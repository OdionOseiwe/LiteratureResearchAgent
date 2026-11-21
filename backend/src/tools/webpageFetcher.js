import { validatePublicUrl } from '../utils/ssrfGuard.js';
import { truncate } from '../utils/helpers.js';
import config from '../config/index.js';

const USER_AGENT = 'ResearchAgentBot/1.0 (+https://example.com/research-agent; respectful research crawler)';

/** Strip HTML to readable text (safe, no execution). */
export function htmlToText(html) {
  if (!html) return '';
  let t = String(html);
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, '\n');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&[#a-z0-9]+;/gi, ' ');
  t = t.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n');
  return t.trim();
}

/** Try Jina Reader first (clean text extraction), then fall back to direct fetch. */
async function fetchViaJinaReader(url) {
  const res = await fetch(`${config.jinaReaderBaseUrl}/${url}`, {
    headers: { Accept: 'text/plain', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Jina Reader HTTP ${res.status}`);
  const text = await res.text();
  const titleMatch = text.match(/^Title:\s*(.+)$/m);
  return { text, title: titleMatch?.[1]?.trim() || '' };
}

async function fetchDirect(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.5',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  const capBytes = 4 * 1024 * 1024; // 4MB cap
  const slice = buf.subarray(0, capBytes);
  if (/pdf/i.test(contentType) || /\.pdf($|\?)/i.test(url)) {
    return { text: extractPdfText(slice), title: '', contentType: 'application/pdf' };
  }
  const html = slice.toString('utf8');
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return { text: htmlToText(html), title: titleMatch ? htmlToText(titleMatch[1]).trim() : '', contentType };
}

/**
 * Minimal PDF text extraction: pulls text-showing operators from uncompressed
 * content streams. Works for many simple PDFs; returns '' when it can't parse.
 * (Full pdf-parse would add a heavy dependency; this keeps things lean and safe.)
 */
export function extractPdfText(buf) {
  try {
    const raw = buf.toString('latin1');
    const chunks = [];
    const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
    let m;
    while ((m = streamRe.exec(raw))) {
      const body = m[1];
      const textChunks = [];
      const tjRe = /\((?:\\.|[^()\\])*\)/g;
      let t;
      while ((t = tjRe.exec(body))) {
        const inner = t[0].slice(1, -1)
          .replace(/\\([()\\])/g, '$1')
          .replace(/\\n/g, '\n')
          .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
        textChunks.push(inner);
      }
      if (textChunks.length) chunks.push(textChunks.join(' '));
    }
    const text = chunks.join('\n').replace(/[ \t]+/g, ' ').trim();
    if (text.length > 50) return text;
    // Fallback: strip and return any printable runs
    const printable = raw.match(/[ -~]{40,}/g) || [];
    return printable.join('\n').slice(0, 20000);
  } catch {
    return '';
  }
}

/**
 * Validate + fetch a URL and return extracted, length-limited text.
 * Never throws: returns { ok: false, error } on any failure.
 */
export async function fetchWebpage(rawUrl) {
  const check = await validatePublicUrl(rawUrl);
  if (!check.ok) {
    return { ok: false, url: rawUrl, error: `Blocked: ${check.reason}`, blocked: true };
  }
  const url = check.url.toString();
  try {
    let result;
    try {
      result = await fetchViaJinaReader(url);
      if (!result.text || result.text.length < 200) throw new Error('Jina Reader returned too little content');
    } catch (jinaErr) {
      result = await fetchDirect(url);
    }
    const text = truncate(result.text || '', config.maxPageChars);
    if (!text || text.length < 100) {
      return { ok: false, url, error: 'Could not extract meaningful content from this page', blocked: false };
    }
    return { ok: true, url, text, title: result.title || '', fetchedAt: new Date().toISOString() };
  } catch (err) {
    return { ok: false, url, error: err.message || 'Fetch failed', blocked: false };
  }
}

/** Check whether a URL is reachable without downloading the whole body. */
export async function checkUrlReachable(rawUrl) {
  const check = await validatePublicUrl(rawUrl);
  if (!check.ok) return { reachable: false, reason: check.reason, blocked: true };
  try {
    let res = await fetch(check.url.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    // Some servers reject HEAD; retry with a ranged GET.
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(check.url.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-2048' },
        signal: AbortSignal.timeout(10000),
      });
    }
    return { reachable: res.status >= 200 && res.status < 400, status: res.status, finalUrl: res.url };
  } catch (err) {
    return { reachable: false, reason: err.message || 'Unreachable' };
  }
}
