import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../supabase.js', import.meta.url), 'utf8');
const expired = {access_token:'old',refresh_token:'refresh-old',expires_at:1,user:{id:'test-user'}};
const fresh = {access_token:'new',refresh_token:'refresh-new',expires_in:3600,user:{id:'test-user'}};
let clock = 200000;
class TestDate extends Date { static now() { return clock; } }
const storage = () => {
  const data = new Map([['audit-sb-session', JSON.stringify(expired)]]);
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
};
function app(fetch, localStorage=storage(), locks) {
  const context = {window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'public-test-key'}},persist(){}},
    localStorage,fetch,AbortController,setTimeout,clearTimeout,Date:TestDate,navigator:{locks},console};
  vm.runInNewContext(source,context);
  return context.window.Sb;
}
const response = (status,body={},headers={}) => new Response(JSON.stringify(body),{status,headers});

// Parallel restores and data requests share one rotation, not one per row.
let refreshes=0;
const client=app(async url=>{
  if(url.includes('/auth/v1/token')) {refreshes++;await new Promise(r=>setTimeout(r,5));return response(200,fresh);}
  return response(200,[]);
});
await Promise.all(Array.from({length:50},()=>client.restore()));
await Promise.all(Array.from({length:50},()=>client.post('test',[])));
assert.equal(refreshes,1);

// Many simultaneous 401 responses do not rotate a token repeatedly.
refreshes=0;
const revokedStore=storage();
revokedStore.setItem('audit-sb-session',JSON.stringify({...expired,expires_at:clock/1000+3600}));
const revoked=app(async (url,opts)=>{
  if(url.includes('/auth/v1/token')) {refreshes++;await new Promise(r=>setTimeout(r,5));return response(200,fresh);}
  return response(opts.headers.Authorization==='Bearer old'?401:200,[]);
},revokedStore);
await revoked.restore();
await Promise.all(Array.from({length:50},()=>revoked.post('test',[])));
assert.equal(refreshes,1);

// 429 preserves the stored session and respects cooldown before retrying.
refreshes=0;
const saved=storage();
const limited=app(async url=>{
  if(url.includes('/auth/v1/token')) {refreshes++;return response(429,{}, {'Retry-After':'120'});}
  throw Error('Data must not be requested with an expired token');
},saved);
await limited.restore();
await Promise.all(Array.from({length:50},()=>limited.post('test',[]).catch(()=>{})));
assert.equal(refreshes,1);
assert.ok(saved.getItem('audit-sb-session'));
clock+=119000;
await assert.rejects(()=>limited.post('test',[]));
assert.equal(refreshes,1);
clock+=2000;
await assert.rejects(()=>limited.post('test',[]));
assert.equal(refreshes,2);

// Same-origin tabs wait for each other and adopt the rotated session.
refreshes=0;
let queue=Promise.resolve();
const locks={request(_name,callback){const result=queue.then(callback);queue=result.catch(()=>{});return result;}};
const shared=storage();
const fetchShared=async()=>{refreshes++;await new Promise(r=>setTimeout(r,5));return response(200,fresh);};
await Promise.all([app(fetchShared,shared,locks).restore(),app(fetchShared,shared,locks).restore()]);
assert.equal(refreshes,1);

// RLS denial is not a token-refresh signal; permissions stay enforced.
refreshes=0;
const permitted=storage();
permitted.setItem('audit-sb-session',JSON.stringify({...fresh,expires_at:clock/1000+3600}));
const denied=app(async url=>{if(url.includes('/auth/v1/token'))refreshes++;return response(403);},permitted);
await denied.restore();
await assert.rejects(()=>denied.post('test',[]),/RLS/);
assert.equal(refreshes,0);

// Signing out during rotation must not resurrect the user's session.
let release;
const signoutStore=storage();
const signingOut=app(()=>new Promise(resolve=>{release=()=>resolve(response(200,fresh));}),signoutStore);
const restoring=signingOut.restore();
await new Promise(r=>setTimeout(r,0));
signingOut.signOut();
release();
await restoring;
assert.equal(signingOut.signedIn(),false);
assert.equal(signoutStore.getItem('audit-sb-session'),null);
console.log('Auth refresh: single-flight, cross-tab lock, 429 backoff, RLS denial and sign-out safety passed');
