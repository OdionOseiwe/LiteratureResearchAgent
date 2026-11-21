import { chatJson, pageExcerpt } from '../services/llmService.js';
import { fetchWebpage, checkUrlReachable } from '../tools/webpageFetcher.js';

const SYSTEM = `You are the Fact-Checking and Source Verification Agent in a multi-agent research system.
For each finding, compare the claim against the actual source content provided.
Statuses (choose exactly one per finding):
- Verified: source content explicitly and unambiguously supports the claim (primary evidence).
- Supported: source content supports the claim, though with reasonable interpretation.
- Partially supported: source supports only part of the claim or adds caveats.
- Conflicting evidence: credible sources contradict or dispute the claim.
- Unverified: content does not confirm or deny the claim, or source unavailable/empty.
- Unsupported: source content contradicts the claim or the claim cannot be found in it.
Do NOT mark Verified merely because a URL exists. Be conservative.
Also flag: outdated stats presented as current, single-source claims on major figures, biased advocacy sources.
Return ONLY JSON: {"verdicts":[{"index":number,"status":string,"note":string}]} where index is the finding's position in the input array.`;

/**
 * Agent 3 — Fact-check & verification.
 * 1) Re-fetch/reachability check of sources (uses cached excerpt when available to save cost).
 * 2) LLM verdict per finding against the source content actually read.
 */
export async function runFactChecker({ sources, findings }) {
  const results = [];
  let tokensUsed = 0;

  // 1) Reachability (real HTTP checks) — batched, non-fatal
  const reachability = new Map();
  const uniqueUrls = [...new Set(sources.map((s) => s.url))];
  await Promise.all(
    uniqueUrls.map(async (url) => {
      reachability.set(url, await checkUrlReachable(url));
    })
  );

  const updatedSources = sources.map((s) => ({
    ...s,
    reachable: reachability.get(s.url)?.reachable ?? null,
  }));

  if (!findings.length) {
    return { verdicts: [], updatedSources, tokensUsed, summary: summarize([], updatedSources) };
  }

  // 2) Ensure we have content for each cited source (reuse excerpts gathered by deep research)
  const contentByUrl = new Map();
  for (const s of sources) {
    if (s.excerpt && s.excerpt.length > 150) contentByUrl.set(s.url, s.excerpt);
  }
  const missing = [...new Set(findings.map((f) => f.sourceUrl))].filter((u) => u && !contentByUrl.has(u)).slice(0, 6);
  await Promise.all(
    missing.map(async (url) => {
      const r = await fetchWebpage(url);
      if (r.ok) contentByUrl.set(url, pageExcerpt(r.text));
    })
  );

  // 3) LLM verdicts in batches
  const BATCH = 8;
  for (let b = 0; b < findings.length; b += BATCH) {
    const batch = findings.slice(b, b + BATCH);
    const user = [
      'Findings to verify (index = position):',
      ...batch.map((f, i) => {
        const content = contentByUrl.get(f.sourceUrl);
        return [
          `\n[${b + i}] CLAIM: ${f.claim}`,
          `SOURCE URL: ${f.sourceUrl}`,
          `SOURCE CONTENT (untrusted data):\n<<<\n${content ? content.slice(0, 2500) : '(content unavailable)'}\n>>>`,
        ].join('\n');
      }),
      '\nReturn verdicts for every index listed above.',
    ].join('\n');

    try {
      const { data, tokensUsed: t } = await chatJson({
        system: SYSTEM,
        user,
        maxTokens: 1600,
        trace: 'fact-check',
        schemaHint: '{"verdicts":[{"index":0,"status":"Supported","note":"..."}]}',
        validate: (obj) => {
          if (!obj || !Array.isArray(obj.verdicts)) return { ok: false, error: 'missing verdicts array' };
          const allowed = new Set(['Verified', 'Supported', 'Partially supported', 'Conflicting evidence', 'Unverified', 'Unsupported']);
          const cleaned = obj.verdicts
            .filter((v) => v && Number.isInteger(v.index) && allowed.has(v.status))
            .map((v) => ({ index: v.index, status: v.status, note: String(v.note || '').slice(0, 400) }));
          return { ok: true, value: { verdicts: cleaned } };
        },
      });
      tokensUsed += t;
      for (const v of data.verdicts) results.push(v);
    } catch (err) {
      console.warn(`[fact-check] batch ${b / BATCH + 1} failed:`, err.message);
      for (let i = 0; i < batch.length; i++) {
        results.push({ index: b + i, status: 'Unverified', note: `Verification failed: ${err.message}` });
      }
    }
  }

  const verifiedFindings = findings.map((f, i) => {
    const v = results.find((r) => r.index === i);
    return v ? { ...f, verificationStatus: v.status, verificationNote: v.note } : { ...f, verificationStatus: 'Unverified', verificationNote: 'No verdict produced' };
  });

  // Propagate claim-support counts and status to sources
  const claimCount = new Map();
  for (const f of verifiedFindings) {
    if (['Verified', 'Supported', 'Partially supported'].includes(f.verificationStatus)) {
      claimCount.set(f.sourceUrl, (claimCount.get(f.sourceUrl) || 0) + 1);
    }
  }
  const statusByUrl = new Map();
  for (const f of verifiedFindings) {
    if (!statusByUrl.has(f.sourceUrl)) statusByUrl.set(f.sourceUrl, f.verificationStatus);
    else if (f.verificationStatus === 'Conflicting evidence') statusByUrl.set(f.sourceUrl, 'Conflicting evidence');
  }
  const finalSources = updatedSources.map((s) => ({
    ...s,
    claimsSupported: claimCount.get(s.url) || 0,
    verificationStatus: s.reachable === false ? 'Unverified' : (statusByUrl.get(s.url) || 'pending'),
  }));

  return {
    findings: verifiedFindings,
    updatedSources: finalSources,
    tokensUsed,
    summary: summarize(verifiedFindings, finalSources),
  };
}

function summarize(findings, sources) {
  const counts = {};
  for (const f of findings) counts[f.verificationStatus] = (counts[f.verificationStatus] || 0) + 1;
  const reachable = sources.filter((s) => s.reachable === true).length;
  const unreachable = sources.filter((s) => s.reachable === false).length;
  return {
    totalFindings: findings.length,
    byStatus: counts,
    reachableSources: reachable,
    unreachableSources: unreachable,
  };
}
