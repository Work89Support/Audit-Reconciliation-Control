const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('supabase.js','utf8'),fn=source.slice(source.indexOf('async function reviewHoldRegistryCompanies('),source.indexOf('  const financeActionReport=',source.indexOf('async function reviewHoldRegistryCompanies(')));
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
(async()=>{
for(const role of ['lead','monitor','audit_assistant','shift_lead','exec','admin'])for(const company of companies){
 let access={role,active:true,companies:[company]},calls=[];
 const h={id:'hold-id',company,business_date:'2026-10-15',account:'TEST',reason:'รอ STM',responsible_role:'Audit'},item={hold_id:h.id,source_ref:'row-1',item_kind:'case',exception_id:'case-id',bo_amount:49};
 const before=JSON.stringify([h,item]);
 const ctx={rpc:async name=>{assert.equal(name,'get_my_access');return access;},json:async(path,options)=>{calls.push(path);assert.equal(options.recoverRead,true);assert.ok(!options.method,'GET only');return path.includes('account_review_hold_items?')?[item]:[h];}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);
 assert.ok((await ctx.reviewHoldRegistryCompanies()).includes(company));
 const r=await ctx.reviewHoldRegistryReport(company,'2026-10-14','2026-10-31');assert.equal(r.items.length,1);assert.equal(r.items[0].company,company);assert.equal(r.items[0].loss_amount,null);assert.equal(r.items[0].bo_amount,49);assert.equal(JSON.stringify([h,item]),before);
 const foreign=companies.find(c=>c!==company),count=calls.length;
 if(role!=='admin'){await assert.rejects(()=>ctx.reviewHoldRegistryReport(foreign,'2026-10-14','2026-10-31'),/ไม่มีสิทธิ์/);assert.equal(calls.length,count);}
 access={...access,active:false};await assert.rejects(()=>ctx.reviewHoldRegistryReport(company,'2026-10-14','2026-10-31'),/ไม่มีสิทธิ์/);
}
let access={role:'shift_lead',active:true,companies:['FR8']},scopeReads=0;
const ctx={rpc:async()=>{scopeReads++;return scopeReads>1?{...access,companies:[]}:access;},json:async()=>[]};vm.createContext(ctx);vm.runInContext(fn,ctx);
await assert.rejects(()=>ctx.reviewHoldRegistryReport('FR8','2026-10-14','2026-10-31'),/สิทธิ์บริษัทเปลี่ยน/);
ctx.rpc=async()=>access;ctx.json=async()=>{throw Error('timeout');};await assert.rejects(()=>ctx.reviewHoldRegistryReport('FR8','2026-10-14','2026-10-31'),/timeout/);
ctx.json=async()=>[{id:'foreign',company:'MR9',business_date:'2026-10-15'}];await assert.rejects(()=>ctx.reviewHoldRegistryReport('FR8','2026-10-14','2026-10-31'),/ขอบเขต/);
let itemPages=0;ctx.json=async(path)=>{if(path.includes('account_review_holds?'))return[{id:'hold',company:'FR8',business_date:'2026-10-15'}];itemPages++;return path.includes('offset=0')?Array.from({length:500},(_,i)=>({hold_id:'hold',source_ref:String(i)})):[{hold_id:'hold',source_ref:'last'}];};
assert.equal((await ctx.reviewHoldRegistryReport('FR8','2026-10-14','2026-10-31')).items.length,501);assert.equal(itemPages,2);
assert.doesNotMatch(fn,/finance_reporting_companies|account_review_hold_report|PATCH|INSERT|DELETE|UPDATE|service_role/);
const app=fs.readFileSync('app.js','utf8');assert.match(app,/companies:Sb.reviewHoldRegistryCompanies/);assert.match(app,/report:Sb.reviewHoldRegistryReport/);
assert.match(app,/from:state.dailySummary.date,to:state.dailySummary.date/,'registry defaults use actual report day, never unbounded visibility sentinel');
assert.doesNotMatch(app,/saveBlob:Exporter.saveBlob,from:VISIBLE_DATE_FROM,to:VISIBLE_DATE_TO/);
console.log('PASS operational hold registry: six existing roles x nine companies; authenticated read-only RLS tables; foreign/inactive/revoked/timeout guards; full pagination; no finance-report access expansion or production writes.');
})().catch(e=>{console.error(e);process.exit(1);});
