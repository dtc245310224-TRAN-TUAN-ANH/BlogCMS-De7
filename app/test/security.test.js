import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,validSource,validPost} from '../src/security.js';
test('scrypt passwords are salted and verified without plaintext storage',async()=>{
 const p='Test-only-password-12345';
 const a=await hashPassword(p), b=await hashPassword(p);
 assert.notEqual(a,b);assert.ok(await verifyPassword(p,a));
 assert.equal(await verifyPassword('wrong',a),false);
 assert.equal(await verifyPassword(p,'broken'),false);
});
test('source links reject script and data schemes',()=>{
 for(const v of ['javascript:alert(1)','data:text/html,x','//example.com','bad'])assert.equal(validSource(v),false);
 assert.equal(validSource('https://docs.docker.com/'),true);
});
test('post validation rejects unsafe or incomplete content',()=>{
 const p={title:'Bài viết thử',excerpt:'Tóm tắt',content:'Nội dung kiểm thử dài hơn ba mươi ký tự.',status:'published',category_id:1,source_url:'https://docs.docker.com'};
 assert.ok(validPost(p));assert.equal(validPost({...p,status:'admin'}),false);
 assert.equal(validPost({...p,source_url:'javascript:alert(1)'}),false);
 assert.equal(validPost({...p,category_id:-1}),false);
});
