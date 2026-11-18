const assert=require('node:assert/strict');
const {bayStatementDisplay,hydrateBayStatementDisplay,rowsOf,tableView}=require('../mc8-live-sheets.js');

assert.deepEqual(bayStatementDisplay('รับโอนเงิน BAAC นาย อภิโชติ กมลสินธุ์ บัญชีต้นทาง : X501671 หมายเลขอ้างอิง : 3486501671'),{
  account:'X501671',tail:'1671',bank:'BAAC',name:'นาย อภิโชติ กมลสินธุ์',reference:'3486501671',
  description:'รับโอนเงิน BAAC นาย อภิโชติ กมลสินธุ์ บัญชีต้นทาง : X501671 หมายเลขอ้างอิง : 3486501671',
});
assert.equal(bayStatementDisplay('รายการที่ไม่มีข้อมูลคู่โอน'),null);
assert.deepEqual(bayStatementDisplay('โอนเงิน SCB PIMPORN KAEWS บัญชีปลายทาง : X532003'),{
  account:'X532003',tail:'2003',bank:'SCB',name:'PIMPORN KAEWS',reference:'',
  description:'โอนเงิน SCB PIMPORN KAEWS บัญชีปลายทาง : X532003',
});

(async()=>{
  const date='2026-11-17',sec=3*3600+9*60+10;
  const source=row=>({fileId:'bay-source',row,date,sec});
  const pair=row=>({company:'FR8',account:'BAY',direction:'deposit',amount:3000,stmAmount:3000,boAmount:3000,
    stm:source(row),bo:{fileId:'bo-source',row,date,sec},customer:{bo:{reference:'bo-'+row},stm:{}}});
  const data={run:{id:'saved-run',company:'FR8',business_date:date,summary:{match_evidence:[pair(3),pair(4)]}},cases:[]};
  const savedRun=JSON.stringify(data.run);
  const descriptions=[
    'รับโอนเงิน BAAC นาย อภิโชติ กมลสินธุ์ บัญชีต้นทาง : X501671 หมายเลขอ้างอิง : 3486501671',
    'รับโอนเงิน SCB นางสาว ทดสอบ สอง บัญชีต้นทาง : X999222 หมายเลขอ้างอิง : 3486999222',
  ];
  const calls=[];
  const errors=await hydrateBayStatementDisplay(data,[{id:'bay-source',kind:'stm_pdf',file_name:'FR8_STM_BAY_DW_2026-11-17.pdf'}],async file=>{
    calls.push(file.id);
    return {bank:'BAY',records:[3,4].map((row,index)=>({rowNo:row,date,sec,amount:3000,direction:'deposit',description:descriptions[index]}))};
  });
  assert.deepEqual(errors,[]);
  assert.deepEqual(calls,['bay-source']);
  assert.equal(JSON.stringify(data.run),savedRun,'saved reconciliation evidence must not change');
  const rows=rowsOf(data,'FR8');
  assert.equal(rows.length,2,'same-time same-amount source rows remain separate');
  const view=tableView(rows,'FR8',date,true,'all');
  const account=view.headers.indexOf('STM/PM · บัญชีลูกค้า');
  const name=view.headers.indexOf('STM/PM · ชื่อ / User');
  const raw=view.headers.indexOf('STM/PM · รายละเอียดต้นฉบับ');
  assert.deepEqual(view.rows.map(row=>row[account]),['X501671','X999222']);
  assert.deepEqual(view.rows.map(row=>row[name]),['นาย อภิโชติ กมลสินธุ์','นางสาว ทดสอบ สอง']);
  assert.ok(view.rows[0][raw].includes('หมายเลขอ้างอิง'));
  assert.deepEqual(view.rows.map(row=>row[view.headers.indexOf('STM/PM · ยอด')]),[3000,3000]);
  const mismatched={run:{...data.run,summary:{match_evidence:[pair(3)]}},cases:[]};
  await hydrateBayStatementDisplay(mismatched,[{id:'bay-source',kind:'stm_pdf',file_name:'FR8_STM_BAY_DW_2026-11-17.pdf'}],async()=>({
    bank:'BAY',records:[{rowNo:3,date,sec,amount:4000,direction:'deposit',description:descriptions[0]}],
  }));
  assert.equal(rowsOf(mismatched,'FR8')[0].pm.account,undefined,'wrong source amount cannot supply display data');
  console.log('BAY STM display tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

// BAY's current PDF places the time and counterparty on continuation lines.
const line=(...cells)=>({items:cells.map(([x,s])=>({x,s})),text:cells.map(c=>c[1]).join(' ')});
const splitPages=[[line([136,'ถอน'],[220,'ฝาก'],[272,'ยอดเงินในบัญชี'],[325,'รหัส'],[350,'คำอธิบายรายละเอียด'],[492,'ช่องทาง']),
  line([25,'17/11/2026'],[201,'3,000.00'],[284,'3,613.00'],[324,'TN'],[350,'รับโอนเงิน'],[492,'MOBILE']),
  line([25,'03:09:10'],[350,'BAAC TEST ONE']),line([350,'บัญชีต้นทาง : X501671']),line([350,'หมายเลขอ้างอิง : 123456']),
  line([25,'17/11/2026'],[119,'3,000.00'],[290,'613.00'],[324,'TW'],[350,'โอนเงิน'],[492,'INTERNET']),
  line([25,'03:09:17'],[350,'KBANK TEST TWO']),line([350,'บัญชีปลายทาง : X855007']),line([350,'หมายเลขอ้างอิง : 456789'])]];
(async()=>{
  const m=require('../mc8-live-sheets.js');const records=m.bayStatementDisplayRecords(splitPages);
  assert.equal(records.length,2);assert.equal(records[0].sec,11350);assert.equal(records[1].direction,'withdraw');
  const pair=(row,direction)=>({company:'3XB',direction,amount:3000,stmAmount:3000,boAmount:3000,stm:{fileId:'bay',row,date:'2026-11-17',sec:11340},bo:{fileId:'bo',row,date:'2026-11-17',sec:11340},customer:{stm:{},bo:{}}});
  const data={run:{business_date:'2026-11-17',summary:{match_evidence:[pair(1,'deposit'),pair(2,'withdraw')]}},cases:[]};
  const original=JSON.stringify(data.run);
  await m.hydrateBayStatementDisplay(data,[{id:'bay',kind:'stm_pdf',file_name:'3XB_STM_BAY_DW.pdf'}],async()=>({bank:'BAY',records}));
  assert.equal(data.bayDisplayBySource['bay|1'].name,'TEST ONE');assert.equal(data.bayDisplayBySource['bay|2'].name,'TEST TWO');
  assert.equal(JSON.stringify(data.run),original);
  const conflict={...data,cases:[],run:{summary:{match_evidence:[pair(1,'withdraw')]}}};
  await m.hydrateBayStatementDisplay(conflict,[{id:'bay',kind:'stm_pdf',file_name:'3XB_STM_BAY_DW.pdf'}],async()=>({bank:'BAY',records}));
  assert.deepEqual(conflict.bayDisplayBySource,{});
  console.log('BAY split-line display and minute provenance tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

(async()=>{
 const m=require('../mc8-live-sheets.js');
 const pairs=[1,2].map(row=>({company:'3XB',account:'0019657483',direction:'deposit',amount:3000,stmAmount:3000,boAmount:3000,stm:{fileId:'bay',row,date:'2026-11-17',sec:11340},bo:{fileId:'bo',row,date:'2026-11-17',sec:11340},customer:{stm:{},bo:{}}}));
 const d={run:{business_date:'2026-11-17',summary:{match_evidence:pairs}},cases:[]};
 const before=m.summarize(m.rowsOf(d,'3XB'));
 await m.hydrateBayStatementDisplay(d,[{id:'bay',kind:'stm_pdf',file_name:'3XB_STM_BAY_DW.pdf'}],async()=>({bank:'BAY',records:[1,2].map(rowNo=>({rowNo,date:'2026-11-17',sec:11350,amount:3000,direction:'deposit',description:'รับโอนเงิน SCB TEST บัญชีต้นทาง : X123456 หมายเลขอ้างอิง : 111111'}))}));
 const rows=m.rowsOf(d,'3XB');
 assert.deepEqual(m.summarize(rows),before,'display-only bank references must never alter physical-row totals');
 assert.equal(rows[0].pm.reference,undefined,'financial identity is unchanged');
 assert.equal(rows[0].pmDisplay.reference,'111111');
 console.log('BAY duplicate display references preserve all financial totals');
})().catch(e=>{console.error(e);process.exitCode=1;});
