import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8');
const companies=['3XB','MC8','MR9','PS8','UR9','AT4','FR8','SK8','UFABET7M'];
const calls=[];let fixture=[],failPage=false,duplicatePage=false,malformed=false;
const session={access_token:'test-token',expires_at:Date.now()/1000+3600,user:{id:'test-user'}};
const context={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'test-key'}},persist(){}},
  localStorage:{getItem:k=>k==='audit-sb-session'?JSON.stringify(session):null,setItem(){},removeItem(){}},
  AbortController,setTimeout,clearTimeout,Date,console,
  fetch:async(url,opts)=>{
    assert.match(url,/\/rpc\/audit_current_cases_scoped\?select=\*$/);
    assert.equal(opts.method,'POST');assert.equal(opts.headers['Content-Type'],'application/json');
    const args=JSON.parse(opts.body);calls.push({url,args});
    if(failPage&&args.p_offset)throw new Error('page two unavailable');
    const offset=duplicatePage?0:args.p_offset;
    return new Response(JSON.stringify(malformed?{}:fixture.slice(offset,offset+args.p_limit)),{status:200});
  }};
vm.runInNewContext(source,context);const client=context.window.Sb;await client.restore();
for(const company of companies)for(const origin of ['manual','system'])for(const type of ['missing_bo','missing_stm'])for(const direction of ['ฝาก','ถอน']){
  const base={company,business_date:'2026-10-17',status:'open',ex_type:type,direction,system_amount:100,bank_amount:null,manual_pair_id:null,superseded_by_exception_id:null,
    run_id:origin==='manual'?null:'accepted-system-run',customer_details:{...(origin==='manual'?{manual_primary_id:'accepted-primary'}:{}),account_review_hold_id:'keep-original'},history:['original']};
  fixture=Array.from({length:1250},(_,i)=>({...base,status:['open','clarifying','answered'][i%3],id:`${origin}-${i}`}));
  fixture.push({...base,id:'closed',status:'closed'},{...base,id:'reserved',manual_pair_id:'pending-request'},
    {...base,id:'closure-pending',status:'answered',case_closure_request_id:'keep-request'},{...base,id:'approved',status:'approved'},
    {...base,id:'superseded',superseded_by_exception_id:'new-case'},{...base,id:'foreign',company:'FOREIGN'},
    {...base,id:'other-date',business_date:'2026-10-16'},{...base,id:'other-direction',direction:direction==='ฝาก'?'ถอน':'ฝาก'},
    {...base,id:'other-type',ex_type:type==='missing_bo'?'missing_stm':'missing_bo'});
  const before=JSON.stringify(fixture),start=calls.length;
  const result=await client.manualPairCandidates(company,'2026-10-17',type,direction);
  assert.equal(result.length,1250,company+' '+origin+' all pages, not 201');
  assert.equal(result.at(-1).id,`${origin}-1249`);
  assert.deepEqual(calls.slice(start).map(c=>c.args.p_offset),[0,1000]);
  assert.ok(calls.slice(start).every(c=>c.args.p_company===company&&c.args.p_from==='2026-10-17'&&c.args.p_to==='2026-10-17'));
  assert.equal(JSON.stringify(fixture),before,'read only: amounts, cases, history and holds unchanged');
}
// A full first page can contain zero eligible rows: continue from raw page size.
fixture=Array.from({length:1000},(_,i)=>({id:`closed-${i}`,company:'FR8',business_date:'2026-10-17',status:'closed'}));
fixture.push({id:'last-page-target',company:'FR8',business_date:'2026-10-17',status:'open',ex_type:'missing_bo',direction:'ฝาก'});
assert.equal((await client.manualPairCandidates('FR8','2026-10-17','missing_bo','ฝาก'))[0].id,'last-page-target');
failPage=true;await assert.rejects(client.manualPairCandidates('FR8','2026-10-17','missing_bo'),/page two unavailable/);failPage=false;
duplicatePage=true;await assert.rejects(client.manualPairCandidates('FR8','2026-10-17','missing_bo'),/เปลี่ยนระหว่างค้นหา/);duplicatePage=false;
malformed=true;await assert.rejects(client.manualPairCandidates('FR8','2026-10-17','missing_bo'),/รูปแบบผลหลัก/);malformed=false;
fixture=[];assert.equal((await client.manualPairCandidates('UR9','2026-10-17','missing_stm')).length,0);
await assert.rejects(client.manualPairCandidates('FR8','2026-10-17','amount_diff'));
const ui=fs.readFileSync(new URL('../manual-pairing.js',import.meta.url),'utf8');
assert.doesNotMatch(ui,/candidates\.slice\(0,200\)/);
assert.match(ui,/pairUploadEvidence/);assert.match(ui,/ยังไม่ส่งคำขอและไม่ปิดเคส/);
assert.match(ui,/uploadCaseEvidence\(e.dbId,file,message=>/);
console.log('PASS read-only manual pairing search: all nine companies, manual null-run/system primaries, both sides/directions, 1250 candidates, sparse page, retryable error, no partial success, closed/reserved/history/foreign exclusion; immutable amounts/history/holds.');
