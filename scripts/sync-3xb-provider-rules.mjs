import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const sources=Object.fromEntries(['Formats','Registry','Engine'].map(name=>[name,fs.readFileSync(new URL('../'+name.toLowerCase()+'.js',import.meta.url),'utf8')]));
const between=(s,start,end)=>{const a=s.indexOf(start),b=s.indexOf(end,a);assert(a>=0&&b>a,'ขอบเขตส่วนกฎไม่ถูกต้อง');return s.slice(a,b);};
function once(text,before,after) {
 assert.equal(text.split(before).length-1,1,'จุดแก้ไขต้องตรงหนึ่งแห่ง: '+before.slice(0,100));
 return text.replace(before,after);
}
// แก้เฉพาะกฎสอง Provider ใหม่ รักษาส่วนต่าง Production เช่น CELOX CSV และทะเบียนส่วนตัว
export function patchProviderModule(name,text) {
 if(name==='Formats') {
  if(text.includes('const strictProviderFields ='))return text;
  text=once(text,'const PM_CHANNELS = [','const PM_CHANNELS = ["CATPAY", "JINLIPAY", "JLP", ');
  const canonical=between(sources.Formats,'    // CATPAY contains ATP:','    if (/MONOPAY/');
  text=once(text,'    if (/MONOPAY/',canonical+'    if (/MONOPAY/');
  text=once(text,'const PM_PROVIDERS = [','const PM_PROVIDERS = [["catpay", "CATPAY"], ["jinlipay", "JINLIPAY"], ["jlp", "JINLIPAY"], ');
  text=once(text,'String(value || "").trim().toUpperCase() === "3X"','["3X", "3XBET"].includes(String(value || "").trim().toUpperCase())');
  assert.equal(text.split('(3XB|3X|').length-1,2);
  text=text.replaceAll('(3XB|3X|','(3XBET|3XB|3X|');
  if(text.includes('const reconcileRef = provider === "MONOPAY"')) {
   text=once(text,'const reconcileRef = provider === "MONOPAY"','const reconcileRef = ["MONOPAY", "CATPAY", "JINLIPAY"].includes(provider)');
  }else text=once(text,'const reconcileRef = ["CELOX", "MONOPAY"]','const reconcileRef = ["CELOX", "MONOPAY", "CATPAY", "JINLIPAY"]');
  text=once(text,'["LOCALPAY", "CELOX"].includes(provider)','["LOCALPAY", "CELOX", "CATPAY", "JINLIPAY"].includes(provider)');
  const marker='      const mr9OnlyProvider = subco === "MR9" && provider === "MONOPAY";';
  const policy=between(sources.Formats,'      const threeXbStrictProvider =','      if (XB_COMPANIES.has(subco) && !xbProviders.includes(provider)');
  text=once(text,marker,marker+'\n'+policy.trimEnd());
  text=once(text,'(mr9OnlyProvider ? ["paymentTime"]','(strictProviderFields ? ["paymentTime"]');
  text=once(text,'if (mr9OnlyProvider) {','if (strictProviderFields) {');
  text=once(text,'`MONOPAY แถว ${i + 1}:','`${provider} แถว ${i + 1}:');
  text=once(text,'memberCode: mr9OnlyProvider ?','memberCode: strictProviderFields ?');
 }
 if(name==='Registry') {
  if(text.includes("['CATPAY','3xbet_catpay(catpay)(P2P)']"))return text;
  const marker='  const TITLE_RE =';
  const block=between(sources.Registry,'  // สองบัญชีใหม่นี้เปิดเฉพาะ 3XB','  // CELOX is enabled');
  text=once(text,marker,block+marker);
  text=once(text,'const PM_KW = { atp:','const PM_KW = { catpay:"CATPAY", jinlipay:"JINLIPAY", jlp:"JINLIPAY", atp:');
  const matchLine='      let hit = ACCOUNTS.filter((a)=>a.source==="pm" && a.provider===pm && norm(a.subco).length>=2 && raw.includes(norm(a.subco)));';
  const alias="      if (!hit.length && ['CATPAY','JINLIPAY'].includes(pm) && (fileToks.includes('3x') || fileToks.includes('3xbet'))) hit = ACCOUNTS.filter((a)=>a.source==='pm' && a.provider===pm && a.subco==='3XB');";
  text=once(text,matchLine,matchLine+'\n'+alias);
 }
 if(name==='Engine') {
  if(text.includes('const threeXbNewProviderFieldsMatch ='))return text;
  text=once(text,'blob.includes("monopay") ||','blob.includes("monopay") || blob.includes("catpay") || blob.includes("jinlipay") ||');
  text=once(text,'"MONOPAY", "SYS123"','"MONOPAY", "CATPAY", "JINLIPAY", "SYS123"');
  const duplicateMarker='    stmRecords = stmRecords.filter((row) => {\n      const id = providerIdOf(row);';
  const preserve=between(sources.Engine,'      // สอง Provider ใหม่นี้เก็บแถวจริงทั้งหมด','      const id = providerIdOf(row);');
  text=once(text,duplicateMarker,'    stmRecords = stmRecords.filter((row) => {\n'+preserve+'      const id = providerIdOf(row);');
  const marker='    const sameCompany =';
  const matching=between(sources.Engine,'    // 3XB CATPAY/JINLIPAY ต้องตรงครบสามช่อง','    const sameCompany =');
  text=once(text,marker,matching+marker);
  assert.equal(text.split('&& monopayIdentityMatches(s, b)').length-1,2);
  text=text.replaceAll('&& monopayIdentityMatches(s, b)','&& monopayIdentityMatches(s, b) && threeXbNewProviderIdentityMatches(s, b)');
 }
 return text;
}
export function syncProviderRules(workflow) {
 let modules=0;
 for(const node of workflow.nodes||[]) {
  if(!['แปลงรายการเป็นมาตรฐาน','กระทบยอดและสร้าง Exception'].includes(node.name))continue;
  let code=node.parameters?.jsCode;
  if(typeof code!=='string')continue;
  for(const name of ['Formats','Registry','Engine']) {
   const start=code.indexOf('const '+name+' =');
   if(start<0)continue;
   const end=code.indexOf('\n})();',start);
   assert(end>start,'ขอบเขตโมดูลไม่ถูกต้อง: '+name);
   code=code.slice(0,start)+patchProviderModule(name,code.slice(start,end+7))+code.slice(end+7);modules++;
  }
  node.parameters.jsCode=code;
 }
 assert(modules>0,'ไม่พบโมดูล Provider');
 return workflow;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const [, ,input,output]=process.argv;
 assert(input&&output,'Usage: node scripts/sync-3xb-provider-rules.mjs input.json output.json');
 const original=fs.readFileSync(input,'utf8');
 fs.writeFileSync(output,JSON.stringify(syncProviderRules(JSON.parse(original)),null,original.includes('\n  "')?2:undefined)+'\n');
}
