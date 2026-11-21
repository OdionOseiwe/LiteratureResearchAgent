/**
 * PDF pipeline smoke test (not part of the test suite):
 * inserts a synthetic completed job with a report, renders the PDF, verifies the file.
 * Usage: MONGODB_URI=... node scripts/pdfSmoke.js
 */
import mongoose from 'mongoose';
import fs from 'fs';

// Spin up an ephemeral in-memory Mongo when no MONGODB_URI is provided (offline smoke testing)
if (!process.env.MONGODB_URI) {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri('praxis_pdf_smoke');
  process.env.__MEM_SERVER__ = '1';
}

const { default: config } = await import('../src/config/index.js');
const { default: Research } = await import('../src/models/Research.js');
const { generatePdfForJob, resolvePdfPath } = await import('../src/services/pdfService.js');

await mongoose.connect(config.mongodbUri);

const job = await Research.create({
  topic: 'PDF smoke test topic',
  depth: 'standard',
  status: 'synthesizing',
  progress: 96,
  agents: [],
  report: {
    title: 'Smoke Test Report: Systems Verification',
    dateGenerated: new Date().toISOString(),
    depth: 'standard',
    timeframe: 'Past year',
    executiveSummary: 'This PDF verifies the rendering pipeline with a [1] citation.',
    abstract: 'Abstract paragraph.',
    sections: [
      { heading: 'Introduction', content: 'Intro text with [1].\n\n- bullet one\n- bullet two' },
      { heading: 'Findings', content: '**Bold claim** supported by evidence [1].\n\n1. first\n2. second' },
    ],
    keyInsights: ['Insight alpha', 'Insight beta'],
    recommendations: ['Recommendation one'],
    risks: [{ risk: 'Risk A', evidence: 'Evidence A' }],
    opportunities: [{ opportunity: 'Opp B', evidence: 'Evidence B' }],
    limitations: ['Limitation one'],
    futureQuestions: ['Future question?'],
    verificationSummary: { totalFindings: 2, byStatus: { Supported: 2 } },
    references: [
      { n: 1, title: 'A Working Source', url: 'https://example.com/article', publisher: 'Example Org', author: 'Doe, J.', publishedAt: '2026-01-01', accessedAt: '2026-11-19', sourceType: 'web', verificationStatus: 'Supported' },
    ],
  },
});

const filePath = await generatePdfForJob(job._id);
const freshJob = await Research.findById(job._id);
const resolved = resolvePdfPath(freshJob);
const stat = fs.statSync(resolved);
const head = Buffer.alloc(5);
const fd = fs.openSync(resolved, 'r');
fs.readSync(fd, head, 0, 5, 0);
fs.closeSync(fd);

console.log('PDF written:', filePath);
console.log('Size bytes:', stat.size);
console.log('Magic bytes:', head.toString());
if (head.toString() !== '%PDF-' || stat.size < 10000) {
  console.error('PDF SMOKE TEST FAILED');
  process.exit(1);
}
await Research.deleteOne({ _id: job._id });
fs.unlinkSync(resolved);
console.log('PDF SMOKE TEST PASSED (job + file cleaned up)');
await mongoose.disconnect();
process.exit(0);
