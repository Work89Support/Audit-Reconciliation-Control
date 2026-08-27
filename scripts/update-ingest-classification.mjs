import fs from 'node:fs';

const path = new URL('../n8n/audit-mail-ingest.json', import.meta.url);
const workflow = JSON.parse(fs.readFileSync(path, 'utf8'));

const classify = workflow.nodes.find((node) => node.id === 'classify');
if (!classify) throw new Error('Missing classify node');
classify.parameters.jsCode = String.raw`/* เดาชนิดไฟล์และสร้าง Storage path แบบ ASCII-safe */
const tokensOf = (value) => String(value || '').toLowerCase()
  .replace(/[._\/\\()\-–—]+/g, ' ')
  .split(/\s+/)
  .filter(Boolean);
const BANK_TOKENS = new Set(['scb', 'kb', 'kbank', 'ktb', 'bbl', 'gsb', 'tmn', 'bay', 'lbk', 'krungsri', 'ttb', 'uob']);
function directionOf(name) {
  const n = String(name || '').toLowerCase();
  const toks = tokensOf(name);
  const deposit = /ฝาก|deposit/i.test(n) || toks.includes('d') || toks.includes('dw');
  const withdraw = /ถอน|withdraw/i.test(n) || toks.includes('w') || toks.includes('dw');
  if (deposit && withdraw) return 'both';
  if (deposit) return 'deposit';
  if (withdraw) return 'withdraw';
  return null;
}
function isBankStatementPdf(name) {
  if (!/\.pdf$/i.test(String(name || ''))) return false;
  const n = String(name || '');
  const toks = tokensOf(n);
  const explicitStatement = /ฝาก\s*[-–—/]?\s*ถอน|ฝากถอน|statement|(^|[^a-z0-9])stm([^a-z0-9]|$)/i.test(n);
  const bankWithDirection = toks.some((token) => BANK_TOKENS.has(token)) && Boolean(directionOf(n));
  return explicitStatement || bankWithDirection;
}
function kindOf(name, subject) {
  const n = String(name || '');
  const s = String(subject || '');
  if (/รายงานหน้า\s*BO/i.test(s) && /\.(xlsx|xlsm?|csv)$/i.test(n)) return 'bo_main';
  if (/\.pdf$/i.test(n)) return isBankStatementPdf(n) ? 'stm_pdf' : 'doc_clarify';
  if (/\.docx?$/i.test(n)) return 'doc_clarify';
  if (/รายงานบัญชี(ฝาก|ถอน)|(^|[^a-z0-9])BO([^a-z0-9]|$)/i.test(n)) return 'bo_main';
  if (/ฝากมือ.*เครดิต/.test(n)) return 'manual_credit';
  if (/ฝากมือ.*Payment/i.test(n)) return 'manual_payment';
  if (/ฝากมือ.*โบนัส/.test(n)) return 'manual_bonus';
  if (/ขอถอนค่าคอม/.test(n)) return 'comm_req';
  if (/ถอนเครดิต/.test(n)) return 'credit_out';
  if (/\.(xlsx|xlsm?|csv)$/i.test(n) && (/รายงาน\s*PM/i.test(s) || /AUTOPEER|CYBER|AZPAY|MYPAY|12PAY|CPXM/i.test(n))) return 'pm_statement';
  return 'unknown';
}
function companyOf(name, current) {
  const n = String(name || '');
  const rules = [['3XB', /(^|[^A-Z0-9])3X(BET|B)?([^A-Z0-9]|$)/i], ['AT4', /(^|[^A-Z0-9])AT4([^A-Z0-9]|$)/i], ['FR8', /(^|[^A-Z0-9])FR8([^A-Z0-9]|$)/i], ['SK8', /(^|[^A-Z0-9])SK8?([^A-Z0-9]|$)/i], ['MR9', /(^|[^A-Z0-9])MR9?([^A-Z0-9]|$)/i], ['MC8', /(^|[^A-Z0-9])MC8?([^A-Z0-9]|$)/i], ['UR9', /(^|[^A-Z0-9])UR9([^A-Z0-9]|$)/i], ['PS8', /(^|[^A-Z0-9])PS8([^A-Z0-9]|$)/i], ['UFABET7M', /UFABET7M|(^|[^A-Z0-9])(?:UFA)?7M([^A-Z0-9]|$)/i]];
  for (const [company, pattern] of rules) if (pattern.test(n)) return company;
  return current || null;
}
const ascii = (s) => String(s || '').replace(/[^A-Za-z0-9._-]/g, '_');
function sizeBytes(value) {
  if (typeof value === 'number') return value;
  const m = String(value || '').match(/([\d.]+)\s*(B|kB|MB|GB)?/i);
  if (!m) return null;
  const factor = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 }[(m[2] || 'b').toLowerCase()] || 1;
  return Math.round(Number(m[1]) * factor);
}
return $input.all().map((item, index) => {
  const j = item.json;
  const date = j.business_date || 'unknown-date';
  const company = companyOf(j.file_name, j.company);
  const messageId = j.gmail_message_id || j.batch_id || 'unknown-message';
  const ordinal = String(j.attachment_index ?? index).padStart(3, '0');
  const extMatch = String(j.file_name || '').match(/\.([A-Za-z0-9]{1,10})$/);
  const ext = (extMatch ? extMatch[1] : 'bin').toLowerCase();
  const path = [ascii(date), ascii(company || 'UNKNOWN'), ascii(messageId), ascii(ordinal) + '.' + ext].join('/');
  const bin = (item.binary || {}).data || {};
  return { json: { ...j, company, kind: kindOf(j.file_name, j.subject), direction: directionOf(j.file_name), storage_path: path, size_bytes: sizeBytes(bin.fileSize) }, binary: item.binary };
});`;

const sourceFile = workflow.nodes.find((node) => node.name === 'Supabase: บันทึกทะเบียนไฟล์');
if (!sourceFile) throw new Error('Missing source file node');
sourceFile.parameters.jsonBody = "={{ JSON.stringify({ batch_id: $('เดาชนิดไฟล์และตั้ง path').item.json.batch_id, file_name: $('เดาชนิดไฟล์และตั้ง path').item.json.file_name, from_zip: $('เดาชนิดไฟล์และตั้ง path').item.json.from_zip || null, mime_type: $('เดาชนิดไฟล์และตั้ง path').item.json.mime_type, size_bytes: $('เดาชนิดไฟล์และตั้ง path').item.json.size_bytes, storage_path: $('เดาชนิดไฟล์และตั้ง path').item.json.storage_path, checksum: null, company: $('เดาชนิดไฟล์และตั้ง path').item.json.company || null, kind: $('เดาชนิดไฟล์และตั้ง path').item.json.kind, parsed: false }) }}";

fs.writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);
