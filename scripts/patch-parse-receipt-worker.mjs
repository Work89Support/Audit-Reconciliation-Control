import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseReceiptPayload,qualityFailureMessage}=require('./worker-parse-receipt.cjs');
export const receiptExpression=`={{ JSON.stringify((${parseReceiptPayload.toString()})($('กระทบยอดและสร้าง Exception').first().json)) }}`;
export function patchAutomatic(w){
 const patched=structuredClone(w),n=patched.nodes.find(n=>n.name==='Supabase: บันทึกผลอ่านไฟล์');
 assert.ok(n?.parameters.url.endsWith('/record_source_file_parse_results'));
 n.parameters.jsonBody=receiptExpression;
 return patched;
}
export function patchManual(w){
 const patched=structuredClone(w),n=patched.nodes.find(n=>n.name==='Supabase: เก็บผลรอทบทวน');
 assert.ok(n?.parameters.url.match(/\/finish_account_recheck(?:_compact)?$/));
 const old="$json.quality_errors?.length?'ไม่ผ่าน Quality Gate ตรวจแหล่งข้อมูล/รูปแบบไฟล์ก่อนลองใหม่':null";
 assert.ok(n.parameters.jsonBody.includes(old),'Manual diagnostic expression changed');
 n.parameters.jsonBody=n.parameters.jsonBody.replace(old,`(${qualityFailureMessage.toString()})($json.quality_errors)`);
 return patched;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [kind,input,output]=process.argv.slice(2),w=JSON.parse(await fs.readFile(input,'utf8'));
 const next=kind==='automatic'?patchAutomatic(w):patchManual(w);
 const changed=next.nodes.filter((n,i)=>JSON.stringify(n)!==JSON.stringify(w.nodes[i]));
 assert.equal(changed.length,1,'Only one node may change');
 await fs.writeFile(output,JSON.stringify(next,null,2)+'\n');
 await fs.writeFile(output+'.expression.txt',changed[0].parameters.jsonBody);
 console.log('Prepared one-node patch:',changed[0].name);
}
