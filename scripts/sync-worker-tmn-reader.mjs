import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {rowSplitCode,installTmnSplitFailure,patchTmnPageOcr} from './tmn-page-ocr-workflow.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function syncTmnReader(workflow){
 if(!workflow.nodes?.some(n=>n.name==='แยกหน้า TMN สำหรับ OCR'))return patchTmnPageOcr(workflow,{rowLayout:true});
 const w=structuredClone(workflow),split=w.nodes.find(n=>n.name==='แยกหน้า TMN สำหรับ OCR');
 split.parameters.jsCode=rowSplitCode();
 const normalizer=w.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน');
 if(!normalizer?.parameters?.jsCode)throw Error('Missing normalizer');
 for(const [file,name,end] of [['tmn-row-geometry.js','TmnRowGeometry',"if(typeof module!=='undefined')module.exports=TmnRowGeometry;"],['tmn-page-ocr.js','TmnPageOcr',"if(typeof module!=='undefined') module.exports=TmnPageOcr;"]]){
  const code=normalizer.parameters.jsCode,start=code.indexOf('const '+name+'='),spaced=code.indexOf('const '+name+' ='),at=Math.max(start,spaced),finish=code.indexOf(end,at);
  if(at<0||finish<at||code.indexOf(end,finish+end.length)>=0)throw Error('Ambiguous '+name+' module');
  const head=code.lastIndexOf('/*',at);
  normalizer.parameters.jsCode=code.slice(0,head)+fs.readFileSync(path.join(root,file),'utf8').trim()+code.slice(finish+end.length);
 }
 return installTmnSplitFailure(w);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output]=process.argv.slice(2);
 if(!input||!output||path.resolve(input)===path.resolve(output))throw Error('Use separate INPUT.json OUTPUT.json; never overwrite a Production export');
 fs.writeFileSync(output,JSON.stringify(syncTmnReader(JSON.parse(fs.readFileSync(input,'utf8'))),null,2)+'\n');
 console.log('Prepared isolated candidate with shared TMN reader; no upload, publish, remote execution or financial writes.');
}
