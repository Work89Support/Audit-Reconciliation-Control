import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const context=vm.createContext({console,performance});
const moduleSource=process.env.MONOPAY_TEST_WORKFLOW
 ? (()=>{const w=JSON.parse(fs.readFileSync(process.env.MONOPAY_TEST_WORKFLOW));const code=w.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน').parameters.jsCode;return ['Registry','Formats','Engine'].map(name=>{const start=code.indexOf('const '+name+' ='),end=code.indexOf('\n})();',start);assert.ok(start>=0&&end>start);return code.slice(start,end+7);}).join('\n');})()
 : ['registry.js','formats.js','engine.js'].map(f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8')).join('\n');
vm.runInContext(moduleSource+'\nglobalThis.api={Registry,Formats,Engine};',context);
const {Registry,Formats,Engine}=context.api;
const date='2026-11-19', label='พร้อมเพย์-MNP(monopay)(P2P)';
const headers=['id','amount','provider','status','requestTime','fee','reference','customerId','realAmount','paymentTime','expiredTime','transactionId','updateTime','_id'];
const row=o=>headers.map(h=>o[h]??'');
const base={id:'synthetic-order',amount:900,provider:'monopay',status:'successed',requestTime:date+' 12:00:00',fee:1,reference:'synthetic-reference',customerId:'sample-user',realAmount:300,paymentTime:date+' 12:02:42',expiredTime:date+' 12:30:00',transactionId:'7654321',updateTime:date+' 12:03:52',_id:'abcdefabcdefabcdefabcdef'};
function parse(o={},dir='D',co='MR9'){return Formats.parse(`${co}_PM_MONOPAY_${dir}_${date}.csv`,[headers,row({...base,...o})],date);}
const dep=parse().records[0],wd=parse({amount:300,_id:'fedcbafedcbafedcbafedcba'},'W').records[0];
assert.equal(Formats.canonicalPm(label),'MONOPAY');
assert.equal(Formats.canonicalPm('MNP'),'MONOPAY');
assert.equal(Formats.canonicalPm('MYPAY'),'MYPAY');
for(const alias of ['MONOPAY','MNP'])for(const direction of ['D','W'])assert.equal(Registry.matchFile(`MR9_PM_${alias}_${direction}_${date}.csv`).match?.provider,'MONOPAY');
assert.equal(Registry.matchFile(`3XB_PM_MONOPAY_D_${date}.csv`).match,null);
assert.equal(parse({},'D','3XB').records.length,0);
assert.equal(dep.account,'MONOPAY');assert.equal(dep.amount,300);assert.equal(dep.amountColumn,'realAmount');assert.equal(dep.timeColumn,'paymentTime');assert.equal(dep.sec,12*3600+2*60+42);assert.equal(dep.memberCode,'sample-user');
assert.equal(wd.amount,300);assert.equal(wd.amountColumn,'amount');assert.equal(wd.timeColumn,'updateTime');assert.equal(wd.ref,'7654321');
assert.throws(()=>parse({paymentTime:''}),/MONOPAY/,'No fallback to expiredTime/requestTime');
assert.throws(()=>parse({updateTime:''},'W'),/MONOPAY/);
assert.throws(()=>parse({realAmount:''}),/MONOPAY/,'No fallback to requested amount');
assert.throws(()=>parse({customerId:''}),/MONOPAY/);
assert.throws(()=>parse({transactionId:''},'W'),/MONOPAY/);
assert.equal(parse({status:'pending'}).records.length,0);
const bo=(s,extra={})=>({rowNo:1,source:'bo',formatCode:'bo_transaction_export',company:'MR9',date,sec:Math.floor(s.sec/60)*60,direction:s.direction,amount:300,account:'MONOPAY',channel:'MONOPAY',isPmChannel:true,memberCode:'sample-user',ref:'7654321',raw:label,...extra});
const settings={toleranceDeposit:90,toleranceWithdraw:180,exactUniqueTolerance:600,providerNearTimeTolerance:600,rules:{crossDay:true,pmSuccessOnly:true,filterCarryForward:true}};
const reconcile=(statements,bos)=>Engine.reconcile(statements,bos,settings,[],null);
assert.equal((await reconcile([dep,wd],[bo(dep),bo(wd,{rowNo:2})])).matched,2);
const competing=[bo(dep,{rowNo:1,memberCode:'another-user'}),bo(dep,{rowNo:2,sec:12*3600}),bo(dep,{rowNo:3})];
assert.equal((await reconcile([dep],competing)).matched,1,'Only the correct payment minute and user may match');
for(const [source,patch] of [[dep,{memberCode:'other-user'}],[wd,{ref:'other-code'}],[dep,{sec:dep.sec+60}],[wd,{sec:wd.sec+60}],[dep,{date:'2026-11-20'}],[wd,{amount:299}],[dep,{account:'MYPAY'}],[wd,{company:'UR9'}]]){
 const result=await reconcile([source],[bo(source,{...patch,note:'Sapan: '+source.providerRef})]);
 assert.equal(result.matched,0,'Exact provider _id cannot override the three-field rule: '+JSON.stringify(patch));
}
assert.equal((await reconcile([{...dep,memberCode:''}],[bo(dep)])).matched,0);
assert.equal((await reconcile([{...wd,transactionId:''}],[bo(wd)])).matched,0);
assert.equal((await reconcile([dep],[bo(dep),bo(dep,{rowNo:2})])).matched,0,'Two possible BO rows must remain ambiguous');
const repeated=Formats.parse(`MR9_PM_MONOPAY_D_${date}.csv`,[headers,row(base),row(base)],date).records;
assert.equal(repeated.length,2);assert.notEqual(repeated[0].rowNo,repeated[1].rowNo,'Physical repeated rows stay separate');
const workflow=JSON.parse(fs.readFileSync(new URL('../n8n/audit-mail-ingest.json',import.meta.url)));
const code=workflow.nodes.find(n=>n.id==='classify').parameters.jsCode;
for(const alias of ['MONOPAY','MNP']){
 const classified=vm.runInNewContext(`(function(){${code}})()`,{$input:{all:()=>[{json:{file_name:`MR9_PM_${alias}_D_${date}.csv`,subject:'[AUDIT] MR9 | '+date+' | BO+PM',business_date:date,batch_id:'synthetic',attachment_index:1},binary:{data:{fileSize:100}}}]}});
 assert.equal(classified[0].json.company,'MR9');assert.equal(classified[0].json.kind,'pm_statement');
}
for(const name of ['audit-headless-worker','audit-round-worker','audit-account-recheck']){
 const worker=JSON.parse(fs.readFileSync(new URL('../n8n/'+name+'.json',import.meta.url)));
 for(const node of worker.nodes){const code=node.parameters?.jsCode||'';if(code.includes('const Formats ='))assert.match(code,/mr9OnlyProvider/);if(code.includes('const Engine ='))assert.match(code,/monopayIdentityMatches/);}
}
console.log('MR9 MONOPAY three-field matching, intake, repeated rows, ambiguity and worker parity passed.');
