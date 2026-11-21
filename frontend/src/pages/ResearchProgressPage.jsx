import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Loader2, AlertTriangle, CheckCircle2, FileDown, ArrowRight, Wifi, WifiOff,
  Database, FileSearch, Coins, RefreshCw, ListChecks,
} from 'lucide-react';
import { useResearchProgress } from '../hooks/useResearchProgress.js';
import AgentCard from '../components/agents/AgentCard.jsx';
import { pdfDownloadUrl } from '../services/researchApi.js';

const STAGE_STEPS = ['Planning', 'Discovery', 'Reading', 'Verification', 'Analysis', 'Synthesis'];

export default function ResearchProgressPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, connected, error } = useResearchProgress(id);
  const [elapsed, setElapsed] = useState(0);

  const done = data && ['completed', 'partial'].includes(data.status);
  const failed = data?.status === 'failed';

  // Auto-redirect to results when done
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate(`/research/${id}/results`, { replace: true }), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [done, id, navigate]);

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const progress = data?.progress ?? 0;
  const stageIndex = useMemo(() => {
    const s = (data?.currentStage || '').toLowerCase();
    if (s.includes('plan')) return 0;
    if (s.includes('source') || s.includes('discover')) return 1;
    if (s.includes('read') || s.includes('findings')) return 2;
    if (s.includes('verif')) return 3;
    if (s.includes('analys')) return 4;
    if (s.includes('synth') || s.includes('report') || s.includes('pdf') || s.includes('complet')) return 5;
    return 0;
  }, [data?.currentStage]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="grid-bg min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <p className="section-title flex items-center gap-2">
              {connected ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-amber-400" />}
              Live research {connected ? '— connected' : '— reconnecting…'}
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-snug text-slate-50 sm:text-3xl">{data?.topic || 'Loading research…'}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="chip capitalize">{data?.depth || 'standard'} depth</span>
              <span className="flex items-center gap-1.5"><Database size={12} /> {data?.sourceCount ?? 0} sources</span>
              <span className="flex items-center gap-1.5"><FileSearch size={12} /> {data?.findingCount ?? 0} findings</span>
              <span className="flex items-center gap-1.5"><Coins size={12} /> {(data?.tokensUsed ?? 0).toLocaleString()} tokens</span>
              <span className="font-mono">{mm}:{ss}</span>
            </div>
          </div>
          <Link to="/history" className="btn-ghost !px-4 !py-2 text-xs">Back to history</Link>
        </div>

        {/* Progress bar + stage stepper */}
        <div className="card mb-6 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-slate-300">{data?.currentStage || 'Queued'}</div>
            <div className="font-mono text-sm text-cyan-300">{Math.round(progress)}%</div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-6">
            {STAGE_STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-1.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  i < stageIndex ? 'bg-emerald-400/20 text-emerald-300' : i === stageIndex ? 'bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-400/50' : 'bg-white/5 text-slate-600'
                }`}>
                  {i < stageIndex ? '✓' : i + 1}
                </span>
                <span className={`text-[10px] font-medium uppercase tracking-wide ${i <= stageIndex ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Failed banner */}
        {failed && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5">
            <AlertTriangle className="mt-0.5 shrink-0 text-rose-400" size={20} />
            <div>
              <h2 className="font-semibold text-rose-300">Research failed</h2>
              <p className="mt-1 text-sm text-rose-200/80">{data?.error || 'The pipeline encountered a fatal error.'}</p>
              <p className="mt-2 text-xs text-rose-200/60">Common causes: missing/invalid API keys, search quota exhausted, or an unreachable page. Check backend logs and your .env configuration, then try again.</p>
              <Link to="/research" className="btn-ghost mt-4 !border-rose-400/30 text-xs">Try again</Link>
            </div>
          </div>
        )}

        {/* Done banner */}
        {done && (
          <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-400" size={22} />
              <div>
                <h2 className="font-semibold text-emerald-300">Report complete{data?.status === 'partial' ? ' (with disclosed limitations)' : ''}</h2>
                <p className="text-xs text-emerald-200/70">Redirecting to the results page…</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={pdfDownloadUrl(id)} className="btn-ghost !py-2 text-xs"><FileDown size={14} /> PDF</a>
              <Link to={`/research/${id}/results`} className="btn-primary !py-2 text-xs">View report <ArrowRight size={14} /></Link>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Agent grid */}
          <section aria-label="Agent status">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Agent execution</h2>
              {data?.rounds > 1 && <span className="chip"><RefreshCw size={11} /> Round {data.rounds}</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(data?.agents || []).map((a) => <AgentCard key={a.agent} agent={a} />)}
              {!data?.agents?.length && Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-28" />)}
            </div>
          </section>

          {/* Activity log */}
          <aside className="card flex max-h-[520px] flex-col p-5" aria-label="Activity log">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              <ListChecks size={14} /> Activity
            </h2>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 font-mono text-[11px] leading-relaxed">
              {(data?.activity || []).length === 0 && <p className="text-slate-600">Waiting for the manager to begin…</p>}
              {[...(data?.activity || [])].reverse().map((entry, i) => (
                <div key={i} className="flex items-start gap-2 border-b border-slate-400/5 pb-2">
                  <span className="shrink-0 text-slate-600">{new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="text-slate-400">{entry.message}</span>
                </div>
              ))}
            </div>
            {error && <p className="mt-2 text-[11px] text-amber-400/80">{error}</p>}
            <div className="mt-3 flex items-center gap-2 border-t border-slate-400/10 pt-3 text-[10px] uppercase tracking-widest text-slate-600">
              <Loader2 size={11} className={done || failed ? '' : 'animate-spin'} /> {done || failed ? 'Stream ended' : 'Streaming live updates'}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
