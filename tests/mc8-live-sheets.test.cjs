const assert=require('node:assert/strict');
const fs=require('node:fs');
const schema=require('../mc8-sheet-schema.js');
delete globalThis.MC8SheetSchema;
const {rowsOf,accountReviewGroups,filter,filterAndSortEntries,columnMatch,mount,providerOf,sheetOf,summarize,summaries,tableView,providerHeader,providerFooter,pmAmountHeader,buildAuditExportSheets,canOpenRealCase,COMPANIES,SHEETS,ALL_HEADERS}=require('../mc8-live-sheets.js');
const actionRow=(status,kind='review',quick=false)=>({kind,case:{id:'case-id',status,_quickSourceEvidence:quick},isPair:kind==='matched',pmAmount:100,boAmount:100,pmRaw:'STM',boRaw:'BO'});
assert.equal(canOpenRealCase(actionRow('closed','closed'),true),false);
assert.equal(canOpenRealCase(actionRow('approved','closed'),true),false);
assert.equal(canOpenRealCase(actionRow('open','matched'),true),false);
assert.equal(canOpenRealCase({...actionRow('open'),pmAmount:null,pmRaw:''},true),true);
{
  const legacyCase={id:'case-1',code:'EX-3001',company:'3XB',business_date:'2026-10-25',status:'open',direction:'ฝาก',system_amount:100,bank_amount:null};
  assert.equal(rowsOf({run:{summary:{}},cases:[legacyCase]},'3XB')[0].code,'3XB-25.10.2026-001');
  assert.equal(rowsOf({run:{business_date:'2026-10-25',summary:{}},cases:[{...legacyCase,business_date:undefined}]},'3XB')[0].code,'3XB-25.10.2026-001');
  assert.equal(rowsOf({run:{summary:{}},cases:[{...legacyCase,company:'UFABET7M'}]},'UFABET7M')[0].code,'7M-25.10.2026-001');
  assert.equal(rowsOf({run:{summary:{}},cases:[{...legacyCase,business_date:'2026-10-26'}]},'3XB')[0].code,'EX-3001');
}
assert.equal(ALL_HEADERS[0],'STM/PM · วัน / เวลา');
assert.ok(ALL_HEADERS.indexOf('STM/PM · รายละเอียดต้นฉบับ')<ALL_HEADERS.indexOf('BO · วัน / เวลา'));
assert.ok(ALL_HEADERS.indexOf('BO · รายละเอียดต้นฉบับ')<ALL_HEADERS.indexOf('ผลตรวจระบบ'));
const allHeaderHtml=providerHeader(ALL_HEADERS,'all');
assert.ok(allHeaderHtml.indexOf('STM / PM')<allHeaderHtml.indexOf('BO / ระบบ'));
assert.ok(allHeaderHtml.indexOf('BO / ระบบ')<allHeaderHtml.indexOf('ผล Audit'));
assert.equal(providerOf('พร้อมเพย์-ANT-AU(anypay)(QR)'), 'ANT');
assert.equal(providerOf('anypay'), 'ANT');
assert.equal(providerOf('CHANT'), 'OTHER');
for (const company of ['3XB','MC8','MR9','PS8','UR9']) {
  const antRows=['deposit','withdraw'].map((direction,i)=>({key:`ANT-${i}`,company,account:'พร้อมเพย์-ANT-AU(anypay)(QR)',direction,kind:'review',boAmount:200+i*100,boTime:'2026-10-03 12:00:00',bo:{user:'xb-user'}}));
  assert.equal(sheetOf(antRows[0]), 'ANT ฝ');
  assert.equal(sheetOf(antRows[1]), 'ANT ถ');
  const sheets=buildAuditExportSheets(antRows,company,'2026-10-03',true,schema);
  const details=sheets.slice(2);
  assert.equal(details.length,2,`${company} splits PM by direction`);
  assert.deepEqual(details.flatMap(sheet=>sheet.rows.map(r=>r[sheet.headers.indexOf('BO · ยอด')])),[200,300]);
  assert.deepEqual(details.flatMap(sheet=>sheet.rows.map(r=>r[sheet.headers.indexOf('ประเภท')])),['ฝาก','ถอน']);
}
assert.ok(!buildAuditExportSheets([],'FR8','2026-10-03',true,schema).some(s=>s.name.startsWith('ANT ')));
const input={run:{id:'r1',matched:1,stm_count:999,bo_count:999,jobStatus:'needs_review',summary:{match_evidence:[{account:'AUTOPEER',direction:'withdraw',amount:355,stmAmount:355,boAmount:355,bo:{fileId:'bo',date:'2026-09-16',sec:3600,row:2},stm:{fileId:'pm',date:'2026-09-16',sec:3700,row:9},customer:{bo:{reference:'ref'},stm:{reference:'ref'}}}]}},complete:true,cases:[{id:'case1',code:'EX-1',account:'COREPAY',direction:'ฝาก',status:'open',system_amount:150,bank_amount:null,company:'MC8',business_date:'2026-09-16',bo_date:'2026-09-17',bo_raw:'bo-cross-day-1',ex_type:'cross_day'},{id:'case1-warning',code:'EX-2',account:'COREPAY',direction:'ฝาก',status:'open',system_amount:150,bank_amount:null,company:'MC8',business_date:'2026-09-16',bo_date:'2026-09-17',bo_raw:'bo-cross-day-1',ex_type:'large_amount'}]};
const before=JSON.stringify(input), rows=rowsOf(input);
assert.equal(rows.length,2);assert.equal(rows[0].boTime,'2026-09-16 01:00:00');
assert.equal(rows[1].pmAmount,null);assert.equal(rows[1].kind,'review');
assert.equal(filter(rows,'COREPAY','deposit','review').length,0);
assert.equal(filter(rows,'COREPAY','deposit','pending_next_day').length,1);
assert.equal(filter(rows,'AUTOPEER','deposit','all').length,0);
assert.equal(providerOf('ATP / Autopeer'),'AT');assert.equal(providerOf('CPXM'),'CP');assert.equal(providerOf('M24'),'M');assert.equal(providerOf('LOCALPAY'),'LP');
const sevenMAutopeerGroups=accountReviewGroups([
  {key:'bo-atp-d',company:'UFABET7M',account:'AUTOPEER',boAccountLabel:'ATP PAYMENT ฝาก 00000ATP',direction:'deposit',boAmount:100,boRaw:'ATP PAYMENT ฝาก 00000ATP | 100',bo:{}},
  {key:'bo-autopeer-d',company:'UFABET7M',account:'AUTOPEER',boAccountLabel:'AUTOPEER',direction:'deposit',boAmount:200,boRaw:'AUTOPEER | 200',bo:{}},
  {key:'bo-atp-w',company:'UFABET7M',account:'AUTOPEER',boAccountLabel:'ATP PAYMENT ถอน 00000ATP',direction:'withdraw',boAmount:300,boRaw:'ATP PAYMENT ถอน 00000ATP | 300',bo:{}},
  {key:'bo-autopeer-w',company:'UFABET7M',account:'AUTOPEER',boAccountLabel:'AUTOPEER',direction:'withdraw',boAmount:400,boRaw:'AUTOPEER | 400',bo:{}},
]);
assert.deepEqual(sevenMAutopeerGroups.map(group=>group.label).sort(),['ATP PAYMENT ถอน 00000ATP','ATP PAYMENT ฝาก 00000ATP','AUTOPEER · ถอน','AUTOPEER · ฝาก'],'7M account headings must preserve exact directional BO labels and clarify legacy labels without a direction');
assert.deepEqual(sevenMAutopeerGroups.map(group=>group.rows.length).sort(),[1,1,1,1],'7M deposit and withdrawal groups must remain separate without changing totals');
const mr9BoFirstRows=rowsOf({run:{summary:{match_evidence:[
  {company:'MR9',account:'AUTOPEER',direction:'deposit',boAmount:100,stmAmount:100,bo:{date:'2026-10-25',sec:60},stm:{date:'2026-10-25',sec:60},customer:{bo:{bank:'พร้อมเพย์-ATP(autopeer)(P2P)'},stm:{}}},
  {company:'MR9',account:'COREPAY',direction:'deposit',boAmount:200,stmAmount:200,bo:{date:'2026-10-25',sec:120},stm:{date:'2026-10-25',sec:120},customer:{bo:{bank:'พร้อมเพย์-CP(corepay)(QR)'},stm:{}}},
  {company:'MR9',account:'MYPAY',direction:'deposit',boAmount:300,stmAmount:300,bo:{date:'2026-10-25',sec:180},stm:{date:'2026-10-25',sec:180},customer:{bo:{bank:'พร้อมเพย์-M24(mypays24)(P2P)'},stm:{}}},
]}},cases:[
  {id:'mr9-at-pm',company:'MR9',account:'AUTOPEER',direction:'ฝาก',status:'open',bank_amount:9,stm_date:'2026-10-25'},
  {id:'mr9-cp-pm',company:'MR9',account:'COREPAY',direction:'ฝาก',status:'open',bank_amount:8,stm_date:'2026-10-25'},
  {id:'mr9-m-pm',company:'MR9',account:'MYPAY',direction:'ฝาก',status:'open',bank_amount:7,stm_date:'2026-10-25'},
]},'MR9');
const mr9BoFirstGroups=accountReviewGroups(mr9BoFirstRows);
assert.deepEqual(mr9BoFirstGroups.map(group=>group.label).sort(),[
  'พร้อมเพย์-ATP(autopeer)(P2P) · ฝาก','พร้อมเพย์-CP(corepay)(QR) · ฝาก','พร้อมเพย์-M24(mypays24)(P2P) · ฝาก',
].sort(),'XB summary pages must come only from exact BO account labels');
assert.deepEqual(mr9BoFirstGroups.map(group=>group.rows.length).sort(),[2,2,2],'PM-only rows attach to the unique BO account/provider page instead of opening duplicate canonical pages');
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
assert.equal(staleRows.length,3,'workbook must retain open persisted cases until backend closes them');
assert.equal(staleRows[0].isPair,true);
const xbIdView=tableView(rowsOf({run:{summary:{match_evidence:[{company:'MC8',account:'AUTOPEER',direction:'withdraw',boAmount:2200,stmAmount:2200,bo:{date:'2026-09-16',sec:80000},stm:{date:'2026-09-16',sec:100,timeColumn:'updateTime',amountColumn:'transferredAmount'},customer:{bo:{reference:'2718608',note:'Sapan: 6aaac4bfed5cd6e1fd9d67a6'},stm:{reference:'P2C-20260916-233303-UIHHCL',transactionReference:'P2C-20260916-233303-UIHHCL',sourceId:'P2C-20260916-233303-UIHHCL',providerReference:'6aaac4bfed5cd6e1fd9d67a6'}}}] }},cases:[]},'MC8'),'MC8','2026-09-16',true,'AT ถ',schema);
assert.equal(xbIdView.rows[0][xbIdView.headers.indexOf('id')],'P2C-20260916-233303-UIHHCL','XB AT column A id must show P2C');
assert.equal(xbIdView.rows[0][xbIdView.headers.indexOf('_id')],'6aaac4bfed5cd6e1fd9d67a6','XB AT _id must show provider 6aa id');
for(const [account,sheet] of [['AZPAY','AZ ถ'],['COREPAY','CP ถ'],['MYPAY','M ถ'],['LOCALPAY','LP ถ']]){
  const providerRows=rowsOf({run:{summary:{match_evidence:[{company:'3XB',account,direction:'withdraw',amount:100,bo:{date:'2026-09-16',sec:100},stm:{date:'2026-09-16',sec:110},method:'legacy-rule',customer:{bo:{reference:'BO-1'},stm:{sourceId:`${account}-1`,providerReference:'6aaac4bfed5cd6e1fd9d67a6'}}}] }},cases:[]},'3XB');
  const view=tableView(providerRows,'3XB','2026-09-16',true,sheet,schema);
  assert.equal(view.rows[0][view.headers.indexOf('_id')],'6aaac4bfed5cd6e1fd9d67a6',`${account} must display its own PM _id`);
  assert.equal(view.rows[0][view.headers.indexOf('หมายเหตุ')],'',`${account} BO note must stay blank when BO has no Sapan note`);
  assert.match(view.rows[0][view.headers.indexOf('เงื่อนไขที่จับคู่')],/legacy-rule/,`${account} matcher label belongs only in the condition column`);
}
const legacySapanRows=rowsOf({run:{summary:{match_evidence:[]}},cases:[{id:'legacy-sapan',company:'3XB',account:'AUTOPEER',direction:'ถอน',status:'open',system_amount:1300,bank_amount:1300,bo_date:'2026-09-15',stm_date:'2026-09-15',bo_raw:'1049603 | sapan: 6aa8a28b6f7ddd65ebf16ce8 | โอนจริง 1300 สำเร็จ 1265.99 คืน 34.01',customer_details:{bo:{note:'sapan: 6aa8a28b6f7ddd65ebf16ce8 | โอนจริง 1300 สำเร็จ 1265.99 คืน 34.01'},stm:{providerReference:'6aa8a28b6f7ddd65ebf16ce8'}}}]},'3XB');
assert.equal(legacySapanRows[0].bo.note,'6aa8a28b6f7ddd65ebf16ce8','legacy BO note must display only the Sapan provider id');
assert.equal(legacySapanRows[0].bo.providerReference,'6aa8a28b6f7ddd65ebf16ce8','legacy BO provider reference must be recovered from raw note');
const recoveredPmIdRows=rowsOf({run:{summary:{match_evidence:[]}},cases:[{id:'legacy-pm-id',company:'3XB',account:'AUTOPEER',direction:'ถอน',status:'open',system_amount:1300,bank_amount:1300,bo_raw:'1049603 | Spean: 6aa8a28b6f7ddd65ebf16ce8 | โอนจริง 1300 สำเร็จ 1265.99 คืน 34.01',stm_raw:'P2C-20260915-214651-AOJGPS | 1300 | autopeer | SUCCESSED | 6aa8a28b6f7ddd65ebf16ce8',customer_details:{bo:{note:'Spean: 6aa8a28b6f7ddd65ebf16ce8 | โอนจริง 1300 สำเร็จ 1265.99 คืน 34.01'},stm:{}}}]},'3XB');
const recoveredPmIdView=tableView(recoveredPmIdRows,'3XB','2026-09-15',true,'AT ถ',schema);
assert.equal(recoveredPmIdView.rows[0][recoveredPmIdView.headers.indexOf('_id')],'6aa8a28b6f7ddd65ebf16ce8','historical case must recover PM _id from its raw row');
assert.equal(recoveredPmIdView.rows[0][recoveredPmIdView.headers.indexOf('id')],'P2C-20260915-214651-AOJGPS','historical case must retain P2C in id and keep it separate from _id');
const fallbackPmIdRows=rowsOf({run:{summary:{match_evidence:[]}},cases:[{id:'missing-pm-id',company:'3XB',account:'AUTOPEER',direction:'ถอน',status:'open',system_amount:-100,bank_amount:100,bo_raw:'10495821 | Sapan: 6aa95f3e6f7ddd65ebf18744 | โอนจริง 100 สำเร็จ 100',stm_raw:'P2C-20260915-213500-TEST03 | 100 | autopeer',customer_details:{bo:{reference:'10495821',note:'Sapan: 6aa95f3e6f7ddd65ebf18744 | โอนจริง 100 สำเร็จ 100'},stm:{transactionId:'10495821'}}}]},'3XB');
const fallbackPmIdView=tableView(fallbackPmIdRows,'3XB','2026-09-15',true,'AT ถ',schema);
assert.equal(fallbackPmIdView.rows[0][fallbackPmIdView.headers.indexOf('_id')],'6aa95f3e6f7ddd65ebf18744','screen must show BO Sapan id when PM extractor left _id blank');
const legacySapanAll=buildAuditExportSheets(legacySapanRows,'3XB','2026-09-15',true,schema).find(sheet=>sheet.name==='ข้อมูลทั้งหมด');
assert.equal(legacySapanAll.rows[0][legacySapanAll.headers.indexOf('BO · รายละเอียดต้นฉบับ')],'6aa8a28b6f7ddd65ebf16ce8','export must not include payout/refund suffix after Sapan id');
const realAmountRows=rowsOf({run:{summary:{match_evidence:[{company:'MC8',account:'AUTOPEER',direction:'deposit',boAmount:200,stmAmount:250,bo:{date:'2026-09-16',sec:3600},stm:{date:'2026-09-16',sec:3600,timeColumn:'paymentTime',amountColumn:'realAmount'},customer:{bo:{reference:'BO-REAL'},stm:{reference:'PM-REAL'}}}]}},cases:[]},'MC8');
const realAmountView=tableView(realAmountRows,'MC8','2026-09-16',true,'AT ฝ',schema);
assert.equal(pmAmountHeader(realAmountView.headers,'AT ฝ'),'realAmount','XB deposit must total the actual realAmount column');
const realAmountFooter=providerFooter(realAmountView.headers,realAmountView.rows,'AT ฝ');
assert.ok(realAmountFooter.includes('ผลรวม realAmount'),'screen footer must identify the realAmount total');
assert.ok(realAmountFooter.includes('250.00'),'screen footer must total realAmount');
assert.ok(realAmountFooter.includes('200.00'),'screen footer must total BO for comparison');
assert.ok(realAmountFooter.includes('50.00'),'screen footer must show realAmount minus BO');
const allView=tableView(realAmountRows,'MC8','2026-09-16',true,'all',schema);
const allFooter=providerFooter(allView.headers,allView.rows,'all');
assert.ok(allFooter.includes('250.00')&&allFooter.includes('200.00')&&allFooter.includes('50.00'),'all-data screen must show STM/PM, BO and difference totals');
const realAmountExport=buildAuditExportSheets(realAmountRows,'MC8','2026-09-16',true,schema).find(sheet=>sheet.name==='AUTOPEER · ฝาก');
assert.equal(realAmountExport.footerRows[0][realAmountExport.headers.indexOf('STM/PM · ยอด')],250,'Excel footer must total realAmount');
assert.equal(realAmountExport.footerRows[0][realAmountExport.headers.indexOf('BO · ยอด')],200,'Excel footer must total BO');
assert.equal(realAmountExport.footerRows[0][realAmountExport.headers.indexOf('ผลต่างยอด')],50,'Excel footer must compare realAmount with BO');
const statementRow=(company,account,bank,direction)=>({key:`${company}-${account}-${direction}`,isPair:true,kind:'matched',company,account,direction,pm:{bank,name:'ผู้ถือบัญชี'},bo:{},pmAmount:100,boAmount:100,pmTime:'2026-09-28 01:00:00',boTime:'2026-09-28 01:00:00'});
const sheetNames=(company,statementRows)=>buildAuditExportSheets(statementRows,company,'2026-09-28',true,schema).map(sheet=>sheet.name);
const sys123Names=sheetNames('FR8',[statementRow('FR8','4311918665','SCB','deposit'),statementRow('FR8','4311918665','SCB','withdraw')]);
assert.equal(sys123Names.filter(name=>name.startsWith('4311918665')).length,2,'123 banks split deposit and withdrawal');
const sevenMBankNames=sheetNames('UFABET7M',[statementRow('UFABET7M','5034633891','SCB','deposit'),statementRow('UFABET7M','5034633891','SCB','withdraw')]);
assert.equal(sevenMBankNames.filter(name=>name==='5034633891').length,1,'7M uses BO identity once');
const sevenMTmnNames=sheetNames('UFABET7M',[statementRow('UFABET7M','0999999999','TMN','deposit'),statementRow('UFABET7M','0999999999','TMN','withdraw')]);
assert.equal(sevenMTmnNames.filter(name=>name.startsWith('0999999999')).length,2,'7M TMN splits deposit and withdrawal');
const xbNames=sheetNames('UR9',[statementRow('UR9','0123456789','SCB','deposit'),statementRow('UR9','0123456789','SCB','withdraw')]);
assert.equal(xbNames.filter(name=>name==='0123456789').length,1,'XB uses BO identity once');
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
assert.ok(src.includes("liveCase?.id"),'real-case buttons must validate and forward the persisted exception UUID');
assert.ok(src.includes("await opts.onCase(liveCase,company)"),'real-case buttons must await the detail loader instead of silently navigating by display code');
assert.ok(src.includes('onCaseError'),'real-case buttons must surface load or permission failures');
assert.ok(!src.includes('entries.slice(page*50'),'live workbook must keep every filtered row in one scrollable table');
assert.ok(src.includes('แสดงครบ ${shown.length}'),'screen must explain that all filtered rows are shown on one page');
assert.ok(src.includes('id="mc8-live-wrap-text"'),'workbook must expose a show-all-text control');
assert.ok(src.includes('data-live-text-cell'),'long cells must be individually expandable');
assert.ok(src.includes('ช่อง “หมายเหตุ/โน้ต” อ่านจากช่องหมายเหตุในไฟล์ BO ต้นทาง'),'screen must explain BO note provenance');
assert.ok(!src.includes("'โน้ต':boNote||bo.reference||row.reason||''"),'empty BO notes must not be replaced by reference or system reason');
const nodes=new Map();const container={innerHTML:'',querySelector(s){if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);},querySelectorAll(){return [];}};
mount(container,{signedIn:()=>false,date:'2026-09-16',onLocal(){},load(){throw Error('should never load');}});
assert.ok(container.innerHTML.includes('กรุณาเข้าสู่ระบบจริง'));
mount(container,{signedIn:()=>true,date:'2026-09-16',company:'MR9',companies:COMPANIES,onLocal(){},load:async(company,date)=>{assert.equal(company,'MR9');assert.equal(date,'2026-09-16');return input;}});
setImmediate(()=>{assert.ok(container.innerHTML.includes('COREPAY'));assert.ok(container.innerHTML.includes('355.00'));assert.ok(container.innerHTML.includes('สรุปยอดแยกตามบัญชี BO'));assert.ok(container.innerHTML.includes('ต่างหลังข้ามวัน'));assert.ok(!container.innerHTML.includes('โหลดผลหรือหลักฐานคู่ไม่ครบ'));assert.ok(container.innerHTML.includes('ปิดได้ทันที'));console.log('Audit live sheets: five-company read-only adapter, deduplicated totals, cross-day totals and login guard passed');});
// SYS123 BBL: old waiting cases must not repeat a BO already in a saved pair.
{
  const lib=require('../mc8-live-sheets.js');
  for(const company of ['SK8','AT4']){
    const p={company,account:company==='SK8'?'6517249394':'6517248040',direction:'deposit',amount:100,
      bo:{fileId:'bo-fixture',row:177,date:'2026-10-10',sec:62880},
      stm:{fileId:'stm-fixture',row:7,date:'2026-10-10',sec:null,noTime:true},
      customer:{bo:{reference:'unique-bo-ref',user:'fixture-user'},stm:{}}};
    const e={id:'old-wait',code:'BO-WAIT-fixture',company,account:p.account,direction:'ฝาก',status:'open',
      ex_type:'missing_stm',system_amount:100,bank_amount:null,bo_date:'2026-10-10',bo_time:'17:28:00',
      customer_details:{waiting_source:true,bo:p.customer.bo,source_rows:{bo:{fileId:'bo-fixture',row:176}}}};
    const d={run:{company,business_date:'2026-10-10',summary:{match_evidence:[p]}},cases:[e,{...e,id:'history',status:'closed'}]};
    const before=JSON.stringify(d),rows=lib.rowsOf(d,company);
    assert.equal(rows.length,1);assert.equal(rows[0].case.id,e.id);
    assert.equal(rows[0].case.status,'open');assert.equal(rows[0].relatedWaitingCases.length,2);
    assert.equal(rows[0].waiting,undefined);assert.equal(rows[0].pmAmount,100);
    assert.equal(lib.summarize(rows).boCents,10000);assert.equal(lib.summarize(rows).waitingBoCount,0);
    assert.equal(JSON.stringify(d),before,'no stored case/source/run mutation');
    for(const change of [{system_amount:99},{bo_time:'18:55:00'},{company:'FR8'},
      {customer_details:{...e.customer_details,bo:{...p.customer.bo,reference:'another-ref'}}},
      {customer_details:{...e.customer_details,bo:{...p.customer.bo,user:'another-user'}}}]){
      assert.equal(lib.rowsOf({...d,cases:[{...e,...change}]},company).length,2,'not folded without exact identity');
    }
    assert.equal(lib.rowsOf({...d,run:{...d.run,summary:{match_evidence:[p,{...p,stm:{...p.stm,row:8}}]}},cases:[e]},company).length,3,'ambiguous evidence remains visible');
    const differentTime={...p,bo:{...p.bo,row:22,sec:80280},customer:{...p.customer,bo:{...p.customer.bo,reference:'second-real-ref'}}};
    assert.equal(lib.rowsOf({...d,run:{...d.run,summary:{match_evidence:[p,differentTime]}}},company).length,2,'same amount at another time is a distinct transaction');
    const cross={...e,id:'cross-case',code:'EX-cross',status:'pending_next_day',ex_type:'cross_day',customer_details:{bo:p.customer.bo}};
    const unresolved={run:{summary:{}},cases:[cross,e]},unresolvedBefore=JSON.stringify(unresolved);
    const unresolvedRows=lib.rowsOf(unresolved,company);
    assert.equal(unresolvedRows.length,1);assert.equal(unresolvedRows[0].case.id,'cross-case');
    assert.equal(unresolvedRows[0].waiting,true);assert.equal(unresolvedRows[0].crossDay,true);
    assert.equal(unresolvedRows[0].isPair,false);assert.equal(unresolvedRows[0].relatedWaitingCases[0].id,e.id);
    assert.equal(lib.summarize(unresolvedRows).boCents,10000);
    assert.equal(lib.summarize(unresolvedRows).waitingBoCents,10000);
    assert.equal(lib.summarize(unresolvedRows).crossDayBoCents,10000);
    assert.equal(lib.summarize(unresolvedRows).matchedCount,0);
    assert.equal(JSON.stringify(unresolved),unresolvedBefore);
    assert.equal(lib.rowsOf({...unresolved,cases:[cross,{...e,bo_time:'18:55:00'}]},company).length,2);
    assert.equal(lib.rowsOf({...unresolved,cases:[cross,{...cross,id:'ambiguous'},e]},company).length,3);
  }
  const comm={id:'commission-fixture',company:'SK8',account:'igoal21431',direction:'-',status:'open',ex_type:'comm_cut_missing',system_amount:128,bo_date:'2026-10-10',bo_time:'19:28:13',bo_raw:'commission source fixture'};
  const d={run:{summary:{}},cases:[comm]},before=JSON.stringify(d);
  assert.equal(lib.rowsOf(d,'SK8').length,0);assert.equal(JSON.stringify(d),before);
  assert.equal(lib.rowsOf({...d,cases:[{...comm,direction:'ฝาก',account:'6517249394'}]},'SK8').length,1,'real deposit retained');
  assert.equal(lib.rowsOf({...d,cases:[{...comm,company:'AT4'}]},'AT4').length,1,'SK8 filter is company scoped');
  console.log('SYS123 bank waiting history identity and SK8 financial direction scope passed');
}
