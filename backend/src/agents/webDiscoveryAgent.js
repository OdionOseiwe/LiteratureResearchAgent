import { chatJson } from '../services/llmService.js';
import { tavilySearch, classifySource } from '../tools/tavilySearch.js';
import { dedupeSources, domainOf } from '../utils/dedupe.js';
import config from '../config/index.js';

const SYSTEM = `You are the Web Discovery planner inside a multi-agent research system.
Given a research topic and questions, produce diverse web search queries that will surface
authoritative sources: official reports, academic studies, reputable journalism, documentation.
Return ONLY JSON: {"queries": [string, ...]}. 4-6 queries. No duplicates. Each query under 12 words.`;

/** Build search queries with the LLM; fall back to deterministic templates on failure. */
async function planQueries(topic, questions, preferences) {
  const fallback = () => {
    const qs = [String(topic).trim()];
    const base = String(topic).trim();
    qs.push(`${base} research report`);
    qs.push(`${base} analysis`);
    for (const q of (questions || []).slice(0, 2)) qs.push(String(q).slice(0, 100));
    return [...new Set(qs)].slice(0, 6);
  };
  try {
    const { data } = await chatJson({
      system: SYSTEM,
      user: `Topic: ${topic}\nResearch questions:\n${(questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n') || '(none)'}\nSource preferences: ${preferences?.join(', ') || 'general web, prefer authoritative'}\nCurrent year: ${new Date().getFullYear()}`,
      maxTokens: 600,
      trace: 'discovery:queries',
    });
    const queries = Array.isArray(data?.queries) ? data.queries.filter((q) => typeof q === 'string' && q.trim()) : [];
    return queries.length ? [...new Set(queries)].slice(0, 6) : fallback();
  } catch (err) {
    console.warn('[discovery] query planning failed, using fallback:', err.message);
    return fallback();
  }
}

/** Time-range hint from a timeframe string like "past year" | "2020-2026" | "". */
function timeRangeFrom(timeframe) {
  const t = String(timeframe || '').toLowerCase();
  if (/past week|last week/.test(t)) return 'week';
  if (/past month|last month/.test(t)) return 'month';
  if (/past year|last year|recent|latest|current/.test(t)) return 'year';
  return undefined;
}

/**
 * Agent 1 — Web Discovery.
 * Searches the web, dedupes, classifies and ranks sources. Returns structured data only.
 */
export async function runWebDiscovery({ topic, questions, timeframe, sourcePreferences, maxSources = config.maxSourcesPerRun }) {
  const queries = await planQueries(topic, questions, sourcePreferences);
  const timeRange = timeRangeFrom(timeframe);

  const settled = await Promise.allSettled(
    queries.map((q) => tavilySearch(q, { maxResults: config.searchResultsPerQuery, timeRange }))
  );

  const raw = [];
  const searchErrors = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') raw.push(...s.value.results);
    else searchErrors.push(s.reason?.message || 'search failed');
  }

  const normalized = raw
    .filter((r) => r.url && /^https?:\/\//i.test(r.url))
    .map((r) => ({
      title: (r.title || '').trim(),
      url: r.url.trim(),
      publisher: domainOf(r.url),
      author: '',
      publishedAt: r.publishedAt || '',
      sourceType: classifySource(r),
      description: r.snippet || '',
      excerpt: '',
      query: r.query,
      category: 'general',
      relevance: r.score,
      summary: '',
      verificationStatus: 'pending',
      discoveredBy: 'web-discovery',
    }));

  const { unique, duplicatesRemoved } = dedupeSources(normalized);

  // Rank: authority heuristics + search score. Authoritative boosts keep quality high.
  const authorityBoost = (s) => {
    const boosts = { academic: 0.35, official: 0.32, report: 0.22, documentation: 0.18, news: 0.12, blog: 0.02, web: 0 };
    return (boosts[s.sourceType] ?? 0) + (s.relevance ?? 0.5);
  };
  const ranked = [...unique].sort((a, b) => authorityBoost(b) - authorityBoost(a)).slice(0, maxSources);

  return {
    queries,
    sources: ranked,
    stats: {
      queriesRun: queries.length,
      rawResults: raw.length,
      uniqueSources: ranked.length,
      duplicatesRemoved,
      failedQueries: searchErrors.length,
      searchErrors,
    },
  };
}
