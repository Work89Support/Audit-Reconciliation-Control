import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const context=vm.createContext({console,performance});
const worker=process.env.XB_NEW_PROVIDER_WORKFLOW&&JSON.parse(fs.readFileSync(process.env.XB_NEW_PROVIDER_WORKFLOW));
const source=worker?worker.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน').parameters.jsCode:null;
const modules=['Registry','Formats','Engine'].map(name=>{
 if(!source)return fs.readFileSync(new URL('../'+name.toLowerCase()+'.js',import.meta.url),'utf8');
 const start=source.indexOf('const '+name+' ='),end=source.indexOf('\n})();',start);
 assert(start>=0&&end>start);return source.slice(start,end+7);
}).join('\n');
vm.runInContext(modules+'\nglobalThis.api={Registry,Formats,Engine};',context);
const {Registry,Formats,Engine}=context.api;
const date='2026-11-26';
const headers=['id','amount','provider','status','requestTime','fee','reference','customerId','realAmount','paymentTime','expiredTime','transactionId','updateTime','_id','transferredAmount','ยูสเซอร์'];
const base={id:'synthetic-order',amount:900,provider:'catpay',status:'successed',requestTime:date+' 12:00:00',fee:1,reference:'synthetic-order-ref',customerId:'synthetic-user',realAmount:300,paymentTime:date+' 12:02:42',expiredTime:date+' 12:30:00',transactionId:'7654321',updateTime:date+' 12:03:52',_id:'abcdefabcdefabcdefabcdef',transferredAmount:888,'ยูสเซอร์':'wrong-fallback-user'};
const row=o=>headers.map(h=>o[h]??'');
const settings={toleranceDeposit:90,toleranceWithdraw:180,exactUniqueTolerance:600,providerNearTimeTolerance:600,rules:{crossDay:true,pmSuccessOnly:true,filterCarryForward:true}};
const reconcile=(s,b)=>Engine.reconcile(s,b,settings,[],null);
const bo=(s,extra={})=>({rowNo:1,source:'bo',formatCode:'bo_transaction_export',company:'3XB',date,sec:Math.floor(s.sec/60)*60,minutePrecision:true,direction:s.direction,amount:s.amount,account:s.account,channel:s.account,isPmChannel:true,memberCode:'synthetic-user',ref:'7654321',raw:'synthetic BO',...extra});
for(const [provider,label,aliases] of [
 ['CATPAY','3xbet_catpay(catpay)(P2P)',['CATPAY']],
 ['JINLIPAY','พร้อมเพย์-JLP(jinlipay)(P2P)',['JINLIPAY','JLP']],
]) {
 const parse=(patch={},dir='D',co='3XB')=>Formats.parse(`${co}_PM_${provider}_${dir}_${date}.xlsx`,[headers,row({...base,provider:provider.toLowerCase(),...patch})],date);
 assert.equal(Formats.canonicalPm(label),provider);
 assert.equal(Formats.canonicalPm('ATP'),'AUTOPEER');
 for(const alias of aliases)for(const dir of ['D','W']) {
  assert.equal(Registry.matchFile(`3XB_PM_${alias}_${dir}_${date}.csv`).match?.provider,provider);
  assert.equal(Formats.canonicalPm(alias),provider);
  assert.equal(Registry.matchFile(`MR9_PM_${alias}_${dir}_${date}.csv`).match,null);
 }
 assert.equal(Registry.matchFile(`3xbet_${provider}(P2P)_ฝาก.xlsx`).match?.provider,provider);
 const dep=parse().records[0],wd=parse({amount:400},'W').records[0];
 assert.equal(dep.account,provider);assert.equal(dep.amount,300);assert.equal(dep.amountColumn,'realAmount');assert.equal(dep.timeColumn,'paymentTime');assert.equal(dep.memberCode,'synthetic-user');assert.equal(dep.sec,43362);
 assert.equal(wd.amount,400);assert.equal(wd.amountColumn,'amount');assert.equal(wd.timeColumn,'updateTime');assert.equal(wd.ref,'7654321');
 for(const [field,dir] of [['paymentTime','D'],['realAmount','D'],['customerId','D'],['updateTime','W'],['transactionId','W'],['amount','W']])assert.throws(()=>parse({[field]:''},dir),new RegExp(provider));
 assert.throws(()=>parse({realAmount:'n/a'}),new RegExp(provider));
 assert.throws(()=>parse({paymentTime:'invalid'}),new RegExp(provider));
 for(const co of ['MR9','UR9','AT4','UFABET7M'])assert.throws(()=>parse({},'D',co),/เฉพาะ 3XB/);
 assert.equal(parse({status:'pending'}).records.length,0);
 assert.equal((await reconcile([dep,wd],[bo(dep),bo(wd,{rowNo:2})])).matched,2);
 for(const [s,patch] of [[dep,{memberCode:'wrong-user'}],[wd,{ref:'wrong-code'}],[dep,{sec:dep.sec+60}],[wd,{sec:wd.sec+60}],[dep,{date:'2026-11-27'}],[wd,{amount:399}],[dep,{account:'AUTOPEER',channel:'AUTOPEER'}],[wd,{company:'UR9'}]]) {
  const result=await reconcile([s],[bo(s,{...patch,note:'Sapan: '+s.providerRef})]);
  assert.equal(result.matched,0,provider+' forbids Sapan/amount-only bypass: '+JSON.stringify(patch));
 }
 const sameSecondBo=bo(dep,{sec:dep.sec,minutePrecision:false});
 assert.equal((await reconcile([dep],[sameSecondBo])).matched,1);
 assert.equal((await reconcile([dep],[{...sameSecondBo,sec:dep.sec+1}])).matched,0,'Preserve seconds when both sources supply seconds');
 assert.equal((await reconcile([dep],[bo(dep),bo(dep,{rowNo:2})])).matched,0,'Ambiguous BO rows remain for review');
 const repeated=parse().records.concat(parse().records.map(r=>({...r,rowNo:3})));
 assert.equal((await reconcile(repeated,[bo(dep)])).matched,0,'Repeated physical rows cannot consume one BO row');
 const parsedRepeated=Formats.parse(`3XB_PM_${provider}_D_${date}.csv`,[headers,row({...base,provider:provider.toLowerCase()}),row({...base,provider:provider.toLowerCase()})],date).records;
 assert.equal(parsedRepeated.length,2);assert.notEqual(parsedRepeated[0].rowNo,parsedRepeated[1].rowNo);
 // BO labels and column selection must normalize to the same provider.
 const boRows=[['รหัส','เวลา','ประเภท','ประเภทดำเนินการ','ยูสเซอร์','ธนาคาร','จำนวน','จำนวนที่ได้รับ','ค่าธรรรมเนียม','เวลาทำรายการ','หมายเหตุ','ผู้ดำเนินการ'],['7654321',date+' 12:02','ฝาก','ออโต้','synthetic-user',label,300,0,1,date+' 12:02','','synthetic-audit']];
 const parsedBo=Formats.parse('3XB_BO_'+date+'.xlsx',boRows,date).records;
 assert.equal(parsedBo.length,1);assert.equal(parsedBo[0].account,provider);
 assert.equal((await reconcile([dep],parsedBo)).matched,1);
}
const ingest=JSON.parse(fs.readFileSync(new URL('../n8n/audit-mail-ingest.json',import.meta.url)));
const classifier=ingest.nodes.find(n=>n.id==='classify').parameters.jsCode;
for(const provider of ['CATPAY','JINLIPAY','JLP']) {
 const r=vm.runInNewContext(`(function(){${classifier}})()`,{$input:{all:()=>[{json:{file_name:`3XB_${provider}_D_${date}.csv`,subject:'[AUDIT] 3XB | '+date+' | BO+PM',business_date:date,batch_id:'synthetic',attachment_index:1},binary:{data:{fileSize:100}}}]}});
 assert.equal(r[0].json.kind,'pm_statement');assert.equal(r[0].json.company,'3XB');
}
console.log('3XB CATPAY/JINLIPAY: exact field mappings, BO labels, intake, company scope, ambiguity and repeated-row protection passed.');
