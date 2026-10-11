// Apply only reviewed shared-code hunks; retain live orchestration/credentials.
const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
const inputs=process.argv.slice(2);
if(!inputs.length)throw Error('Supply workflow JSON paths');
for(const input of inputs){
 const workflow=JSON.parse(fs.readFileSync(input,'utf8'));let changed=0;
 for(const node of workflow.nodes||[]){
  let code=node.parameters?.jsCode;if(!code?.includes('const Formats'))continue;
  for(const file of ['formats.js','engine.js']){
   if(file==='engine.js'&&!code.includes('const Engine'))continue;
   const start=code.indexOf(file==='formats.js'?'const Formats':'const Engine');
   const moduleEnd=code.indexOf('\n})();',start)+6;
   assert.ok(start>=0&&moduleEnd>start);
   let moduleCode=code.slice(start,moduleEnd);
   const diff=cp.execFileSync('git',['diff','--unified=0','HEAD','--',file],{encoding:'utf8'});
   for(const hunk of diff.split(/^@@[^\n]*\n/m).slice(1)){
    const lines=hunk.split('\n');
    const before=lines.filter(x=>x.startsWith('-')).map(x=>x.slice(1)).join('\n');
    const after=lines.filter(x=>x.startsWith('+')).map(x=>x.slice(1)).join('\n');
    assert.ok(before,'No unanchored additions');
    assert.equal(moduleCode.split(before).length,2,'Unique baseline hunk: '+file+' '+before.slice(0,70));
    moduleCode=moduleCode.replace(before,after);
   }
   code=code.slice(0,start)+moduleCode+code.slice(moduleEnd);
  }
  new (Object.getPrototypeOf(async function(){}).constructor)('$input','$json','$',code);
  node.parameters.jsCode=code;changed++;
 }
 assert.equal(changed,3);
 const output=input.includes('/Downloads/')?'/private/tmp/audit-partial-live-prepared.json':input;
 fs.writeFileSync(output,JSON.stringify(workflow,null,2)+'\n');
 console.log(output+': patched '+changed+' runtime copies only');
}
