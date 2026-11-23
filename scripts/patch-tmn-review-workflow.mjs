import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function patchReview(w,{manual=false}={}){
 const out=structuredClone(w),norm=out.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน'),calc=out.nodes.find(n=>n.name==='กระทบยอดและสร้าง Exception');assert(norm&&calc);
 let s=norm.parameters.jsCode;assert(s.includes('TmnRowGeometry.bind(input[0].json.tmn_page_ocr)'));assert(!s.includes('TmnReviewDraft'));
 s=fs.readFileSync(path.join(root,'tmn-review-draft.js'),'utf8')+'\n'+s;
 s=s.replace('let tmnPageDiagnostics=null;','let tmnPageDiagnostics=null;let tmnReviewDraft=null;');
 const anchor="norm=input[0]?.json?.tmn_page_ocr ? TmnPageOcr.normalize(TmnRowGeometry.bind(input[0].json.tmn_page_ocr),file,{...job,business_date:parseBusinessDate}) :";assert(s.includes(anchor));
 s=s.replace(anchor,"if(input[0]?.json?.tmn_page_ocr)tmnReviewDraft=TmnReviewDraft.build(TmnRowGeometry.bind(input[0].json.tmn_page_ocr),file,{...job,business_date:parseBusinessDate});\n    norm=input[0]?.json?.tmn_page_ocr ? TmnPageOcr.normalize(TmnRowGeometry.bind(input[0].json.tmn_page_ocr),file,{...job,business_date:parseBusinessDate}) :");
 s=s.replace('tmn_page_diagnostics:tmnPageDiagnostics,','tmn_review_draft:tmnReviewDraft,tmn_page_diagnostics:tmnPageDiagnostics,');norm.parameters.jsCode=s;
 const a='parse_error:f.parse_error||null,parser_version:';assert(calc.parameters.jsCode.includes(a));calc.parameters.jsCode=calc.parameters.jsCode.replace(a,'parse_error:f.parse_error||null,tmn_review_draft:f.tmn_review_draft||null,parser_version:');
 const receipt=out.nodes.find(n=>n.name===(manual?'Supabase: เก็บผลรอทบทวน':'Supabase: บันทึกผลอ่านไฟล์'));assert(receipt);
 const old=manual?'finish_account_recheck_compact':'record_source_file_parse_results';assert(receipt.parameters.url.endsWith('/'+old));receipt.parameters.url=receipt.parameters.url.replace('/'+old,'/'+old+'_tmn_review');
 return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[k,input,output]=process.argv.slice(2);fs.writeFileSync(output,JSON.stringify(patchReview(JSON.parse(fs.readFileSync(input)),{manual:k==='manual'}),null,2));}
