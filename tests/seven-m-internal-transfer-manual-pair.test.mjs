import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sql=fs.readFileSync('supabase/20261025_7m_internal_transfer_same_account_pair.sql','utf8');
for(const guard of [
  'validate_7m_internal_transfer_pair',
  "upper(a.company) not in ('7M','UFABET7M')",
  "same_account and b.direction='ถอน'",
  'ปรับ(ยอด|เงิน)?ออก',
  "same_account and b.direction='ฝาก'",
  'ปรับ(ยอด|เงิน)?เข้า',
  'a.system_amount is distinct from b.bank_amount',
  'seconds_apart>300',
  "manual_pair_source_ready(a.id,'bo')",
  "manual_pair_source_ready(b.id,'stm')",
  'manual-seven-m-internal-transfer-same-account',
]) assert.ok(sql.includes(guard),`missing SQL guard: ${guard}`);
const latestLineageSql=fs.readFileSync('supabase/20261025_manual_pair_latest_primary_lineage.sql','utf8');
assert.match(latestLineageSql,/manual_pair_scoped_source_ready\(a\.id,''BO''\)/);
assert.match(latestLineageSql,/manual_pair_scoped_source_ready\(b\.id,''STM''\)/);
assert.match(latestLineageSql,/reviewed_pdf_recoveries/);
assert.doesNotMatch(sql,/update public\.exceptions set (system_amount|bank_amount)=/i);
const clarifyingSql=fs.readFileSync('supabase/20261025_7m_internal_transfer_clarifying_pair.sql','utf8');
assert.match(clarifyingSql,/p_mode=''internal'' and a\.status in\(''open'',''clarifying'',''answered''\)/);
assert.match(clarifyingSql,/p\.mode=''internal'' and old\.status in \(''open'',''clarifying'',''answered''\)/);
assert.match(clarifyingSql,/manual_pair_internal_source_key\(a,''BO''\)/);
assert.match(clarifyingSql,/source_rows',lower\(p_side\),'fileId'/);
assert.match(clarifyingSql,/source_rows',lower\(p_side\),'row'/);
assert.match(clarifyingSql,/pair_row\.mode='internal'/);
assert.match(clarifyingSql,/No case rows are changed by this migration/);
const finalPolicySql=fs.readFileSync('supabase/20261026_7m_internal_transfer_same_account_only.sql','utf8');
assert.match(finalPolicySql,/a\.account is distinct from b\.account/);
assert.match(finalPolicySql,/a\.direction is distinct from b\.direction/);
assert.match(finalPolicySql,/Cross-account A-to-B remains evidence only/);
assert.doesNotMatch(finalPolicySql,/manual-seven-m-internal-transfer-cross-account/);

const code=fs.readFileSync('manual-pairing.js','utf8');
const client=fs.readFileSync('supabase.js','utf8');
assert.match(client,/rpc\/close_internal_transfer_pair/);
assert.match(code,/sameAccountAdjustmentMatches/);
assert.doesNotMatch(code,/internalTransferDirectionMatches/,'cross-account relation must not close cases');

async function runScenario({direction,stmRaw,boRaw,wrongRaw,boStatus='open'}){
  const nodes={},calls=[];
  const node=id=>nodes[id]??={value:'',checked:false,files:[],disabled:false,textContent:'',innerHTML:'',closest:s=>node(s),querySelector:s=>node(s),addEventListener:(event,handler)=>{if(event==='change')node(id).onchange=handler;}};
  const stm={id:`stm-${direction}`,code:`7M-STM-${direction}`,company:'UFABET7M',business_date:'2026-10-25',occurred_at:'10:02:00',direction,account:'TMN-1',currency:'THB',ex_type:'missing_bo',bank_amount:7000,stm_raw:stmRaw,status:'open'};
  const bo={id:`bo-${direction}`,code:`7M-BO-${direction}`,company:'UFABET7M',business_date:'2026-10-25',occurred_at:'10:00:00',direction,account:'TMN-1',currency:'THB',ex_type:'missing_stm',system_amount:7000,bo_raw:boRaw,status:boStatus,response_text:'เก็บคำชี้แจงเดิม',clarification_file_id:'original-file'};
  const wrongBo={...bo,id:`wrong-bo-${direction}`,code:`7M-WRONG-${direction}`,bo_raw:wrongRaw};
  const crossBo={...bo,id:`cross-bo-${direction}`,code:`7M-CROSS-${direction}`,account:'TMN-2'};
  let html='',candidateArgs=null;
  const byId=new Map([[stm.id,stm],[bo.id,bo],[wrongBo.id,wrongBo],[crossBo.id,crossBo]]);
  const context={state:{dataset:'production',role:'lead'},DB:{companies:['UFABET7M'],exceptions:[]},crypto:{randomUUID:()=>`request-${direction}`},h:String,money:n=>Number(n).toFixed(2),$:s=>node(s.slice(1)),caseLabel:e=>e.id,companyMaster:()=>['UFABET7M'],canAccessCompany:()=>true,toast:m=>calls.push(['toast',m]),openModal:(title,body)=>{calls.push(['title',title]);html=body;node('pairCompany').value='UFABET7M';node('pairDate').value='2026-10-25';},closeModal:()=>{},render:()=>{},openException:async()=>{},Sb:{signedIn:()=>true,authUser:()=>({id:'lead'}),exceptionDetail:async id=>byId.get(id),manualPairCandidates:async(...args)=>{candidateArgs=args;return [wrongBo,crossBo,bo];},pendingManualPairs:async()=>[],submitManualPair:async()=>{throw Error('must direct close')},closeInternalTransferPair:async payload=>{calls.push(['close',payload]);return {id:payload.p_id,status:'approved'};}}};
  vm.createContext(context);vm.runInContext(code+';this.api=ManualPairing;',context);
  await context.api.open({dbId:stm.id,id:stm.code,company:'UFABET7M',date:'2026-10-25',direction,type:'missing_bo',status:'open'},'internal');
  assert.equal(calls[0][1],'จับคู่รายการภายในบริษัท');
  assert.match(html,/ปิดได้เฉพาะ 7M บัญชีเดียวกัน/);
  assert.match(html,/ความสัมพันธ์ A → B เก็บเป็นหลักฐานได้แต่ใช้ปิดแทนกันไม่ได้/);
  await node('pairSearch').onclick({target:node('pairSearch')});
  assert.equal(candidateArgs[3],null,'internal search must inspect both directions');
  assert.match(node('pairBoAccount').innerHTML,/TMN-1/,'same STM and BO account must be selectable');
  assert.doesNotMatch(node('pairBoAccount').innerHTML,/TMN-2/,'cross-account relation must not be offered as a closing pair');
  node('pairBoAccount').value='TMN-1';node('pairBoAccount').onchange();
  assert.match(node('pairCandidate').innerHTML,new RegExp(bo.id));
  assert.doesNotMatch(node('pairCandidate').innerHTML,new RegExp(wrongBo.id),'opposite adjustment semantic must be rejected');
  assert.match(node('pairCandidate').innerHTML,new RegExp(direction),'candidate must show direction');
  node('pairCandidate').value=bo.id;node('pairCandidate').onchange();
  assert.equal(node('pairSubmit').textContent,'ปิดทั้งสองเคส');
  if(boStatus!=='open'){
    assert.match(node('pairCandidate').innerHTML,/ปิดได้เมื่อคู่ผ่านกฎ 7M/);
    assert.match(node('pairCompare').innerHTML,/เก็บคำชี้แจง ไฟล์ และประวัติเดิมไว้ใน Audit/);
  }
  node('pairReasonType').value='internal_transfer';node('pairChecked').checked=true;
  await node('pairSubmit').onclick({target:node('pairSubmit')});
  assert.equal(calls.filter(call=>call[0]==='close').length,1);
  assert.equal(bo.response_text,'เก็บคำชี้แจงเดิม');
  assert.equal(bo.clarification_file_id,'original-file');
}

await runScenario({direction:'ถอน',stmRaw:'โอนเงินออก 7,000',boRaw:'ปรับยอดออก โอนเงินออก 7,000',wrongRaw:'ปรับยอดเข้า 7,000'});
await runScenario({direction:'ฝาก',stmRaw:'รับโอนเงินเข้า 7,000',boRaw:'ปรับยอดเข้า รับเงินเข้า 7,000',wrongRaw:'ปรับยอดออก 7,000'});
await runScenario({direction:'ฝาก',stmRaw:'รับโอนเงินเข้า 7,000',boRaw:'โยกเงินเข้า 7,000',wrongRaw:'โยกเงินออก 7,000',boStatus:'clarifying'});

console.log('7M same-account pairing: STM out to BO adjust out and STM in to BO adjust in passed');
