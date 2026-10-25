const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync('formats.js','utf8')+'\nglobalThis.F=Formats;',context);
const sheets=require('../mc8-live-sheets.js');

(async()=>{
  const rows=[
    ['เวลา','ประเภท','ยูสเซอร์','บัญชี','บัญชีบริษัท','ยอดเงิน','โบนัส','โน้ต','ผู้ดำเนินการ','แก้ไข'],
    ['2026-10-24 22:58','จ่ายค่าคอม','ufpyo7mm146937','ณรงค์ชัย พรหมพินิจ (BBL) 5824423262','Keep -',110,0,'ค่าคอมมิชชั่น','ลอย','แก้ไข'],
    ['2026-10-24 23:59','ถอน','ufpyo7mm142817','นาย ธรรมสอน (KBANK) 0611216572','ถอน KB กิตติ 1953583301',50,0,'ถอน split จากรายการ P2C-20261024-233023-NW8JIB','ไว','แก้ไข'],
  ];
  const parsed=context.F.parse('UFABET7M_BO_2026-10-24.xlsx',rows,'2026-10-24');
  assert.equal(parsed.records.length,1);
  assert.equal(parsed.aux.length,1);
  assert.equal(parsed.aux[0].kind,'xb_information');
  assert.equal(parsed.aux[0].infoCategory,'เก็บ');
  assert.equal(parsed.aux[0].amount,110);
  assert.equal(parsed.records[0].boIdentityRaw,'ถอน KB กิตติ 1953583301');

  const data={run:{company:'UFABET7M',business_date:'2026-10-24',summary:{match_evidence:[{
    company:'UFABET7M',account:'1953583301',direction:'withdraw',boAmount:50,stmAmount:50,
    bo:{fileId:'bo-7m',row:parsed.records[0].rowNo,date:'2026-10-24',sec:86340},
    stm:{fileId:'stm-7m',row:7,date:'2026-10-24',sec:86340},customer:{bo:{reference:'P2C-20261024-233023-NW8JIB'},stm:{}}
  }]}},cases:[]};
  await sheets.hydrateBoOperators(data,[{id:'bo-7m',company:'UFABET7M',kind:'bo_main',parsed:true,file_name:'UFABET7M_BO_2026-10-24.xlsx'}],async()=>[...parsed.records,...parsed.aux]);
  assert.equal(data.sourceBo.length,1,'Keep is not a reconciliation source row');
  assert.equal(data.xbInformation.length,1,'Keep remains available as supporting information');
  const info=sheets.informationSheets(data.xbInformation,'UFABET7M');
  assert.deepEqual(info.map(sheet=>sheet.name),['เก็บ']);
  assert.equal(info[0].rows[0][11],'ข้อมูลประกอบ · ไม่กระทบยอด · ไม่เป็นเคส');
  const groups=sheets.accountReviewGroups(sheets.rowsOf(data,'UFABET7M'));
  assert.equal(groups.length,1);
  assert.equal(groups[0].label,'ถอน KB กิตติ 1953583301');
  const labels=[
    ['ATP PAYMENT ถอน 00000ATP','withdraw'],['ATP PAYMENT ฝาก 00000ATP','deposit'],
    ['CP2 PAYMENT ถอน 000000CP2','withdraw'],['CP2 PAYMENT ฝาก 000000CP2','deposit'],
    ['CYBERPLUS PAYMENT ถอน 00000CYBERPLUS','withdraw'],['CYBERPLUS PAYMENT ฝาก 00000CYBERPLUS','deposit'],
    ['ถอน KB กิตติ 1953583301','withdraw'],['ฝาก SCB สมภพ 5034633891','deposit'],
    ['ฝาก TMN รุ่งฟ้า 0812792075','deposit'],['ถอน TMN รุ่งฟ้า 0812792075','withdraw'],
    ['ฝาก TMN สรวิศา 0639274201','deposit'],['ถอน TMN สรวิศา 0639274201','withdraw'],
    ['ถอน ผู้ให้บริการใหม่ 99999NEW','withdraw'],
  ];
  const dynamicGroups=sheets.accountReviewGroups(labels.map(([label,direction],index)=>({
    key:`bo-${index}`,company:'UFABET7M',account:label,boAccountLabel:label,direction,
    boAmount:index+1,boDate:'2026-10-24',bo:{reference:`BO-${index}`},kind:'review'
  })));
  assert.deepEqual(dynamicGroups.map(group=>group.label).sort((a,b)=>a.localeCompare(b,'th')),labels.map(([label])=>label).sort((a,b)=>a.localeCompare(b,'th')));
  console.log('7M Keep information exclusion and exact BO account label passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
