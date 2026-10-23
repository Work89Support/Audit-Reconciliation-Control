const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'build-n8n-worker.mjs'),
  'utf8',
);

const queueNode = source.match(/http\("queue", "Supabase: ตรวจไฟล์และจัดคิว",[\s\S]*?\n  \}\), retryOnFail: true, maxTries: (\d+), waitBetweenTries: (\d+) \},/);
if (!queueNode) throw new Error('queue node retry contract not found');
if (Number(queueNode[1]) < 6) throw new Error('queue node must retry at least six times');
if (Number(queueNode[2]) < 10000) throw new Error('queue retry interval must tolerate a short schema-cache outage');

console.log('worker queue retry contract passed');
