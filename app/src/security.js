import {scrypt, randomBytes, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function hashPassword(password){
 const salt=randomBytes(16).toString('hex');
 const key=await derive(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});
 return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password,stored){
 if(!stored || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored))return false;
 const [salt,hex]=stored.split(':');
 const key=await derive(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});
 return timingSafeEqual(key,Buffer.from(hex,'hex'));
}
export function validSource(url){
 if(!url)return true;
 try {return ['https:','http:'].includes(new URL(url).protocol);}catch{return false;}
}
export function validPost(p){
 return typeof p.title==='string' && p.title.trim().length>=5 && p.title.length<=180
 && typeof p.excerpt==='string' && p.excerpt.length<=500
 && typeof p.content==='string' && p.content.trim().length>=30 && p.content.length<=50000
 && ['draft','published'].includes(p.status) && Number.isInteger(Number(p.category_id))
 && Number(p.category_id)>0 && typeof p.source_url==='string' && p.source_url.length<=1000
 && validSource(p.source_url);
}
