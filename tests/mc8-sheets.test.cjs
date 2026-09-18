const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const schema = require('../mc8-sheet-schema.js');
assert.deepEqual(schema.sheets.map(s=>s.name),['AT ถ','AT ฝ','AZ ถ','AZ ฝ','CP ถ','CP ฝ','M ถ','M ฝ']);
assert.deepEqual(schema.sheets.map(s=>s.headers.indexOf('รหัส')), [22,22,22,24,25,24,24,23]);
assert.equal(schema.company,'MC8');
for(const sheet of schema.sheets){
  assert.equal(sheet.headers[0],'id');
  assert.equal(sheet.headers.filter(Boolean).slice(-1)[0],'ผู้ดำเนินการ');
  assert.equal(sheet.headers.filter(h=>h==='รหัส').length,1);
}
const context = {window:{MC8SheetSchema:schema}};
vm.runInNewContext(fs.readFileSync(require.resolve('../mc8-sheets.js'),'utf8'),context);
let listeners=[];
const container={innerHTML:'',querySelectorAll: selector=>selector==='[data-sheet]'?[-1,0,1,2,3,4,5,6,7].map(i=>({dataset:{sheet:String(i)},addEventListener:(event,handler)=>{if(event==='click')listeners.push(handler);}})):[],querySelector:()=>({focus(){},addEventListener(){}})};
context.window.MC8Sheets.render(container);
assert.ok(container.innerHTML.includes('aria-labelledby="mc8-tab--1"'));
assert.ok(container.innerHTML.includes('ขอบเขต 8 ชีต'));
assert.ok(container.innerHTML.includes('ไม่หักกลบกัน'));
assert.ok(container.innerHTML.includes('ผลต่าง STM − BO'));
assert.deepEqual(schema.sheets.map(context.window.MC8Sheets.amountHeader), ['transferredAmount','realAmount','amount','realAmount','amount','realAmount','transferredAmount','realAmount']);
const combined = context.window.MC8Sheets.combinedSheet(schema.sheets);
for (const sheet of schema.sheets) for(const header of sheet.headers.filter(Boolean)) assert.ok(combined.headers.includes(header));
const scope = context.window.MC8Sheets.sourceSheets;
for(const pm of ['AT','AZ','CP','M']) {
  assert.equal(scope(schema.sheets,pm,'all').length,2);
  for(const type of ['ถ','ฝ']) assert.equal(scope(schema.sheets,pm,type)[0].name,`${pm} ${type}`);
}
assert.equal(scope(schema.sheets,'all','ฝ').length,4);
assert.equal(scope(schema.sheets,'all','ถ').length,4);
const balances=[{name:'AT ฝ',pmTotal:100,boTotal:200,errors:[]},{name:'CP ฝ',pmTotal:100,boTotal:100,errors:[]},{name:'M ฝ',missing:true,errors:[]},{name:'AZ ฝ',pmTotal:0,boTotal:0,errors:['invalid']}];
assert.equal(scope(balances,'all','ฝ','different').length,1);
assert.equal(scope(balances,'all','ฝ','different')[0].name,'AT ฝ');
assert.equal(scope(balances,'all','ฝ','equal')[0].name,'CP ฝ');
assert.equal(scope(balances,'CP','ฝ','different').length,0);
assert.equal(scope(balances,'all','all','all').length,4);
const clicks=[...listeners];
for(let i=0;i<8;i++){
  clicks[i+1]();
  assert.ok(container.innerHTML.includes(`aria-labelledby="mc8-tab-${i}"`));
  for(const header of schema.sheets[i].headers.filter(Boolean)) assert.ok(container.innerHTML.includes(`>${header}</th>`));
  assert.equal((container.innerHTML.match(/role="tab"/g)||[]).length,9);
  assert.ok(container.innerHTML.includes('ยังไม่ได้โหลดธุรกรรม'));
  assert.ok(container.innerHTML.includes('<tfoot>'));
  assert.equal((container.innerHTML.match(/— รอข้อมูล/g)||[]).length,2);
  assert.ok(container.innerHTML.includes('รอข้อมูลทั้งสองฝั่ง'));
  assert.ok(container.innerHTML.includes('ยอดรวมตรงกันไม่ได้ยืนยันว่าจับคู่รายรายการครบ'));
}
console.log('MC8: 8 sheet headers, column positions and tab rendering passed');
