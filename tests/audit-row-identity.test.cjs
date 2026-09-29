const assert = require('node:assert/strict');
globalThis.MC8SheetSchema = require('../mc8-sheet-schema.js');
const live = require('../mc8-live-sheets.js');

async function main() {
  for (const company of live.COMPANIES) {
    const nodes = new Map();
    const container = {innerHTML:'',querySelector(s){if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);},querySelectorAll(){return [];}};
    const data = {complete:true,run:{id:'test',matched:1,jobStatus:'completed',summary:{match_evidence:[{
      company,account:'AUTOPEER',direction:'withdraw',amount:1001,
      stm:{date:'2026-09-28',sec:72000},bo:{date:'2026-09-28',sec:72000},
      customer:{stm:{reference:'pm-pair'},bo:{reference:'bo-pair'}}
    }]}},cases:[
      {id:'case-bo',company,account:'AUTOPEER',direction:'withdraw',status:'open',ex_type:'missing_stm',system_amount:3890,bank_amount:null,bo_date:'2026-09-28',bo_time:'01:00:00',bo_raw:'only-bo'},
      {id:'case-pm',company,account:'AUTOPEER',direction:'withdraw',status:'open',ex_type:'missing_bo',system_amount:null,bank_amount:1750,stm_date:'2026-09-28',stm_time:'02:00:00',stm_raw:'only-pm'}
    ]};
    live.mount(container,{signedIn:()=>true,company,companies:live.COMPANIES,date:'2026-09-28',load:async()=>data});
    await new Promise(resolve=>setImmediate(resolve));
    const grid=container.innerHTML.split('<table class="mc8-grid">')[1].split('</table>')[0];
    const rows = [...grid.matchAll(/<tr class="mc8-(success|warning|error)">([\s\S]*?)<\/tr>/g)];
    assert.equal(rows.length,3,company);
    assert.deepEqual(rows.map(r=>r[1]),['error','error','success'],company);
    assert.ok(rows[0][2].includes('data-live-case="case-bo"'),company);
    assert.ok(rows[1][2].includes('data-live-case="case-pm"'),company);
    assert.ok(!rows[2][2].includes('data-live-case'),company);
    assert.ok(rows[0][2].includes('3,890.00') && rows[1][2].includes('1,750.00') && rows[2][2].includes('1,001.00'),company);
    for(const r of rows)assert.ok(r[2].includes(r[1]==='success'?'ปิดได้ทันที':'ปิดไม่ได้/ต้องตรวจ'),company);
    const sourceRows=live.rowsOf(data,company);
    for(const sheet of ['all','AT ถ']){
      const view=live.tableView(sourceRows,company,'2026-09-28',true,sheet);
      assert.deepEqual(view.rows.map(r=>r.at(-1)),['ปิดไม่ได้/ต้องตรวจ','ปิดไม่ได้/ต้องตรวจ','ปิดได้ทันที']);
    }
  }
  const base={kind:'review',pmAmount:100,boAmount:100,pmRaw:'PM evidence',boRaw:'BO evidence'};
  for(const exType of ['wrong_account','duplicate','amount_diff','missing_bo']){
    assert.equal(live.auditStatus({...base,exType}),'ปิดไม่ได้/ต้องตรวจ');
  }
  for(const amount of [null,undefined,'',' ',false]){
    assert.equal(live.auditStatus({...base,pmAmount:amount,boAmount:amount}),'ปิดไม่ได้/ต้องตรวจ');
    assert.equal(live.summarize([{...base,pmAmount:amount,boAmount:amount}]).pmCount,0);
  }
  assert.equal(live.auditStatus({...base,kind:'matched',isPair:true,pmAmount:101}),'ต้องตรวจเพิ่ม · หลักฐานคู่ไม่สมบูรณ์');
  assert.equal(live.auditStatus({...base,case:{status:'open',_quickSourceEvidence:{verified:true}}}),'ปิดได้ทันที');
  assert.equal(live.auditStatus({...base,case:{status:'open',_quickSourceEvidence:true}},false),'ต้องตรวจเพิ่ม · ข้อมูลรอบไม่ครบ');
  assert.equal(live.auditStatus({...base,kind:'closed'}),'ปิดเคสแล้ว');
  assert.equal(live.auditStatus({...base,kind:'pending_next_day'}),'ค้างรอข้อมูลข้ามวัน · รอข้อมูลของวันถัดไป');
  console.log('All 9 companies: chronological row identity, tone, action UUID and conservative eligibility passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
