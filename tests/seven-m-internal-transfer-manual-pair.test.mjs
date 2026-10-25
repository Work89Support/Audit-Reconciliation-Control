import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sql=fs.readFileSync('supabase/20261025_7m_internal_transfer_manual_pair.sql','utf8');
for(const guard of [
  "mode in ('same','cross','internal')",
  'validate_7m_internal_transfer_pair',
  "upper(a.company) not in ('7M','UFABET7M')",
  'a.account=b.account',
  'a.direction=b.direction',
  'a.system_amount is distinct from b.bank_amount',
  'seconds_apart>300',
  "manual_pair_source_ready(a.id,'bo')",
  "manual_pair_source_ready(b.id,'stm')",
  'manual_7m_internal_transfer_close',
]) assert.ok(sql.includes(guard),`missing SQL guard: ${guard}`);
assert.doesNotMatch(sql,/update public\.exceptions set (system_amount|bank_amount)=/i);

const code=fs.readFileSync('manual-pairing.js','utf8');
const client=fs.readFileSync('supabase.js','utf8');
const app=fs.readFileSync('app.js','utf8');
assert.match(client,/rpc\/close_internal_transfer_pair/);
assert.match(client,/closeInternalTransferPair/);
assert.match(app,/btnInternalTransferPair/);
const nodes={},calls=[];
const node=id=>nodes[id]??={value:'',checked:false,files:[],disabled:false,textContent:'',innerHTML:'',closest:s=>node(s),querySelector:s=>node(s)};
const stm={id:'stm-case',code:'7M-001',company:'UFABET7M',business_date:'2026-10-25',occurred_at:'10:02:00',direction:'ฝาก',account:'TMN-1',currency:'THB',ex_type:'missing_bo',bank_amount:7000,stm_raw:'รับโอนเงิน 7,000',status:'open'};
const bo={id:'bo-case',code:'7M-002',company:'UFABET7M',business_date:'2026-10-25',occurred_at:'10:00:00',direction:'ถอน',account:'1953583301',currency:'THB',ex_type:'missing_stm',system_amount:7000,bo_raw:'โยกเงินเข้า รับยอด TMN 7,000',status:'open'};
const wrongBo={...bo,id:'wrong-bo-case',code:'7M-003',account:'OTHER-BO',system_amount:6000};
let html='';
const context={state:{dataset:'production',role:'lead'},DB:{companies:['UFABET7M'],exceptions:[]},crypto:{randomUUID:()=> 'internal-request'},h:String,money:n=>Number(n).toFixed(2),$:s=>node(s.slice(1)),caseLabel:e=>e.id,companyMaster:()=>['UFABET7M'],canAccessCompany:()=>true,toast:m=>calls.push(['toast',m]),openModal:(title,body)=>{calls.push(['title',title]);html=body;node('pairCompany').value='UFABET7M';node('pairDate').value='2026-10-25';},closeModal:()=>{},render:()=>{},openException:async()=>{},Sb:{signedIn:()=>true,authUser:()=>({id:'lead'}),exceptionDetail:async id=>id==='bo-case'?bo:stm,manualPairCandidates:async()=>[wrongBo,bo],pendingManualPairs:async()=>[],submitManualPair:async()=>{throw Error('must direct close')},closeInternalTransferPair:async payload=>{calls.push(['close',payload]);return {id:payload.p_id,status:'approved'};}}};
vm.createContext(context);vm.runInContext(code+';this.api=ManualPairing;',context);
await context.api.open({dbId:'stm-case',id:'7M-001',company:'UFABET7M',date:'2026-10-25',direction:'ฝาก',type:'missing_bo',status:'open'},'internal');
assert.equal(calls[0][1],'จับคู่ข้ามบัญชีภายในบริษัท');
assert.match(html,/คนละบัญชี/);
assert.match(html,/บัญชี BO/);
await node('pairSearch').onclick({target:node('pairSearch')});
assert.equal(node('pairBoAccount').value,'1953583301');
assert.match(node('pairCandidate').innerHTML,/bo-case/);
assert.doesNotMatch(node('pairCandidate').innerHTML,/wrong-bo-case/);
node('pairCandidate').value='bo-case';node('pairCandidate').onchange();
assert.equal(node('pairSubmit').textContent,'ปิดทั้งสองเคส');
node('pairReasonType').value='internal_transfer';node('pairChecked').checked=true;
await node('pairSubmit').onclick({target:node('pairSubmit')});
assert.equal(calls.filter(c=>c[0]==='close').length,1);
assert.equal(calls.find(c=>c[0]==='close')[1].p_mode,'internal');

console.log('7M manual internal-transfer pairing: exact guarded direct-close path passed');
