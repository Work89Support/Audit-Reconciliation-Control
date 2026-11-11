const assert=require('node:assert/strict');
const {mount,rowsOf,accountReviewGroups}=require('../mc8-live-sheets.js');

const fixture={
  run:{id:'run-1',jobStatus:'completed',matched:1,summary:{match_evidence:[{
    company:'3XB',account:'COREPAY',direction:'deposit',boAmount:100,stmAmount:100,
    bo:{fileId:'bo-1',date:'2026-11-10',sec:3600,row:2},
    stm:{fileId:'pm-1',date:'2026-11-10',sec:3600,row:2},
    customer:{bo:{bank:'พร้อมเพย์-CP(corepay)(QR)',reference:'BO-1'},stm:{reference:'PM-1'}},
  }]}},complete:true,cases:[],sourceBo:[],
};
const account=accountReviewGroups(rowsOf(fixture,'3XB'))[0];
assert.ok(account?.key,'test data must contain a BO account tab');

class FakeContainer{
  set innerHTML(value){this.html=value;this.elements=new Map();this.lists=new Map();}
  get innerHTML(){return this.html||'';}
  querySelector(selector){
    if(selector==='.mc8-scroll')return {scrollTop:0,scrollLeft:0};
    if(!selector.startsWith('#')||!this.html?.includes(`id="${selector.slice(1)}"`))return null;
    if(!this.elements.has(selector))this.elements.set(selector,{value:selector==='#mc8-live-date'?'2026-11-10':'',dataset:{}});
    return this.elements.get(selector);
  }
  querySelectorAll(selector){
    if(selector!=='[data-live-sheet]')return [];
    if(!this.lists.has(selector))this.lists.set(selector,[...this.html.matchAll(/data-live-sheet="([^"]+)"/g)].map(([,value])=>({dataset:{liveSheet:value}})));
    return this.lists.get(selector);
  }
}
global.window={scrollX:0,scrollY:0,scrollTo(){}};
const options={company:'3XB',date:'2026-11-10',companies:['3XB','MR9'],signedIn:()=>true,load:async()=>fixture};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const first=new FakeContainer();mount(first,options);await settle();
  const tab=first.querySelectorAll('[data-live-sheet]').find(button=>button.dataset.liveSheet===account.key);
  assert.ok(tab,'account tab must be visible');tab.onclick();
  assert.match(first.innerHTML,new RegExp(`aria-selected="true" data-live-sheet="${account.key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"`));
  first.querySelector('#mc8-live-direction').onchange({target:{value:'deposit'}});

  // Closing or requesting clarification reloads the current workbook in place.
  await first.auditRefreshInPlace();
  assert.ok(first.innerHTML.includes(`aria-selected="true" data-live-sheet="${account.key}"`));
  assert.ok(first.innerHTML.includes('<option value="deposit" selected>ฝาก</option>'));

  // A parent route refresh can also remount the workbook; keep the same account.
  const remounted=new FakeContainer();mount(remounted,options);await settle();
  assert.ok(remounted.innerHTML.includes(`aria-selected="true" data-live-sheet="${account.key}"`));
  assert.ok(remounted.innerHTML.includes('<option value="deposit" selected>ฝาก</option>'));

  // A different business date must not inherit the old account selection.
  const otherDay=new FakeContainer();mount(otherDay,{...options,date:'2026-11-11'});await settle();
  assert.ok(otherDay.innerHTML.includes('aria-selected="true" data-live-sheet="summary"'));
  console.log('BO account and filters survive case refresh and remount within company/date');
})().catch(error=>{console.error(error);process.exitCode=1;});
