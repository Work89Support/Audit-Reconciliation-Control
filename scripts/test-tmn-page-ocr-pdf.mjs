/* Isolated local test: original PDF -> actual embedded n8n splitter -> fixture
   OCR provider -> strict validator. Never uploads or writes a production row. */
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import path from 'node:path';
import {sha256,splitCode} from './tmn-page-ocr-workflow.mjs';
const require=createRequire(import.meta.url),OCR=require('../tmn-page-ocr.js'),PDF=require('../vendor/pdf-lib-1.17.1.min.js');
const [pdfPath,ocrPath,outDir]=process.argv.slice(2);
if(!pdfPath||!ocrPath||!outDir)throw Error('original.pdf page-ocr.json private-output-dir required');
const bytes=fs.readFileSync(pdfPath),count=(await PDF.PDFDocument.load(bytes)).getPageCount();
const file={id:'isolated-physical-source',file_name:'UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-11-22.pdf',kind:'stm_pdf',checksum:sha256(bytes)};
const context=vm.createContext({Buffer,Uint8Array,DataView,setTimeout,clearTimeout,console,$:()=>({item:{json:{file}}}),
 helpers:{getBinaryDataBuffer:async()=>bytes,prepareBinaryData:async(data,fileName,mimeType)=>({data:data.toString('base64'),fileName,mimeType})}});
const split=await vm.runInContext('(async function(){'+splitCode()+'\n}).call({helpers})',context);
if(split.length!==count)throw Error('Physical page count mismatch');
const fixture=JSON.parse(fs.readFileSync(ocrPath,'utf8'));
fs.mkdirSync(outDir,{recursive:true});
const pages=[];
for(const item of split){
 const page=item.json.tmn_page;
 const f=fixture.find(x=>x.page===page.page);
 fs.writeFileSync(path.join(outDir,'page-'+String(page.page).padStart(2,'0')+'.pdf'),Buffer.from(item.binary.data.data,'base64'));
 if(!f){pages.push({...page,text:'',error:'provider returned no page'});continue;}
 // Vision fixture observations use physical page coordinates. Group words
 // on the same visual line; this is test-provider formatting, not amount or
 // date repair. Keep every OCR character and every repeated occurrence.
 const groups=[];
 for(const o of f.observations){let g=groups.find(g=>Math.abs(g.y-o.y)<0.008);if(!g){g={y:o.y,items:[]};groups.push(g);}g.items.push(o);}
 const lines=groups.sort((a,b)=>a.y-b.y).map(g=>g.items.sort((a,b)=>a.x-b.x).map(o=>o.text).join(' '));
 pages.push({...page,text:lines.join('\n')});
}
const envelope={version:'tmn-page-ocr-v1',sourceFileId:file.id,sourceSha256:file.checksum,pageCount:count,pages};
fs.writeFileSync(path.join(outDir,'page-linked-evidence.json'),JSON.stringify(envelope,null,2));
let report;
try{
 const parsed=OCR.normalize(envelope,file,{company:'UFABET7M',business_date:'2026-11-22'});
 fs.writeFileSync(path.join(outDir,'parsed-private.json'),JSON.stringify(parsed,null,2));
 report={physicalPages:count,ocrPages:pages.length,quality:'passed',principalCount:parsed.records.length,excludedFees:parsed.quality.pages.reduce((n,p)=>n+p.feeCount,0)};
}catch(e){report={physicalPages:count,ocrPages:pages.length,pagesProcessed:e.pagesProcessed,quality:'needs_review',errors:e.pageErrors||[e.message]};}
report.provider='Apple Vision offline fixture; Google Drive production OCR not yet tested';
report.productionWrites=0;
fs.writeFileSync(path.join(outDir,'test-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
