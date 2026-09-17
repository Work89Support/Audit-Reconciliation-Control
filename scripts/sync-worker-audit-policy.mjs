// Scoped mechanical synchronization: preserve credentials, trigger states, nodes and edges.
import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=f=>fs.readFile(new URL(f,root),'utf8');
const pdf=(await read('pdf-stm.js')).trim();
const screen=await read('preliminary-review.js'),policy=await read('audit-case-policy.js');
const marker='// AUDIT_CASE_POLICY_WRAPPER_V1\n';
for(const file of ['n8n/audit-headless-worker.json','n8n/audit-round-worker.json']){
  const workflow=JSON.parse(await read(file));
  for(const node of workflow.nodes){
    let code=node.parameters?.jsCode;
    if(!code)continue;
    if(code.includes('const PdfStm')){
      const start=code.indexOf('/*');
      const pdfStart=code.lastIndexOf('/*',code.indexOf('const PdfStm'));
      const footer='if (typeof window !== "undefined") window.PdfStm = PdfStm;';
      const end=code.indexOf(footer,code.indexOf('const PdfStm'));
      if(pdfStart<0||end<0||start<0)throw Error('Cannot locate PDF module safely: '+node.name);
      code=code.slice(0,pdfStart)+pdf+code.slice(end+footer.length);
    }
    if(node.name==='กระทบยอดและสร้าง Exception'){
      if(code.startsWith(marker))code=code.slice(marker.length,code.indexOf('\n// AUDIT_CASE_POLICY_RUNTIME_V1'));
      else code='const auditGenerated = await (async()=>{\n'+code+'\n})();';
      code=marker+code+'\n// AUDIT_CASE_POLICY_RUNTIME_V1\n'+screen+'\n'+policy+'\nreturn auditGenerated.map(item=>({...item,json:AuditCasePolicy.apply(item.json,PreliminaryReview.candidates)}));\n';
    }
    node.parameters.jsCode=code;
  }
  await fs.writeFile(new URL(file,root),JSON.stringify(workflow,null,2)+'\n');
}
console.log('Synchronized PDF runtime and guarded new-run case routing; preserved workflow topology');
