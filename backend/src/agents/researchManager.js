import { chatJson } from '../services/llmService.js';
import { safeJsonParse } from '../utils/helpers.js';

/** Research Manager prompts and decision logic. */

const PLAN_SYSTEM = `You are the Research Manager of a multi-agent research system.
Analyze the user's research request and produce a research plan.
Rules: identify objective, scope, and 4-8 concrete research questions. The plan is a short list of steps the agents will follow.
Return ONLY JSON: {"objective":string,"scope":string,"questions":[string],"plan":[string]}`;

export async function planResearch({ topic, depth, timeframe, userQuestions }) {
  const depthHint = {
    quick: 'Quick scan: 3-4 questions, narrow scope.',
    standard: 'Standard review: 5-6 questions, balanced scope.',
    deep: 'Deep dive: 7-8 questions, broad scope, include primary sources.',
  }[depth] || 'Standard review';

  const { data, tokensUsed } = await chatJson({
    system: PLAN_SYSTEM,
    user: `Topic / research request: ${topic}\nRequested depth: ${depthHint}\nTimeframe preference: ${timeframe || '(any)'}\nUser-supplied questions:\n${(userQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n') || '(none)'}\nCurrent year: ${new Date().getFullYear()}`,
    maxTokens: 1400,
    trace: 'manager:plan',
    validate: (obj) => {
      if (!obj || typeof obj !== 'object') return { ok: false, error: 'not an object' };
      const questions = Array.isArray(obj.questions) ? obj.questions.filter((q) => typeof q === 'string' && q.trim()).slice(0, 8) : [];
      const plan = Array.isArray(obj.plan) ? obj.plan.filter((p) => typeof p === 'string' && p.trim()).slice(0, 12) : [];
      if (!questions.length) return { ok: false, error: 'no research questions produced' };
      return { ok: true, value: { objective: String(obj.objective || topic).trim(), scope: String(obj.scope || '').trim(), questions, plan } };
    },
  });
  return { ...data, tokensUsed };
}

/** Decide whether current evidence is enough or another discovery round is warranted. */
export function evaluateSufficiency({ findings, verificationSummary, round, maxRounds, depth }) {
  const minFindings = depth === 'quick' ? 4 : depth === 'deep' ? 12 : 8;
  const good = (verificationSummary?.byStatus?.Verified || 0)
    + (verificationSummary?.byStatus?.Supported || 0)
    + (verificationSummary?.byStatus?.['Partially supported'] || 0);
  const total = verificationSummary?.totalFindings ?? findings.length;

  if (round >= maxRounds) return { sufficient: true, reason: `Reached maximum research rounds (${maxRounds})` };
  if (depth === 'quick') return { sufficient: true, reason: 'Quick depth does not require additional rounds' };
  if (total >= minFindings && good >= Math.max(3, Math.floor(minFindings * 0.5))) {
    return { sufficient: true, reason: `${total} findings collected, ${good} verified/supported` };
  }
  return { sufficient: false, reason: `Only ${total} findings (${good} verified/supported); fewer than the ${minFindings} required for ${depth} depth` };
}

const SYNTHESIS_SYSTEM = `You are the Research Manager writing the final research report.
You are given fact-checked findings (with citation numbers), insights from the analysis agent, and the numbered source list.
Hard rules:
- Use inline numbered citations like [1], [2] attached to factual claims, exactly matching the source numbers provided.
- NEVER invent citations, statistics, quotes, dates or URLs. Only cite sources from the provided list.
- If evidence for a point is missing, explicitly say so under Limitations.
- Distinguish reported fact (cite) from your analysis (no citation needed).
- Write for a professional/academic audience. Be specific, not generic.
Return ONLY JSON:
{"title":string,"executiveSummary":string,"abstract":string,"sections":[{"heading":string,"content":string}]}
Sections must adapt to the topic. Include, adapting/combining where sensible: Introduction; Background and Context; Research Objectives; Research Questions; Research Methodology; Detailed Research Findings (with sub-points); Topic-Specific Analysis; Cross-Source Analysis; Discussion; Risks, Challenges and Opportunities; Recommendations; Future Outlook; Limitations of the Research; Conclusion.
Section content is markdown (paragraphs, bullet lists, bold). Do not include a References section — references are generated from the source list programmatically.`;

export async function synthesizeReport({ topic, depth, timeframe, researchQuestions, findings, insights, sources, verificationSummary }) {
  const sourceList = sources
    .map((s, i) => `[${i + 1}] ${s.title} — ${s.publisher || 'unknown publisher'}${s.publishedAt ? ` (${s.publishedAt})` : ''} — ${s.url}`)
    .join('\n');

  // Map finding sourceUrl -> citation number
  const urlToNumber = new Map(sources.map((s, i) => [s.url, i + 1]));
  const findingBlock = findings
    .slice(0, 45)
    .map((f, i) => {
      const n = urlToNumber.get(f.sourceUrl);
      return `(${f.verificationStatus}) ${f.claim} [citation: ${n ?? 'none'}]\n    Evidence: ${(f.evidence || '').slice(0, 280)}${f.excerpt ? `\n    Excerpt: ${f.excerpt.slice(0, 200)}` : ''}`;
    })
    .join('\n');

  const insightsBlock = JSON.stringify(insights || {}, null, 0).slice(0, 6000);

  const { data, tokensUsed } = await chatJson({
    system: SYNTHESIS_SYSTEM,
    user: `Topic: ${topic}
Depth: ${depth}\nTimeframe: ${timeframe || '(any)'}
Research questions:\n${(researchQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}

Verification summary: ${JSON.stringify(verificationSummary || {})}

Numbered sources (cite ONLY these):
${sourceList}

Fact-checked findings (verification status shown):
${findingBlock}

Analysis agent output:
${insightsBlock}

Write the report now. Executive summary ≤ 250 words; abstract ≤ 150 words. Total length: ${depth === 'quick' ? '1200-1800' : depth === 'deep' ? '3000-4500' : '2000-3000'} words.`,
    heavy: true,
    temperature: 0.35,
    maxTokens: 6500,
    trace: 'manager:synthesize',
    schemaHint: '{"title":"...","executiveSummary":"...","abstract":"...","sections":[{"heading":"...","content":"..."}]}',
    validate: (obj) => {
      if (!obj || typeof obj !== 'object') return { ok: false, error: 'not an object' };
      const sections = Array.isArray(obj.sections)
        ? obj.sections.filter((s) => s && typeof s.heading === 'string' && typeof s.content === 'string' && s.content.trim()).slice(0, 30)
        : [];
      if (!sections.length) return { ok: false, error: 'no sections produced' };
      return {
        ok: true,
        value: {
          title: String(obj.title || topic).trim().slice(0, 220),
          executiveSummary: String(obj.executiveSummary || '').trim(),
          abstract: String(obj.abstract || '').trim(),
          sections,
        },
      };
    },
  });

  const references = sources.map((s, i) => ({
    n: i + 1,
    title: s.title,
    url: s.url,
    publisher: s.publisher || domainOfSafe(s.url),
    author: s.author || '',
    publishedAt: s.publishedAt || '',
    accessedAt: (s.accessedAt ? new Date(s.accessedAt) : new Date()).toISOString().slice(0, 10),
    sourceType: s.sourceType || 'web',
    verificationStatus: s.verificationStatus || 'pending',
  }));

  return {
    report: {
      ...data,
      keyInsights: (insights?.keyInsights || []).map((k) => (typeof k === 'string' ? k : k.insight)),
      recommendations: (insights?.recommendations || []).map((r) => (typeof r === 'string' ? r : r.recommendation)),
      risks: insights?.risks || [],
      opportunities: insights?.opportunities || [],
      limitations: insights?.limitations || [],
      futureQuestions: insights?.futureQuestions || [],
      verificationSummary: verificationSummary || {},
      depth,
      timeframe: timeframe || '',
      dateGenerated: new Date().toISOString(),
      references,
    },
    tokensUsed,
  };
}

function domainOfSafe(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
