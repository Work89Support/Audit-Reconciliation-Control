import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('$("#evInput").addEventListener("change"');
const end=source.indexOf('$("#btnNote").addEventListener',start);
assert.ok(start>0&&end>start);
let handler,actor='test-user',receiptCount=0;
const calls=[],accepted=[];
const context={
  $:()=>({addEventListener:(_,fn)=>{handler=fn;}}),
  state:{dataset:'production',selected:'ui-case'},e:{id:'ui-case',dbId:'test-case',status:'open'},
  can:()=>true,deny:()=>assert.fail('unexpected denial'),
  Sb:{authUser:()=>({id:actor}),uploadCaseEvidence:async(id,file,progress)=>{
    calls.push(file.name);progress('test progress');
    if(file.name==='first.txt')throw Error('database timed out');
    return {id:file.name};
  }},
  acceptStoredEvidence:file=>accepted.push(file.id),recordCaseUiResult:()=>{},toast:()=>{},
  openException:async()=>{},showCaseSubmissionReceipt:()=>receiptCount++
};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
const input={files:[{name:'first.txt'},{name:'second.txt'}],value:'files',disabled:false};
await handler({target:input});
assert.deepEqual(calls,['first.txt','second.txt']);
assert.deepEqual(accepted,['second.txt']);
assert.match(context.e._uploadResult,/แนบสำเร็จ 1\/2/);
assert.match(context.e._uploadResult,/first.txt: database timed out/);
assert.equal(receiptCount,0,'partial success must not show all-success receipt');
assert.equal(input.disabled,false);

calls.length=0;
context.Sb.uploadCaseEvidence=async(_,file)=>{calls.push(file.name);actor='other-user';return {id:file.name};};
await handler({target:input});
assert.deepEqual(calls,['first.txt'],'stop remaining files when actor changes');
assert.match(context.e._uploadResult,/ไม่ผูกเคสข้ามบัญชี/);
console.log('Batch upload: independent per-file failures, accurate partial result, actor isolation passed (mock only).');
