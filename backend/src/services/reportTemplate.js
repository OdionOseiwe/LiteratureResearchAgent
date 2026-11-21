import { escapeHtml } from '../utils/helpers.js';

/** Minimal safe markdown -> HTML for report content. Escapes first, then applies formatting. */
export function mdToHtml(md) {
  if (!md) return '';
  const lines = String(md).split('\n');
  const out = [];
  let inList = false;
  let inOrdered = false;
  const closeLists = () => {
    if (inList) { out.push('</ul>'); inList = false; }
    if (inOrdered) { out.push('</ol>'); inOrdered = false; }
  };
  const inline = (text) => {
    let t = escapeHtml(text);
    t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<em>$2</em>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { closeLists(); out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOrdered) { closeLists(); out.push('<ol>'); inOrdered = true; }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }
    closeLists();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  closeLists();
  return out.join('\n');
}

/** Build the full standalone HTML document used for Puppeteer PDF rendering. */
export function buildReportHtml(report, job) {
  const date = new Date(report.dateGenerated || job.createdAt || Date.now());
  const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const generated = date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const depthLabel = { quick: 'Quick Scan', standard: 'Standard Review', deep: 'Deep Dive' }[report.depth] || 'Standard Review';
  const refs = report.references || [];
  const sections = report.sections || [];
  const toc = sections.map((s, i) => `<li><a href="#sec-${i}">${escapeHtml(s.heading)}</a></li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(report.title)}</title>
<style>
@page { size: A4; margin: 22mm 18mm 20mm 18mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
body { font-family: 'Georgia', 'Times New Roman', serif; color: #1f2937; font-size: 11pt; line-height: 1.55; margin: 0; }
.cover { width: 210mm; height: 297mm; background: linear-gradient(160deg, #0b1220 0%, #101c33 55%, #17244a 100%); color: #e5e7eb; padding: 34mm 22mm 20mm; display: flex; flex-direction: column; page-break-after: always; }
.kicker { letter-spacing: 3px; text-transform: uppercase; font-size: 8.5pt; color: #67e8f9; font-family: Helvetica, Arial, sans-serif; margin-bottom: 10mm; }
.cover h1 { font-size: 30pt; line-height: 1.22; font-weight: 600; color: #f8fafc; margin: 0 0 8mm; }
.cover .accent { width: 64px; height: 4px; background: linear-gradient(90deg,#22d3ee,#8b5cf6); border-radius: 2px; margin-bottom: 10mm; }
.cover .meta { margin-top: auto; font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #94a3b8; border-top: 1px solid rgba(148,163,184,.25); padding-top: 6mm; }
.cover .meta strong { color: #e2e8f0; font-weight: 600; }
.content { padding: 0 2mm; }
h1,h2,h3,h4 { font-family: Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.3; }
h2 { font-size: 17pt; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin-top: 26px; page-break-after: avoid; }
h3 { font-size: 13pt; color: #1e3a5f; page-break-after: avoid; }
h4 { font-size: 11pt; color: #334155; }
p { margin: 0 0 10px; text-align: justify; }
ul, ol { margin: 6px 0 12px 20px; }
li { margin-bottom: 4px; }
a { color: #0369a1; text-decoration: none; word-break: break-word; }
a:hover { text-decoration: underline; }
code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1px 5px; font-size: 9.5pt; font-family: 'SFMono-Regular', Consolas, monospace; }
.toc { font-family: Helvetica, Arial, sans-serif; page-break-after: always; }
.toc h2 { border-bottom: 2px solid #e2e8f0; }
.toc ol { columns: 2; column-gap: 24px; font-size: 10.5pt; }
.toc li { margin-bottom: 7px; }
.callout { background: #f0f9ff; border-left: 4px solid #0891b2; padding: 10px 14px; border-radius: 6px; margin: 12px 0; font-size: 10pt; }
.callout strong { color: #0e7490; }
.insights { background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 10px 14px; border-radius: 6px; margin: 12px 0; }
.refs { font-size: 9.5pt; }
.refs li { margin-bottom: 7px; word-break: break-word; }
.refs .url { font-size: 8.5pt; color: #0369a1; }
.footer-note { font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 6px; font-family: Helvetica, Arial, sans-serif; }
.badge { display: inline-block; font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; padding: 1px 7px; border-radius: 10px; background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; margin-left: 6px; vertical-align: middle; }
.badge.warn { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.badge.bad { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
</style>
</head>
<body>

<section class="cover">
  <div class="kicker">Multi-Agent Research Report</div>
  <h1>${escapeHtml(report.title)}</h1>
  <div class="accent"></div>
  <div class="meta">
    <div><strong>Depth:</strong> ${escapeHtml(depthLabel)}${report.timeframe ? ` &nbsp;·&nbsp; <strong>Timeframe:</strong> ${escapeHtml(report.timeframe)}` : ''}</div>
    <div style="margin-top:6px"><strong>Research date:</strong> ${escapeHtml(dateStr)}</div>
    <div style="margin-top:6px"><strong>Generated:</strong> ${escapeHtml(generated)}</div>
    <div style="margin-top:6px"><strong>Sources consulted:</strong> ${refs.length} &nbsp;·&nbsp; <strong>Verification:</strong> ${escapeHtml(verificationLine(report.verificationSummary))}</div>
  </div>
</section>

<nav class="toc content">
  <h2>Contents</h2>
  <ol>
    <li><a href="#executive-summary">Executive Summary</a></li>
    <li><a href="#abstract">Abstract</a></li>
    ${toc}
    <li><a href="#key-insights">Key Insights</a></li>
    <li><a href="#references">References</a></li>
  </ol>
</nav>

<main class="content">

<h2 id="executive-summary">Executive Summary</h2>
${mdToHtml(report.executiveSummary || 'No executive summary was generated.')}
<div class="callout"><strong>How to read this report:</strong> Factual claims carry bracketed citations like [3] that map to the References section. Interpretation and prediction are labelled as such. Unverifiable material is disclosed in Limitations.</div>

<h2 id="abstract">Abstract</h2>
${mdToHtml(report.abstract || '—')}

${sections.map((s, i) => `<h2 id="sec-${i}">${escapeHtml(s.heading)}</h2>\n${mdToHtml(s.content)}`).join('\n\n')}

${(report.keyInsights || []).length ? `<h2 id="key-insights">Key Insights</h2>\n<div class="insights"><ol>${report.keyInsights.map((k) => `<li>${escapeHtml(k)}</li>`).join('')}</ol></div>` : ''}

${(report.recommendations || []).length ? `<h2 id="recommendations-appendix">Consolidated Recommendations</h2>\n<ol>${report.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ol>` : ''}

<h2 id="references">References</h2>
<ol class="refs">
${refs.map((r) => `<li id="ref-${r.n}">${escapeHtml(r.author ? `${r.author}. ` : '')}${escapeHtml(r.title)}${r.publisher ? `. ${escapeHtml(r.publisher)}` : ''}${r.publishedAt ? ` (${escapeHtml(r.publishedAt)})` : ''}. Accessed ${escapeHtml(r.accessedAt)}.${verificationBadge(r.verificationStatus)}<br/><a class="url" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.url)}</a></li>`).join('\n')}
</ol>

<div class="footer-note">Generated by a multi-agent AI research system (Web Discovery · Deep Research · Fact-Checking · Analysis, coordinated by a Research Manager). All sources above were retrieved and read programmatically; citations map to live URLs. AI-generated analysis is distinguished from cited factual findings. This report may contain errors and should be independently verified before consequential use.</div>

</main>
</body>
</html>`;
}

function verificationLine(v) {
  if (!v || !v.totalFindings) return 'not available';
  const parts = Object.entries(v.byStatus || {}).map(([k, n]) => `${n} ${k}`).join(', ');
  return `${v.totalFindings} findings (${parts})`;
}

function verificationBadge(status) {
  if (!status || status === 'pending') return '<span class="badge">unverified</span>';
  if (status === 'Verified' || status === 'Supported') return `<span class="badge">${escapeHtml(status)}</span>`;
  if (status === 'Conflicting evidence' || status === 'Unsupported') return `<span class="badge bad">${escapeHtml(status)}</span>`;
  return `<span class="badge warn">${escapeHtml(status)}</span>`;
}
