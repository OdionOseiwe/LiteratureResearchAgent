import { ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion, FileText, Globe, Newspaper, GraduationCap, Building2, BookOpen } from 'lucide-react';

const typeIcons = {
  academic: GraduationCap,
  official: Building2,
  news: Newspaper,
  documentation: BookOpen,
  report: FileText,
  blog: Globe,
  web: Globe,
};

const verifyStyles = {
  Verified: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  Supported: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  'Partially supported': 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  'Conflicting evidence': 'text-rose-300 border-rose-400/30 bg-rose-400/10',
  Unverified: 'text-slate-400 border-slate-500/25 bg-slate-500/10',
  Unsupported: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
  pending: 'text-slate-500 border-slate-500/20 bg-slate-500/5',
};

export default function SourceCard({ source, index }) {
  const TypeIcon = typeIcons[source.sourceType] || Globe;
  const vClass = verifyStyles[source.verificationStatus] || verifyStyles.pending;
  const VerifyIcon = source.reachable === false ? ShieldAlert : source.verificationStatus === 'Verified' || source.verificationStatus === 'Supported' ? ShieldCheck : ShieldQuestion;

  return (
    <article className="card card-hover flex flex-col p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-400/10 font-mono text-[11px] font-semibold text-cyan-300">
            {source.n}
          </span>
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-100">{source.title || 'Untitled source'}</h3>
        </div>
        <TypeIcon size={15} className="mt-1 shrink-0 text-slate-500" />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {source.publisher && <span className="max-w-[180px] truncate">{source.publisher}</span>}
        {source.publishedAt && <span>· {source.publishedAt}</span>}
        <span className="rounded border border-slate-400/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{source.sourceType}</span>
      </div>
      {source.summary && <p className="mb-2 line-clamp-2 text-[11.5px] leading-relaxed text-slate-400">{source.summary}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-400/10 pt-2.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${vClass}`}>
          <VerifyIcon size={11} strokeWidth={2.4} />
          {source.verificationStatus || 'pending'}
        </span>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300"
        >
          Open <ExternalLink size={11} />
        </a>
      </div>
    </article>
  );
}
