const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
assert.ok(app.includes("button.closest('article').append(detail)"));
assert.ok(app.includes("b.closest('article').append(form)"));
assert.ok(css.includes('.case-mail-evidence article[hidden] { display:none; }'));
assert.ok(!app.includes('b.after(form)'));

// Exercise the real rendering template with local sample data; no backend calls.
const template = app.slice(app.indexOf('list.innerHTML=`') + 'list.innerHTML='.length,
  app.indexOf('\n        host.querySelector', app.indexOf('list.innerHTML=`')) - 1);
const markup = vm.runInNewContext(template, {
  e: {company:'UFABET7M', date:'2026-10-01'},
  candidates: [{id:'sample', file_name:'UFABET7M_EVIDENCE_เอกสารชี้แจงรายการข้ามวัน_2026-10-01.pdf',
    subject:'[AUDIT] UFABET7M | 2026-10-01 | EVIDENCE', sender:'myflower@example.com'}],
  amountsByFile: new Map(), evidenceAmountLabel: x=>x,
  normalizeEvidenceSearch: x=>x, exceptionFileAttrs: ()=>'',
  h: x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
});
const formMarkup = app.match(/form.innerHTML='([^']+)'/)[1];

async function run() {
  const {chromium} = require(process.env.AUDIT_PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({headless:true, ...(process.env.AUDIT_BROWSER_PATH ? {executablePath:process.env.AUDIT_BROWSER_PATH} : {})});
  try {
    const page = await browser.newPage();
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({width, height:1000});
      await page.setContent(`<style>${css}</style><main style="max-width:850px;margin:auto;padding:16px"><section class="case-mail-evidence">${markup}</section></main>`);
      await page.evaluate(formMarkup=>{
        const article=document.querySelector('article');
        const detail=document.createElement('details');detail.innerHTML='<summary>ใช้เป็นหลักฐาน 0 เคสในบริษัทนี้ (รวมเคสปิดแล้ว)</summary>';article.append(detail);
        const form=document.createElement('form');form.className='case-mail-reason';form.innerHTML=formMarkup;
        const actions=document.createElement('div');actions.className='case-mail-reason-actions';
        form.querySelector('[type=submit]').className='primary-button sm';
        actions.append(...form.querySelectorAll('button'));form.append(actions);article.append(form);
      }, formMarkup);
      const measurements=await page.evaluate(()=>{
        const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
        return {file:rect('.case-mail-file'), form:rect('form'), actions:rect('.case-mail-actions'),
          overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.ok(measurements.file.width>260, `File collapsed at ${width}`);
      assert.ok(measurements.form.y>=measurements.actions.bottom, 'Form must be below actions');
      assert.ok(!measurements.overflow, `Horizontal overflow at ${width}`);
      await page.screenshot({path:`/private/tmp/audit-evidence-layout-${width}.png`, fullPage:true});
      await page.locator('article').evaluate(el=>el.hidden=true);
      assert.equal(await page.locator('article').isVisible(), false);
    }
  } finally {await browser.close();}
  console.log('Evidence layout: real template, desktop/tablet/mobile widths and hidden search results passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
