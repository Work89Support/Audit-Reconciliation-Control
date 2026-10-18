const assert=require('node:assert/strict');
const api=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
for(const company of api.COMPANIES){
  for(const origin of ['manual','system']){
    const sourceCases=[0,1,2].map(i=>({id:`${origin}-${i}`,code:`${origin}-${i}`,company,account:'4311918665',direction:'deposit',status:'open',system_amount:80,bank_amount:null,bo_date:'2026-10-17',bo_time:`08:0${i}:00`,customer_details:{waiting_source:true,account_review_hold_id:'keep-original',source_rows:{bo:{fileId:`${origin}-bo`,row:i+1}}}}));
    const input={run:{company,business_date:'2026-10-17',summary:{}},cases:sourceCases,...(origin==='manual'?{primaryResult:{id:'accepted-manual'}}:{})};
    const inputBefore=JSON.stringify(input),realRows=api.rowsOf(input,company);
    assert.equal(api.filter(realRows,'4311918665','deposit','waiting_source').length,3,company+' '+origin+' rowsOf case projection');
    assert.equal(api.filter(realRows,'4311918665','deposit','review').length,0);
    assert.equal(JSON.stringify(input),inputBefore,'projection preserves original source case records');
    const base={company,account:'4311918665',direction:'deposit',boDate:'2026-10-17',boAmount:80,pmAmount:null,bo:{},pm:{},waiting:true,kind:'review'};
    const held=[0,1,2].map(i=>({...base,key:`${origin}-${i}`,boSource:{fileId:`${origin}-bo`,row:i+1},case:{id:`${origin}-${i}`,status:'open',customer_details:{waiting_source:true,account_review_hold_id:'keep-original'},history:['original']}}));
    const cross={...base,key:'cross',waiting:false,kind:'review',exType:'cross_day',crossDay:true,boSource:{fileId:'bo',row:4}};
    const closed={...base,key:'closed',kind:'closed',boSource:{fileId:'bo',row:5},case:{status:'closed',history:['keep-closed']}};
    const pendingWaiting={...base,key:'pending-wait',kind:'pending_next_day',exType:'cross_day',boSource:{fileId:'bo',row:6}};
    const ordinary={...base,key:'review',waiting:false,boSource:{fileId:'bo',row:7}};
    const matched={...base,key:'matched',waiting:false,kind:'matched',isPair:true,pmAmount:80,boSource:{fileId:'bo',row:8},pmSource:{fileId:'stm',row:1}};
    const rows=[...held,cross,closed,ordinary,matched],before=JSON.stringify(rows);
    assert.deepEqual(api.filter(rows,'4311918665','deposit','waiting_source').map(r=>r.key),held.map(r=>r.key),company+' '+origin+' three real waiting rows');
    assert.equal(api.filter(rows,'4311918665','withdraw','waiting_source').length,0);
    assert.equal(api.filter(rows,'other','deposit','waiting_source').length,0);
    assert.deepEqual(api.filter(rows,'all','all','review'),[ordinary]);
    assert.deepEqual(api.filter(rows,'all','all','closed'),[closed]);
    assert.deepEqual(api.filter(rows,'all','all','pending_next_day'),[cross]);
    assert.deepEqual(api.filter([pendingWaiting],'all','all','waiting_source'),[pendingWaiting]);
    assert.deepEqual(api.filter(rows,'all','all','matched'),[matched]);
    for(const dir of ['all','deposit','withdraw'])for(const status of ['all','waiting_source','review','closed','matched','pending_next_day','advisory']){
      const selected=api.filter(rows,'4311918665',dir,status),s=api.summarize(selected);
      const view=api.tableView(selected,company,'2026-10-17',true,'all',schema);
      const cells=[...api.providerFooter(view.headers,view.rows,'all',undefined,s).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
      assert.equal(Number(cells[view.headers.indexOf('ผลต่างยอด')].replace(/,/g,'')),s.diffAfterCents/100);
    }
    assert.equal(JSON.stringify(rows),before,'filter never changes amounts, workflow states, history or holds');
  }
}
console.log('PASS waiting-source filter: all nine companies, manual/system rows, three held rows, closed history, cross-day precedence, account/direction/status combinations and shared totals; no writes.');
