const assert=require('node:assert/strict');
const primary=require('../manual-primary.js');

let modalCount=0,accepted=0,review;
const node=()=>({style:{},dataset:{},setAttribute(){},focus(){},before(){},insertAdjacentHTML(){},remove(){this.removed=true;}});
const preview={company:'MR9',date:'2026-11-03',account:'ALL',direction:'all',file_count:12,allowed:true,token:'same-source-token',before:{},after:{exception_count:11}};
global.AccountRecheck={confirmationReasons:[['reviewed','ตรวจไฟล์ล่าสุดและผลครบแล้ว']],confirmationReason:()=> 'ตรวจไฟล์ล่าสุดและผลครบแล้ว'};
global.document={body:{appendChild(){}},createElement(tag){
 if(tag==='p')return node();
 if(tag==='section'){
  const final=node();final.querySelector=selector=>final[selector]??(final[selector]=node());return final;
 }
 assert.equal(tag,'dialog');
 review=node();review.isConnected=true;review.querySelector=selector=>{
  if(selector==='.manual-final-content'||selector==='footer')return review[selector]??(review[selector]=node());
  if(selector==='[data-reviewed]')return review[selector]??(review[selector]={checked:true});
  if(selector==='[data-reason]')return review[selector]??(review[selector]={value:'reviewed'});
  if(selector==='[data-other]')return review[selector]??(review[selector]={value:''});
  return review[selector]??(review[selector]=node());
 };
 review.querySelectorAll=()=>[review.querySelector('[data-cancel]')];
 review.appendChild=child=>{review.final=child;};
 review.addEventListener=()=>{};
 review.showModal=()=>{modalCount++;};
 review.close=()=>{};
 review.remove=()=>{review.isConnected=false;};
 return review;
}};

(async()=>{
 const d=await primary.open('MR9-ready',{actor:()=> 'head',role:()=> 'lead',preview:async()=>preview,withCases:true,accept:async()=>{accepted++;return {};}});
 const first=d.querySelector('[data-next]').onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(modalCount,1,'confirmation remains in the existing modal');
 assert.ok(d.final&&!d.final.removed,'final confirmation is visible inside the open modal');
 assert.equal(d.querySelector('.manual-final-content').style.display,'none');
 assert.equal(accepted,0,'opening final review never accepts the primary');
 d.final.querySelector('[data-back]').onclick();
 await first;
 assert.equal(d.querySelector('.manual-final-content').style.display,'');
 assert.equal(d.querySelector('[data-next]').disabled,false,'returning to review restores the action');
 assert.equal(accepted,0);
 console.log('PASS manual primary final review appears in one modal and can return without writes');
})().catch(error=>{console.error(error);process.exitCode=1;});
