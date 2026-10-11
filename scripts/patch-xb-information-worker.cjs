// Update only the shared parser embedded in existing workflows. Do not rebuild
// newer production worker logic from an older generator template.
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const old=execFileSync('git',['show','HEAD:formats.js'],{encoding:'utf8'}).trimEnd();
const next=fs.readFileSync('formats.js','utf8').trimEnd();
for(const file of ['n8n/audit-headless-worker.json','n8n/audit-round-worker.json']){
 const data=JSON.parse(execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:32*1024*1024}));let updated=0;
 for(const node of data.nodes||[]){
  const code=node.parameters?.jsCode;
  if(typeof code==='string'&&code.includes(old)){
   node.parameters.jsCode=code.split(old).join(next);updated++;
  }
 }
 if(!updated)throw Error('No exact parser baseline found: '+file);
 fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
 console.log(file+': updated '+updated+' code nodes, other workflow settings retained');
}
