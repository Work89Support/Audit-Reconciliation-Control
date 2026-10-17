import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('supabase.js','utf8');const calls=[];
const ctx={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'public-test'}},persist(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},AbortController,setTimeout,clearTimeout,fetch:async(url,opts={})=>{
 calls.push({url,opts});assert.match(url,/\/rpc\/audit_current_cases_scoped\?select=\*/);assert.equal(opts.method,'POST');
 const p=JSON.parse(opts.body);return {ok:true,status:200,text:async()=>JSON.stringify([{id:p.p_company+'-manual',run_id:null,company:p.p_company,status:'open'}])};
}};vm.runInNewContext(source,ctx);
for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']){
 const rows=await ctx.window.Sb.currentExceptions({company,from:'2026-10-16',to:'2026-10-16',limit:10000});
 assert.equal(rows.length,1);assert.equal(rows[0].run_id,null);assert.equal(rows[0].company,company);
 const body=JSON.parse(calls.at(-1).opts.body);assert.equal(body.p_company,company);assert.equal(body.p_from,'2026-10-16');assert.equal(body.p_to,'2026-10-16');assert.equal(body.p_limit,1000);assert.equal(body.p_offset,0);
}
assert.equal(calls.length,9,'one read per next-case scope, no job-run precondition or business writes');
console.log('PASS manual next-case transport: all nine companies include null-base primary cases through the same scoped current-case reader; read-only.');
