const assert=require('node:assert/strict');
const fs=require('node:fs');
const schema=require('../mc8-sheet-schema.js');
delete globalThis.MC8SheetSchema;
const {rowsOf,filter,filterAndSortEntries,columnMatch,mount,providerOf,sheetOf,summarize,summaries,tableView,COMPANIES,SHEETS}=require('../mc8-live-sheets.js');
const input={run:{id:'r1',matched:1,stm_count:999,bo_count:999,jobStatus:'needs_review',summary:{match_evidence:[{account:'AUTOPEER',direction:'withdraw',amount:355,stmAmount:355,boAmount:355,bo:{fileId:'bo',date:'2026-09-16',sec:3600,row:2},stm:{fileId:'pm',date:'2026-09-16',sec:3700,row:9},customer:{bo:{reference:'ref'},stm:{reference:'ref'}}}]}},complete:true,cases:[{id:'case1',code:'EX-1',account:'COREPAY',direction:'ฝาก',status:'open',system_amount:150,bank_amount:null,company:'MC8',business_date:'2026-09-16',bo_date:'2026-09-17',bo_raw:'bo-cross-day-1',ex_type:'cross_day'},{id:'case1-warning',code:'EX-2',account:'COREPAY',direction:'ฝาก',status:'open',system_amount:150,bank_amount:null,company:'MC8',business_date:'2026-09-16',bo_date:'2026-09-17',bo_raw:'bo-cross-day-1',ex_type:'large_amount'}]};
const before=JSON.stringify(input), rows=rowsOf(input);
assert.equal(rows.length,2);assert.equal(rows[0].boTime,'2026-09-16 01:00:00');
assert.equal(rows[1].pmAmount,null);assert.equal(rows[1].kind,'review');
assert.equal(filter(rows,'COREPAY','deposit','review').length,1);
assert.equal(filter(rows,'AUTOPEER','deposit','all').length,0);
assert.equal(providerOf('ATP / Autopeer'),'AT');assert.equal(providerOf('CPXM'),'CP');assert.equal(providerOf('M24'),'M');assert.equal(providerOf('LOCALPAY'),'LP');
assert.equal(sheetOf(rows[0]),'AT ถ');assert.deepEqual(COMPANIES,['3XB','MC8','MR9','PS8','UR9','AT4','FR8','SK8','UFABET7M']);assert.ok(SHEETS.includes('CY ฝ'));assert.ok(SHEETS.includes('LO ถ'));
const totals=summarize(rows);assert.equal(totals.pmCount,1);assert.equal(totals.pmCents,35500);assert.equal(totals.boCount,2);assert.equal(totals.boCents,50500);assert.equal(totals.crossDayCount,1);assert.equal(totals.crossDayBoCents,15000);assert.equal(totals.diffBeforeCents,0);assert.equal(totals.diffAfterCents,-15000);
assert.equal(summaries(rows)['CP ฝ'].boCount,1,'warning cases sharing one BO transaction must be deduplicated');
const overlap=rowsOf({run:{summary:{match_evidence:[{account:'AUTOPEER',direction:'withdraw',boAmount:25,stmAmount:25,bo:{date:'2026-09-16'},stm:{date:'2026-09-16'},customer:{bo:{reference:'same-bo'},stm:{reference:'same-pm'}}}]}},cases:[{id:'warning',company:'MC8',account:'AUTOPEER',direction:'ถอน',system_amount:25,bank_amount:25,bo_date:'2026-09-16',stm_date:'2026-09-16',bo_raw:'same raw bo',stm_raw:'same raw pm',customer_details:{bo:{reference:'same-bo'},stm:{reference:'same-pm'}},ex_type:'large_amount'}]},'MC8');
const overlapTotals=summarize(overlap);assert.equal(overlapTotals.pmCount,1);assert.equal(overlapTotals.boCount,1);assert.equal(overlapTotals.unmatchedPmCount,0);assert.equal(overlapTotals.unmatchedBoCount,0);
assert.equal(overlap.length,1,'large_amount advisory must not be exported as an Audit action row');
const stalePair={account:'MYPAY',company:'PS8',direction:'deposit',boAmount:900,stmAmount:900,bo:{date:'2026-09-19',sec:36000},stm:{date:'2026-09-19',sec:36000},customer:{bo:{reference:'BO-900'},stm:{bank:'SCB',name:'CUSTOMER'}}};
const staleRows=rowsOf({run:{summary:{match_evidence:[stalePair]}},cases:[
  {id:'old-bo',company:'PS8',account:'MYPAY',direction:'ฝาก',ex_type:'missing_stm',system_amount:900,bo_date:'2026-09-19',bo_time:'10:00:00',customer_details:{bo:{reference:'BO-900'}}},
  {id:'old-stm',company:'PS8',account:'MYPAY',direction:'ฝาก',ex_type:'missing_bo',bank_amount:900,stm_date:'2026-09-19',stm_time:'10:00:00',customer_details:{stm:{bank:'SCB',name:'CUSTOMER'}}},
]},'PS8');
assert.equal(staleRows.length,1,'all-company workbook view must not repeat matched evidence as two stale cases');
assert.equal(staleRows[0].isPair,true);
const xbIdView=tableView(rowsOf({run:{summary:{match_evidence:[{company:'MC8',account:'AUTOPEER',direction:'withdraw',boAmount:2200,stmAmount:2200,bo:{date:'2026-09-16',sec:80000},stm:{date:'2026-09-16',sec:100,timeColumn:'updateTime',amountColumn:'transferredAmount'},customer:{bo:{reference:'2718608',note:'Sapan: 6aaac4bfed5cd6e1fd9d67a6'},stm:{reference:'P2C-20260916-233303-UIHHCL',transactionReference:'P2C-20260916-233303-UIHHCL',sourceId:'P2C-20260916-233303-UIHHCL',providerReference:'6aaac4bfed5cd6e1fd9d67a6'}}}] }},cases:[]},'MC8'),'MC8','2026-09-16',true,'AT ถ',schema);
assert.equal(xbIdView.rows[0][xbIdView.headers.indexOf('id')],'P2C-20260916-233303-UIHHCL','XB AT column A id must show P2C');
assert.equal(xbIdView.rows[0][xbIdView.headers.indexOf('_id')],'6aaac4bfed5cd6e1fd9d67a6','XB AT _id must show provider 6aa id');
assert.equal(JSON.stringify(input),before);
assert.equal(columnMatch('ปิดได้ทันที','ปิดได้'),true);
assert.equal(columnMatch('MC8',{values:['MC8','PS8']}),true);
assert.equal(columnMatch('UR9',{values:['MC8','PS8']}),false);
assert.deepEqual(filterAndSortEntries([
  {source:{id:'b'},values:['MC8',200]},
  {source:{id:'a'},values:['PS8',100]},
],{0:'8'},{index:1,direction:'asc'}).map(entry=>entry.source.id),['a','b'],'column filters and numeric sort must compose without mutating source data');
const src=fs.readFileSync(require.resolve('../mc8-live-sheets.js'),'utf8');
assert.ok(!/\.rpc\(|\.post\(|\.patch\(|\.saveRun\(|\.confirmAuditPairs\(/.test(src));
assert.ok(src.includes('mc8-live-fullscreen'),'workbook must expose a full-screen table control');
assert.ok(src.includes('data-live-filter-menu'),'workbook must expose an Excel-like value menu in each visible column header');
assert.ok(src.includes('เรียงน้อย → มาก'),'column menu must sort ascending like Excel');
assert.ok(src.includes('data-live-filter-value'),'column menu must list distinct values with checkboxes');
assert.ok(src.includes('data-live-column'),'workbook must expose hide/show controls for individual columns');
const nodes=new Map();const container={innerHTML:'',querySelector(s){if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);},querySelectorAll(){return [];}};
mount(container,{signedIn:()=>false,date:'2026-09-16',onLocal(){},load(){throw Error('should never load');}});
assert.ok(container.innerHTML.includes('กรุณาเข้าสู่ระบบจริง'));
mount(container,{signedIn:()=>true,date:'2026-09-16',company:'MR9',companies:COMPANIES,onLocal(){},load:async(company,date)=>{assert.equal(company,'MR9');assert.equal(date,'2026-09-16');return input;}});
setImmediate(()=>{assert.ok(container.innerHTML.includes('EX-1'));assert.ok(container.innerHTML.includes('355.00'));assert.ok(container.innerHTML.includes('สรุปยอดแยกทุกหน้า'));assert.ok(container.innerHTML.includes('ผลต่างหลังรวมข้ามวัน'));assert.ok(!container.innerHTML.includes('ผลหรือหลักฐานยังไม่ครบ'));assert.ok(container.innerHTML.includes('ปิดได้ทันที'));console.log('Audit live sheets: five-company read-only adapter, deduplicated totals, cross-day totals and login guard passed');});
