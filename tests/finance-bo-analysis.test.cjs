const assert=require('node:assert/strict'),fs=require('node:fs');global.FinanceReport=require('../finance-report.js');const F=global.FinanceReport,B=require('../finance-bo-analysis.js'),X=require('../xlsx-writer.js');
const cs=Array.from({length:9},(_,i)=>'C'+i),rows=[];
for(const company of cs)for(const date of ['2026-09-29','2026-09-30','2026-10-01','2026-10-02']){
 const deposit=date<'2026-10-01'?50:date==='2026-10-01'?100:0,withdraw=date==='2026-10-02'?200:0;
 rows.push({scopeKey:company+'|'+date,company,date,deposit,withdraw,count:1,deposits:deposit?1:0,withdrawals:withdraw?1:0,complete:true,identified_rows:1,user_complete:true,user_keys:[{key:(date<'2026-10-01'?'b':'a').repeat(32),count:1,deposits:deposit?1:0,withdrawals:withdraw?1:0}],reason:'verified',channels:[]});
}
const d={companies:cs,boRows:rows,from:'2026-10-01',to:'2026-10-02',previous:{from:'2026-09-29',to:'2026-09-30',rows:[]},bo:{rows:rows.filter(r=>r.date>='2026-10-01')},equalDays:true,analysisMode:'range'};
let m=B.build(d);assert.equal(m.company.length,9);assert.equal(m.dailyCompany.length,18);assert.equal(m.monthlyCompany.length,9);
assert.equal(m.overall.deposit,900);assert.equal(m.overall.withdraw,1800);assert.equal(m.overall.net,-900);
assert.equal(m.overall.userCount,9,'Do not sum daily users or merge identities across companies');assert.equal(m.monthly[0].userCount,9);assert.equal(m.overall.bothUsers,9);assert.equal(m.overall.repeatUsers,9);
assert.equal(m.overall.frequency,2);assert.equal(m.cohort[0].overlap,0);assert.equal(m.cohort[0].notSeenBefore,1,'Observed period newcomer is not claimed to be newly registered');
assert.equal(B.change({complete:true,deposit:100},{complete:true,deposit:0},'deposit'),null);assert.equal(B.change({complete:true,net:50},{complete:true,net:-100},'net'),150);
const partialRows=rows.map(r=>r.company==='C0'&&r.date==='2026-10-01'?{...r,complete:false,user_complete:false}:r),partial={...d,boRows:partialRows};
m=B.build(partial);assert.equal(m.daily[0].complete,false);assert.equal(m.daily[0].deposit,900,'Available subtotal must not disappear when one company is partial');assert.equal(B.charts(m,'daily')[0].items[0].partial,true);assert.equal(m.daily[0].depositGrowth,null);assert.equal(m.cohort[0].returnRate,null);
assert.equal(B.aggregate([{company:'C0',date:'2026-10-01',complete:false}],1).deposit,null,'No fabricated zero when no rows can be read');
const view=B.view(d,'daily'),sheets=view.sheets;assert.equal(sheets.find(s=>s.name==='BO บริษัทและวัน').rows.length,18);assert.equal(sheets.find(s=>s.name==='ภาพรวมบริษัท').rows.length,9);
for(const sheet of sheets)for(const row of sheet.rows)assert.equal(row.length,sheet.headers.length,sheet.name+' columns must align');
assert.doesNotMatch(JSON.stringify(sheets),new RegExp('a'.repeat(32)));assert.match(B.csv({headers:['x'],rows:[['=1+2'],[-100]]}),/'=1\+2/);assert.doesNotMatch(B.csv({headers:['x'],rows:[[-100]]}),/'-100/);
const trend=F.period('trend','2026-10','','','2026-10-15');assert.equal(trend.from,'2026-08-01');assert.equal(trend.to,'2026-10-14');
const chart=F.chartSvg({title:'negative partial',kind:'line',items:[{label:'d1',value:-900,partial:true},{label:'d2',value:100}]});assert.match(chart,/#d58a1b/);assert.match(chart,/6 4/);assert.doesNotMatch(chart,/NaN|Infinity/);
const svg=B.tableSvg({name:'full',headers:['value'],rows:[['a'.repeat(150)]]});assert.ok(svg.split('a').length>150,'SVG must not silently truncate long table values');
const sql=fs.readFileSync('supabase/20261015_finance_bo_analytics.sql','utf8');assert.doesNotMatch(sql,/\b(update|insert into|delete from)\s+(public\.)?(damages|exceptions|recon_runs|daily_recon_jobs|damage_receipts|damage_collections)\b/i);
(async()=>{const file=X.build(sheets,{title:'QA BO'}),buf=Buffer.from(await file.arrayBuffer());assert.match(buf.toString('utf8'),/C8/);assert.match(buf.toString('utf8'),/-900/);console.log('PASS BO analysis: all-company day/month tables, exact amounts, partial graph, negative net, distinct scoped users, safe comparisons and complete XLSX/CSV/SVG exports.');})().catch(e=>{console.error(e);process.exitCode=1;});
