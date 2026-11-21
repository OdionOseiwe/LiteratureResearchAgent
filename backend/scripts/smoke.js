/**
 * Local smoke test using an ephemeral in-memory MongoDB (dev only, no Atlas needed):
 *  - boots an in-memory mongod
 *  - starts the real Express app on an ephemeral port
 *  - checks /api/health, POST /api/research validation + acceptance,
 *    watches the pipeline fail gracefully (no keys configured), checks history + delete.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const mem = await MongoMemoryServer.create();
const uri = mem.getUri('praxis_smoke');
process.env.MONGODB_URI = uri;
process.env.PORT = '0';

const { default: app } = await import('../src/app.js');
await mongoose.connect(uri);

const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
const port = server.address().port;
const base = `http://127.0.0.1:${port}/api`;
const log = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);

// 1. health
let res = await fetch(`${base}/health`);
let body = await res.json();
log('GET /health 200 db=up', res.status === 200 && body.db === 'up', JSON.stringify(body.issues));

// 2. validation: too-short topic rejected
res = await fetch(`${base}/research`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'short' }) });
log('POST /research 400 on short topic', res.status === 400);

// 3. validation: bad depth rejected
res = await fetch(`${base}/research`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'A reasonably long research topic question', depth: 'ultra' }) });
log('POST /research 400 on bad depth', res.status === 400);

// 4. accept a job (LLM/Tavily keys intentionally absent -> pipeline must fail gracefully, not crash)
res = await fetch(`${base}/research`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'What does the evidence say about intermittent fasting and metabolic health in adults?', depth: 'quick' }) });
body = await res.json();
const jobId = body.id;
log('POST /research 202 accepted', res.status === 202 && !!jobId);

// 5. watch it fail gracefully
let finalStatus = 'queued';
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const jr = await fetch(`${base}/research/${jobId}`);
  const jb = await jr.json();
  finalStatus = jb.research.status;
  if (['completed', 'failed', 'partial'].includes(finalStatus)) break;
}
log('pipeline terminated with graceful state', ['failed', 'partial', 'completed'].includes(finalStatus), `status=${finalStatus}`);

res = await fetch(`${base}/research/${jobId}`);
body = await res.json();
const failedAgents = (body.research.agents || []).filter((a) => a.status === 'failed').map((a) => a.agent);
log('failure surfaced on agents + job error', Boolean(body.research.error) && failedAgents.length > 0, `agents failed: ${failedAgents.join(', ')}`);

// 6. SSE endpoint streams and closes
const sseRes = await fetch(`${base}/research/${jobId}/progress`);
const sseText = await sseRes.text();
log('SSE stream delivered events', sseText.includes('event: progress'), `${sseText.length} bytes`);

// 7. report not ready -> 409
res = await fetch(`${base}/research/${jobId}/report`);
log('GET /report 409 before completion', res.status === 409);

// 8. history lists the job
res = await fetch(`${base}/research/history?q=intermittent`);
body = await res.json();
log('history search finds job', body.items.some((j) => j.id === jobId));

// 9. delete works
res = await fetch(`${base}/research/${jobId}`, { method: 'DELETE' });
body = await res.json();
res = await fetch(`${base}/research/${jobId}`);
log('DELETE removes job', body.ok === true && res.status === 404);

// 10. invalid id handled
res = await fetch(`${base}/research/not-an-id`);
log('GET /research/not-an-id -> 400', res.status === 400);

await mongoose.disconnect();
await mem.stop();
server.close();
process.exit(0);
