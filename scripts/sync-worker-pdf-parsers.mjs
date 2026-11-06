import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const workflowFiles=['audit-headless-worker.json','audit-round-worker.json','audit-account-recheck.json'];
const exportLine='if (typeof window !== "undefined") window.PdfStm = PdfStm;';
export function syncPdfParsers(workflow,parser){
 const result=structuredClone(workflow);let count=0;
 if(!parser.includes('const PdfStm = (() => {')||!parser.trimEnd().endsWith(exportLine))throw Error('Unexpected canonical PDF module');
 for(const node of result.nodes||[]){
  const code=node.parameters?.jsCode;if(typeof code!=='string'||!code.includes('const PdfStm'))continue;
  const declaration=code.indexOf('const PdfStm = (() => {'),start=code.lastIndexOf('/*',declaration),end=code.indexOf(exportLine,declaration);
  if(declaration<0||start<0||end<declaration||code.indexOf(exportLine,end+exportLine.length)>=0)throw Error('Ambiguous PDF module: '+node.name);
  // Replace exactly the PdfStm module, retaining subsequent TMN recovery modules,
  // normalization/probe wrappers, node metadata, credentials, graph and schedule.
  node.parameters.jsCode=code.slice(0,start)+parser.trim()+code.slice(end+exportLine.length);
  count++;
 }
 if(count!==2)throw Error('Expected exactly one PDF probe and one normalizer');
 return result;
}
export function syncPdfWorkflowText(text,parser){
 const source=JSON.parse(text),updated=syncPdfParsers(source,parser),replacements=new Map();
 source.nodes.forEach((node,index)=>{
  const oldCode=node.parameters?.jsCode,newCode=updated.nodes[index].parameters?.jsCode;
  if(oldCode!==newCode)replacements.set(JSON.stringify(oldCode),JSON.stringify(newCode));
 });
 for(const [oldCode,newCode] of replacements){
  if(!text.includes(oldCode))throw Error('Cannot locate serialized PDF code without changing workflow formatting');
  text=text.split(oldCode).join(newCode);
 }
 return text;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const parser=await fs.readFile(path.join(root,'pdf-stm.js'),'utf8');
 for(const file of workflowFiles){
  const target=path.join(root,'n8n',file),source=await fs.readFile(target,'utf8');
  const updated=syncPdfWorkflowText(source,parser);
  if(process.argv.includes('--check')){
   if(updated!==source)throw Error(file+': embedded PDF parser is stale');
  }else await fs.writeFile(target,updated);
 }
 console.log('PDF parser parity verified for three workflow definitions; no remote workflow or case executed.');
}
