// ทะเบียนบัญชีจริงอยู่ใน n8n variable ส่วนตัว ใช้ค่าเดียวกันทั้งออโต้และรันมือ
// จำกัดบริษัทจากงานและชื่อไฟล์ใน parser อีกชั้น ไม่ใช้ข้อมูลบัญชีคู่โอนแทนเจ้าของ
export const bayOwnerConfiguration = `
// BAY owner configuration v1 (private n8n variable; no financial data in source)
if(meta.file.kind==='stm_pdf'&&/(?:^|[_\\s-])BAY(?:[_\\s-]|$)/i.test(meta.file.file_name||'')){
  const bayOwnerConfig=JSON.parse(String($vars.AUDIT_BAY_STATEMENT_OWNERS_JSON||'[]'));
  if(!Array.isArray(bayOwnerConfig))throw new Error('BAY owner configuration must be an array');
  PdfStm.configureBayOwners(bayOwnerConfig.filter(entry=>String(entry.company||'').toUpperCase()===String(meta.job.company||'').toUpperCase()));
}
`;
export function configureBayWorker(workflow){
 const updated=structuredClone(workflow);let count=0;
 for(const node of updated.nodes||[]){
  const code=node.parameters?.jsCode;
  if(typeof code!=='string'||!code.includes('const PdfStm = (() => {'))continue;
  if(!code.includes('configureBayOwners'))throw new Error('BAY parser not synchronized: '+node.name);
  if(!code.includes('// BAY owner configuration v1')){
   const anchor="const meta=$('วนทีละไฟล์').item.json;";
   if(code.split(anchor).length!==2)throw new Error('Ambiguous file metadata: '+node.name);
   node.parameters.jsCode=code.replace(anchor,anchor+bayOwnerConfiguration);
  }
  count++;
 }
 if(count!==2)throw new Error('Expected exactly two PDF modules');
 return updated;
}
