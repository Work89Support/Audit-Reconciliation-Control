import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8');
const fresh={access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'test-user',email:'test@example.invalid'}};
function setup(saved,fetch){
 const data=new Map([['audit-sb-session',JSON.stringify(saved)]]);
 const context={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'test-public'}},persist(){}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},fetch,AbortController,clearTimeout,setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?5:ms)};
 vm.runInNewContext(source,context);return {sb:context.window.Sb,data};
}
let blocked=true,calls=0;
const access=setup(fresh,async()=>{calls++;return {ok:true,status:200,text:()=>blocked?new Promise(()=>{}):Promise.resolve('[{"active":true}]')};});
await access.sb.restore();
await assert.rejects(access.sb.myAccess(),/ข้อมูลตอบกลับค้าง/);
assert.equal(access.sb.signedIn(),true);assert.ok(access.data.has('audit-sb-session'));
blocked=false;assert.equal((await access.sb.myAccess())[0].active,true);assert.equal(calls,2);
// Refresh headers arrive but its body never completes. Retain session and
// respect cooldown; never use the expired access token to bypass the failure.
let refreshes=0;
const renewal=setup({...fresh,expires_at:1},async url=>{assert.ok(url.includes('/auth/v1/token'));refreshes++;return {ok:true,status:200,json:()=>new Promise(()=>{})};});
assert.equal(await renewal.sb.restore(),true);
await assert.rejects(renewal.sb.myAccess(),/พักคำขอ/);
assert.equal(refreshes,1);assert.ok(renewal.data.has('audit-sb-session'));
console.log('Auth response bodies: bounded stalled access/refresh, session retained, retry recovers, no expired-token bypass passed (mock transport).');
