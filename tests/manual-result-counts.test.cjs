const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const fn=app.slice(app.indexOf('function dailyAuditSheetRows(date) {'),app.indexOf('\nfunction exportDailyCompanySummary',app.indexOf('function dailyAuditSheetRows(date) {')));
function rows(checklist,quality){const ctx={dailyCompanyState:{checklist,quality},isLiveCompanyRow:()=>true,dailyResultStatus:(row,run)=>({primary:run.primaryResult||row.primaryResult})};vm.createContext(ctx);return vm.runInContext(fn+';dailyAuditSheetRows("2026-10-15")',ctx);}
const base={company:'UFABET7M',business_date:'2026-10-15',open_count:2668,resolved_count:0,exception_count:2668};
test('manual primary report never reuses historical case count',()=>{const primaryResult={report:{exceptions:Array(19).fill({}),summary:{waiting_bo:[]}}};const [r]=rows([{...base,primaryResult}],[{...base,primaryResult,stm_count:3109,bo_count:3118,matched:3104}]);assert.equal(r.generatedExceptionCount,19);assert.equal(r.exceptionCount,19);assert.equal(r.caseSetPending,true);assert.equal(r.historicalOpenCount,2668);assert.equal(r.openCount,19);});
test('active case lifecycle remains separate from report exceptions',()=>{const primaryResult={report:{exceptions:Array(7).fill({})},case_set:{}};const [r]=rows([{...base,primaryResult,open_count:0,resolved_count:7}],[{...base,primaryResult}]);assert.equal(r.generatedExceptionCount,7);assert.equal(r.openCount,0);assert.equal(r.resolvedCount,7);assert.equal(r.caseSetPending,false);});
test('waiting STM rows included once in manual result',()=>{const primaryResult={report:{exceptions:Array(20).fill({}),summary:{waiting_bo:Array(143).fill({})}}};const [r]=rows([{...base,primaryResult}],[{...base,primaryResult}]);assert.equal(r.generatedExceptionCount,163);assert.equal(r.exceptionCount,163);});
test('automatic counts and genuine zero lifecycle stay intact',()=>{const [r]=rows([{...base,open_count:0,resolved_count:5}],[{...base,exception_count:5}]);assert.equal(r.openCount,0);assert.equal(r.exceptionCount,5);assert.equal(r.resolvedCount,5);assert.equal(r.caseSetPending,false);});
test('render labels report and case lifecycle independently without truthy-zero fallback',()=>{assert.match(app,/DailyCaseSummary.markup\(row\)/);assert.doesNotMatch(app,/num\(row.openCount \|\| row.exceptionCount\)/);});
