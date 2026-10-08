import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
let clock = 100000, calls = 0, fail = false, release;
class Clock extends Date { static now() { return clock; } }
const saved = new Map([['audit-sb-session', JSON.stringify({access_token:'test',refresh_token:'test',expires_at:999999,user:{id:'a'}})]]);
const context = {window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'public'}},persist(){}},
  localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
  AbortController,setTimeout,clearTimeout,Date:Clock,console,
  fetch:async (url, options) => {
    calls++;
    if (release) await new Promise(r=>{release=r;});
    if (fail) return new Response('{}',{status:522});
    if (url.includes('/storage/')) return new Response(new Uint8Array([1,2,3]));
    return new Response(JSON.stringify([{id:'mail',source_files:[{id:'file'}]}]));
  }};
vm.runInNewContext(source, context);
const sb = context.window.Sb;
await sb.restore();
const query={from:'2026-10-07',to:'2026-10-07',company:'FR8'};
const rows=await Promise.all(Array.from({length:10},()=>sb.batches(query)));
assert.equal(calls,1,'same-scope requests coalesced');
rows[0][0].source_files[0].id='changed';
assert.equal((await sb.batches(query))[0].source_files[0].id,'file','snapshot is immutable to callers');
assert.equal(calls,1);
assert.equal(sb.fileSnapshotInfo(query).updatedAt,clock);
await sb.batches({...query,company:'3XB'}); assert.equal(calls,2);
await sb.batches({...query,force:true}); assert.equal(calls,3);
clock+=60001;
await sb.batches(query); assert.equal(calls,4,'expired snapshot reloads');
fail=true;
await assert.rejects(()=>sb.batches({...query,force:true}));
assert.equal(sb.fileSnapshotInfo(query).updatedAt,clock,'failed reload does not replace good snapshot');
fail=false;
const before=calls;
const buffers=await Promise.all([sb.download('file.pdf'),sb.download('file.pdf')]);
assert.equal(calls,before+1);
new Uint8Array(buffers[0])[0]=9;
assert.equal(new Uint8Array(await sb.download('file.pdf'))[0],1);
await sb.post('test',[]);
assert.equal(sb.fileSnapshotInfo(query),null,'writes invalidate snapshots');
await sb.batches(query);
sb.signOut();
assert.equal(sb.fileSnapshotInfo(query),null);
await assert.rejects(()=>sb.batches(query),/ล็อกอิน/);
await assert.rejects(()=>sb.download('file.pdf'),/ล็อกอิน/);
// Logout while loading must not repopulate or return the previous user's data.
saved.set('audit-sb-session',JSON.stringify({access_token:'test',refresh_token:'test',expires_at:999999,user:{id:'b'}}));
await sb.restore(); release=true;
const pending=sb.batches(query);
await new Promise(r=>setTimeout(r,0));
sb.signOut(); release(); release=null;
await assert.rejects(()=>pending,/ผู้ใช้หรือข้อมูลเปลี่ยน/);
assert.equal(sb.fileSnapshotInfo(query),null);
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.match(app,/Sb\.batches\(\{ from, to, company: state\.filters\.company, force \}\)/);
assert.match(app,/สแนปช็อตทะเบียนไฟล์ในแท็บนี้/);
console.log('file snapshot tests passed');
