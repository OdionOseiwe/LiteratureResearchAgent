/** URL + source normalization and deduplication helpers. */

/** Normalize a URL for dedup: lowercase host, strip protocol, www, trailing slash, fragments, common tracking params. */
export function normalizeUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const params = new URLSearchParams(u.search);
    for (const key of [...params.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(key)) params.delete(key);
    }
    const qs = params.toString();
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    return `${host}${path}${qs ? `?${qs}` : ''}`;
  } catch {
    return String(raw || '').trim().toLowerCase();
  }
}

export function domainOf(raw) {
  try {
    return new URL(String(raw)).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Deduplicate source objects by normalized URL. Keeps the first occurrence,
 * merging in any missing metadata from later duplicates. Returns { unique, duplicatesRemoved }.
 */
export function dedupeSources(sources = []) {
  const map = new Map();
  let duplicatesRemoved = 0;
  for (const src of sources) {
    if (!src || !src.url) continue;
    const key = normalizeUrl(src.url);
    if (map.has(key)) {
      duplicatesRemoved++;
      const existing = map.get(key);
      for (const [k, v] of Object.entries(src)) {
        if (v && !existing[k]) existing[k] = v;
      }
      continue;
    }
    map.set(key, { ...src });
  }
  return { unique: [...map.values()], duplicatesRemoved };
}

/** Simple recency bucket used for reporting. */
export function publicationYear(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}
