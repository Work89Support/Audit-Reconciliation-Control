const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'build-n8n-rounds.mjs'),
  'utf8',
);

const queueNode = source.match(/const queue=\{[\s\S]*?name:'Supabase: ตรวจไฟล์และจัดคิว'[\s\S]*?retryOnFail:true,maxTries:(\d+),waitBetweenTries:(\d+)/);
if (!queueNode) throw new Error('dispatcher queue retry contract not found');
if (Number(queueNode[1]) < 2) throw new Error('dispatcher queue must retry transient Supabase failures');
if (Number(queueNode[2]) < 10000) throw new Error('dispatcher queue retry interval must tolerate a short schema-cache outage');

console.log('dispatcher queue retry contract passed');
