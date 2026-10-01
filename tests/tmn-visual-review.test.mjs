import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'tmn-visual-review.js'), 'utf8') + '\nthis.review = TmnVisualReview;', context);
const review = context.review;
const checksum = 'a'.repeat(64);
const file = {id:'file-1',file_name:'UFABET7M_STM_TMN_ รุ่งฟ้า_DW_2026-09-30.pdf',kind:'stm_pdf',checksum};
const job = {company:'UFABET7M',business_date:'2026-09-30'};
const payload = () => ({provider:'tmn_visual_review_v1',page_count:2,rows:{
  version:1,sourceFileId:file.id,sourceChecksum:checksum,sourceSha256:checksum,
  company:job.company,businessDate:job.business_date,account:'0812792075',
  pageCount:2,pagesReviewed:[1,2],transcribedBy:'manual-review',
  coverageEvidence:'Every source page reviewed, overlapping screenshots deduplicated.',
  rows:[
    {id:'P1-R1',reviewed:true,date:'2026-09-30',time:'08:51',direction:'deposit',amount:15,description:'Received transfer'},
    {id:'P2-R1',reviewed:true,date:'2026-09-30',time:'19:44',direction:'withdraw',amount:5000,description:'Internal transfer',internalTransfer:true},
  ],
  controls:{deposit:{count:1,amount:15},withdraw:{count:1,amount:5000},excludedFeeCount:0},
}});

const output = review.normalize(payload(),file,job);
assert.equal(output.records.length,2);
assert.equal(output.records[0].amount,15);
assert.equal(output.records[0].sec,8*3600+51*60);
assert.equal(output.records[1].internalTransferHint,true);
assert.equal(output.quality.complete,true);
const reject = (mutate) => { const evidence = payload(); mutate(evidence); assert.throws(() => review.normalize(evidence,file,job)); };
reject(x => { x.rows.sourceChecksum='b'.repeat(64); });
reject(x => { x.rows.pagesReviewed=[1]; });
reject(x => { x.rows.controls.deposit.amount=150; });
reject(x => { x.rows.rows[0].reviewed=false; });
reject(x => { x.rows.rows[0].date='2026-09-29'; });
reject(x => { x.rows.rows[0].id='P3-R1'; });
reject(x => { x.rows.rows[0].amount=1000; });
reject(x => { x.rows.rows[0].direction='withdraw'; });
reject(x => { x.page_count=1; });
console.log('TMN visual review quality gate: OK');
