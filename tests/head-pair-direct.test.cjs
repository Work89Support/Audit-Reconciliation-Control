const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('manual-pairing.js','utf8');
async function test(role,fail=false){
 const nodes={},calls=[];const node=id=>nodes[id]??={value:'',checked:false,files:[],closest:s=>node(s),querySelector:s=>node(s)};
 const row={id:'case',company:'UFABET7M',business_date:'2026-10-04',ex_type:'amount_diff',status:'open',direction:'ถอน',currency:'THB',system_amount:44,bank_amount:43.88,bo_raw:'BO original 44',stm_raw:'STM original 43.88'};
 const c={state:{dataset:'production',role},DB:{exceptions:[]},crypto:{randomUUID:()=> 'stable-id'},$:s=>node(s.slice(1)),h:String,money:n=>Number(n).toFixed(2),companyMaster:()=>['UFABET7M'],canAccessCompany:()=>true,caseLabel:()=> 'EX-3009',toast:m=>calls.push(['toast',m]),openModal:()=>{},closeModal:()=>{},render:()=>{},openException:()=>calls.push(['openException']),showCaseSubmissionReceipt:()=>{},Sb:{signedIn:()=>true,authUser:()=>({id:'head'}),exceptionDetail:async()=>row,pendingManualPairs:async()=>[],submitManualPair:async b=>{calls.push(['submit',b]);return {id:b.p_id}},closeManualPair:async b=>{calls.push(['close',b]);if(fail)throw new Error('DB failed');return {id:b.p_id,status:'approved'}}}};
 vm.createContext(c);vm.runInContext(code+';this.api=ManualPairing;',c);
 await c.api.open({dbId:'case',id:'EX-3009',company:row.company,date:row.business_date,type:'amount_diff',status:'open'},'same');
 assert.equal(node('pairSubmit').textContent,role==='monitor'?'ส่งให้หัวหน้าทีมอนุมัติ':'ปิดเคส');
 node('pairReasonType').value='small_difference';node('pairChecked').checked=true;
 await node('pairSubmit').onclick({target:node('pairSubmit')});
 assert.equal(calls.filter(x=>x[0]===(role==='monitor'?'submit':'close')).length,1);
 if(role!=='monitor')assert.equal(calls.filter(x=>x[0]==='openException').length,0,'stay on current approval page');
 if(fail){await node('pairSubmit').onclick({target:node('pairSubmit')});assert.equal(calls.filter(x=>x[0]==='close')[1][1].p_id,'stable-id');}
}
(async()=>{await test('lead');await test('admin');await test('monitor');await test('lead',true);console.log('Head direct pairing: labels, atomic endpoint, employee queue, current-page retention and stable retry passed');})().catch(e=>{console.error(e);process.exitCode=1});
