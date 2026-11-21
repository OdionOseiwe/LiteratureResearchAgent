import { useEffect, useMemo, useState } from 'react';
import { ListTree, ExternalLink } from 'lucide-react';
import { mdToHtml } from '../../utils/markdown.js';

/**
 * Report reader: sticky TOC sidebar + scrollable serif body.
 * Sections passed as array of { heading, content } (markdown).
 */
export default function ReportReader({ report }) {
  const sections = useMemo(() => report.sections || [], [report]);
  const [active, setActive] = useState('executive-summary');

  useEffect(() => {
    const ids = ['executive-summary', 'abstract', ...sections.map((_, i) => `sec-${i}`), 'key-insights', 'references'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const toc = [
    { id: 'executive-summary', label: 'Executive Summary' },
    { id: 'abstract', label: 'Abstract' },
    ...sections.map((s, i) => ({ id: `sec-${i}`, label: s.heading })),
    ...(report.keyInsights?.length ? [{ id: 'key-insights', label: 'Key Insights' }] : []),
    { id: 'references', label: `References (${report.references?.length ?? 0})` },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      {/* TOC */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <ListTree size={13} /> Contents
          </div>
          <nav aria-label="Report contents">
            <ul className="max-h-[65vh] space-y-0.5 overflow-y-auto pr-1">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={`block rounded-lg px-2.5 py-1.5 text-[12px] leading-snug transition-colors ${
                      active === item.id ? 'bg-cyan-400/10 font-medium text-cyan-300' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Body */}
      <div className="report-body card min-w-0 p-5 sm:p-8">
        <p className="section-title mb-2">Executive Summary</p>
        <h2 id="executive-summary" className="!mt-0 border-b border-slate-400/15 pb-3 font-serif text-2xl font-semibold text-slate-50">Summary</h2>
        <div dangerouslySetInnerHTML={{ __html: mdToHtml(report.executiveSummary) }} />

        <h2 id="abstract" className="mt-8 font-serif text-xl font-semibold text-slate-50">Abstract</h2>
        <div dangerouslySetInnerHTML={{ __html: mdToHtml(report.abstract) }} />

        {sections.map((s, i) => (
          <section key={i}>
            <h2 id={`sec-${i}`} className="mt-8 border-b border-slate-400/15 pb-2 font-serif text-xl font-semibold text-slate-50">
              {s.heading}
            </h2>
            <div dangerouslySetInnerHTML={{ __html: mdToHtml(s.content) }} />
          </section>
        ))}

        {report.keyInsights?.length > 0 && (
          <section>
            <h2 id="key-insights" className="mt-8 border-b border-slate-400/15 pb-2 font-serif text-xl font-semibold text-slate-50">Key Insights</h2>
            <ol className="list-decimal space-y-1.5 pl-6">
              {report.keyInsights.map((k, i) => <li key={i}>{k}</li>)}
            </ol>
          </section>
        )}

        <section>
          <h2 id="references" className="mt-8 border-b border-slate-400/15 pb-2 font-serif text-xl font-semibold text-slate-50">
            References
          </h2>
          <ol className="space-y-2.5 text-[13px]">
            {(report.references || []).map((r) => (
              <li key={r.n} id={`ref-${r.n}`} className="scroll-mt-24 leading-snug text-slate-300">
                <span className="mr-1 font-mono text-[11px] text-cyan-400">[{r.n}]</span>
                {r.author ? `${r.author}. ` : ''}{r.title}{r.publisher ? `. ${r.publisher}` : ''}{r.publishedAt ? ` (${r.publishedAt})` : ''}. Accessed {r.accessedAt}.{' '}
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex break-all items-center gap-1 text-cyan-400 hover:text-cyan-300">
                  {r.url} <ExternalLink size={11} className="inline shrink-0" />
                </a>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
