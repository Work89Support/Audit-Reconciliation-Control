const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync('formats.js','utf8')+'\nglobalThis.F=Formats;',context);
vm.runInContext(fs.readFileSync('rules.js','utf8')+'\nglobalThis.R=Rules;',context);
const {F,R}=context,sheets=require('../mc8-live-sheets.js'),schema=require('../mc8-sheet-schema.js');
const header=['รหัส','เวลา','ประเภท','ประเภทดำเนินการ','ยูสเซอร์','ธนาคาร','จำนวน','จำนวนที่ได้รับ','ค่าธรรมเนียม','เวลาทำรายการ','หมายเหตุ','ผู้ดำเนินการ'];
const row=(type,id,time,amount=5)=>[id,'2026-10-10 '+time,type,type,'user','-',amount,0,0,'2026-10-10 '+time,'กิจกรรมวงล้อ','Admin'];
(async()=>{
for(const company of ['3XB','MC8','MR9','PS8','UR9']){
 const rows=[header,row('เก็บ','1','01:00'),row('ฝากAFF','2','01:01'),row('โบนัส','3','01:02'),row('โบนัส','4','01:03'),row('ยกเลิก','5','01:04',0),row('ฝาก','6','01:05')];
 const parsed=F.parse(company+'_BO_2026-10-10.xlsx',rows,'2026-10-10');
 assert.equal(parsed.records.length,1,'real UNKNOWN cash deposit retained');
 assert.equal(parsed.records[0].amount,5);
 assert.equal(parsed.aux.length,5,'all informational source rows retained including zero cancellation');
 assert.equal(R.run([{records:[],aux:parsed.aux}],{}).exceptions.length,0,'informational records cannot create rule cases');
 const data={run:{company,business_date:'2026-10-10',summary:{}},cases:[]};
 await sheets.hydrateBoOperators(data,[{id:'file',company,kind:'bo_main',parsed:true,file_name:'BO.xlsx'}],async()=>[...parsed.records,...parsed.aux]);
 assert.equal(data.sourceBo.length,1);assert.equal(data.xbInformation.length,5);
 const info=sheets.informationSheets(data.xbInformation,company);
 assert.deepEqual(info.map(s=>s.name),['เก็บ','ฝาก AFF','โบนัส','ยกเลิก']);
 assert.equal(info[2].rows.length,2);assert.notEqual(info[2].rows[0][1],info[2].rows[1][1]);
 const all=sheets.rowsOf(data,company),before=sheets.summarize(all);
 const exp=sheets.buildAuditExportSheets(all,company,'2026-10-10',false,schema,null,data.xbInformation);
 assert.deepEqual(exp.slice(-4).map(s=>s.name),info.map(s=>s.name));
 assert.equal(new Set(exp.map(s=>s.name)).size,exp.length);
 assert.deepEqual(sheets.summarize(all),before,'informational sheets do not alter cash sums or matches');
 const legacy={id:'old-bonus-case',company,account:'UNKNOWN',direction:'deposit',status:'open',system_amount:5,bank_amount:null,bo_date:'2026-10-10',bo_time:'01:02:00',bo_raw:'3 | 2026-10-10 01:02 | โบนัส | โบนัส | user | - | 5',customer_details:{source_rows:{bo:{fileId:'file',row:parsed.aux[2].rowNo}}}};
 const realCash={...legacy,id:'cash-case',bo_raw:'6 | 2026-10-10 01:05 | ฝาก | ฝาก | user | - | 5',customer_details:{source_rows:{bo:{fileId:'file',row:parsed.records[0].rowNo}}}};
 data.cases=[legacy,realCash];const storedCases=JSON.stringify(data.cases);
 const financial=sheets.rowsOf(data,company);
 assert.ok(!financial.some(r=>r.key===legacy.id),'historical activity case excluded from financial rows');
 assert.ok(financial.some(r=>r.key===realCash.id),'real UNKNOWN cash remains visible');
 assert.equal(sheets.summarize(financial).boCount,1);
 assert.equal(sheets.summarize(financial).boCents,500);
 assert.equal(JSON.stringify(data.cases),storedCases,'no deletion or closure of historical cases');
 assert.equal(sheets.informationSheets(data.xbInformation,company)[2].rows.length,2,'source activities remain in bonus sheet');
 const withoutSource={...data,xbInformation:[]};
 assert.ok(!sheets.rowsOf(withoutSource,company).some(r=>r.key===legacy.id),'explicit legacy bonus raw is excluded even if source cannot load');
 const withStatement={...legacy,bank_amount:5,stm_date:'2026-10-10',stm_raw:'bank evidence'};
 assert.ok(sheets.rowsOf({...data,cases:[withStatement]},company).some(r=>r.key===legacy.id),'never hide statement evidence');
 const cancelledWithdrawal=row('ถอน','cancel-withdraw','01:06');cancelledWithdrawal[3]='ยกเลิก';
 const cancelled=F.parse(company+'_BO_2026-10-10.xlsx',[header,cancelledWithdrawal],'2026-10-10');
 assert.equal(cancelled.records.length,0);assert.equal(cancelled.aux[0].infoCategory,'ยกเลิก');
}
for(const company of ['FR8','AT4','SK8','UFABET7M']){
 const parsed=F.parse(company+'_BO_2026-10-10.xlsx',[header,row('โบนัส','1','01:00')],'2026-10-10');
 assert.equal(parsed.records.length,1);assert.equal(parsed.aux.length,0);
 assert.equal(sheets.informationSheets([],company).length,0);
}
console.log('XB four information categories: five-company scope, real cash, zero cancellation, repeated amounts, no rule cases and unchanged reconciliation totals passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
