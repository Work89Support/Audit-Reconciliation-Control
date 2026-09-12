import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8');
const start=source.indexOf('  async function damages('),end=source.indexOf('  async function evidenceFiles(',start);
const calls=[];
const all=Array.from({length:1201},(_,i)=>({id:String(i)}));
const damages=new Function('json',source.slice(start,end)+';return damages;')(async url=>{
  calls.push(url);const q=new URL(url,'https://example.test').searchParams;
  const offset=Number(q.get('offset')),limit=Math.min(100,Number(q.get('limit')));
  return all.slice(offset,offset+limit);
});
const rows=await damages({from:'2026-09-01',to:'2026-09-12',company:'FR8'});
assert.equal(rows.length,1201);
assert.equal(new Set(rows.map(r=>r.id)).size,1201);
assert.ok(calls.every(url=>url.includes('company=eq.FR8')&&url.includes('business_date=gte.2026-09-01')));
assert.equal((await damages({limit:200})).length,200);
console.log('Damage pagination: server cap, date/company scope and requested limit passed');
