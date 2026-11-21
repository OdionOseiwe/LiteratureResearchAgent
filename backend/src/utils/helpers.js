/** Parse an LLM response that is expected to contain JSON. Tolerates code fences and prose around the JSON. */
export function safeJsonParse(text) {
  if (text == null) return null;
  if (typeof text === 'object') return text;
  let t = String(text).trim();
  // strip ```json ... ``` fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // find first { or [ and last } or ]
  const firstObj = t.indexOf('{');
  const firstArr = t.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);
  if (start === -1) return null;
  // attempt progressively: full slice, then trim trailing junk
  const candidate = t.slice(start);
  const closers = { '{': '}', '[': ']' };
  const open = candidate[0];
  const close = closers[open];
  const end = candidate.lastIndexOf(close);
  if (end === -1) {
    try { return JSON.parse(candidate); } catch { return null; }
  }
  try { return JSON.parse(candidate.slice(0, end + 1)); } catch {
    try { return JSON.parse(candidate); } catch { return null; }
  }
}

/** Sleep helper for retry/backoff. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry an async fn with exponential backoff. Retries when shouldRetry(err) is true. */
export async function withRetry(fn, { retries = 3, baseDelayMs = 800, shouldRetry = () => true, onRetry } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !shouldRetry(err)) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      if (onRetry) onRetry({ attempt: attempt + 1, delay, err });
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Clamp a string to a max length, appending an ellipsis marker when truncated. */
export const truncate = (s, max) => (s && s.length > max ? s.slice(0, max) + '\n…[truncated]' : s || '');

/** Escape HTML for safe interpolation into the PDF template. */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
