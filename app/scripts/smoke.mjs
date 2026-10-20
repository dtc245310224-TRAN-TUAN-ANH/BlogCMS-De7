import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://nginx:8080';
const email=process.env.ADMIN_EMAIL||'admin@blog.local',password=process.env.ADMIN_PASSWORD;
if(!password)throw Error('ADMIN_PASSWORD is required');
let checks=0;const ok=(condition,name)=>{assert.ok(condition,name);checks++;console.log('PASS '+name);};
function actor(){
 let cookie='',csrf='';
 return {async call(path,method='GET',body,withCsrf=true){
  const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(withCsrf?{'X-CSRF-Token':csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
  let data;try{data=await res.json();}catch{data={};}
  if(data.csrf)csrf=data.csrf;
  return {status:res.status,data,headers:res.headers};
 }};
}
const anonymous=actor(),admin=actor(),editor=actor();let postId,categoryId,userId;
try{
 let r=await anonymous.call('/healthz');ok(r.status===200&&r.data.database==='connected','MySQL health through Nginx');
 ok(r.headers.get('x-frame-options')==='DENY'&&!!r.headers.get('content-security-policy'),'Nginx security headers');
 r=await anonymous.call('/api/posts');ok(r.data.total>=6,'published articles seeded');
 r=await anonymous.call('/api/posts?q=MySQL');ok(r.data.total>=1&&r.data.items.every(p=>p.title.includes('MySQL')||p.excerpt.includes('MySQL')),'search');
 r=await anonymous.call('/api/admin/posts');ok(r.status===401,'anonymous admin access denied');
 await anonymous.call('/api/session');
 r=await anonymous.call('/api/login','POST',{email,password},false);ok(r.status===403,'CSRF missing rejected');
 await admin.call('/api/session');
 r=await admin.call('/api/login','POST',{email,password});ok(r.status===200&&r.data.user.role==='admin','admin login');
 r=await admin.call('/api/admin/categories','POST',{name:'QA '+Date.now()});ok(r.status===201,'category create');categoryId=r.data.id;
 const post={title:'QA Test bài viết',excerpt:'Nội dung thử nghiệm tự động',content:'Nội dung thử nghiệm kiểm tra chức năng CMS, dài hơn ba mươi ký tự.',category_id:categoryId,status:'draft',source_url:'https://docs.docker.com/'};
 r=await admin.call('/api/admin/posts','POST',post);ok(r.status===201,'draft create');postId=r.data.id;const slug=r.data.slug;
 r=await anonymous.call('/api/posts/'+slug);ok(r.status===404,'draft hidden from public');
 r=await admin.call('/api/admin/posts/'+postId,'PUT',{...post,status:'published'});ok(r.status===200,'publish post');
 r=await anonymous.call('/api/posts/'+slug);ok(r.status===200&&r.data.title===post.title,'published visible');
 r=await admin.call('/api/admin/categories/'+categoryId,'DELETE');ok(r.status===409,'foreign key protects category');
 r=await admin.call('/api/admin/posts/'+postId,'PUT',{...post,source_url:'javascript:alert(1)'});ok(r.status===400,'unsafe source rejected');
 const editorEmail='qa-'+Date.now()+'@example.test',editorPassword='QA-only-password-strong-123456789';
 r=await admin.call('/api/admin/users','POST',{name:'QA Editor',email:editorEmail,password:editorPassword,role:'editor'});ok(r.status===201,'user create');userId=r.data.id;
 await editor.call('/api/session');r=await editor.call('/api/login','POST',{email:editorEmail,password:editorPassword});ok(r.status===200,'editor login');
 r=await editor.call('/api/admin/posts/'+postId,'PUT',post);ok(r.status===404,'editor cannot change another author');
 r=await editor.call('/api/admin/users');ok(r.status===403,'editor cannot list users');
 r=await editor.call('/api/admin/categories','POST',{name:'Forbidden'});ok(r.status===403,'editor cannot manage categories');
 r=await admin.call('/api/admin/users/'+userId,'PUT',{name:'QA Updated',role:'editor',password:'QA-only-changed-password-123456789'});ok(r.status===200,'user update');
 r=await editor.call('/api/admin/posts');ok(r.status===401,'password update invalidates sessions');
 r=await admin.call('/api/admin/categories/'+categoryId,'PUT',{name:'QA Renamed '+Date.now()});ok(r.status===200,'category update');
 r=await anonymous.call('/api/posts?q='+encodeURIComponent("' OR 1=1 --"));ok(r.status===200&&r.data.total===0,'SQL injection treated as text');
 r=await anonymous.call('/metrics');ok(r.status===404,'metrics not exposed through public proxy');
 r=await anonymous.call('/trang-khong-ton-tai');ok(r.status===404,'missing route produces 404 log');
}finally{
 if(postId)ok((await admin.call('/api/admin/posts/'+postId,'DELETE')).status===200,'delete test post');
 if(categoryId)ok((await admin.call('/api/admin/categories/'+categoryId,'DELETE')).status===200,'delete test category');
 if(userId)ok((await admin.call('/api/admin/users/'+userId,'DELETE')).status===200,'delete test user');
}
let r=await admin.call('/api/logout','POST');ok(r.status===200,'logout');
r=await admin.call('/api/admin/posts');ok(r.status===401,'logged out session denied');
console.log(JSON.stringify({result:'PASS',checks,time:new Date().toISOString()}));
