const assert=require('node:assert/strict'),fs=require('node:fs');
const ui=require('../file-run-management.js');
const input={preflight:{version:1,blocked:true,warnings:[{code:'file_day_mismatch',file_name:'<script>file.xlsx',detail:'2026-10-18'}],cross_day_queue:[{id:'original',code:'EX-3025',source_date:'2026-10-17',report_date:'2026-10-18',account:'A',direction:'ฝาก',amount:50,source_rows:{bo:{fileId:'same-file',row:53}}}]}};
const before=structuredClone(input),html=ui.preflightHtml(input);
assert.match(html,/รอคนตัดสินใจ/);assert.match(html,/อ่านอย่างเดียว/);assert.match(html,/2026-10-17 \/ 2026-10-18/);assert.match(html,/แถว 53/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<button|onclick|<script>/);assert.deepEqual(input,before);
assert.match(ui.preflightHtml({preflight:{version:1,blocked:false,warnings:[],cross_day_queue:[]}}),/รอบปกติทำงานอัตโนมัติได้/);
const code=fs.readFileSync('file-run-management.js','utf8');assert.match(code,/if\(!confirmed\|\|!sameActor\(\)\)return/);assert.match(code,/busy=true;draw\(\)/);assert.match(code,/confirmRunWarnings/);
console.log('PASS preflight UI: read-only late queue, actual dates, source row, escaped content, unchanged draft objects, explicit human confirmation before manual-run review');
