import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(
  app,
  /function caseLabel\(e\)[\s\S]*?const code = String\(e\?\.code \|\| e\?\.id \|\| "เคส"\)/,
  'case label must include the persisted display code',
);
assert.match(
  app,
  /function mapLiveException\(e\)[\s\S]*?id: e\.id,[\s\S]*?code: e\.code \|\| e\.id,/,
  'live exceptions must navigate by UUID, never by the repeated EX number',
);
assert.doesNotMatch(
  app,
  /function mapLiveException\(e\)[\s\S]{0,800}?id: e\.code \|\| e\.id,/,
  'repeated EX numbers must not be used as the in-memory key',
);
for (const surface of [
  /id="drawerTitle">\$\{h\(caseLabel\(e\)\)\}/,
  /class="sheet-state"[\s\S]*?\$\{h\(caseLabel\(e\)\)\}/,
  /<td><b>\$\{h\(caseLabel\(e\)\)\}<\/b>/,
]) assert.match(app, surface, 'case company/date/code must be visible on every review surface');

console.log('exception identity and scoped case labels passed');
