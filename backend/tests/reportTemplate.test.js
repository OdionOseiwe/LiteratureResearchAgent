import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mdToHtml, buildReportHtml } from '../src/services/reportTemplate.js';

test('mdToHtml escapes raw HTML (XSS-safe)', () => {
  const out = mdToHtml('<script>alert(1)</script>');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
});

test('mdToHtml renders bullets, bold, inline links', () => {
  const out = mdToHtml('- one **bold** item\n- see [site](https://example.com)');
  assert.match(out, /<li>one <strong>bold<\/strong> item<\/li>/);
  assert.match(out, /<a href="https:\/\/example\.com"/);
});

test('mdToHtml never emits javascript: links', () => {
  const out = mdToHtml('[click](javascript:alert(1))');
  assert.ok(!out.includes('href="javascript:'));
  assert.ok(!/href="[^"]*javascript/i.test(out));
});

const sampleReport = {
  title: 'Test & <b>Report</b>',
  dateGenerated: '2026-11-19T10:00:00.000Z',
  depth: 'standard',
  timeframe: 'Past year',
  executiveSummary: 'Summary with [1] citation.',
  abstract: 'Abstract text.',
  sections: [
    { heading: 'Introduction', content: 'Body with [2] link.' },
    { heading: 'Findings', content: '- point a\n- point b' },
  ],
  keyInsights: ['Insight one'],
  recommendations: ['Do the thing'],
  limitations: ['Sampling bias'],
  futureQuestions: ['What next?'],
  verificationSummary: { totalFindings: 3, byStatus: { Supported: 2, Unverified: 1 } },
  references: [
    { n: 1, title: 'Source A', url: 'https://a.example.com/x', publisher: 'A News', author: 'Doe', publishedAt: '2026', accessedAt: '2026-11-19', sourceType: 'news', verificationStatus: 'Supported' },
    { n: 2, title: 'Source B', url: 'https://b.example.org/y', publisher: '', author: '', publishedAt: '', accessedAt: '2026-11-19', sourceType: 'academic', verificationStatus: 'Verified' },
  ],
};

test('buildReportHtml produces a full document with clickable reference links', () => {
  const html = buildReportHtml(sampleReport, { createdAt: sampleReport.dateGenerated });
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /Test &amp; &lt;b&gt;Report&lt;\/b&gt;/);
  assert.match(html, /href="https:\/\/a\.example\.com\/x"/);
  assert.match(html, /href="https:\/\/b\.example\.org\/y"/);
  assert.match(html, /Executive Summary/);
  assert.match(html, /Introduction/);
  assert.match(html, /Findings/);
  assert.match(html, /Key Insights/);
  assert.match(html, /id="references"/);
  // no injected raw HTML from title
  assert.ok(!html.includes('<b>Report</b>'));
});
