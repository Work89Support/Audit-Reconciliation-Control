import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css = fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const html = fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<!--[\s\S]*?-->/g,'');
const extract = name => app.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0];
const timer = new Map(); let sequence = 0;
const element = () => ({hidden:true, classList:{add(){},remove(){}}, addEventListener(){}});
const modal=element(), overlay=element(), button=element();
const context = {$:s=>s==='#modal'?modal:s==='#modalOverlay'?overlay:button,AuditUi:{open(){},close(){}},requestAnimationFrame:fn=>fn(),setTimeout:fn=>{timer.set(++sequence,fn);return sequence;},clearTimeout:id=>timer.delete(id)};
vm.createContext(context);vm.runInContext(extract('openModal')+'\n'+extract('closeModal'),context);
context.openModal('first','test');context.closeModal();assert.equal(timer.size,1);
context.openModal('second','test');assert.equal(timer.size,0);
assert.equal(modal.hidden,false);assert.equal(overlay.hidden,false);
context.closeModal();[...timer.values()].forEach(fn=>fn());assert.equal(modal.hidden,true);assert.equal(overlay.hidden,true);
function luminance(hex){return hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [a,b] of [['53647b','eef6ff'],['805200','fdf3dd'],['0066cc','ffffff']])assert.ok(contrast(a,b)>=4.5,`${a}/${b}: ${contrast(a,b)}`);
assert.match(css,/--muted: #53647b/);assert.match(css,/--amber-txt: #805200/);
assert.match(css,/button:active:not\(:disabled\)/);assert.match(css,/min-height: 44px/);
assert.match(app,/document.title = `\$\{route.title\}/);
assert.match(html,/rel="icon"/);assert.doesNotMatch(html,/clarifier_test/);
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const file=match[1].split('?')[0];if(!/^https?:/.test(file))assert.ok(fs.existsSync(new URL('../'+file,import.meta.url)),file);}
assert.match(app,/AuditUi\.open\(drawer\)/);assert.match(app,/AuditUi\.tabs\(root\)/);
assert.match(app,/accessFormError/);assert.match(app,/AuditUi.top\(\)\?\.id === 'modal'/);
console.log('UI QA regression passed: modal reopen, contrast, metadata/assets, touch/pressed states and integration guards');
