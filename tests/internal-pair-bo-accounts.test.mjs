import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const calls=[];let primary=null,fail=false,runId='current-run';
const coverage={required:[{company:'UFABET7M',identity:'TMN-TEST',source_labels:['ถอน TMN ทดสอบ']},{company:'UFABET7M',identity:'TMN-TEST',source_labels:['ฝาก TMN ทดสอบ']},{company:'UFABET7M',identity:'BANK-NEW',source_labels:['BO ธนาคารใหม่']},{company:'OTHER',identity:'HIDDEN'}]};
const session={access_token:'synthetic-token',expires_at:Date.now()/1000+3600,user:{id:'synthetic-user'}};
const ctx={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'synthetic-key'}},persist(){}},localStorage:{getItem:k=>k==='audit-sb-session'?JSON.stringify(session):null,setItem(){},removeItem(){}},AbortController,setTimeout,clearTimeout,Date,console,
 fetch:async(url,opts)=>{calls.push({url,method:opts.method||'GET'});let body;
  if(url.includes('/rpc/read_manual_primary_case_set'))body={items:[]};
  else if(url.includes('/rpc/read_manual_primary'))body=primary;
  else if(url.includes('/daily_recon_jobs?'))body=runId?[{last_run_id:runId}]:[];
  else if(url.includes('/recon_runs?')){assert.match(url,/id=eq.current-run/);assert.match(url,/company=eq.UFABET7M/);assert.match(url,/business_date=eq.2099-01-01/);assert.match(url,/select=coverage:summary->bo_first/);if(fail)throw Error('directory timeout');body=[{coverage}];}
  else throw Error('Unexpected request '+url);
  return new Response(JSON.stringify(body),{status:200});
 }};
vm.runInNewContext(fs.readFileSync('supabase.js','utf8'),ctx);const client=ctx.window.Sb;await client.restore();
assert.equal((await client.manualPairBoAccounts('UFABET7M','2099-01-01')).map(r=>r.account).join(','),'TMN-TEST,BANK-NEW');
assert.match((await client.manualPairBoAccounts('UFABET7M','2099-01-01'))[0].label,/BO|ทดสอบ/);
primary={id:'accepted-manual',report:{summary:{bo_first:coverage}}};const start=calls.length;
assert.equal((await client.manualPairBoAccounts('UFABET7M','2099-01-01')).length,2);
assert.equal(calls.slice(start).some(c=>c.url.includes('/recon_runs?')),false,'accepted manual primary must not fall back to automatic history');
primary={stale:true,message:'source changed'};await assert.rejects(client.manualPairBoAccounts('UFABET7M','2099-01-01'),/source changed/);
primary=null;fail=true;await assert.rejects(client.manualPairBoAccounts('UFABET7M','2099-01-01'),/directory timeout/);fail=false;runId=null;assert.equal((await client.manualPairBoAccounts('UFABET7M','2099-01-01')).length,0);
assert.ok(calls.every(c=>c.method==='GET'||/\/rpc\/read_manual_primary/.test(c.url)),'only read endpoints used');
console.log('PASS BO account directory: all current BO accounts including no open case, manual-primary scope, automatic run scope, foreign exclusion, failure propagation, read-only requests.');
