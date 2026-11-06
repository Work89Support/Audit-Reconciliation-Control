import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {syncPdfParsers,syncPdfWorkflowText,workflowFiles} from '../scripts/sync-worker-pdf-parsers.mjs';
const parser=await fs.readFile('pdf-stm.js','utf8'),exportLine='if (typeof window !== "undefined") window.PdfStm = PdfStm;';
for(const file of workflowFiles){
 const workflow=JSON.parse(await fs.readFile('n8n/'+file,'utf8')),before=JSON.stringify(workflow),updated=syncPdfParsers(workflow,parser);
 assert.equal(JSON.stringify(workflow),before,'source object immutable');
 assert.deepEqual(syncPdfParsers(updated,parser),updated,'idempotent');
 const oldModule=parser.replace('const PdfStm = (() => {','const PdfStm = (() => {\n  // stale test fixture');
 const stale=syncPdfParsers(updated,oldModule),restored=syncPdfParsers(stale,parser);
 assert.deepEqual(restored,updated);
 const differentlyFormatted=JSON.stringify(stale,null,4)+'\n';
 assert.deepEqual(JSON.parse(syncPdfWorkflowText(differentlyFormatted,parser)),restored);
 assert.equal(syncPdfWorkflowText(JSON.stringify(restored,null,4)+'\n',parser),JSON.stringify(restored,null,4)+'\n','formatting preserved for already synchronized workflow');
 for(let i=0;i<workflow.nodes.length;i++){
  const a=stale.nodes[i],b=restored.nodes[i];
  if(!a.parameters?.jsCode?.includes('const PdfStm')){assert.deepEqual(b,a);continue;}
  const prefix=code=>code.slice(0,code.lastIndexOf('/*',code.indexOf('const PdfStm')));
  const suffix=code=>code.slice(code.indexOf(exportLine)+exportLine.length);
  assert.equal(prefix(a.parameters.jsCode),prefix(b.parameters.jsCode));assert.equal(suffix(a.parameters.jsCode),suffix(b.parameters.jsCode));
  assert.deepEqual({...b,parameters:{...b.parameters,jsCode:''}},{...a,parameters:{...a.parameters,jsCode:''}});
 }
 const noCode=updated.nodes.find(node=>node.parameters?.jsCode?.includes('const PdfStm'));
 noCode.parameters.jsCode=noCode.parameters.jsCode.replace(exportLine,'');
 assert.throws(()=>syncPdfParsers(updated,parser),/Ambiguous PDF module/);
}
assert.throws(()=>syncPdfParsers({nodes:[]},parser),/exactly/);
console.log('PASS worker PDF sync: exact bounded module replacement, TMN/wrappers/credentials/graph/settings preserved, idempotent and fail-closed anchors.');
