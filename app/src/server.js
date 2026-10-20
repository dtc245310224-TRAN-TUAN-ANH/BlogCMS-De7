import express from 'express';
import session from 'express-session';
import {rateLimit} from 'express-rate-limit';
import {randomBytes} from 'node:crypto';
import {appendFileSync,statSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import client from 'prom-client';
import {pool,MySQLStore} from './db.js';
import {hashPassword,verifyPassword,validPost} from './security.js';
import seed from './seed.json' with {type:'json'};

for(const key of ['DB_PASSWORD','SESSION_SECRET','ADMIN_PASSWORD']){
 if(!process.env[key] || process.env[key].length<16) throw Error(`${key} must contain at least 16 characters. Run setup first.`);
}
const app=express();
app.disable('x-powered-by'); app.set('trust proxy',1);
app.use(express.json({limit:'100kb'}));
client.collectDefaultMetrics();
const count=new client.Counter({name:'cms_http_requests_total',help:'HTTP responses',labelNames:['method','route','status']});
const latency=new client.Histogram({name:'cms_http_duration_seconds',help:'HTTP latency',labelNames:['method','route'],buckets:[.01,.05,.1,.5,1,2,5]});
function log(obj){
 const line=JSON.stringify({time:new Date().toISOString(),...obj});
 console.log(line);
 try{
  const f=process.env.LOG_FILE||'/app/logs/app.log';
  try{if(statSync(f).size>10*1024*1024)renameSync(f,f+'.1');}catch(e){if(e.code!=='ENOENT')throw e;}
  appendFileSync(f,line+'\n');
 }catch(e){console.error('log_write_failed',e.code);}
}
app.use((req,res,next)=>{
 const end=latency.startTimer();
 res.on('finish',()=>{const route=req.route?.path||'unmatched';
  count.inc({method:req.method,route,status:res.statusCode});end({method:req.method,route});
  log({event:'http',method:req.method,path:req.path,status:res.statusCode});
 });next();
});
app.use('/api',session({name:'cms.sid',secret:process.env.SESSION_SECRET,store:new MySQLStore(),
 resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge:7200000}}));
app.get('/healthz',async(req,res)=>{await pool.query('SELECT 1');res.json({status:'ok',database:'connected'});});
app.get('/api/session',(req,res)=>{req.session.csrf??=randomBytes(32).toString('hex');res.json({user:req.session.user||null,csrf:req.session.csrf});});
app.use('/api',(req,res,next)=>{
 if(!['GET','HEAD','OPTIONS'].includes(req.method) && (!req.session.csrf||req.get('x-csrf-token')!==req.session.csrf))
  return res.status(403).json({error:'Phiên không hợp lệ. Tải lại trang và thử lại.'});
 next();
});
const authLimiter=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút.'}});
app.post('/api/login',authLimiter,async(req,res,next)=>{
 const {email,password}=req.body;
 if(typeof email!=='string'||typeof password!=='string'||password.length>128)return res.status(400).json({error:'Dữ liệu không hợp lệ'});
 const [rows]=await pool.execute('SELECT id,name,email,role,password_hash FROM users WHERE email=?',[email]);
 const u=rows[0];
 if(!u||!await verifyPassword(password,u.password_hash)){log({event:'login_failed'});return res.status(401).json({error:'Email hoặc mật khẩu không đúng'});}
 req.session.regenerate(err=>{
  if(err)return next(err);
  req.session.user={id:u.id,name:u.name,email:u.email,role:u.role};
  req.session.csrf=randomBytes(32).toString('hex');
  req.session.save(err=>err?next(err):res.json({user:req.session.user,csrf:req.session.csrf}));
 });
});
app.post('/api/logout',(req,res,next)=>req.session.destroy(e=>e?next(e):(res.clearCookie('cms.sid'),res.json({ok:true}))));
async function requireUser(req,res,next){
 if(!req.session.user)return res.status(401).json({error:'Vui lòng đăng nhập'});
 const [users]=await pool.execute('SELECT id,name,email,role FROM users WHERE id=?',[req.session.user.id]);
 if(!users[0])return res.status(401).json({error:'Tài khoản không còn tồn tại'});
 req.user=users[0]; next();
}
function admin(req,res,next){if(req.user.role!=='admin')return res.status(403).json({error:'Cần quyền quản trị'});next();}
app.get('/api/categories',async(req,res)=>{const [r]=await pool.query('SELECT c.*,COUNT(p.id) AS post_count FROM categories c LEFT JOIN posts p ON p.category_id=c.id AND p.status="published" GROUP BY c.id ORDER BY c.name');res.json(r);});
const selectPost='SELECT p.*,c.name AS category,u.name AS author FROM posts p JOIN categories c ON c.id=p.category_id JOIN users u ON u.id=p.author_id';
app.get('/api/posts',async(req,res)=>{
 const page=Math.max(1,Math.min(10000,parseInt(req.query.page)||1)),limit=6;
 let where=' WHERE p.status="published"',params=[];
 if(req.query.q){where+=' AND (p.title LIKE ? OR p.excerpt LIKE ?)';const q=`%${String(req.query.q).slice(0,100)}%`;params.push(q,q);}
 if(req.query.category){where+=' AND p.category_id=?';params.push(Number(req.query.category)||0);}
 const [[{total}]]=await pool.execute('SELECT COUNT(*) AS total FROM posts p'+where,params);
 const [items]=await pool.execute(selectPost+where+` ORDER BY p.published_at DESC,p.id DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`,params);
 res.json({items,total,page,pages:Math.ceil(total/limit)});
});
app.get('/api/posts/:slug',async(req,res)=>{
 const [r]=await pool.execute(selectPost+' WHERE p.slug=? AND p.status="published"',[req.params.slug]);
 if(!r[0])return res.status(404).json({error:'Bài viết không tồn tại'});res.json(r[0]);
});
app.use('/api/admin',requireUser);
app.get('/api/admin/posts',async(req,res)=>{
 const [r]=await pool.execute(selectPost+(req.user.role==='admin'?'':' WHERE p.author_id=?')+' ORDER BY p.updated_at DESC',req.user.role==='admin'?[]:[req.user.id]);res.json(r);
});
app.post('/api/admin/posts',async(req,res)=>{
 if(!validPost(req.body))return res.status(400).json({error:'Tiêu đề tối thiểu 5 ký tự, nội dung tối thiểu 30 ký tự và nguồn phải là URL HTTP(S).'});
 const p=req.body,slug=p.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,140)+'-'+randomBytes(3).toString('hex');
 const [r]=await pool.execute('INSERT INTO posts(title,slug,excerpt,content,category_id,author_id,status,source_url,published_at) VALUES(?,?,?,?,?,?,?,?,IF(?="published",NOW(),NULL))',[p.title.trim(),slug,p.excerpt,p.content,p.category_id,req.user.id,p.status,p.source_url,p.status]);
 res.status(201).json({id:r.insertId,slug});
});
app.put('/api/admin/posts/:id',async(req,res)=>{
 if(!validPost(req.body))return res.status(400).json({error:'Dữ liệu bài viết không hợp lệ'});
 const p=req.body;
 const [r]=await pool.execute('UPDATE posts SET title=?,excerpt=?,content=?,category_id=?,status=?,source_url=?,published_at=IF(?="published",COALESCE(published_at,NOW()),published_at) WHERE id=?'+(req.user.role==='admin'?'':' AND author_id=?'),
 [p.title.trim(),p.excerpt,p.content,p.category_id,p.status,p.source_url,p.status,req.params.id,...(req.user.role==='admin'?[]:[req.user.id])]);
 if(!r.affectedRows)return res.status(404).json({error:'Không tìm thấy bài viết có quyền sửa'});res.json({ok:true});
});
app.delete('/api/admin/posts/:id',async(req,res)=>{
 const [r]=await pool.execute('DELETE FROM posts WHERE id=?'+(req.user.role==='admin'?'':' AND author_id=?'),[req.params.id,...(req.user.role==='admin'?[]:[req.user.id])]);
 if(!r.affectedRows)return res.status(404).json({error:'Không tìm thấy bài viết có quyền xóa'});res.json({ok:true});
});
app.post('/api/admin/categories',admin,async(req,res)=>{
 const name=String(req.body.name||'').trim();
 if(name.length<2||name.length>80)return res.status(400).json({error:'Tên danh mục cần 2–80 ký tự'});
 const [r]=await pool.execute('INSERT INTO categories(name) VALUES(?)',[name]);res.status(201).json({id:r.insertId});
});
app.put('/api/admin/categories/:id',admin,async(req,res)=>{
 const name=String(req.body.name||'').trim();if(name.length<2||name.length>80)return res.status(400).json({error:'Tên danh mục cần 2–80 ký tự'});
 await pool.execute('UPDATE categories SET name=? WHERE id=?',[name,req.params.id]);res.json({ok:true});
});
app.delete('/api/admin/categories/:id',admin,async(req,res)=>{await pool.execute('DELETE FROM categories WHERE id=?',[req.params.id]);res.json({ok:true});});
app.get('/api/admin/users',admin,async(req,res)=>{const [r]=await pool.query('SELECT id,name,email,role,created_at FROM users ORDER BY id');res.json(r);});
app.post('/api/admin/users',admin,async(req,res)=>{
 const {name,email,password,role}=req.body;
 if(typeof name!=='string'||name.length<2||name.length>100||typeof email!=='string'||email.length>190||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||typeof password!=='string'||password.length<16||password.length>128||!['admin','editor'].includes(role))
 return res.status(400).json({error:'Kiểm tra tên, email, vai trò và mật khẩu từ 16–128 ký tự'});
 const [r]=await pool.execute('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)',[name,email,await hashPassword(password),role]);res.status(201).json({id:r.insertId});
});
app.put('/api/admin/users/:id',admin,async(req,res)=>{
 const {name,role,password}=req.body;
 if(typeof name!=='string'||name.length<2||name.length>100||!['admin','editor'].includes(role)|| (password && (typeof password!=='string'||password.length<16||password.length>128)))return res.status(400).json({error:'Dữ liệu tài khoản không hợp lệ'});
 if(Number(req.params.id)===req.user.id && role!=='admin')return res.status(400).json({error:'Không thể tự bỏ quyền quản trị'});
 if(password)await pool.execute('UPDATE users SET name=?,role=?,password_hash=? WHERE id=?',[name,role,await hashPassword(password),req.params.id]);
 else await pool.execute('UPDATE users SET name=?,role=? WHERE id=?',[name,role,req.params.id]);
 await pool.execute("DELETE FROM sessions WHERE JSON_EXTRACT(data,'$.user.id')=?",[Number(req.params.id)]);
 res.json({ok:true});
});
app.delete('/api/admin/users/:id',admin,async(req,res)=>{
 if(Number(req.params.id)===req.user.id)return res.status(400).json({error:'Không thể xóa chính mình'});
 await pool.execute('DELETE FROM users WHERE id=?',[req.params.id]);
 await pool.execute("DELETE FROM sessions WHERE JSON_EXTRACT(data,'$.user.id')=?",[Number(req.params.id)]);
 res.json({ok:true});
});
app.use('/api',(req,res)=>res.status(404).json({error:'API không tồn tại'}));
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
app.use(express.static(publicDir,{index:false}));
app.get(['/', '/bai-viet/:slug','/quan-tri'],(req,res)=>res.sendFile(path.join(publicDir,'index.html')));
app.use((req,res)=>res.status(404).sendFile(path.join(publicDir,'index.html')));
app.use((err,req,res,next)=>{
 log({event:'error',code:err.code||'APP_ERROR',message:err.code?'Database operation failed':err.message});
 if(err.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Tên hoặc email đã tồn tại'});
 if(['ER_ROW_IS_REFERENCED_2','ER_NO_REFERENCED_ROW_2'].includes(err.code))return res.status(409).json({error:'Dữ liệu đang được sử dụng hoặc danh mục không hợp lệ. Hãy chuyển/xóa bài viết liên quan trước.'});
 res.status(err.status||500).json({error:'Không thể xử lý yêu cầu. Kiểm tra dữ liệu hoặc xem log hệ thống.'});
});
async function seedData(){
 const conn=await pool.getConnection();
 try{
 await conn.query("SELECT GET_LOCK('cms_seed',30)");await conn.beginTransaction();
 const [[{n}]]=await conn.query('SELECT COUNT(*) n FROM users');
 if(!n){
  const [u]=await conn.execute('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,"admin")',['Ban biên tập',process.env.ADMIN_EMAIL||'admin@blog.local',await hashPassword(process.env.ADMIN_PASSWORD)]);
  for(const name of ['Container','Hạ tầng web','Dữ liệu','Quan sát hệ thống','Bảo mật'])await conn.execute('INSERT IGNORE INTO categories(name) VALUES(?)',[name]);
  for(const p of seed){
   const [[c]]=await conn.execute('SELECT id FROM categories WHERE name=?',[p.category]);
   await conn.execute('INSERT INTO posts(title,slug,excerpt,content,category_id,author_id,status,source_url,published_at) VALUES(?,?,?,?,?,?,"published",?,NOW())',[p.title,p.slug,p.excerpt,p.content,c.id,u.insertId,p.source_url]);
  }
 }
 await conn.commit();
 }catch(e){await conn.rollback();throw e;}finally{await conn.query("SELECT RELEASE_LOCK('cms_seed')");conn.release();}
}
await seedData();
const cleanup=setInterval(()=>pool.query('DELETE FROM sessions WHERE expires<UNIX_TIMESTAMP()').catch(e=>log({event:'session_cleanup_failed'})),600000);cleanup.unref();
const server=app.listen(3000,'0.0.0.0',()=>log({event:'startup',port:3000}));
const metrics=express();
metrics.get('/metrics',async(req,res)=>{res.type(client.register.contentType).send(await client.register.metrics());});
const metricServer=metrics.listen(9100,'0.0.0.0');
process.on('SIGTERM',()=>{server.close(async()=>{metricServer.close();await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
