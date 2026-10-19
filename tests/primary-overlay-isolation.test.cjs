const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('supabase.js','utf8'),app=fs.readFileSync('app.js','utf8');
const fn=source.slice(source.indexOf('  async function primaryOverlays('),source.indexOf('  const dailyStatus =',source.indexOf('  async function primaryOverlays(')));
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
const rows=companies.map(company=>({company,business_date:'2026-10-17',stm_count:10,bo_count:11,open_count:2,resolved_count:1}));
let mode='stale',reads=[];
const primary={id:'accepted-fr8',company:'FR8',business_date:'2026-10-17',recheck_id:'q',case_set:{open_count:1,closed_count:2},report:{stm_count:20,bo_count:21,matched:19,exceptions:[{}]}};
const ctx={json:async path=>path.includes('manual_primary_results')?[{company:'SK8',business_date:'2026-10-17'},{company:'FR8',business_date:'2026-10-17'}]:[],
readManualPrimary:async company=>{reads.push(company);if(company==='SK8'){if(mode==='timeout')throw Error('read timeout');return {stale:true,id:'accepted-sk8',message:'ผลหลักตรวจมือมีไฟล์/รอบใหม่ ต้องรันทบทวนใหม่'};}return primary;}};
vm.createContext(ctx);vm.runInContext(fn,ctx);
const statusFn=app.match(/function dailyResultStatus\([^]*?\n}/)[0],status=new Function('LIVE_STATUS',statusFn+';return dailyResultStatus;')({});
(async()=>{
 const before=JSON.stringify({rows,primary});
 for(const failure of ['stale','timeout'])for(const caseCountsOnly of [false,true]){
  mode=failure;reads=[];const result=await ctx.primaryOverlays(rows,{caseCountsOnly});
  assert.equal(result.length,9);assert.equal(reads.filter(c=>c==='SK8').length,1);
  const sk=result.find(r=>r.company==='SK8'),fr=result.find(r=>r.company==='FR8');
  assert.equal(sk.primaryResult,null);assert.equal(sk.primaryUnavailable.stale,failure==='stale');assert.ok(sk.workflowStatusError.includes('SK8'));
  assert.equal(fr.primaryResult.id,primary.id);assert.ok(!result.find(r=>r.company==='PS8').primaryUnavailable);
  assert.ok(!status(sk).primary);assert.match(status(sk).manual,failure==='stale'?/ต้องทบทวน/:/ยังตรวจผลหลักไม่ได้/);
  assert.equal(JSON.stringify({rows,primary}),before);
 }
 const duplicates=await ctx.primaryOverlays([...rows,rows[6]]);assert.equal(duplicates.length,10);
 assert.ok(source.includes('if(primary?.stale)throw new Error(primary.message)'),'detail reader must still block stale primary, not silently promote it');
 console.log('PASS nine-company summary: stale or unreadable SK8 does not erase other companies; scoped warning and unchanged accepted reports/counts, no primary acceptance or case writes; detail safeguard retained.');
})().catch(e=>{console.error(e);process.exitCode=1;});
