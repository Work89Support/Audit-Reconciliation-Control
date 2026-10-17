const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('    const openCompanyCases =',app.indexOf('VIEWS.clarify ='));
const end=app.indexOf('    root.querySelectorAll("[data-clarify-company]")',start);
let renders=0,navigations=[];
const ctx={state:{role:'shift_lead',filters:{company:'ALL',from:'2026-10-16',to:'2026-10-16',direction:'all'},drafts:{caseA:'existing response'}},render:()=>renders++,go:(...args)=>navigations.push(args)};
vm.createContext(ctx);vm.runInContext(app.slice(start,end)+';this.selectCompany=openCompanyCases;',ctx);
const preserved=JSON.stringify({drafts:ctx.state.drafts,from:ctx.state.filters.from,to:ctx.state.filters.to,direction:ctx.state.filters.direction});
for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']){ctx.selectCompany(company);assert.equal(ctx.state.filters.company,company);}
assert.equal(renders,9);assert.equal(navigations.length,0,'same-route company selection must repaint, not wait for hashchange');
assert.equal(JSON.stringify({drafts:ctx.state.drafts,from:ctx.state.filters.from,to:ctx.state.filters.to,direction:ctx.state.filters.direction}),preserved);
ctx.state.role='lead';ctx.selectCompany('FR8');assert.equal(navigations[0][0],'exceptions');assert.equal(navigations[0][1].filters.company,'FR8');
console.log('PASS clarify company cards: all nine same-route repaints, preserved dates/direction/drafts, lead navigation unchanged. No business writes.');
