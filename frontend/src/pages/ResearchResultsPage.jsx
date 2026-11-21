import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileDown, Loader2, AlertCircle, ArrowLeft, CalendarDays, Timer, Coins, Database,
  ShieldCheck, Lightbulb, AlertTriangle, Rocket, BookOpenCheck, TrendingUp, Users, Search,
} from 'lucide-react';
import { fetchReport, fetchSources, pdfDownloadUrl } from '../services/researchApi.js';
import ReportReader from '../components/report/ReportReader.jsx';
import SourceCard from '../components/sources/SourceCard.jsx';
import AgentCard from '../components/agents/AgentCard.jsx';

const TABS = [
  { id: 'report', label: 'Report' },
  { id: 'insights', label: 'Insights & Recommendations' },
  { id: 'sources', label: 'Sources' },
  { id: 'agents', label: 'Agent Execution' },
];

export default function ResearchResultsPage() {
  const { id } = useParams();
  const [tab, setTab] = useState('report');
  const [report, setReport] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sourcesState, setSourcesState] = useState({ loading: false, error: '', items: [] });
  const [typeFilter, setTypeFilter] = useState('all');
  const [verifyFilter, setVerifyFilter] = useState('all');
  const [sourceQuery, setSourceQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchReport(id);
        if (cancelled) return;
        setReport(data.report);
        setMeta(data.meta);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message || 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Lazy-load sources when the sources tab is opened
  useEffect(() => {
    if (tab !== 'sources' || sourcesState.items.length || sourcesState.loading) return;
    setSourcesState((s) => ({ ...s, loading: true, error: '' }));
    fetchSources(id)
      .then((data) => setSourcesState({ loading: false, error: '', items: data.sources || [] }))
      .catch((err) => setSourcesState({ loading: false, error: err?.response?.data?.error || err.message, items: [] }));
  }, [tab, id, sourcesState.items.length, sourcesState.loading]);

  const filteredSources = useMemo(() => {
    return sourcesState.items.filter((s) => {
      if (typeFilter !== 'all' && s.sourceType !== typeFilter) return false;
      if (verifyFilter !== 'all' && s.verificationStatus !== verifyFilter) return false;
      if (sourceQuery) {
        const hay = `${s.title} ${s.publisher} ${s.url} ${s.summary}`.toLowerCase();
        if (!hay.includes(sourceQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [sourcesState.items, typeFilter, verifyFilter, sourceQuery]);

  const sourceTypes = useMemo(() => [...new Set(sourcesState.items.map((s) => s.sourceType).filter(Boolean))], [sourcesState.items]);

  if (loading) return <CenteredState icon={<Loader2 className="animate-spin" size={26} />} title="Opening report…" />;
  if (error) {
    return (
      <CenteredState
        icon={<AlertCircle size={26} className="text-rose-400" />}
        title="Couldn't load the report"
        body={error}
        action={<Link to={`/research/${id}/progress`} className="btn-primary mt-6"><BookOpenCheck size={16} /> Check research status</Link>}
      />
    );
  }
  if (!report) return null;

  const generated = report.dateGenerated ? new Date(report.dateGenerated) : new Date();
  const refCount = report.references?.length ?? 0;

  return (
    <div className="grid-bg min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Breadcrumb + actions */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <Link to="/history" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-300"><ArrowLeft size={13} /> All research</Link>
          <a href={pdfDownloadUrl(id)} download className="btn-primary !py-2.5 text-[13px]"><FileDown size={16} /> Download PDF</a>
        </div>

        {/* Report header */}
        <header className="card mb-6 overflow-hidden">
          <div className="border-b border-slate-400/10 bg-gradient-to-br from-cyan-400/5 via-transparent to-violet-500/5 p-6 sm:p-8">
            <p className="section-title">Research report {meta?.depth ? `· ${meta.depth} depth` : ''}</p>
            <h1 className="mt-3 max-w-4xl font-serif text-2xl font-semibold leading-snug text-slate-50 sm:text-4xl">{report.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><CalendarDays size={12} /> {generated.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              {meta?.completedAt && <span className="flex items-center gap-1.5"><Timer size={12} /> Completed {new Date(meta.completedAt).toLocaleTimeString()}</span>}
              <span className="flex items-center gap-1.5"><Database size={12} /> {refCount} sources</span>
              <span className="flex items-center gap-1.5"><Coins size={12} /> {(meta?.tokensUsed ?? 0).toLocaleString()} tokens</span>
              {report.verificationSummary?.totalFindings ? (
                <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-emerald-400" /> {report.verificationSummary.totalFindings} findings verified</span>
              ) : null}
            </div>
          </div>
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-400/10" role="tablist" aria-label="Report views">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap border-b-2 px-5 py-3.5 text-[12px] font-semibold uppercase tracking-wider transition-colors ${
                  tab === t.id ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* Tab panels */}
        {tab === 'report' && (
          <>
            <div className="card mb-6 border-l-4 !border-l-cyan-400/60 bg-gradient-to-r from-cyan-400/5 to-transparent p-5">
              <p className="label !mb-1.5">Executive summary</p>
              <p className="text-[14px] leading-relaxed text-slate-200">{report.executiveSummary}</p>
            </div>
            <ReportReader report={report} />
          </>
        )}

        {tab === 'insights' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <InsightPanel title="Key insights" icon={Lightbulb} tone="amber" items={report.keyInsights?.map((k) => ({ text: k }))} />
            <InsightPanel title="Recommendations" icon={Rocket} tone="cyan" items={report.recommendations?.map((r) => ({ text: r }))} />
            <InsightPanel title="Risks & challenges" icon={AlertTriangle} tone="rose" items={report.risks?.map((r) => ({ text: r.risk, sub: r.evidence }))} />
            <InsightPanel title="Opportunities" icon={TrendingUp} tone="emerald" items={report.opportunities?.map((r) => ({ text: r.opportunity, sub: r.evidence }))} />
            <div className="card p-6 lg:col-span-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><Users size={14} /> Analysis limitations</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-300">
                {(report.limitations || []).map((l, i) => <li key={i}>{l}</li>)}
                {!report.limitations?.length && <li className="text-slate-500">None recorded by the analysis agent.</li>}
              </ul>
              {report.futureQuestions?.length > 0 && (
                <>
                  <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Open questions for future research</h3>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] text-slate-300">
                    {report.futureQuestions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'sources' && (
          <div>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={sourceQuery} onChange={(e) => setSourceQuery(e.target.value)} placeholder="Filter sources by title, publisher, URL…" className="input !pl-11 !py-2.5 text-sm" aria-label="Filter sources" />
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input !w-auto !py-2.5 text-sm" aria-label="Filter by type">
                <option value="all">All types</option>
                {sourceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={verifyFilter} onChange={(e) => setVerifyFilter(e.target.value)} className="input !w-auto !py-2.5 text-sm" aria-label="Filter by verification">
                <option value="all">All verification</option>
                {['Verified', 'Supported', 'Partially supported', 'Conflicting evidence', 'Unverified', 'Unsupported'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {sourcesState.loading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-44" />)}</div>}
            {sourcesState.error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-300">{sourcesState.error}</p>}
            {!sourcesState.loading && !sourcesState.error && (
              <>
                <p className="mb-3 text-xs text-slate-500">{filteredSources.length} of {sourcesState.items.length} sources</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredSources.map((s) => <SourceCard key={s._id || s.url} source={s} />)}
                </div>
                {!filteredSources.length && <p className="py-10 text-center text-sm text-slate-500">No sources match these filters.</p>}
              </>
            )}
          </div>
        )}

        {tab === 'agents' && (
          <div className="grid gap-4 md:grid-cols-2">
            {(meta?.agents || []).map((a) => (
              <AgentCard
                key={a.agent}
                agent={{ agent: a.agent, agentType: 'specialist', status: a.status, task: a.outputSummary ? '' : 'Executed', outputSummary: a.outputSummary, endedAt: a.endedAt, startedAt: undefined, retryCount: 0 }}
              />
            ))}
            {!meta?.agents?.length && <p className="text-sm text-slate-500">Agent execution details are not available for this run.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function CenteredState({ icon, title, body, action }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-slate-500">{icon}</div>
      <h1 className="mt-4 text-xl font-semibold text-slate-100">{title}</h1>
      {body && <p className="mt-2 max-w-md text-sm text-slate-500">{body}</p>}
      {action}
    </div>
  );
}

const toneClasses = {
  amber: 'text-amber-300 border-amber-400/20',
  cyan: 'text-cyan-300 border-cyan-400/20',
  rose: 'text-rose-300 border-rose-400/20',
  emerald: 'text-emerald-300 border-emerald-400/20',
};

function InsightPanel({ title, icon: Icon, tone, items }) {
  return (
    <div className="card p-6">
      <h3 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] ${toneClasses[tone]}`}>
        <Icon size={15} /> {title}
      </h3>
      <ul className="mt-4 space-y-3">
        {(items || []).map((item, i) => (
          <li key={i} className="rounded-xl border border-slate-400/10 bg-white/[0.02] p-3">
            <p className="text-[13.5px] leading-relaxed text-slate-200">{item.text}</p>
            {item.sub && <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500"><span className="font-semibold text-slate-400">Evidence:</span> {item.sub}</p>}
          </li>
        ))}
        {!items?.length && <li className="text-sm text-slate-500">None recorded.</li>}
      </ul>
    </div>
  );
}
