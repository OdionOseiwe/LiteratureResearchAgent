import { chatJson } from '../services/llmService.js';

const SYSTEM = `You are the Analysis & Insights Agent in a multi-agent research system.
You receive fact-checked findings and source statistics. Produce genuine ANALYTICAL work, not paraphrase.
Rules:
- Ground every insight in the provided findings; reference finding indexes like (finding #3).
- Clearly separate facts from interpretation and prediction.
- Do not invent statistics. If data is missing, say so.
Return ONLY JSON:
{
  "keyInsights":[{"insight":string,"basis":string,"type":"fact"|"interpretation"|"prediction"}],
  "patterns":[string],
  "trends":[string],
  "agreements":[string],
  "disagreements":[string],
  "implications":[string],
  "risks":[{"risk":string,"evidence":string}],
  "opportunities":[{"opportunity":string,"evidence":string}],
  "recommendations":[{"recommendation":string,"rationale":string,"priority":"high"|"medium"|"low"}],
  "limitations":[string],
  "futureQuestions":[string]
}`;

/**
 * Agent 4 — Analysis & Insights.
 */
export async function runAnalysis({ topic, researchQuestions, findings, verificationSummary }) {
  const usable = findings
    .map((f, i) => ({ i, f }))
    .filter(({ f }) => !['Unsupported'].includes(f.verificationStatus))
    .slice(0, 40);

  const findingBlock = usable
    .map(({ i, f }) => `[#${i}] (${f.verificationStatus}, confidence ${f.confidence}) ${f.claim}\n    Evidence: ${f.evidence.slice(0, 300)}\n    Source: ${f.sourceUrl}`)
    .join('\n');

  const { data, tokensUsed } = await chatJson({
    system: SYSTEM,
    user: `Topic: ${topic}\nResearch questions:\n${(researchQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n') || '(none)'}\n\nVerification summary: ${JSON.stringify(verificationSummary || {})}\n\nFact-checked findings:\n${findingBlock || '(no usable findings)'}\n\nProduce the analysis.`,
    heavy: true,
    maxTokens: 4000,
    trace: 'analysis',
    schemaHint: '{"keyInsights":[{"insight":"...","basis":"...","type":"fact"}], ...}',
    validate: (obj) => {
      if (!obj || typeof obj !== 'object') return { ok: false, error: 'not an object' };
      const arr = (k) => (Array.isArray(obj[k]) ? obj[k] : []);
      const normalized = {
        keyInsights: arr('keyInsights').map((x) =>
          typeof x === 'string'
            ? { insight: x, basis: '', type: 'interpretation' }
            : { insight: String(x.insight || '').trim(), basis: String(x.basis || '').trim(), type: ['fact', 'interpretation', 'prediction'].includes(x.type) ? x.type : 'interpretation' }
        ).filter((x) => x.insight),
        patterns: arr('patterns').map(String),
        trends: arr('trends').map(String),
        agreements: arr('agreements').map(String),
        disagreements: arr('disagreements').map(String),
        implications: arr('implications').map(String),
        risks: arr('risks').map((r) => (typeof r === 'string' ? { risk: r, evidence: '' } : { risk: String(r.risk || '').trim(), evidence: String(r.evidence || '').trim() })).filter((r) => r.risk),
        opportunities: arr('opportunities').map((r) => (typeof r === 'string' ? { opportunity: r, evidence: '' } : { opportunity: String(r.opportunity || '').trim(), evidence: String(r.evidence || '').trim() })).filter((r) => r.opportunity),
        recommendations: arr('recommendations').map((r) =>
          typeof r === 'string'
            ? { recommendation: r, rationale: '', priority: 'medium' }
            : { recommendation: String(r.recommendation || '').trim(), rationale: String(r.rationale || '').trim(), priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium' }
        ).filter((r) => r.recommendation),
        limitations: arr('limitations').map(String),
        futureQuestions: arr('futureQuestions').map(String),
      };
      return { ok: true, value: normalized };
    },
  });

  return { insights: data, tokensUsed };
}
