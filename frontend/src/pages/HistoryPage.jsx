import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Trash2, FileDown, Eye, Loader2, PlusCircle, Clock, CheckCircle2, AlertTriangle, XCircle, FlaskConical,
} from 'lucide-react';
import { fetchHistory, deleteResearch, pdfDownloadUrl } from '../services/researchApi.js';

const statusMeta = {
  completed: { icon: CheckCircle2, cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10', label: 'Completed' },
  partial: { icon: AlertTriangle, cls: 'text-amber-300 border-amber-400/30 bg-amber-400/10', label: 'Partial' },
  failed: { icon: XCircle, cls: 'text-rose-300 border-rose-400/30 bg-rose-400/10', label: 'Failed' },
  queued: { icon: Clock, cls: 'text-slate-400 border-slate-500/25 bg-slate-500/10', label: 'Queued' },
  planning: { icon: Clock, cls: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10', label: 'Planning' },
  researching: { icon: Clock, cls: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10', label: 'Researching' },
  analyzing: { icon: Clock, cls: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10', label: 'Analyzing' },
  synthesizing: { icon: Clock, cls: 'text-violet-300 border-violet-400/30 bg-violet-400/10', label: 'Synthesizing' },
};

export default function HistoryPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: '', items: [], totalPages: 1, total: 0 });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fetchHistory({ q: debounced, page, limit: 12 });
      setState({ loading: false, error: '', items: data.items, totalPages: data.totalPages, total: data.total });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err?.response?.data?.error || err.message }));
    }
  }, [debounced, page]);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteResearch(id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setState((s) => ({ ...s, error: err?.response?.data?.error || err.message }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid-bg min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-title">Archive</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">Research history</h1>
            <p className="mt-2 text-sm text-slate-400">{state.total} report{state.total === 1 ? '' : 's'} on file — stored in MongoDB.</p>
          </div>
          <Link to="/research" className="btn-primary !py-2.5 text-[13px]"><PlusCircle size={16} /> New research</Link>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-xl">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search past research by topic…" className="input !pl-11" aria-label="Search research history" />
        </div>

        {state.error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-300">{state.error}</p>}

        {state.loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-44" />)}</div>
        ) : state.items.length === 0 ? (
          <div className="card mx-auto max-w-lg p-12 text-center">
            <FlaskConical size={30} className="mx-auto text-slate-600" strokeWidth={1.5} />
            <h2 className="mt-4 text-lg font-semibold text-slate-200">{debounced ? 'No matches' : 'No research yet'}</h2>
            <p className="mt-1.5 text-sm text-slate-500">{debounced ? `Nothing matches "${debounced}".` : 'Your completed reports will appear here.'}</p>
            <Link to="/research" className="btn-primary mx-auto mt-6 w-fit">Start your first research <PlusCircle size={15} /></Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {state.items.map((item) => {
                const s = statusMeta[item.status] || statusMeta.queued;
                const isDone = item.status === 'completed' || item.status === 'partial';
                return (
                  <article key={item.id} className="card card-hover flex flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${s.cls}`}>
                        <s.icon size={11} strokeWidth={2.4} /> {s.label}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-slate-600">{item.depth}</span>
                    </div>
                    <h2 className="mt-3 line-clamp-2 min-h-[2.6rem] text-[15px] font-semibold leading-snug text-slate-100" title={item.topic}>{item.topic}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>{item.sourceCount} sources</span>
                      <span>·</span>
                      <span>{item.findingCount} findings</span>
                      <span>·</span>
                      <span>{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {!isDone && item.status !== 'failed' && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-cyan-400/70" style={{ width: `${item.progress || 0}%` }} /></div>
                    )}
                    {item.error && <p className="mt-2 line-clamp-1 text-[10.5px] text-rose-400/80" title={item.error}>{item.error}</p>}
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-400/10 pt-4">
                      <div className="flex flex-wrap gap-1.5">
                        {isDone && (
                          <>
                            <Link to={`/research/${item.id}/results`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-cyan-400/30 hover:text-cyan-300"><Eye size={12} /> View</Link>
                            <a href={pdfDownloadUrl(item.id)} download className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-cyan-400/30 hover:text-cyan-300"><FileDown size={12} /> PDF</a>
                          </>
                        )}
                        {!isDone && item.status !== 'failed' && (
                          <Link to={`/research/${item.id}/progress`} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-300"><Loader2 size={12} className="animate-spin" /> Watch live</Link>
                        )}
                      </div>
                      <button onClick={() => setConfirmDelete(item)} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-400/10 hover:text-rose-400" aria-label={`Delete research: ${item.topic.slice(0, 40)}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {state.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button className="btn-ghost !px-4 !py-2 text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                <span className="font-mono text-xs text-slate-500">Page {page} / {state.totalPages}</span>
                <button className="btn-ghost !px-4 !py-2 text-xs" disabled={page >= state.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-title" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="card max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="delete-title" className="flex items-center gap-2 font-semibold text-slate-100"><Trash2 size={18} className="text-rose-400" /> Delete this research?</h2>
            <p className="mt-2 line-clamp-2 text-sm text-slate-400">"{confirmDelete.topic}" and its stored PDF will be permanently removed. This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost !py-2 text-xs" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</button>
              <button className="btn-primary !bg-rose-500 !py-2 text-xs text-white hover:!bg-rose-400" onClick={() => onDelete(confirmDelete.id)} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete permanently'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
