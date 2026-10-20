import mysql from 'mysql2/promise';
import session from 'express-session';
export const pool=mysql.createPool({
 host:process.env.DB_HOST||'mysql',user:'cms_app',password:process.env.DB_PASSWORD,
 database:'blogcms',waitForConnections:true,connectionLimit:10,charset:'utf8mb4',timezone:'Z'
});
export class MySQLStore extends session.Store{
 get(sid,cb){pool.execute('SELECT data FROM sessions WHERE sid=? AND expires>UNIX_TIMESTAMP()',[sid])
  .then(([r])=>cb(null,r[0]?(typeof r[0].data==='string'?JSON.parse(r[0].data):r[0].data):null)).catch(cb);}
 set(sid,data,cb){const exp=Math.floor(Date.now()/1000)+(data.cookie.maxAge||7200000)/1000;
  pool.execute('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),expires=VALUES(expires)',[sid,JSON.stringify(data),Math.floor(exp)]).then(()=>cb?.()).catch(e=>cb?.(e));}
 destroy(sid,cb){pool.execute('DELETE FROM sessions WHERE sid=?',[sid]).then(()=>cb?.()).catch(e=>cb?.(e));}
}
