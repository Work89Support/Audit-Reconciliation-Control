const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let user='tester',destroyed=0,drawn=[],received,observerCallback,downloadError=false;
const original=new Uint8Array([1,2,3]).buffer;
const nodes={};for(const key of ['canvas','[data-pdf-status]','[data-pdf-prev]','[data-pdf-next]','[data-pdf-zoom]','[data-pdf-error]'])nodes[key]={disabled:false,textContent:'',getContext:()=>({})};
const host={isConnected:true,dataset:{},clientWidth:600,innerHTML:'',querySelector:k=>nodes[k],querySelectorAll:()=>[nodes['[data-pdf-prev]'],nodes['[data-pdf-next]'],nodes['[data-pdf-zoom]']]};
const context={Uint8Array,MutationObserver:class{constructor(fn){observerCallback=fn;}observe(){}disconnect(){}},document:{body:{}},Sb:{authUser:()=>({id:user}),download:async()=>{if(downloadError)throw Error('test timeout');return original;}},pdfjsLib:{GlobalWorkerOptions:{},getDocument:opts=>{received=opts.data;assert.equal(opts.isEvalSupported,false);return {destroy:async()=>{destroyed++;},promise:Promise.resolve({numPages:2,getPage:async n=>({getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>{drawn.push(n);return {promise:Promise.resolve(),cancel(){}};}})})};}}};
vm.runInNewContext(fs.readFileSync('statement-preview.js','utf8')+'\nthis.preview=StatementPreview;',context);
(async()=>{
 await context.preview.mount(host,{id:'file',storage_path:'test/file.pdf'});
 assert.deepEqual(drawn,[1]);assert.notEqual(received.buffer,original,'never detach the cached original');
 assert.match(nodes['[data-pdf-status]'].textContent,/1 \/ 2/);assert.equal(nodes['[data-pdf-prev]'].disabled,true);
 nodes['[data-pdf-next]'].onclick();await new Promise(r=>setTimeout(r,0));assert.deepEqual(drawn,[1,2]);assert.equal(nodes['[data-pdf-next]'].disabled,true);
 nodes['[data-pdf-zoom]'].onclick();await new Promise(r=>setTimeout(r,0));assert.equal(nodes.canvas.width,1200);
 host.isConnected=false;observerCallback();assert.equal(destroyed,1);
 host.isConnected=true;downloadError=true;await context.preview.mount(host,{id:'bad',storage_path:'bad.pdf'});assert.match(host.textContent,/คู่ที่เตรียมไว้ยังอยู่/);
 const workbench=fs.readFileSync('cross-day-workbench.js','utf8');assert.equal((workbench.match(/StatementPreview\.mount/g)||[]).length,2);assert.ok(!workbench.includes('<iframe'));
 console.log('Statement canvas: paging, zoom, original buffer preserved, detach cleanup, failure message and both workbench entry points passed (mock renderer).');
})().catch(e=>{console.error(e);process.exitCode=1;});
