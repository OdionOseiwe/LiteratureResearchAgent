/**
 * End-to-end pipeline verification with a MOCKED LLM + MOCKED Tavily (real HTTP to localhost).
 * Uses an ephemeral in-memory MongoDB. Exercises: planning -> discovery (mock search) ->
 * deep read (real fetch of mocked-URL pages is avoided: we return short real pages via jina/direct) ->
 * fact-check -> analysis -> synthesis -> report stored -> PDF generated (real Puppeteer).
 *
 * Run: node scripts/e2eMock.js
 */
import http from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.PORT = '0';
process.env.OPENAI_API_KEY = 'mock-key';
process.env.OPENAI_BASE_URL = 'http://127.0.0.1:8787/v1/';
process.env.OPENAI_MODEL = 'mock-fast';
process.env.OPENAI_MODEL_HEAVY = 'mock-heavy';
process.env.TAVILY_API_KEY = 'mock-tavily';
process.env.TAVILY_BASE_URL = 'http://127.0.0.1:8787/tavily';
process.env.JINA_READER_BASE_URL = 'http://127.0.0.1:8787/jina';
process.env.PDF_STORAGE_PATH = './storage';

const MOCK_PAGES = {
  'https://example.com/': 'Title: Intermittent fasting and metabolism\n\nA 2024 randomized controlled trial of 120 adults found intermittent fasting improved fasting glucose by 8 percent over 12 weeks (Doe et al.). Authors note adherence and small sample size as limitations. Metabolic markers like triglycerides improved modestly; effects on weight were sustained in the intervention arm.',
  'https://example.org/': 'Title: Meta-analysis of fasting regimens\n\nThis 2025 meta-analysis of 14 trials reports that time-restricted eating produces modest weight loss comparable to continuous calorie restriction. Evidence in people with type 2 diabetes is limited. Several studies were funded by fasting-app vendors, introducing potential bias. Long-term safety beyond one year remains unknown.',
  'https://www.iana.org/domains/example': 'Title: National nutrition guidelines\n\nThe 2023 national nutrition report states there is insufficient high-quality evidence to recommend intermittent fasting as a first-line strategy for metabolic health in the general population. It advises clinician supervision for people with diabetes taking glucose-lowering medication.',
};

const URLs = Object.keys(MOCK_PAGES);

/* ---------------------------- mock server ---------------------------- */
function mockChatCompletion(body) {
  const sys = String(body?.messages?.find((m) => m.role === 'system')?.content || '');
  const user = String(body?.messages?.find((m) => m.role === 'user')?.content || '');
  const reply = (obj) => ({ choices: [{ message: { role: 'assistant', content: JSON.stringify(obj) } }], usage: { total_tokens: 321 }, model: body.model });

  if (sys.includes('Web Discovery planner')) {
    return reply({ queries: ['intermittent fasting metabolic health evidence', 'time restricted eating meta-analysis', 'fasting guidelines type 2 diabetes'] });
  }
  if (sys.includes('Deep Research Agent')) {
    return reply({
      findings: [
        { claim: 'A 2024 RCT found intermittent fasting improved fasting glucose by about 8% over 12 weeks in 120 adults.', explanation: 'Randomized controlled trial evidence.', evidence: 'improved fasting glucose by 8 percent over 12 weeks (Doe et al.)', sourceUrl: URLs[0], sourceTitle: 'Intermittent fasting and metabolism', excerpt: 'improved fasting glucose by 8 percent', researchQuestion: 'efficacy', confidence: 'high', limitations: 'Small sample; adherence' },
        { claim: 'Time-restricted eating produces weight loss comparable to continuous calorie restriction across 14 trials.', explanation: 'Meta-analysis result.', evidence: 'modest weight loss comparable to continuous calorie restriction', sourceUrl: URLs[1], sourceTitle: 'Meta-analysis of fasting regimens', excerpt: 'comparable to continuous calorie restriction', researchQuestion: 'efficacy', confidence: 'high', limitations: 'Vendor funding in several studies' },
        { claim: 'National guidelines find insufficient high-quality evidence to recommend fasting as a first-line strategy.', explanation: 'Official guidance.', evidence: 'insufficient high-quality evidence to recommend intermittent fasting', sourceUrl: URLs[2], sourceTitle: 'National nutrition guidelines', excerpt: 'insufficient high-quality evidence', researchQuestion: 'guidelines', confidence: 'high', limitations: 'Guidance may lag newest trials' },
      ],
    });
  }
  if (sys.includes('Fact-Checking and Source Verification Agent')) {
    const indexes = [...user.matchAll(/^\[(\d+)\] CLAIM/gm)].map((m) => Number(m[1]));
    return reply({ verdicts: indexes.map((index, i) => ({ index, status: i === 2 ? 'Partially supported' : 'Supported', note: 'Claim matches source content excerpt.' })) });
  }
  if (sys.includes('Analysis & Insights Agent')) {
    return reply({
      keyInsights: [
        { insight: 'Short-term metabolic improvements are consistent across trials, but effect sizes are modest.', basis: 'finding #0 and #1', type: 'fact' },
        { insight: 'Guideline bodies remain cautious; evidence quality is moderate at best.', basis: 'finding #2', type: 'fact' },
      ],
      patterns: ['Reported benefits cluster in short-term glucose and weight outcomes'],
      trends: ['Interest shifting toward long-term safety endpoints'],
      agreements: ['Trials and meta-analysis agree on modest weight loss'],
      disagreements: ['Enthusiasm in vendor-funded studies vs caution in guidelines'],
      implications: ['Clinicians may trial fasting as an adjunct, not a replacement'],
      risks: [{ risk: 'Hypoglycemia risk for medicated diabetics', evidence: 'Guideline notes need for supervision' }],
      opportunities: [{ opportunity: 'Larger independent long-term RCTs', evidence: 'Unknown safety beyond 1 year' }],
      recommendations: [{ recommendation: 'Use clinician-supervised protocols for at-risk groups', rationale: 'Official guidance', priority: 'high' }],
      limitations: ['No long-term safety data', 'Vendor funding in subset of studies', 'Adherence measurement varies'],
      futureQuestions: ['Does benefit persist after discontinuation?'],
    });
  }
  if (sys.includes('Research Manager of a multi-agent research system')) {
    return reply({ objective: 'Assess the evidence on intermittent fasting and metabolic health.', scope: 'Adults, efficacy and safety, 2018–2026 literature', questions: ['What efficacy data exists?', 'What do official guidelines say?', 'What are the safety concerns?'], plan: ['Discover sources', 'Extract findings', 'Verify claims', 'Analyze', 'Synthesize'] });
  }
  if (sys.includes('research report')) {
    return reply({
      title: 'Intermittent Fasting and Metabolic Health: Evidence Review',
      executiveSummary: 'Intermittent fasting yields modest metabolic benefits in short trials [1][2]. Official bodies urge caution [3]. Effects beyond one year are unknown.',
      abstract: 'This report reviews controlled trials, meta-analyses and official guidance on intermittent fasting in adults, finding modest short-term benefits with unresolved long-term safety questions.',
      sections: [
        { heading: 'Introduction', content: 'Intermittent fasting is widely practiced. This report evaluates the evidence [1].' },
        { heading: 'Detailed Research Findings', content: '- An RCT reports improved fasting glucose [1]\n- A meta-analysis finds comparable weight loss to calorie restriction [2]\n- National guidelines call evidence insufficient [3]' },
        { heading: 'Cross-Source Analysis', content: 'Findings agree on modest short-term benefit; guidance lags primary literature [2][3].' },
        { heading: 'Discussion', content: 'Vendor funding may inflate reported effects [2]. Clinicians should supervise at-risk patients [3].' },
        { heading: 'Limitations of the Research', content: 'Long-term safety beyond one year is unknown. Some studies carry vendor funding bias.' },
        { heading: 'Conclusion', content: 'Intermittent fasting shows promise as an adjunct strategy but is not yet first-line guidance [3].' },
      ],
    });
  }
  return reply({ note: 'unhandled mock prompt' });
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const readBody = () => new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d)); });

  if (req.method === 'POST' && req.url === '/tavily/search') {
    const body = JSON.parse(await readBody() || '{}');
    return send(200, {
      results: [
        { title: 'Intermittent fasting and metabolism', url: URLs[0], content: 'RCT: improved fasting glucose by 8 percent over 12 weeks.', published_date: '2024-05-01', score: 0.91 },
        { title: 'Meta-analysis of fasting regimens', url: URLs[1], content: 'Comparable to calorie restriction; vendor funding noted.', published_date: '2025-02-01', score: 0.88 },
        { title: 'National nutrition guidelines', url: URLs[2], content: 'Insufficient evidence for first-line recommendation.', published_date: '2023-09-01', score: 0.84 },
      ],
    });
  }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    const body = JSON.parse(await readBody() || '{}');
    return send(200, mockChatCompletion(body));
  }
  if (req.url?.startsWith('/jina/')) {
    const target = req.url.slice('/jina/'.length);
    const page = MOCK_PAGES[target];
    res.writeHead(page ? 200 : 404, { 'Content-Type': 'text/plain' });
    return res.end(page || 'Not Found');
  }
});
await new Promise((r) => server.listen(8787, '127.0.0.1', r));

/* -------------------- in-memory db + real pipeline -------------------- */
const mem = await MongoMemoryServer.create();
process.env.MONGODB_URI = mem.getUri('praxis_e2e');

const { default: Research } = await import('../src/models/Research.js');
const { runResearchPipeline } = await import('../src/graph/researchGraph.js');
await mongoose.connect(process.env.MONGODB_URI);

const job = await Research.create({
  topic: 'What does the evidence say about intermittent fasting and metabolic health in adults?',
  depth: 'quick',
  timeframe: 'Past 5 years',
  sourcePreferences: ['Academic papers'],
  userQuestions: ['What is the effecacy data?'],
  outputFormat: 'report',
  status: 'queued',
  agents: [
    { agent: 'Research Manager', agentType: 'orchestrator', status: 'pending', task: 'Plan and synthesize', retryCount: 0 },
    { agent: 'Web Discovery Agent', agentType: 'specialist', status: 'pending', task: 'Discover sources', retryCount: 0 },
    { agent: 'Deep Research Agent', agentType: 'specialist', status: 'pending', task: 'Read sources', retryCount: 0 },
    { agent: 'Fact-Checking Agent', agentType: 'specialist', status: 'pending', task: 'Verify claims', retryCount: 0 },
    { agent: 'Analysis & Insights Agent', agentType: 'specialist', status: 'pending', task: 'Analyze', retryCount: 0 },
  ],
});

console.log('Running mocked end-to-end pipeline for job', job._id);
await runResearchPipeline(job._id);

const doneJob = await Research.findById(job._id).lean();
const flat = {
  status: doneJob.status,
  stage: doneJob.currentStage,
  progress: doneJob.progress,
  sources: doneJob.sources?.length,
  findings: doneJob.findings?.length,
  agentsDone: doneJob.agents.map((a) => `${a.agent}:${a.status}`).join(' | '),
  reportSections: doneJob.report?.sections?.length,
  references: doneJob.report?.references?.length,
  pdfPath: doneJob.pdfPath,
  tokens: doneJob.tokensUsed,
};
console.log(JSON.stringify(flat, null, 2));

const problems = [];
if (!['completed', 'partial'].includes(doneJob.status)) problems.push(`status=${doneJob.status}`);
if (!doneJob.report?.sections?.length) problems.push('no report sections');
if (!doneJob.pdfPath) problems.push('no PDF generated');
if (!doneJob.sources?.length) problems.push('no sources stored');

await mongoose.disconnect();
await mem.stop();
server.close();

if (problems.length) {
  console.error('E2E MOCK FAILED:', problems.join(', '));
  process.exit(1);
}
console.log('E2E MOCK PASSED — full pipeline including PDF generation works.');
process.exit(0);
