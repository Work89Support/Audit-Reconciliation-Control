import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const PAGE_NODE='แยกหน้า TMN สำหรับ OCR';
// Pure SHA-256 avoids depending on n8n Cloud's require('crypto') allowlist.
export function sha256(bytes) {
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const n=bytes.length,b=new Uint8Array(Math.ceil((n+9)/64)*64);b.set(bytes);b[n]=128;
  const v=new DataView(b.buffer);v.setUint32(b.length-8,Math.floor(n/0x20000000));v.setUint32(b.length-4,(n*8)>>>0);
  const r=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Uint32Array(64);
  for(let j=0;j<b.length;j+=64){
    for(let i=0;i<16;i++)w[i]=v.getUint32(j+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],z=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(z,17)^r(z,19)^(z>>>10)))>>>0;}
    let [a,c,d,e,f,g,l,m]=h;
    for(let i=0;i<64;i++){const t=(m+(r(f,6)^r(f,11)^r(f,25))+((f&g)^((~f)&l))+k[i]+w[i])>>>0;
      const u=((r(a,2)^r(a,13)^r(a,22))+((a&c)^(a&d)^(c&d)))>>>0;m=l;l=g;g=f;f=(e+t)>>>0;e=d;d=c;c=a;a=(t+u)>>>0;}
    [a,c,d,e,f,g,l,m].forEach((x,i)=>h[i]=(h[i]+x)>>>0);
  }
  return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}
export function splitCode() {
  const lib=fs.readFileSync(path.join(root,'vendor/pdf-lib-1.17.1.min.js'),'utf8');
  return `const PDFLib=(()=>{const module={exports:{}},exports=module.exports;${lib}\nreturn module.exports;})();
const sha256=${sha256.toString()};
const f=$('วนทีละไฟล์').item.json.file;
const bytes=await this.helpers.getBinaryDataBuffer(0,'data');
const hash=sha256(bytes);
if(f.checksum&&f.checksum!==hash) throw Error('TMN PDF checksum changed');
const pdf=await PDFLib.PDFDocument.load(new Uint8Array(bytes),{updateMetadata:false});
const count=pdf.getPageCount();
if(count<1||count>100) throw Error('TMN physical page count invalid');
const out=[];
for(let i=0;i<count;i++){
 const one=await PDFLib.PDFDocument.create();one.setCreationDate(new Date(0));one.setModificationDate(new Date(0));
 const original=pdf.getPage(i);let imageOnly=false;
 // A narrow, lossless Word-screenshot path. Drive skips image OCR when a
 // page contains only a native blank-space text object (seen on final pages).
 // Copy the original image stream (JPEG or lossless Flate) without re-encoding,
 // and discard only proven blank text outside that image.
 try {
  const c=original.node.Contents(),parts=c?.asArray?c.asArray():c?[c]:[];
  const content=parts.map(ref=>String.fromCharCode(...PDFLib.decodePDFRawStream(pdf.context.lookup(ref)).decode())).join('\\n');
  const draws=[...content.matchAll(/\\/([A-Za-z0-9_.-]+)\\s+Do\\b/g)];
  const meaningfulText=[...content.matchAll(/\\bBT\\b([\\s\\S]*?)\\bET\\b/g)].some(m=>
    [...m[1].matchAll(/\\(([^()]*)\\)/g)].some(t=>t[1].trim())||/<[a-f0-9]+>/i.test(m[1]));
  const matrices=[...content.matchAll(/([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+cm/g)];
  const matrix=matrices.length===1?matrices[0].slice(1).map(Number):null;
  if(draws.length===1&&!meaningfulText&&matrix&&matrix[0]>0&&matrix[3]>0&&matrix[1]===0&&matrix[2]===0){
   const objects=original.node.Resources()?.lookup(PDFLib.PDFName.of('XObject'));
   const image=objects?.lookup(PDFLib.PDFName.of(draws[0][1]));
   if(image?.dict?.get(PDFLib.PDFName.of('Subtype'))?.toString()==='/Image'){
    const copied=PDFLib.PDFObjectCopier.for(pdf.context,one.context).copy(image);
    const ref=one.context.register(copied),page=one.addPage([matrix[0],matrix[3]]);
    const key=page.node.newXObject('OriginalScreenshot',ref);
    page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.scale(matrix[0],matrix[3]),PDFLib.drawObject(key),PDFLib.popGraphicsState());imageOnly=true;
   }
  }
 } catch { imageOnly=false; }
 if(!imageOnly){const [page]=await one.copyPages(pdf,[i]);one.addPage(page);}
 const data=await one.save({useObjectStreams:false,addDefaultPage:false,updateFieldAppearances:false});
 const binary=await this.helpers.prepareBinaryData(Buffer.from(data),'tmn-page-'+(i+1)+'.pdf','application/pdf');
 out.push({json:{tmn_page:{sourceFileId:f.id,sourceSha256:hash,pageCount:count,page:i+1,pageSha256:sha256(data),imageOnly}},binary:{data:binary},pairedItem:{item:0}});
}
return out;`;
}
export function rowSplitCode(){
 const base=splitCode(),prefix=base.slice(0,base.indexOf("const f=$('วนทีละไฟล์')"));
 const jpeg=fs.readFileSync(path.join(root,'vendor/jpeg-js-0.4.4-decoder.cjs'),'utf8');
 const geometry=fs.readFileSync(path.join(root,'tmn-row-geometry.js'),'utf8');
 return prefix+`\nconst JpegDecode=(()=>{const module={exports:{}},exports=module.exports;${jpeg}\nreturn module.exports;})();\nconst Geometry=(()=>{const module={exports:{}};${geometry}\nreturn module.exports;})();
const f=$('วนทีละไฟล์').item.json.file,bytes=await this.helpers.getBinaryDataBuffer(0,'data'),hash=sha256(bytes);
if(f.checksum&&f.checksum!==hash)throw Error('TMN PDF checksum changed');
const pdf=await PDFLib.PDFDocument.load(new Uint8Array(bytes),{updateMetadata:false}),count=pdf.getPageCount(),out=[];
if(count<1||count>100)throw Error('TMN physical page count invalid');
for(let i=0;i<count;i++){
 const original=pdf.getPage(i),objects=original.node.Resources()?.lookup(PDFLib.PDFName.of('XObject'));
 const contents=original.node.Contents(),parts=contents?.asArray?contents.asArray():contents?[contents]:[];
 const operators=parts.map(ref=>String.fromCharCode(...PDFLib.decodePDFRawStream(pdf.context.lookup(ref)).decode())).join('\\n');
 const nativeText=[...operators.matchAll(/\\bBT\\b([\\s\\S]*?)\\bET\\b/g)].some(m=>[...m[1].matchAll(/\\(([^()]*)\\)/g)].some(t=>t[1].trim())||/<[a-f0-9]+>/i.test(m[1]));
 const draws=[...operators.matchAll(/\\/([A-Za-z0-9_.-]+)\\s+Do\\b/g)],matrices=[...operators.matchAll(/([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+cm/g)];
 const matrix=matrices.length===1?matrices[0].slice(1).map(Number):null,box=original.getCropBox();
 if(nativeText||draws.length!==1||!matrix||matrix[1]!==0||matrix[2]!==0||matrix[0]<=0||matrix[3]<=0||matrix[4]<box.x-.1||matrix[5]<box.y-.1||matrix[4]+matrix[0]>box.x+box.width+.1||matrix[5]+matrix[3]>box.y+box.height+.1||[...operators.matchAll(/([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+([\\d.+-]+)\\s+re/g)].some(r=>{const [x,y,w,h]=r.slice(1).map(Number);return matrix[4]<x-.1||matrix[5]<y-.1||matrix[4]+matrix[0]>x+w+.1||matrix[5]+matrix[3]>y+h+.1;}))throw Error('TMN row OCR cannot discard native text, clipping or transforms');
 if(!objects||objects.keys().length!==1)throw Error('TMN row OCR requires one physical screenshot per page '+(i+1));
 const image=objects.lookup(objects.keys()[0]);if(image?.dict?.get(PDFLib.PDFName.of('Subtype'))?.toString()!=='/Image')throw Error('TMN page image unavailable');
 const filter=image.dict.get(PDFLib.PDFName.of('Filter'))?.toString(),width=image.dict.get(PDFLib.PDFName.of('Width')).asNumber(),height=image.dict.get(PDFLib.PDFName.of('Height')).asNumber();
 if(width*height>16000000)throw Error('TMN screenshot too large');let pixels;
 if(filter==='/DCTDecode')pixels=JpegDecode(image.contents,{useTArray:true,formatAsRGBA:false,maxMemoryUsageInMB:128});
 else if(filter==='/FlateDecode'&&image.dict.get(PDFLib.PDFName.of('ColorSpace'))?.toString()==='/DeviceRGB'&&image.dict.get(PDFLib.PDFName.of('BitsPerComponent')).asNumber()===8)pixels={width,height,data:PDFLib.decodePDFRawStream(image).decode()};
 else throw Error('Unsupported TMN image encoding');
 const geometry=Geometry.analyze(pixels),flow=Geometry.reflow(pixels,geometry),one=await PDFLib.PDFDocument.create();one.setCreationDate(new Date(0));one.setModificationDate(new Date(0));
 const ref=one.context.register(one.context.flateStream(flow.data,{Type:'XObject',Subtype:'Image',Width:flow.width,Height:flow.height,ColorSpace:'DeviceRGB',BitsPerComponent:8})),page=one.addPage([flow.width/2,flow.height/2]),key=page.node.newXObject('Rows',ref);
 page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.scale(flow.width/2,flow.height/2),PDFLib.drawObject(key),PDFLib.popGraphicsState());
 const data=await one.save({useObjectStreams:false,updateFieldAppearances:false}),binary=await this.helpers.prepareBinaryData(Buffer.from(data),'tmn-rows-page-'+(i+1)+'.pdf','application/pdf');
 out.push({json:{tmn_page:{sourceFileId:f.id,sourceSha256:hash,pageCount:count,page:i+1,pageSha256:sha256(data),sourceImageSha256:sha256(image.contents),rowLayout:true,geometry}},binary:{data:binary},pairedItem:{item:0}});
}
return out;`;
}
export const collectCode=`
const meta=$('วนทีละไฟล์').item.json;
const scoped=meta.job.company==='UFABET7M'&&meta.file.ext==='pdf'&&meta.file.kind==='stm_pdf'&&/(?:^|[_\\s-])TMN(?:[_\\s-]|$)/i.test(meta.file.file_name||'')&&/รุ[่้]งฟ้า/.test(meta.file.file_name||'')&&!/สรวิศา/.test(meta.file.file_name||'');
if(scoped){
 const items=$input.all(),pages=items.map((item,i)=>{
   const original=item.json.tmn_page||$('${PAGE_NODE}').itemMatching(i).json.tmn_page;
   return {...original,text:String(item.json.data??item.json.body??item.json.text??''),error:item.json.error||null};
 });
 const first=pages[0];if(!first)throw Error('TMN page OCR returned no pages');
 return [{json:{text:pages.map(p=>p.text).join('\\f'),ocr_used:true,ocr_provider:'tmn_page_ocr_v1',
   ocr_input_count:first.pageCount,ocr_page_count:pages.length,source_page_count:first.pageCount,ocr_errors:pages.filter(p=>p.error).length,
   tmn_page_ocr:{version:'tmn-page-ocr-v1',sourceFileId:first.sourceFileId,sourceSha256:first.sourceSha256,pageCount:first.pageCount,pages}},pairedItem:{item:0}}];
}
`;
export function patchTmnPageOcr(workflow,{rowLayout=false}={}) {
  const w=structuredClone(workflow),find=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('Missing node '+name);return n;};
  if(w.nodes.some(n=>n.name===PAGE_NODE))throw Error('Page OCR already installed');
  const formatter=find('จัดผล OCR'),normalizer=find('แปลงรายการเป็นมาตรฐาน');
  const probe=find('ตรวจรายการ PDF ก่อน OCR');
  const readableAnchor='readable=!!result.header.bank';
  if(!probe.parameters.jsCode.includes(readableAnchor))throw Error('PDF probe changed');
  probe.parameters.jsCode=probe.parameters.jsCode.replace(readableAnchor,
    "readable=!(meta.job.company==='UFABET7M'&&/รุ[่้]งฟ้า/.test(meta.file.file_name||'')&&result.records?.some(r=>r.ocrWalletScreenshot))&&!!result.header.bank");
  if(!normalizer.parameters.jsCode.includes('norm=PdfStm.parseStructuredOcr'))throw Error('Unknown normalizer baseline');
  formatter.parameters.jsCode=collectCode+formatter.parameters.jsCode;
  const moduleCode=fs.readFileSync(path.join(root,'tmn-page-ocr.js'),'utf8');
  normalizer.parameters.jsCode=moduleCode+'\n'+normalizer.parameters.jsCode.replace(
    "norm=PdfStm.parseStructuredOcr(file.file_name,storedOcr,extractedText,parseBusinessDate)",
    "norm=input[0]?.json?.tmn_page_ocr ? TmnPageOcr.normalize("+(rowLayout?"TmnRowGeometry.bind(input[0].json.tmn_page_ocr)":"input[0].json.tmn_page_ocr")+",file,{...job,business_date:parseBusinessDate}) : PdfStm.parseStructuredOcr(file.file_name,storedOcr,extractedText,parseBusinessDate)");
  if(rowLayout)normalizer.parameters.jsCode=fs.readFileSync(path.join(root,'tmn-row-geometry.js'),'utf8')+'\n'+normalizer.parameters.jsCode;
  const catchAnchor="}catch(error){\n  parseError='อ่านไฟล์ไม่สำเร็จ:";
  if(!normalizer.parameters.jsCode.includes(catchAnchor))throw Error('Normalizer error wrapper changed');
  normalizer.parameters.jsCode=normalizer.parameters.jsCode
    .replace('let parseError=null;','let parseError=null;let tmnPageDiagnostics=null;')
    .replace(catchAnchor,"}catch(error){\n  if(error.pageErrors)tmnPageDiagnostics={pagesProcessed:error.pagesProcessed,pageErrors:error.pageErrors};\n  parseError='อ่านไฟล์ไม่สำเร็จ:");
  // Retain the whole-document guard in actual Production exports. Only a
  // successfully validated page-linked envelope can take the new path.
  normalizer.parameters.jsCode=normalizer.parameters.jsCode.replace(
    'isTmnScreenshotPdf&&ocrUsed&&!usedManualTmnReview;',
    'isTmnScreenshotPdf&&ocrUsed&&!usedManualTmnReview&&!norm.quality?.pageLinkedOcr;');
  // Include the full page/fee audit alongside parsed source records. This is
  // provenance, never a case approval or a replacement accepted result.
  normalizer.parameters.jsCode=normalizer.parameters.jsCode.replace('pdf_quality:norm.quality||null,','pdf_quality:norm.quality||null,tmn_page_diagnostics:tmnPageDiagnostics,tmn_page_audit:norm.quality?.pageLinkedOcr?norm.quality:null,');
  const regression="if(!parseError&&norm.quality?.pageLinkedOcr&&priorRowCount>0&&attemptedRows<priorRowCount) parseError='TMN page OCR row count regressed; preserve prior evidence';\n";
  const returnAnchor='return [{json:{job,file,format:norm.format';
  if(!normalizer.parameters.jsCode.includes(returnAnchor))throw Error('Normalizer return changed');
  normalizer.parameters.jsCode=normalizer.parameters.jsCode.replace(returnAnchor,regression+returnAnchor);
  const calculate=find('กระทบยอดและสร้าง Exception');
  calculate.parameters.jsCode=calculate.parameters.jsCode.replace(
    'parse_error:f.parse_error,row_count:f.row_count||0}',
    'parse_error:f.parse_error,row_count:f.row_count||0,tmn_page_diagnostics:f.tmn_page_diagnostics||null}');
  const auditAnchor='source_parser_completion:true,';
  if(!calculate.parameters.jsCode.includes(auditAnchor))throw Error('Worker summary changed');
  calculate.parameters.jsCode=calculate.parameters.jsCode.replace(auditAnchor,auditAnchor+"...(files.some(f=>f.tmn_page_audit)?{tmn_page_audits:files.filter(f=>f.tmn_page_audit).map(f=>({sourceFileId:f.file.id,...f.tmn_page_audit}))}:{}),");
  const edge=node=>({node,type:'main',index:0});
  const name='เป็น PDF TMN รุ่งฟ้าต้องแยกหน้า?';
  w.nodes.push({id:'tmn-page-ocr-if-v1',name,type:'n8n-nodes-base.if',typeVersion:2.2,position:[1900,600],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'tmn-rungfa-pdf-only',leftValue:"={{ (()=>{const m=$('วนทีละไฟล์').item.json;return m.job.company==='UFABET7M'&&m.file.ext==='pdf'&&m.file.kind==='stm_pdf'&&/(?:^|[_\\s-])TMN(?:[_\\s-]|$)/i.test(m.file.file_name||'')&&/รุ[่้]งฟ้า/.test(m.file.file_name||'')&&!/สรวิศา/.test(m.file.file_name||'');})() }}",rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}});
  w.nodes.push({id:'tmn-page-ocr-split-v1',name:PAGE_NODE,type:'n8n-nodes-base.code',typeVersion:2,position:[2120,600],parameters:{jsCode:rowLayout?rowSplitCode():splitCode()}});
  const loop='TMN OCR วนทีละหน้า',upload='TMN OCR ส่งภาพหนึ่งหน้า',hasId='TMN OCR สร้างเอกสารสำเร็จ?',wait='TMN OCR เว้นช่วงและรอข้อความ',read='TMN OCR อ่านหนึ่งหน้า',result='TMN OCR เก็บผลทุกหน้า';
  const uploadNode=structuredClone(find('Google Drive OCR: แปลง PDF'));
  uploadNode.id='tmn-page-upload-v1';uploadNode.name=upload;uploadNode.position=[2560,700];
  uploadNode.maxTries=5;uploadNode.waitBetweenTries=15000;
  const readNode=structuredClone(find('Google Drive OCR: อ่านข้อความ'));
  readNode.id='tmn-page-read-v1';readNode.name=read;readNode.position=[3220,700];
  readNode.maxTries=5;readNode.waitBetweenTries=15000;
  w.nodes.push({id:'tmn-page-loop-v1',name:loop,type:'n8n-nodes-base.splitInBatches',typeVersion:3,position:[2340,600],parameters:{batchSize:1,options:{}}},uploadNode,
    {id:'tmn-page-has-id-v1',name:hasId,type:'n8n-nodes-base.if',typeVersion:2.2,position:[2780,700],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'tmn-upload-id-present',leftValue:'={{ !!$json.id && !$json.error }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}},
    {id:'tmn-page-wait-v1',name:wait,type:'n8n-nodes-base.wait',typeVersion:1.1,position:[3000,700],parameters:{amount:8,unit:'seconds'}},readNode,
    {id:'tmn-page-result-v1',name:result,type:'n8n-nodes-base.code',typeVersion:2,position:[3440,700],parameters:{jsCode:`const item=$input.first();const p=$('${PAGE_NODE}').itemMatching(0).json.tmn_page;const raw=item.json.data??item.json.body??item.json.text;const text=typeof raw==='string'?raw:'';return [{json:{tmn_page:p,text,error:item.json.error||(!text.trim()?{message:'OCR exported empty text after waiting; page needs review'}:null)},pairedItem:{item:0}}];`}});
  const old=w.connections['เตรียม PDF สำหรับ OCR'];
  if(JSON.stringify(old)!==JSON.stringify({main:[[edge('เป็น Word ภาพรายการ?')]]}))throw Error('Unexpected OCR route');
  w.connections['เตรียม PDF สำหรับ OCR']={main:[[edge(name)]]};
  w.connections[name]={main:[[edge(PAGE_NODE)],[edge('เป็น Word ภาพรายการ?')]]};
  w.connections[PAGE_NODE]={main:[[edge(loop)]]};
  w.connections[loop]={main:[[edge('จัดผล OCR')],[edge(upload)]]};
  w.connections[upload]={main:[[edge(hasId)]]};
  w.connections[hasId]={main:[[edge(wait)],[edge(result)]]};
  w.connections[wait]={main:[[edge(read)]]};
  w.connections[read]={main:[[edge(result)]]};
  w.connections[result]={main:[[edge(loop)]]};
  return w;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [input,output]=process.argv.slice(2);if(!input||!output||input===output)throw Error('Use separate INPUT.json OUTPUT.json');
  fs.writeFileSync(output,JSON.stringify(patchTmnPageOcr(JSON.parse(fs.readFileSync(input)),{rowLayout:process.argv.includes('--row-layout')}),null,2)+'\n');
  console.log('Prepared candidate only; no upload, publish, reconciliation or case writes.');
}
