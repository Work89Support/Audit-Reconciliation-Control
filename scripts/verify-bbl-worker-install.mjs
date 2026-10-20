// Read exported definitions and an original PDF locally; never call a service.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),[beforePath,afterPath,pdfPath]=process.argv.slice(2);
assert.ok(beforePath&&afterPath&&pdfPath,'before.json after.json original.pdf required');
const before=JSON.parse(fs.readFileSync(beforePath)),after=JSON.parse(fs.readFileSync(afterPath));
const parser=fs.readFileSync(new URL('../pdf-stm.js',import.meta.url),'utf8');
const invalid=parser.slice(parser.indexOf('    // BBL exports can contain'),parser.indexOf('    if (head.bank === "SCB" && rows.some',parser.indexOf('    // BBL exports can contain')));
const quality=parser.slice(parser.indexOf('    const quality = { complete: unreadRows.length'),parser.indexOf('\n\n    // ทีมใช้งาน'));
const wa=parser.indexOf('    const warnings = [];',parser.indexOf('const outOfDayDirectionRows'));
const warnings=parser.slice(wa,parser.indexOf('    if (previousDayReport)',wa));
const names=['ตรวจรายการ PDF ก่อน OCR','แปลงรายการเป็นมาตรฐาน'];
assert.deepEqual(after.connections,before.connections);assert.deepEqual(after.settings,before.settings);assert.equal(after.active,before.active);
assert.equal(after.nodes.length,before.nodes.length);
const pdfjs=require('../vendor/pdf.min.js');pdfjs.GlobalWorkerOptions.workerSrc=require.resolve('../vendor/pdf.worker.min.js');
for(const node of after.nodes){
 const old=before.nodes.find(n=>n.id===node.id);assert.ok(old);
 if(!names.includes(node.name)){assert.deepEqual(node,old);continue;}
 let expected=old.parameters.jsCode;
 const ia=expected.indexOf('    const invalidRows = rows.filter('),ib=expected.indexOf('    if (head.bank === "SCB" && rows.some',ia);
 assert.ok(ia>0&&ib>ia);expected=expected.slice(0,ia)+invalid+expected.slice(ib);
 const qa=expected.includes('    const outsideBblDay = (r) => head.bank === "BBL"')?expected.indexOf('    const outsideBblDay = (r) => head.bank === "BBL"'):expected.indexOf('    const quality = { complete: unreadRows.length');
 const qb=expected.indexOf('\n\n    // ทีมใช้งาน',qa);assert.ok(qa>0&&qb>qa);
 expected=expected.slice(0,qa)+quality+expected.slice(qb);
 const oldWarning='    const warnings = [];\n    if (previousDayReport)';assert.equal(expected.split(oldWarning).length,2);
 expected=expected.replace(oldWarning,warnings+'    if (previousDayReport)');
 assert.equal(node.parameters.jsCode,expected,'Only reviewed PDF quality changes allowed: '+node.name);
 assert.deepEqual({...node,parameters:{...node.parameters,jsCode:''}},{...old,parameters:{...old.parameters,jsCode:''}});
 const code=node.parameters.jsCode,c=vm.createContext({console,pdfjsLib:pdfjs,Uint8Array});
 vm.runInContext(code.slice(0,code.indexOf('const meta='))+';globalThis.P=PdfStm',c);
 const original=await c.P.parse('SK8_STM_BBL.pdf',fs.readFileSync(pdfPath),'2026-10-19');
 assert.equal(original.records.length,12);assert.equal(original.quality.complete,true);
 assert.equal(original.quality.businessDayPolicy,'bbl_previous_day_direction_v1');
 const text=(await c.P.textLines(fs.readFileSync(pdfPath))).map(p=>p.map(l=>l.text).join('\n')).join('\f');
 for(const company of ['3XB','AT4','FR8','SK8','MC8','MR9','PS8','UR9','UFABET7M']){
  const parsed=await c.P.parseText(company+'_STM_BBL.pdf',text,'2026-10-19');
  assert.equal(parsed.records.length,12);assert.equal(parsed.quality.complete,true);
  const bad=await c.P.parseText(company+'_STM_BBL.pdf',text+'\n19/10/26 TRF FR OTH BK unreadable','2026-10-19');
  assert.equal(bad.quality.complete,false);
 }
 console.log(node.name+': original PDF / nine-company native text / current-day fail-closed PASS');
}
console.log('PASS only two PDF quality blocks changed; all other nodes, settings, credentials, connections and activation preserved; no production execution');
