// Apply only the reviewed engine/parser delta to a current exported Code node.
// Never substitute the repository's older orchestration/runtime wholesale.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const [source,destination]=process.argv.slice(2);
if(!source||!destination) throw new Error('Supply backup and output paths');
let code=fs.readFileSync(source,'utf8');
for(const file of ['engine.js','pdf-stm.js']) {
 if(file==='pdf-stm.js'&&!code.includes('const PdfStm')) continue;
 const patch=execFileSync('git',['diff','--unified=0','--',file],{encoding:'utf8'});
 for(const hunk of patch.split(/^@@[^\n]*\n/m).slice(1)) {
   const lines=hunk.split('\n');
   const before=lines.filter(l=>l.startsWith('-')).map(l=>l.slice(1)).join('\n');
   const after=lines.filter(l=>l.startsWith('+')).map(l=>l.slice(1)).join('\n');
   // Pure additions need surrounding source context, handled below instead.
   if(!before) continue;
   if(code.split(before).length!==2) throw new Error('Non-unique live source hunk: '+before.slice(0,80));
   code=code.replace(before,after);
 }
}
function add(anchor,text){if(code.split(anchor).length!==2)throw new Error('Non-unique anchor');code=code.replace(anchor,text+anchor);}
add('  const TYPE_NAME = {\n','');
code=code.replace('  const TYPE_NAME = {\n','  const TYPE_NAME = {\n    bank_charge: "ค่าธรรมเนียม / ดอกเบี้ยธนาคาร (แยกจาก BO)",\n');
code=code.replace('  const BASE_SEVERITY = {\n','  const BASE_SEVERITY = {\n    bank_charge: "low",\n');
const engine=fs.readFileSync('engine.js','utf8');
const chargeBlock=engine.slice(engine.indexOf('    // Keep charges in BBL'),engine.indexOf('    boRecords = boRecords.map(absoluteAmount);'));
add('    boRecords = boRecords.map(absoluteAmount);',chargeBlock);
code=code.replace('    const exceptions = [];','    const exceptions = [];\n    bankCharges.forEach(r => exceptions.push(mkException(\'bank_charge\', r, null, 0)));');
const pass=code.indexOf('    const stmLeft2 = [];');
const direction=code.indexOf('            if (!dirOK(s, b)) continue;',pass);
if(pass<0||direction<0)throw new Error('Missing amount-difference pass');
code=code.slice(0,direction)+'            if (s.noTime || b.noTime) continue;\n'+code.slice(direction);
code=code.replace('      stmCount: reconciledStmCount,','      stmCount: reconciledStmCount,\n      bankChargeCount: bankCharges.length,');
code=code.replace('        amount_diff: "คีย์ยอดผิดจากต้นฉบับ",','        bank_charge: "รายการค่าธรรมเนียม / ดอกเบี้ยตามเอกสารธนาคาร ไม่ใช่คู่ธุรกรรม BO",\n        amount_diff: "คีย์ยอดผิดจากต้นฉบับ",');
if(!code.includes('1.9.83-fr8-source-time-review'))throw new Error('Unexpected live baseline');
code=code.replaceAll('1.9.83-fr8-source-time-review','1.9.84-bbl-bank-charge-split');
new (Object.getPrototypeOf(async function(){}).constructor)('$input','$json','$',code);
fs.writeFileSync(destination,code);
console.log('Patched only BBL engine/parser delta; live FR8 baseline preserved');
