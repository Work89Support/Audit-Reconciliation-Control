import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('async function enterProductionApp()'),source.indexOf('async function boot()'));
for(const denied of [false,true]){
  let signouts=0,retry,gate,connecting;
  const error=Object.assign(Error(denied?'inactive':'database timeout'),denied?{code:'APP_ACCESS_DENIED'}:{});
  const context={Sb:{authUser:()=>({email:'test@example.invalid'}),passwordChangeRequired:async()=>false,signOut(){signouts++;}},prepareProductionData(){},applyAuthenticatedRole:async()=>{throw error;},showLoginGate:text=>gate=text,
    showConnectingGate(text,action){connecting=text;retry=action;},$:()=>({})};
  Object.assign(context,{setTimeout,clearTimeout});
  vm.runInNewContext(helper,context);assert.equal(await context.enterProductionApp(),false);
  assert.equal(signouts,denied?1:0);
  if(!denied){assert.equal(gate,undefined);assert.match(connecting,/ไม่ได้ออกจากระบบ/);assert.equal(typeof retry,'function');await retry();assert.equal(signouts,0);}
}
assert.match(source,/error\.code = 'APP_ACCESS_DENIED'/);
assert.match(source,/await applyAuthenticatedRole\(\);[\s\S]*\$\("#appShell"\)\.hidden = false/);
{
 let calls=0,release;
 const context={setTimeout,clearTimeout,Sb:{authUser:()=>({email:'test@example.invalid'}),passwordChangeRequired:async()=>false},prepareProductionData(){},
 applyAuthenticatedRole:()=>{calls++;return new Promise((_resolve,reject)=>{release=()=>reject(Error('temporary timeout'));});},showConnectingGate(){},$:()=>({})};
 vm.runInNewContext(helper,context);
 const first=context.enterProductionApp(),second=context.enterProductionApp();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1,'Concurrent entry retries must share one permission check');
 release();assert.deepEqual(await Promise.all([first,second]),[false,false]);
 assert.equal(context.enterProductionApp.pending,null);
}
{
 const nodes=new Map();const $=s=>{if(!nodes.has(s))nodes.set(s,{dataset:{}});return nodes.get(s);};let permissionCalls=0;
 const context={setTimeout,clearTimeout,$,Sb:{authUser:()=>({email:'test@example.invalid'}),passwordChangeRequired:async()=>true},prepareProductionData(){},showConnectingGate(){},applyAuthenticatedRole(){permissionCalls++;}};
 vm.runInNewContext(helper,context);assert.equal(await context.enterProductionApp(),false);assert.equal(permissionCalls,0);
 assert.equal($('#appShell').hidden,true);assert.equal($('#resetForm').hidden,false);assert.equal($('#resetForm').dataset.firstPassword,'true');
}
{
 let signouts=0,permissions=0;const context={setTimeout,clearTimeout,$:()=>({}),Sb:{authUser:()=>({email:'test@example.invalid'}),passwordChangeRequired:async()=>{throw Error('gate check unavailable');},signOut(){signouts++;}},prepareProductionData(){},showConnectingGate(){},applyAuthenticatedRole(){permissions++;}};
 vm.runInNewContext(helper,context);assert.equal(await context.enterProductionApp(),false);assert.equal(signouts,0);assert.equal(permissions,0,'Unavailable password gate fails closed without permission admission');
}
const sheets=fs.readFileSync(new URL('../mc8-live-sheets.js',import.meta.url),'utf8');
assert.match(sheets,/if\(!preserveView\)\{data=null;files=\[\];page=0;/);
assert.match(sheets,/await load\(\{preserveView:true\}\)/);
assert.match(sheets,/if\(!alive\(\)\)return false/);
console.log('Access outage preserves session without admitting access; explicit denial logs out; account view refresh is preserved');
