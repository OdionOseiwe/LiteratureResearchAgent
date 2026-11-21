import Research from '../models/Research.js';
import { runResearchPipeline } from '../graph/researchGraph.js';
import * as jobs from '../services/jobService.js';
import { subscribeProgress, publishProgress } from '../services/progressBus.js';
import { generatePdfForJob, resolvePdfPath, deletePdfForJob } from '../services/pdfService.js';
import { configIssues } from '../config/index.js';
import fs from 'fs';

const objectIdOk = (id) => /^[a-f\d]{24}$/i.test(String(id));

const fail = (res, status, message, details) => res.status(status).json({ ok: false, error: message, ...(details ? { details } : {}) });

/** POST /api/research — create + kick off a research job. */
export async function createResearch(req, res) {
  const { topic, depth = 'standard', timeframe = '', sourcePreferences = [], userQuestions = [], outputFormat = 'report' } = req.body || {};

  if (typeof topic !== 'string' || topic.trim().length < 10) {
    return fail(res, 400, 'Please provide a research topic of at least 10 characters.');
  }
  if (topic.trim().length > 500) return fail(res, 400, 'Topic is too long (max 500 characters).');
  if (!['quick', 'standard', 'deep'].includes(depth)) return fail(res, 400, "Depth must be 'quick', 'standard' or 'deep'.");
  if (!Array.isArray(sourcePreferences) || sourcePreferences.some((s) => typeof s !== 'string')) {
    return fail(res, 400, 'sourcePreferences must be an array of strings.');
  }
  if (!Array.isArray(userQuestions) || userQuestions.some((s) => typeof s !== 'string')) {
    return fail(res, 400, 'userQuestions must be an array of strings.');
  }
  const prefs = sourcePreferences.slice(0, 8).map((s) => s.trim()).filter(Boolean);
  const questions = userQuestions.slice(0, 10).map((s) => s.trim()).filter(Boolean);

  const issues = configIssues();
  const blocking = issues.filter((i) => i.startsWith('MONGODB_URI'));
  if (blocking.length) return fail(res, 503, 'Server is not configured for research runs.', issues);

  try {
    const job = await Research.create({
      topic: topic.trim(),
      prompt: topic.trim(),
      depth,
      timeframe: String(timeframe || '').slice(0, 120),
      sourcePreferences: prefs,
      userQuestions: questions,
      outputFormat: String(outputFormat || 'report').slice(0, 40),
      status: 'queued',
      currentStage: 'Queued',
      progress: 0,
      agents: jobs.initialAgents(),
      activityLog: [{ at: new Date(), message: 'Research job created' }],
    });

    // Fire and forget: pipeline runs in background; clients track via SSE + polling GET /:id
    setImmediate(() => {
      runResearchPipeline(job._id).catch((err) => console.error('[pipeline] fatal:', err));
    });

    return res.status(202).json({ ok: true, id: String(job._id), status: job.status });
  } catch (err) {
    console.error('[createResearch]', err);
    return fail(res, 500, 'Could not create research job', err.message);
  }
}

/** GET /api/research/:id — job detail (status, agents, counts). */
export async function getResearch(req, res) {
  const { id } = req.params;
  if (!objectIdOk(id)) return fail(res, 400, 'Invalid research id');
  const job = await Research.findById(id).lean();
  if (!job) return fail(res, 404, 'Research not found');
  return res.json({ ok: true, research: serializeJob(job, { includeReport: false }) });
}

/** GET /api/research/:id/progress — Server-Sent Events stream. */
export async function streamProgress(req, res) {
  const { id } = req.params;
  if (!objectIdOk(id)) return fail(res, 400, 'Invalid research id');
  const existing = await Research.findById(id).lean();
  if (!existing) return fail(res, 404, 'Research not found');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const send = (payload) => {
    res.write(`event: progress\ndata: ${JSON.stringify(payload)}\n\n`);
    if (payload?.done || ['completed', 'failed', 'partial'].includes(payload?.status)) {
      res.write(`event: done\ndata: ${JSON.stringify(payload)}\n\n`);
      cleanup();
      res.end();
    }
  };

  const unsubscribe = subscribeProgress(id, send);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  let closed = false;
  function cleanup() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
  }
  req.on('close', cleanup);

  // Replay current state immediately so reconnecting clients catch up
  send(jobs.progressPayload(existing, { replay: true }));
}

/** GET /api/research/:id/report — full report (when complete). */
export async function getReport(req, res) {
  const { id } = req.params;
  if (!objectIdOk(id)) return fail(res, 400, 'Invalid research id');
  const job = await Research.findById(id).lean();
  if (!job) return fail(res, 404, 'Research not found');
  if (!job.report) return fail(res, 409, 'Report is not ready yet', { status: job.status });
  return res.json({ ok: true, report: job.report, meta: reportMeta(job) });
}

/** GET /api/research/:id/sources — sources list. */
export async function getSources(req, res) {
  const { id } = req.params;
  if (!objectIdOk(id)) return fail(res, 400, 'Invalid research id');
  const job = await Research.findById(id).lean();
  if (!job) return fail(res, 404, 'Research not found');
  const sources = (job.sources || []).map((s, i) => ({ n: i + 1, ...s, _id: String(s._id) }));
  return res.json({ ok: true, sources, total: sources.length });
}

/** GET /api/research/:id/pdf — download the generated PDF. Regenerates if missing. */
export async function downloadPdf(req, res) {
  const { id } = req.params;
  if (!objectIdOk(id)) return fail(res, 400, 'Invalid research id');
  let job = await Research.findById(id);
  if (!job) return fail(res, 404, 'Research not found');
  if (!job.report) return fail(res, 409, 'Report is not ready yet', { status: job.status });

  let pdfPath = resolvePdfPath(job);
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    try {
      pdfPath = await generatePdfForJob(id);
      pdfPath = resolvePdfPath(await Research.findById(id));
    } catch (err) {
      console.error('[downloadPdf] regeneration failed:', err);
      return fail(res, 502, 'PDF could not be generated', err.message);
    }
  }
  const safeTitle = String(job.report?.title || job.topic).replace(/[^a-z0-9\-_]+/gi, '-').replace(/-+/g, '-').slice(0, 80) || 'research-report';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(pdfPath).pipe(res);
}

/** GET /api/research/history — paginated history with optional search. */
export async function getHistory(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  const q = String(req.query.q || '').trim();
  const filter = q ? { $text: { $search: q } } : {};
  const [items, total] = await Promise.all([
    Research.find(filter, { report: 0, findings: 0, reportMarkdown: 0 })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Research.countDocuments(filter),
  ]);
  return res.json({
    ok: true,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
    items: items.map((j) => ({
      id: String(j._id),
      topic: j.topic,
      depth: j.depth,
      status: j.status,
      progress: j.progress,
      currentStage: j.currentStage,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      sourceCount: j.sources?.length ?? 0,
      findingCount: j.findings?.length ?? 0,
      tokensUsed: j.tokensUsed ?? 0,
      hasPdf: !!j.pdfPath,
      error: j.error || '',
    })),
  });
}

/** DELETE /api/research/:id — delete job + stored PDF. */
export async function deleteResearch(req, res) {
  const { id } = req.params;
  if (!objectIdOk(id)) return fail(res, 400, 'Invalid research id');
  const job = await Research.findById(id);
  if (!job) return fail(res, 404, 'Research not found');
  deletePdfForJob(job);
  await Research.deleteOne({ _id: id });
  return res.json({ ok: true });
}

/** GET /api/health */
export async function health(req, res) {
  const issues = configIssues();
  let db = 'down';
  try {
    const mongoose = (await import('mongoose')).default;
    db = mongoose.connection.readyState === 1 ? 'up' : 'down';
  } catch { /* noop */ }
  res.json({ ok: true, db, configured: issues.length === 0, issues, uptime: process.uptime() });
}

/* -------------------------------------------------------- serialization */

function reportMeta(job) {
  return {
    id: String(job._id),
    topic: job.topic,
    depth: job.depth,
    timeframe: job.timeframe,
    status: job.status,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    pdfReady: !!job.pdfPath,
    tokensUsed: job.tokensUsed ?? 0,
    agents: (job.agents || []).map((a) => ({ agent: a.agent, status: a.status, outputSummary: a.outputSummary, endedAt: a.endedAt })),
  };
}

function serializeJob(job, { includeReport = false } = {}) {
  const base = {
    id: String(job._id),
    topic: job.topic,
    depth: job.depth,
    timeframe: job.timeframe,
    sourcePreferences: job.sourcePreferences,
    userQuestions: job.userQuestions,
    status: job.status,
    progress: job.progress,
    currentStage: job.currentStage,
    objective: job.objective,
    scope: job.scope,
    researchPlan: job.researchPlan,
    researchQuestions: job.researchQuestions,
    agents: job.agents || [],
    sourceCount: job.sources?.length ?? 0,
    findingCount: job.findings?.length ?? 0,
    verificationSummary: job.verificationSummary,
    rounds: job.rounds,
    tokensUsed: job.tokensUsed ?? 0,
    activityLog: job.activityLog || [],
    error: job.error || '',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    hasPdf: !!job.pdfPath,
  };
  if (includeReport) base.report = job.report;
  return base;
}
