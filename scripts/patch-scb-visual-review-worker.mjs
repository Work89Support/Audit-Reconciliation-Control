import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function patchScbReview(worker,scbRuntime){
 const w=structuredClone(worker);const n=w.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน');assert(n);
 const marker="const meta=$('วนทีละไฟล์').item.json;";
 assert(n.parameters.jsCode.includes(marker)&&!n.parameters.jsCode.includes('const ScbVisualReview'));
 let c=n.parameters.jsCode.replace(marker,scbRuntime+'\n\n'+marker);
 const flag="const usedManualTmnReview=ext==='pdf'&&storedOcr?.provider==='tmn_visual_review_v1';";assert(c.includes(flag));
 c=c.replace(flag,flag+"\nconst usedManualScbReview=ext==='pdf'&&storedOcr?.provider==='scb_visual_review_v1';\nconst usedManualReview=usedManualTmnReview||usedManualScbReview;");
 assert(c.includes('if(upstreamError&&!usedManualTmnReview)'));c=c.replace('if(upstreamError&&!usedManualTmnReview)','if(upstreamError&&!usedManualReview)');
 const branch='norm=TmnVisualReview.normalize(storedOcr,file,job);\n  }else if(parseError)';assert(c.includes(branch));
 c=c.replace(branch,"norm=TmnVisualReview.normalize(storedOcr,file,job);\n  }else if(usedManualScbReview){\n    norm=ScbVisualReview.normalize(storedOcr,{...file,downloadSha256:$('คืนชื่อไฟล์ต้นฉบับ').item.json.scb_review_download_sha256},job);\n  }else if(parseError)");
 const empty='&&!pdfEvidence&&!usedManualTmnReview)';assert(c.includes(empty));c=c.replace(empty,'&&!pdfEvidence&&!usedManualReview)');
 c=c.replace('extracted_row_count:usedManualTmnReview?attemptedRows:',"extracted_row_count:usedManualScbReview?(norm.quality?.parsedRows||0):usedManualTmnReview?attemptedRows:");
 c=c.replace(/parser_version:'[^']+'/g,"parser_version:'1.9.86-bbl-flat-text'");n.parameters.jsCode=c;
 const route=w.nodes.find(n=>n.name==='TMN ตรวจภาพครบแล้ว?');assert(route);
 const condition=route.parameters.conditions.conditions[0];assert(condition.leftValue.includes("o?.provider==='tmn_visual_review_v1'"));
 condition.leftValue=condition.leftValue.replace("o?.provider==='tmn_visual_review_v1'","['tmn_visual_review_v1','scb_visual_review_v1'].includes(o?.provider)");
 const restore=w.nodes.find(n=>n.name==='คืนชื่อไฟล์ต้นฉบับ');assert(restore);
 const ret='return [{json:item.json,binary,pairedItem:{item:0}}];';assert(restore.parameters.jsCode.includes(ret));
 // Hash bytes downloaded in THIS execution; never change source_files.checksum
 // because its UPDATE trigger can schedule an automatic/main reconciliation.
 restore.parameters.jsCode=restore.parameters.jsCode.replace(ret,"const proof=Array.isArray(meta.file.source_file_ocr)?meta.file.source_file_ocr[0]:meta.file.source_file_ocr;\nlet resultJson=item.json;\nif(proof?.provider==='scb_visual_review_v1'){\n const buffer=await this.helpers.getBinaryDataBuffer(0,'data');\n const digest=require('crypto').createHash('sha256').update(buffer).digest('hex');\n resultJson={...item.json,scb_review_download_sha256:digest};\n}\nreturn [{json:resultJson,binary,pairedItem:{item:0}}];");
 const aggregate=w.nodes.find(n=>n.name==='กระทบยอดและสร้าง Exception');assert(aggregate);
 assert(aggregate.parameters.jsCode.includes("f.parser_version!=='1.9.80-seven-m-repeated-internal-transfer'"));
 aggregate.parameters.jsCode=aggregate.parameters.jsCode.replaceAll('1.9.80-seven-m-repeated-internal-transfer','1.9.86-bbl-flat-text');
 const summary='summary:{waiting_bo:';assert(aggregate.parameters.jsCode.includes(summary));
 aggregate.parameters.jsCode=aggregate.parameters.jsCode.replace(summary,"summary:{scb_visual_review_sources:files.filter(f=>f.pdf_quality?.visualReview&&f.format?.bank==='SCB').map(f=>({source_file_id:f.file.id,source_sha256:f.pdf_quality.sourceSha256,approval_reference:f.pdf_quality.readApprovalReference,printed_rows:f.pdf_quality.parsedRows,target_day_rows:f.row_count,adjacent_day_rows:Number(f.dropped?.['วันที่ไม่ตรงกับวันที่ตรวจ']||0),descriptions_certified:false})),waiting_bo:");
 // All claim/finish endpoints, credentials, connections, schedules and settings stay untouched.
 assert.deepEqual(w.connections,worker.connections);assert.deepEqual(w.settings,worker.settings);
 assert(w.nodes.every((v,i)=>['แปลงรายการเป็นมาตรฐาน','TMN ตรวจภาพครบแล้ว?','คืนชื่อไฟล์ต้นฉบับ','กระทบยอดและสร้าง Exception'].includes(v.name)||JSON.stringify(v)===JSON.stringify(worker.nodes[i])));
 return w;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,out]=process.argv.slice(2);assert(input&&out);
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const w=patchScbReview(JSON.parse(await fs.readFile(input,'utf8')),await fs.readFile(path.join(root,'scb-visual-review.js'),'utf8'));
 await fs.writeFile(out,JSON.stringify(w,null,2));console.log('Patched only manual worker downloaded-byte hash + SCB review route + normalizer');
}
