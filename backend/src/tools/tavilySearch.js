import config from '../config/index.js';
import { withRetry } from '../utils/helpers.js';

/**
 * Tavily Search API integration.
 * Docs: https://docs.tavily.com/docs/api-reference/endpoint/search
 */
export async function tavilySearch(query, { maxResults, searchDepth = 'advanced', includeDomains, excludeDomains, timeRange } = {}) {
  if (!config.tavilyApiKey) {
    const err = new Error('TAVILY_API_KEY is not configured. Get a free key at https://tavily.com and add it to backend/.env.');
    err.code = 'TAVILY_NOT_CONFIGURED';
    throw err;
  }
  const limit = maxResults ?? config.searchResultsPerQuery;

  const body = {
    api_key: config.tavilyApiKey,
    query,
    search_depth: searchDepth,
    max_results: Math.min(Math.max(limit, 1), 10),
    include_answer: false,
    include_raw_content: false,
  };
  if (Array.isArray(includeDomains) && includeDomains.length) body.include_domains = includeDomains;
  if (Array.isArray(excludeDomains) && excludeDomains.length) body.exclude_domains = excludeDomains;
  if (timeRange) body.time_range = timeRange; // 'day' | 'week' | 'month' | 'year'

  const res = await withRetry(
    () =>
      fetch(`${config.tavilyBaseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      }),
    { retries: 2, baseDelayMs: 1000, shouldRetry: (e) => e.name === 'TimeoutError' || /fetch failed/i.test(e.message) }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`Tavily search failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
    err.code = res.status === 429 ? 'TAVILY_RATE_LIMIT' : 'TAVILY_ERROR';
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const results = (json.results || []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    publishedAt: r.published_date || '',
    score: typeof r.score === 'number' ? r.score : null,
    query,
  }));
  return { results, query };
}

/** Classify a source into a coarse type based on domain and title heuristics. */
export function classifySource({ url = '', title = '', snippet = '' }) {
  const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
  const hay = `${title} ${snippet} ${host}`.toLowerCase();
  if (/\.(edu|ac\.[a-z]{2})(\/|$)/.test(host) || /arxiv|doi\.org|nature\.|science\.|springer|wiley|ieee|acm\.org|jstor|pubmed|scholar/.test(hay)) return 'academic';
  if (/\.(gov|mil|int)(\/|$)|who\.int|un\.org|oecd|worldbank|europa\.eu|cdc\.gov|nih\.gov|nist\.gov/.test(hay)) return 'official';
  if (/docs?\.|documentation|developer\.|github\.com|readthedocs/.test(hay)) return 'documentation';
  if (/reuters|apnews|bbc|nytimes|wsj|ft\.com|bloomberg|theguardian|cnn\.|nbcnews|aljazeera/.test(host)) return 'news';
  if (/blog|medium\.com|substack|wordpress/.test(hay)) return 'blog';
  if (/report|whitepaper|white paper|annual report|survey/.test(hay)) return 'report';
  return 'web';
}
