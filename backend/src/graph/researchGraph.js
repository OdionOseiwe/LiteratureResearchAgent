import { StateGraph, END, START } from '@langchain/langgraph';
import { ResearchState } from './researchState.js';
import { planResearch, evaluateSufficiency, synthesizeReport } from '../agents/researchManager.js';
import { runWebDiscovery } from '../agents/webDiscoveryAgent.js';
import { runDeepResearch } from '../agents/deepResearchAgent.js';
import { runFactChecker } from '../agents/factCheckerAgent.js';
import { runAnalysis } from '../agents/analysisAgent.js';
import { dedupeSources } from '../utils/dedupe.js';
import * as jobs from '../services/jobService.js';
import { publishDone } from '../services/progressBus.js';
import { generatePdfForJob } from '../services/pdfService.js';
import Research from '../models/Research.js';
import config from '../config/index.js';

/**
 * Multi-agent research graph.
 * plan -> discover -> deepRead -> verify -> insights -> review -[insufficient & round<max]-> discover
 *                                                  \-[sufficient]-> synthesize -> finalize
 */

export function buildResearchGraph() {
  const graph = new StateGraph(ResearchState)
    .addNode('planner', planNode)
    .addNode('discover', discoverNode)
    .addNode('deepRead', deepReadNode)
    .addNode('verify', verifyNode)
    .addNode('analyze', insightsNode)
    .addNode('review', reviewNode)
    .addNode('synthesize', synthesizeNode)
    .addNode('finalize', finalizeNode)
    .addEdge(START, 'planner')
    .addEdge('planner', 'discover')
    .addEdge('discover', 'deepRead')
    .addEdge('deepRead', 'verify')
    .addEdge('verify', 'analyze')
    .addEdge('analyze', 'review')
    .addConditionalEdges('review', routeAfterReview, { discover: 'discover', synthesize: 'synthesize' })
    .addEdge('synthesize', 'finalize')
    .addEdge('finalize', END);

  return graph.compile();
}

/* ------------------------------------------------------------------ nodes */

async function planNode(state) {
  const jobId = state.jobId;
  await jobs.setStage(jobId, 'Planning research', 5, 'planning', 'Research Manager analyzing the request');
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.manager, { status: 'working', task: 'Analyze request, generate research plan and questions' });

  const plan = await planResearch({ topic: state.topic, depth: state.depth, timeframe: state.timeframe, userQuestions: state.userQuestions });
  await Research.updateOne(
    { _id: jobId },
    { $set: { objective: plan.objective, scope: plan.scope, researchPlan: plan.plan, researchQuestions: plan.questions } }
  );
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.manager, {
    status: 'completed',
    outputSummary: `Plan created: ${plan.questions.length} research questions, ${plan.plan.length} steps`,
    tokensUsed: plan.tokensUsed,
  });
  await jobs.setStage(jobId, 'Research plan ready', 12, 'planning', `Plan ready — ${plan.questions.length} research questions`);

  return {
    objective: plan.objective,
    scope: plan.scope,
    researchQuestions: plan.questions,
    plan: plan.plan,
    tokensUsed: plan.tokensUsed,
  };
}

async function discoverNode(state) {
  const jobId = state.jobId;
  const round = state.round;
  const label = round > 1 ? `Discovery round ${round} (gap-fill)` : 'Discovering sources';
  await jobs.setStage(jobId, label, round > 1 ? 22 : 18, 'researching', `Web Discovery Agent running searches (round ${round})`);
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.discovery, { status: 'working', task: `Search the web for high-quality sources (round ${round})`, retryCount: round - 1 });

  // On later rounds, ask for sources on the weakest-covered questions.
  const questions = round > 1 ? gapQuestions(state.researchQuestions, state.findings) : state.researchQuestions;

  let discovery;
  try {
    discovery = await runWebDiscovery({
      topic: state.topic,
      questions,
      timeframe: state.timeframe,
      sourcePreferences: state.sourcePreferences,
      maxSources: state.depth === 'quick' ? 8 : config.maxSourcesPerRun,
    });
  } catch (err) {
    await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.discovery, { status: 'failed', error: err.message });
    await jobs.setStage(jobId, 'Discovery failed', state.progress, 'researching');
    return { errors: [...state.errors, `Discovery: ${err.message}`] };
  }

  // Merge with existing sources and dedupe across rounds
  const merged = dedupeSources([...(state.sources || []), ...discovery.sources]);
  const sources = merged.unique.slice(0, config.maxSourcesPerRun + 4);
  await Research.updateOne({ _id: jobId }, { $set: { sources } });
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.discovery, {
    status: 'completed',
    outputSummary: `Found ${discovery.stats.rawResults} raw results → ${sources.length} unique sources from ${discovery.stats.queriesRun} queries (${discovery.stats.failedQueries} failed)`,
  });
  await jobs.setStage(jobId, `${sources.length} sources collected`, 32, 'researching', `Discovery complete: ${sources.length} unique sources`);

  return { sources };
}

async function deepReadNode(state) {
  const jobId = state.jobId;
  await jobs.setStage(jobId, 'Reading sources', 42, 'researching', 'Deep Research Agent fetching and reading pages');
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.deepRead, { status: 'working', task: 'Fetch pages and extract evidence-backed findings' });

  if (!state.sources.length) {
    await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.deepRead, { status: 'failed', error: 'No sources available to read' });
    return { findings: [], errors: [...state.errors, 'Deep research: no sources to read'] };
  }

  try {
    const result = await runDeepResearch({ topic: state.topic, researchQuestions: state.researchQuestions, sources: state.sources });
    // Carry updated source summaries (excerpts) forward for the fact-checker
    const sources = mergeSources(state.sources, result.updatedSources);
    const findings = [...(state.findings || []), ...result.findings].slice(0, 60);
    await Research.updateOne({ _id: jobId }, { $set: { sources, findings } });
    await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.deepRead, {
      status: 'completed',
      outputSummary: `Read ${result.pagesRead} pages, extracted ${result.findings.length} findings${result.fetchFailures.length ? ` (${result.fetchFailures.length} fetch failures)` : ''}`,
      tokensUsed: result.tokensUsed,
    });
    await jobs.setStage(jobId, `${findings.length} findings extracted`, 55, 'researching', `Deep research complete: ${result.findings.length} findings`);
    return { sources, findings, tokensUsed: result.tokensUsed };
  } catch (err) {
    await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.deepRead, { status: 'failed', error: err.message });
    return { errors: [...state.errors, `Deep research: ${err.message}`] };
  }
}

async function verifyNode(state) {
  const jobId = state.jobId;
  await jobs.setStage(jobId, 'Verifying claims', 66, 'researching', 'Fact-Checking Agent verifying sources and claims');
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.factCheck, { status: 'working', task: 'Check URL reachability and match claims to source content' });

  try {
    const result = await runFactChecker({ sources: state.sources, findings: state.findings });
    await Research.updateOne(
      { _id: jobId },
      { $set: { sources: result.updatedSources, findings: result.findings, verificationSummary: result.summary } }
    );
    await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.factCheck, {
      status: 'completed',
      outputSummary: `Verified ${result.summary.totalFindings} findings — ${JSON.stringify(result.summary.byStatus)}; ${result.summary.reachableSources} sources reachable, ${result.summary.unreachableSources} unreachable`,
      tokensUsed: result.tokensUsed,
    });
    await jobs.setStage(jobId, 'Verification complete', 74, 'researching', 'Fact-checking complete');
    return { sources: result.updatedSources, findings: result.findings, verificationSummary: result.summary, tokensUsed: result.tokensUsed };
  } catch (err) {
    await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.factCheck, { status: 'failed', error: err.message });
    return { errors: [...state.errors, `Fact-check: ${err.message}`], verificationSummary: state.verificationSummary };
  }
}

async function insightsNode(state) {
  const jobId = state.jobId;
  await jobs.setStage(jobId, 'Analyzing findings', 80, 'analyzing', 'Analysis Agent generating insights and recommendations');
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.analysis, { status: 'working', task: 'Identify patterns, trends, risks, opportunities, recommendations' });

  try {
    const { insights, tokensUsed } = await runAnalysis({
      topic: state.topic,
      researchQuestions: state.researchQuestions,
      findings: state.findings,
      verificationSummary: state.verificationSummary,
    });
    await Research.updateOne({ _id: jobId }, { $set: { insights } });
    await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.analysis, {
      status: 'completed',
      outputSummary: `${insights.keyInsights.length} key insights, ${insights.recommendations.length} recommendations, ${insights.risks.length} risks, ${insights.opportunities.length} opportunities`,
      tokensUsed,
    });
    await jobs.setStage(jobId, 'Analysis complete', 86, 'analyzing', 'Analysis complete');
    return { insights, tokensUsed };
  } catch (err) {
    await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.analysis, { status: 'failed', error: err.message });
    return { errors: [...state.errors, `Analysis: ${err.message}`] };
  }
}

async function reviewNode(state) {
  const jobId = state.jobId;
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.manager, {
    status: 'working',
    task: `Review research sufficiency (round ${state.round}/${state.maxRounds})`,
  });
  const { sufficient, reason } = evaluateSufficiency({
    findings: state.findings,
    verificationSummary: state.verificationSummary,
    round: state.round,
    maxRounds: state.maxRounds,
    depth: state.depth,
  });
  const job = await Research.findById(jobId);
  if (job) {
    job.logActivity(`Sufficiency review: ${reason}`);
    job.rounds = state.round;
    await job.save();
  }
  await jobs.setStage(jobId, sufficient ? 'Evidence sufficient — synthesizing' : 'Insufficient evidence — one more round', sufficient ? 88 : 30, 'researching', reason);
  return { sufficiencyReason: reason, round: sufficient ? state.round : state.round + 1 };
}

async function synthesizeNode(state) {
  const jobId = state.jobId;
  await jobs.setStage(jobId, 'Writing report', 90, 'synthesizing', 'Research Manager synthesizing the final report');
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.manager, { status: 'working', task: 'Synthesize findings into the final cited report' });

  const { report, tokensUsed } = await synthesizeReport({
    topic: state.topic,
    depth: state.depth,
    timeframe: state.timeframe,
    researchQuestions: state.researchQuestions,
    findings: state.findings,
    insights: state.insights,
    sources: state.sources,
    verificationSummary: state.verificationSummary,
  });

  await Research.updateOne({ _id: jobId }, { $set: { report, reportMarkdown: '' } });
  await jobs.setAgentStatus(jobId, jobs.AGENT_NAMES.manager, {
    status: 'completed',
    outputSummary: `Report synthesized: "${report.title}" with ${report.sections.length} sections and ${report.references.length} references`,
    tokensUsed,
  });
  await jobs.setStage(jobId, 'Report generated', 96, 'synthesizing', 'Report synthesis complete');
  return { report, tokensUsed };
}

async function finalizeNode(state) {
  const jobId = state.jobId;
  await jobs.setStage(jobId, 'Generating PDF', 97, 'synthesizing', 'Rendering professional PDF');
  let status = 'completed';
  try {
    await generatePdfForJob(jobId);
  } catch (err) {
    console.error(`[finalize] PDF generation failed for ${jobId}:`, err.message);
    status = state.errors?.length ? 'partial' : 'completed';
    const job = await Research.findById(jobId);
    if (job) {
      job.error = `PDF generation failed: ${err.message}`;
      job.logActivity(`PDF generation failed: ${err.message}. Report is still available in the UI.`);
      await job.save();
    }
  }

  const job = await Research.findById(jobId);
  if (job) {
    if (state.errors?.length && status !== 'completed') status = 'partial';
    job.status = status;
    job.progress = 100;
    job.currentStage = status === 'partial' ? 'Completed with limitations' : 'Completed';
    job.completedAt = new Date();
    job.logActivity(status === 'partial' ? 'Research completed with disclosed limitations' : 'Research completed');
    await job.save();
    publishDone(jobId, jobs.progressPayload(job));
  }
  return {};
}

/* ------------------------------------------------------------- routing */

function routeAfterReview(state) {
  const goAgain = state.round <= state.maxRounds && state.sufficiencyReason && /^Only /.test(state.sufficiencyReason);
  return goAgain ? 'discover' : 'synthesize';
}

/* ------------------------------------------------------------- helpers */

function mergeSources(existing, updated) {
  const byUrl = new Map(existing.map((s) => [s.url, s]));
  for (const u of updated) {
    const prev = byUrl.get(u.url) || {};
    byUrl.set(u.url, { ...prev, ...u });
  }
  return [...byUrl.values()];
}

function gapQuestions(questions, findings) {
  if (!findings?.length) return questions;
  const covered = new Set(findings.map((f) => (f.researchQuestion || '').trim()).filter(Boolean));
  const uncovered = questions.filter((q) => ![...covered].some((c) => c.includes(q.slice(0, 30))));
  return uncovered.length ? uncovered : questions.slice(0, 3);
}

/** Run the full pipeline for a job, capturing top-level failures. */
export async function runResearchPipeline(jobId) {
  const job = await Research.findById(jobId);
  if (!job) return;
  const graph = buildResearchGraph();
  try {
    await graph.invoke(
      {
        jobId: String(job._id),
        topic: job.topic,
        depth: job.depth,
        timeframe: job.timeframe,
        sourcePreferences: job.sourcePreferences,
        userQuestions: job.userQuestions,
        outputFormat: job.outputFormat,
        maxRounds: Math.min(job.depth === 'deep' ? config.maxResearchRounds : job.depth === 'quick' ? 1 : 2, config.maxResearchRounds),
        errors: [],
      },
      { recursionLimit: 40 }
    );
  } catch (err) {
    console.error(`[pipeline] job ${jobId} failed:`, err);
    const failed = await Research.findById(jobId);
    if (failed) {
      failed.status = 'failed';
      failed.error = err.message || String(err);
      failed.currentStage = 'Failed';
      failed.logActivity(`Pipeline failed: ${failed.error}`);
      // mark any still-working agents as failed
      for (const a of failed.agents) {
        if (a.status === 'working' || a.status === 'pending') {
          a.status = 'failed';
          a.error = a.error || 'Pipeline aborted';
          a.endedAt = new Date();
        }
      }
      await failed.save();
      publishDone(jobId, jobs.progressPayload(failed, { done: true }));
    }
  }
}
