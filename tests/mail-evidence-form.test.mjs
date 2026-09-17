import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = app.indexOf("list.querySelectorAll('[data-link-mail]')");
assert.ok(start > 0);
const handler = app.slice(start, app.indexOf('bindStoredFileLinks(host)', start));
assert.ok(!handler.includes('window.prompt'));
for (const fragment of [
  "document.createElement('form')",
  'event.preventDefault()',
  'if(saving)return',
  "if(!can('attach')&&!can('note'))",
  'state.selected!==e.id',
  'const note=input.value.trim()',
  'if(!note)',
  'submit.disabled=true',
  'cancel.disabled=true',
  'Sb.manualMatchClarificationFile(b.dataset.linkMail,[e.dbId],note)',
  'if(state.selected===e.id)await openException',
  'form.remove();b.disabled=false',
]) assert.ok(handler.includes(fragment), `Missing guard: ${fragment}`);
assert.ok(!handler.includes('closeException('));
assert.ok(!handler.includes('persistCaseClosure('));
console.log('Mail evidence form: prompt-free form and safety contract passed');
