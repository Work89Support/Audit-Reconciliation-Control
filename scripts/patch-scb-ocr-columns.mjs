import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {reconstructScbOcrColumns}=require('./scb-ocr-columns.cjs');
export function patchPdfParser(code){
 const needle='  async function parseText(fileName, text, businessDate) {\n    return parse(fileName, pagesFromText(text), businessDate);\n  }';
 assert.equal(code.split(needle).length,2,'Expected one unchanged parseText entrypoint');
 const replacement=`  ${reconstructScbOcrColumns.toString()}\n  async function parseText(fileName, text, businessDate) {
    const original=await parse(fileName,pagesFromText(text),businessDate);
    if(original.quality?.complete||original.header?.bank!=='SCB')return original;
    const restored=reconstructScbOcrColumns(text);
    if(!restored)return original;
    const recovered=await parse(fileName,pagesFromText(restored.text),businessDate);
    if(!recovered.quality?.complete||recovered.quality.parsedRows!==restored.proof.length)return original;
    const proof=new Map(restored.proof.map(p=>[p.canonical,p]));
    for(const row of recovered.records||[]){const source=proof.get(row.raw);if(!source)return original;row.page=source.page;row.sourceLine=source.sourceLine;row.ocrColumnProof=source;}
    recovered.quality.ocrColumnReconstruction={method:'scb_ocr_balanced_columns_v1',parsedRows:restored.proof.length,sourcePages:Math.max(...restored.proof.map(p=>p.page)),originalUnreadRows:original.quality.unreadRows.length};
    recovered.warnings.push('กู้คอลัมน์ OCR โดยตรวจยอดพิมพ์จริง จำนวนแถว ทิศทาง และยอดคงเหลือต่อเนื่องครบทุกหน้า เก็บอ้างอิงข้อความเดิมทุกแถว');
    return recovered;
  }`;
 return code.replace(needle,replacement);
}
export function patchWorkflow(w){
 const next=structuredClone(w),n=next.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน');assert.ok(n);
 n.parameters.jsCode=patchPdfParser(n.parameters.jsCode);
 return next;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output]=process.argv.slice(2),w=JSON.parse(await fs.readFile(input,'utf8')),next=patchWorkflow(w);
 await fs.writeFile(output,JSON.stringify(next,null,2)+'\n');
 await fs.writeFile(output+'.normalize.txt',next.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน').parameters.jsCode);
 console.log('Prepared strict SCB column recovery; other parser/runtime code retained');
}
