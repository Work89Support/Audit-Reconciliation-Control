// Refresh embedded provider modules without changing any workflow graph or credentials.
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const version=fs.readFileSync(new URL('scripts/build-n8n-worker.mjs',root),'utf8').match(/const WORKER_VERSION = "([^"]+)"/)[1];
export function syncProviderRuntime(workflow){
 for(const node of workflow.nodes||[]){let code=node.parameters?.jsCode;if(typeof code!=='string')continue;
  for(const name of ['Formats','Registry','Engine']){const source=fs.readFileSync(new URL(({Formats:'formats',Registry:'registry',Engine:'engine'})[name]+'.js',root),'utf8');const declaration=`const ${name} =`;const start=code.indexOf(declaration);if(start<0)continue;const end=code.indexOf('\n})();',start),a=source.indexOf(declaration),b=source.indexOf('\n})();',a);if(end<0||a<0||b<0)throw Error('Missing '+name+' boundary');code=code.slice(0,start)+source.slice(a,b+7)+code.slice(end+7);}
  node.parameters.jsCode=code.replace(/1\.9\.\d+(?:-[a-z0-9-]+)?/g,version);
 }
 return workflow;
}
if(process.argv[1]===new URL(import.meta.url).pathname){for(const file of process.argv.slice(2)){const workflow=JSON.parse(fs.readFileSync(file));syncProviderRuntime(workflow);fs.writeFileSync(file,JSON.stringify(workflow,null,2)+'\n');}}
