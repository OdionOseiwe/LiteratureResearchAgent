/** Minimal safe markdown → HTML (escape-first). Mirrors the PDF renderer's behavior. */
export function mdToHtml(md) {
  if (!md) return '';
  const escape = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const lines = String(md).split('\n');
  const out = [];
  let inList = false;
  let inOrdered = false;
  const closeLists = () => {
    if (inList) { out.push('</ul>'); inList = false; }
    if (inOrdered) { out.push('</ol>'); inOrdered = false; }
  };
  const inline = (text) => {
    let t = escape(text);
    t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<em>$2</em>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Highlight numbered citations [1], [2]… (not markdown links, which were replaced above)
    t = t.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g, '<span class="cite">[$1]</span>');
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

/** Rough reading time for a blocks array of strings. */
export function readingTime(...texts) {
  const words = texts.join(' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
