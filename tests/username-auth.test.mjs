import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const requests=[];
const context={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'public-key'}},persist(){}},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},AbortController,setTimeout,clearTimeout,Date,console,
  fetch:async(url,opts)=>{requests.push({url,...opts});return new Response(JSON.stringify({access_token:'token',refresh_token:'refresh',expires_in:3600,user:{id:'user'}}),{status:200});}};
vm.runInNewContext(fs.readFileSync(new URL('../supabase.js',import.meta.url),'utf8'),context);
const sb=context.window.Sb;
assert.equal(sb.loginIdentity(' Clarifier_Test '),'clarifier_test@users.audit.invalid');
assert.equal(sb.loginIdentity('Staff@Company.com'),'staff@company.com');
assert.equal(sb.displayLogin('clarifier_test@users.audit.invalid'),'clarifier_test');
for(const name of ['ab','123user','name space','../../admin']) assert.throws(()=>sb.loginIdentity(name));
await sb.signIn('clarifier_test','test-password-only');
assert.equal(JSON.parse(requests[0].body).email,'clarifier_test@users.audit.invalid');
assert.equal(context.Store.data.supabase.email,'clarifier_test');
await assert.rejects(()=>sb.requestPasswordReset('clarifier_test'),/ผู้ดูแล/);
await sb.adminCreateUsernameUser('clarifier_test','test-password-only','ผู้ชี้แจงทดสอบ','shift_lead',true,['FR8','UFABET7M']);
assert.equal(requests[1].headers['Content-Type'],'application/json');
assert.equal(JSON.parse(requests[1].body).login_mode,'username');

let handler,callerRole='admin',existing=false,created=0,invited=0;
const writes=[];
const admin={auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null}),admin:{
  listUsers:async()=>({data:{users:existing?[{id:'existing',email:'clarifier_test@users.audit.invalid'}]:[]}}),
  createUser:async(body)=>{created++;assert.equal(body.email_confirm,true);return {data:{user:{id:'new-user'}},error:null};},
  inviteUserByEmail:async()=>{invited++;throw Error('Username must not send email');}}},
  from(table){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{role:callerRole,active:true}}),
    then(resolve){resolve({data:[{company:'FR8'},{company:'UFABET7M'}],error:null});},
    upsert:async(body)=>{writes.push({table,body});return {error:null};},
    delete(){return this;},insert:async(body)=>{writes.push({table,body});return {error:null};},
    update(body){writes.push({table,body});return this;}};}};
const edgeContext={createClient:()=>admin,Response,Request,console,Deno:{env:{get:()=> 'test-only'},serve:fn=>handler=fn}};
const edge=fs.readFileSync(new URL('../supabase/functions/admin-invite-user/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/,'');
vm.runInNewContext(stripTypeScriptTypes(edge),edgeContext);
const body={login_mode:'username',username:'clarifier_test',password:'Test-only-password12',full_name:'ผู้ชี้แจงทดสอบ',role:'shift_lead',companies:['FR8','UFABET7M'],active:true};
const send=payload=>handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer test-only','Content-Type':'application/json'},body:JSON.stringify(payload)}));
callerRole='shift_lead';assert.equal((await send(body)).status,403);assert.equal(created,0);
callerRole='admin';assert.equal((await send({...body,companies:[]})).status,400);
assert.equal((await send({...body,password:'short'})).status,400);
assert.equal((await send({...body,password:'Abcd1234'})).status,400);
assert.equal((await send({...body,password:'123456789'})).status,400);
assert.equal((await send({...body,password:'Abcd12345',companies:[]})).status,400);
assert.equal((await send({...body,companies:['*']})).status,400);
assert.equal((await send({...body,companies:['UNKNOWN']})).status,400);
existing=true;assert.equal((await send(body)).status,409);assert.equal(created,0);
existing=false;const response=await send({...body,password:'Abcd12345'});assert.equal(response.status,200);
assert.equal(created,1);assert.equal(invited,0);
const result=await response.json();assert.equal(result.username,'clarifier_test');assert.equal(result.password,undefined);
assert.ok(writes.some(w=>w.table==='app_profiles'&&w.body.active===false));
assert.ok(writes.some(w=>w.table==='app_profiles'&&w.body.active===true));
assert.ok(writes.some(w=>w.table==='app_profiles'&&w.body.role==='shift_lead'));
assert.ok(!writes.some(w=>JSON.stringify(w).includes(body.password)));
console.log('Username login, email compatibility, admin-only creation, scope, duplicate and secret guards: passed');
