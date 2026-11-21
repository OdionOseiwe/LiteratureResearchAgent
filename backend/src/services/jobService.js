import Research from '../models/Research.js';
import { publishProgress } from './progressBus.js';

/** Central place for mutating a research job + broadcasting SSE updates. */

export async function loadJob(jobId) {
  return Research.findById(jobId);
}

export async function broadcast(jobId, extra = {}) {
  const job = await Research.findById(jobId).lean();
  if (!job) return;
  publishProgress(jobId, progressPayload(job, extra));
}

export function progressPayload(job, extra = {}) {
  return {
    id: String(job._id),
    topic: job.topic,
    depth: job.depth,
    status: job.status,
    progress: job.progress,
    currentStage: job.currentStage,
    agents: (job.agents || []).map((a) => ({
      agent: a.agent,
      agentType: a.agentType,
      status: a.status,
      task: a.task,
      outputSummary: a.outputSummary,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      error: a.error,
      retryCount: a.retryCount,
    })),
    sourceCount: job.sources?.length ?? 0,
    findingCount: job.findings?.length ?? 0,
    rounds: job.rounds ?? 1,
    tokensUsed: job.tokensUsed ?? 0,
    activity: (job.activityLog || []).slice(-12),
    error: job.error || '',
    ...extra,
  };
}

export async function setStage(jobId, stage, progress, status = 'researching', message) {
  const job = await Research.findById(jobId);
  if (!job) return null;
  job.currentStage = stage;
  if (typeof progress === 'number') job.progress = progress;
  job.status = status;
  if (message) job.logActivity(message);
  await job.save();
  publishProgress(jobId, progressPayload(job));
  return job;
}

export async function setAgentStatus(jobId, agentName, patch) {
  const job = await Research.findById(jobId);
  if (!job) return null;
  let agent = job.agents.find((a) => a.agent === agentName);
  if (!agent) {
    agent = { agent: agentName, agentType: patch.agentType || 'specialist', status: 'pending', task: '', retryCount: 0 };
    job.agents.push(agent);
    agent = job.agents[job.agents.length - 1];
  }
  Object.assign(agent, patch);
  if (patch.status === 'working' && !agent.startedAt) agent.startedAt = new Date();
  if ((patch.status === 'completed' || patch.status === 'failed' || patch.status === 'skipped') && !agent.endedAt) agent.endedAt = new Date();
  if (patch.tokensUsed) job.tokensUsed = (job.tokensUsed || 0) + patch.tokensUsed;
  await job.save();
  publishProgress(jobId, progressPayload(job));
  return job;
}

export async function addTokens(jobId, tokens) {
  if (!tokens) return;
  await Research.updateOne({ _id: jobId }, { $inc: { tokensUsed: tokens } });
}

export async function setSources(jobId, sources) {
  await Research.updateOne({ _id: jobId }, { $set: { sources } });
  await broadcast(jobId);
}

export async function setFindings(jobId, findings) {
  await Research.updateOne({ _id: jobId }, { $set: { findings } });
  await broadcast(jobId);
}

export const AGENT_NAMES = {
  manager: 'Research Manager',
  discovery: 'Web Discovery Agent',
  deepRead: 'Deep Research Agent',
  factCheck: 'Fact-Checking Agent',
  analysis: 'Analysis & Insights Agent',
};

export function initialAgents() {
  return [
    { agent: AGENT_NAMES.manager, agentType: 'orchestrator', status: 'pending', task: 'Plan research, dispatch agents, review sufficiency, synthesize report', retryCount: 0 },
    { agent: AGENT_NAMES.discovery, agentType: 'specialist', status: 'pending', task: 'Discover high-quality web sources via search', retryCount: 0 },
    { agent: AGENT_NAMES.deepRead, agentType: 'specialist', status: 'pending', task: 'Read sources and extract evidence-backed findings', retryCount: 0 },
    { agent: AGENT_NAMES.factCheck, agentType: 'specialist', status: 'pending', task: 'Verify URLs, claims and citations against source content', retryCount: 0 },
    { agent: AGENT_NAMES.analysis, agentType: 'specialist', status: 'pending', task: 'Analyze verified findings into insights and recommendations', retryCount: 0 },
  ];
}
