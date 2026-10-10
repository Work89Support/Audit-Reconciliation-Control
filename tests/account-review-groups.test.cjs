const assert=require('node:assert/strict');
const api=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
assert.ok(require('node:fs').readFileSync(require.resolve('../mc8-live-sheets.js'),'utf8').includes("sheet='summary';pm='all';load();"),'company switch must also open the summary first');
const pair=(account,label,dir='withdraw')=>({key:label,isPair:true,kind:'matched',account,boAccountLabel:label,direction:dir,boAmount:20,pmAmount:20,boDate:'2026-10-09',pmDate:'2026-10-09',bo:{reference:label},pm:{reference:label+'-pm'},company:'UFABET7M'});
const orphan=(account,key,dir='withdraw')=>({key,isPair:false,kind:'review',account,direction:dir,boAmount:null,pmAmount:7,pmDate:'2026-10-09',pm:{reference:key},company:'UFABET7M'});
for(const company of api.COMPANIES){
  const rows=[pair('AUTOPEER','ATP PAYMENT ถอน 00000ATP'),orphan('AUTOPEER','unmatched'),{...pair('CP PAYMENT ถอน 0000000001','CP PAYMENT ถอน 0000000001'),isPair:false,waiting:true,kind:'waiting_source',boAmount:5,pmAmount:null,pm:{},pmDate:''},orphan('unknown','residual')].map(row=>({...row,company}));
  const before=JSON.stringify(rows),groups=api.accountReviewGroups(rows);
  assert.equal(groups.flatMap(g=>g.rows).length,rows.length);
  assert.equal(new Set(groups.flatMap(g=>g.rows)).size,rows.length);
  assert.equal(groups.find(g=>g.account==='ATP PAYMENT ถอน 00000ATP').rows.length,2);
  assert.equal(groups.filter(g=>g.key.startsWith('unassigned-pm:')).length,1);
  for(const group of groups){
    const scoped=api.filter(rows,'all','all','all',group.key);
    assert.deepEqual(scoped,group.rows);
    const view=api.tableView(scoped,company,'2026-10-09',true,group.key,schema);
    assert.ok(view.headers.includes('STM/PM · ยอด')&&view.headers.includes('BO · ยอด'));
    assert.equal(api.pmAmountHeader(view.headers,group.key),'STM/PM · ยอด');
  }
  assert.equal(api.summarize(groups.flatMap(g=>g.rows)).boCents,api.summarize(rows).boCents);
  assert.equal(api.summarize(groups.flatMap(g=>g.rows)).pmCents,api.summarize(rows).pmCents);
  assert.equal(JSON.stringify(rows),before,'presentation must not mutate matches, amounts or case states');
}
const ambiguous=[pair('AUTOPEER','Account A'),pair('AUTOPEER','Account B'),orphan('AUTOPEER','ambiguous')];
assert.equal(api.accountReviewGroups(ambiguous).find(g=>g.key.startsWith('unassigned-pm:')).rows.length,1,'ambiguous account must remain separate, never guess by amount');
const bank=[pair('111','SCB 111'),pair('222','SCB 222'),orphan('333','other-bank')];
assert.equal(api.accountReviewGroups(bank).find(g=>g.key.startsWith('unassigned-pm:')).rows.length,1,'never conflate bank accounts');
const nodes=new Map(),container={innerHTML:'',querySelector(s){if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);},querySelectorAll(){return [];}};
api.mount(container,{signedIn:()=>true,company:'UFABET7M',date:'2026-10-09',load:async()=>({complete:true,run:{id:'fixture',matched:0,jobStatus:'completed',summary:{match_evidence:[],waiting_bo:[{company:'UFABET7M',account:'CP PAYMENT ถอน 0000000001',direction:'withdraw',systemAmount:5,boDate:'2026-10-09',boRaw:'fixture',boSource:{fileId:'fixture-bo',row:1}}]}},cases:[]})});
setImmediate(()=>{
  assert.match(container.innerHTML,/โหลดผลรอบงานและหลักฐานคู่ครบแล้ว/);
  assert.match(container.innerHTML,/BO รอ STM\/PM 1 รายการ/);
  assert.ok(!container.innerHTML.includes('โหลดผลหรือหลักฐานคู่ไม่ครบ'));
  assert.ok(!container.innerHTML.includes('data-live-sheet="CP ถ"'));
  assert.ok(container.innerHTML.includes('data-live-sheet="bo-account:CP PAYMENT ถอน 0000000001"'));
  assert.ok(container.innerHTML.includes('aria-selected="true" data-live-sheet="summary"'),'large company days open summary first, not thousands of rows');
  console.log('Account review groups: all nine companies, preserved amounts, PM-only visibility and separate load/waiting status passed');
});
