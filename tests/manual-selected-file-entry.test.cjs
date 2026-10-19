const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),begin=app.indexOf('    onRun:async fileIds=>{',app.indexOf('function openFileRunManagement(')),end=app.indexOf('\n  });',begin);
const entry=app.slice(begin,end).trim().replace(/,$/,'');
(async()=>{
 for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']){
  let reads=0,opened=null,disposed=0,closed=0,error='';
  const ctx={company,date:'2026-10-17',accounts:[],Sb:{reconciliationOverview:async()=>{reads++;throw Error('primary stale');}},dispose:()=>disposed++,closeModal:()=>closed++,openAccountRecheck:scope=>opened=scope,toast:message=>error=message};
  vm.createContext(ctx);const handler=vm.runInContext('({'+entry+'}).onRun',ctx),ids=Array.from({length:9},(_,i)=>'selected-'+i);
  await handler(ids);assert.equal(reads,0);assert.equal(error,'');assert.equal(opened.company,company);assert.equal(opened.date,'2026-10-17');assert.deepEqual(Array.from(opened.fileIds),ids);assert.equal(opened.accounts.length,0);assert.equal(disposed,1);assert.equal(closed,1);
  opened=null;await handler([]);assert.equal(reads,1);assert.equal(opened,null);assert.equal(error,'primary stale','unscoped legacy entry still fails closed');
 }
 const panel=app.slice(app.indexOf('function openAccountRecheck('),app.indexOf('function openFileRunManagement('));
 assert.match(panel,/accounts:\['ALL',/);assert.match(panel,/request:Sb.requestAccountRecheck/);
 assert.match(app,/if\(primary\?\.stale\)/); // Existing acceptance/read safeguards remain.
 console.log('PASS all nine: selected-file entry opens staged ALL-account review despite stale primary, carries exact nine IDs, no reads/writes/dispatch/acceptance; legacy unscoped entry fails closed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
