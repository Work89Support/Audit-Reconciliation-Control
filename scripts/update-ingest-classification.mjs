import fs from 'node:fs';

const path = new URL('../n8n/audit-mail-ingest.json', import.meta.url);
const workflow = JSON.parse(fs.readFileSync(path, 'utf8'));

const classify = workflow.nodes.find((node) => node.id === 'classify');
if (!classify) throw new Error('Missing classify node');
classify.parameters.jsCode = classify.parameters.jsCode.replace(
  "if (/\\.pdf$/i.test(n)) return /ฝาก\\s*-\\s*ถอน|statement|stm/i.test(n) ? 'stm_pdf' : 'doc_clarify';",
  "if (/\\.pdf$/i.test(n)) return /ฝาก\\s*[-–—/]?\\s*ถอน|ฝากถอน|statement|(^|[^a-z0-9])stm([^a-z0-9]|$)/i.test(n) ? 'stm_pdf' : 'doc_clarify';",
);

const sourceFile = workflow.nodes.find((node) => node.name === 'Supabase: บันทึกทะเบียนไฟล์');
if (!sourceFile) throw new Error('Missing source file node');
sourceFile.parameters.jsonBody = "={{ JSON.stringify({ batch_id: $('เดาชนิดไฟล์และตั้ง path').item.json.batch_id, file_name: $('เดาชนิดไฟล์และตั้ง path').item.json.file_name, from_zip: $('เดาชนิดไฟล์และตั้ง path').item.json.from_zip || null, mime_type: $('เดาชนิดไฟล์และตั้ง path').item.json.mime_type, size_bytes: $('เดาชนิดไฟล์และตั้ง path').item.json.size_bytes, storage_path: $('เดาชนิดไฟล์และตั้ง path').item.json.storage_path, checksum: null, company: $('เดาชนิดไฟล์และตั้ง path').item.json.company || null, kind: $('เดาชนิดไฟล์และตั้ง path').item.json.kind, parsed: false }) }}";

fs.writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);
