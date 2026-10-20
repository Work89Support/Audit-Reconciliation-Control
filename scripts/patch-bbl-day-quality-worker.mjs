import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parser=await fs.readFile(path.join(root,'pdf-stm.js'),'utf8');
const start=parser.indexOf('    // BBL exports can contain');
const end=parser.indexOf('    if (head.bank === "SCB" && rows.some',start);
assert.ok(start>0&&end>start);
const oldInvalid='    const invalidRows = rows.filter((r) => !r.date || r.sec === null || !Number.isFinite(r.amount) || !r.direction);\n';
const oldQuality='      unreadRows, invalidRows: invalidRows.map((r) => ({ raw: r.raw, reason: "วันที่ เวลา ยอด หรือทิศทางยังยืนยันไม่ได้" })) };';
const newQuality=parser.slice(parser.indexOf('      unreadRows, invalidRows: invalidRows.map'),parser.indexOf('\n\n    // ทีมใช้งาน'));
const oldWarning='    const warnings = [];\n    if (previousDayReport)';
const newWarning=parser.slice(parser.indexOf('    const warnings = [];',end),parser.indexOf(' warnings.push(`Statement เป็นข้อมูล',end));
// Update only the reviewed quality block in the six embedded PDF parsers.
// No selectors, RPCs, credentials, trigger/activation or job state changes.
for(const name of ['audit-headless-worker','audit-account-recheck','audit-round-worker']){
 const p=path.join(root,'n8n',name+'.json'),w=JSON.parse(await fs.readFile(p,'utf8'));
 let count=0;
 for(const n of w.nodes){
  let c=n.parameters?.jsCode;if(!c?.includes('const PdfStm = '))continue;
  if(!c.includes('const outOfDayDirectionRows = []')){
   for(const s of [oldInvalid,oldQuality,oldWarning])assert.equal(c.split(s).length,2,`${name}/${n.name}: expected unique quality anchor`);
   c=c.replace(oldInvalid,parser.slice(start,end)).replace(oldQuality,newQuality).replace(oldWarning,newWarning);
  }
  const qa=c.indexOf('    const quality = { complete: unreadRows.length'),qb=c.indexOf('\n\n    // ทีมใช้งาน',qa);
  assert.ok(qa>0&&qb>qa,'Expected bounded PDF quality receipt');
  c=c.slice(0,qa)+parser.slice(parser.indexOf('    const quality = { complete: unreadRows.length'),parser.indexOf('\n\n    // ทีมใช้งาน'))+c.slice(qb);
  n.parameters.jsCode=c;count++;
 }
 assert.equal(count,2,`${name}: probe and normalizer both patched`);
 await fs.writeFile(p,JSON.stringify(w,null,2)+'\n');
}
console.log('Patched native PDF probe and normalizer in three worker definitions; no production action');
