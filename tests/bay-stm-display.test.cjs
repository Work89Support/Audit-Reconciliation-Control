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
