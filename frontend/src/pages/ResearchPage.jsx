import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, Loader2, AlertCircle, Zap, Scale, Microscope, Info, Plus, X,
  CalendarClock, Globe2, FileText, ListChecks,
} from 'lucide-react';
import { startResearch } from '../services/researchApi.js';

const DEPTHS = [
  { id: 'quick', icon: Zap, title: 'Quick', desc: '~5 min · 8 sources · best for orientation', chip: '3-4 questions' },
  { id: 'standard', icon: Scale, title: 'Standard', desc: '~10 min · 15+ sources · most topics', chip: '5-6 questions' },
  { id: 'deep', icon: Microscope, title: 'Deep', desc: '~15+ min · 20+ sources · high-stakes topics', chip: '7-8 questions' },
];

const SOURCE_PREFS = ['Academic papers', 'Official reports', 'News', 'Documentation', 'Expert analysis', 'Primary data'];
const TIMEFRAMES = ['', 'Past week', 'Past month', 'Past year', 'Past 5 years', 'Any time'];

export default function ResearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState('standard');
  const [timeframe, setTimeframe] = useState('');
  const [prefs, setPrefs] = useState([]);
  const [questions, setQuestions] = useState(['']);
  const [outputFormat, setOutputFormat] = useState('report');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = searchParams.get('topic');
    if (t) setTopic(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePref = (p) => setPrefs((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const setQuestion = (i, v) => setQuestions((prev) => prev.map((q, idx) => (idx === i ? v : q)));
  const addQuestion = () => setQuestions((prev) => (prev.length >= 6 ? prev : [...prev, '']));
  const removeQuestion = (i) => setQuestions((prev) => (prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i)));

  const valid = topic.trim().length >= 10;
  const charCount = topic.trim().length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!valid) {
      setError('Please describe your research topic in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const { id } = await startResearch({
        topic: topic.trim(),
        depth,
        timeframe,
        sourcePreferences: prefs,
        userQuestions: questions.map((q) => q.trim()).filter(Boolean),
        outputFormat,
      });
      navigate(`/research/${id}/progress`);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.details || err.message || 'Failed to start research';
      setError(Array.isArray(msg) ? msg.join('; ') : String(msg));
      setSubmitting(false);
    }
  };

  return (
    <div className="grid-bg min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-title">Research workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">Brief the agents</h1>
            <p className="mt-2 max-w-lg text-sm text-slate-400">Be specific. A sharp question produces a sharper report — the manager adapts the plan to your brief.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-slate-400/10 bg-white/[0.03] px-4 py-2.5 text-[11px] text-slate-500 lg:flex">
            <Info size={13} className="text-cyan-400" /> Nothing leaves your configured LLM & search providers.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Left: prompt */}
          <div className="card flex flex-col p-5 sm:p-6">
            <label htmlFor="topic" className="label">Research topic or question</label>
            <textarea
              id="topic"
              autoFocus
              rows={6}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. What does peer-reviewed research say about the effects of GLP-1 receptor agonists on long-term weight maintenance after discontinuation? Include efficacy data, safety signals, and gaps in the literature."
              className="input min-h-[150px] flex-1 resize-y text-[15px] leading-relaxed"
              aria-invalid={!valid && topic.length > 0}
              aria-describedby="topic-hint"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span id="topic-hint">Minimum 10 characters — more detail yields better sourcing.</span>
              <span className={charCount >= 500 ? 'text-amber-400' : ''}>{charCount}/500</span>
            </div>

            <div className="mt-6">
              <div className="label flex items-center justify-between">
                <span>Optional: questions to answer</span>
                <span className="text-[10px] normal-case text-slate-600">max 6</span>
              </div>
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center font-mono text-[11px] text-slate-600">{i + 1}.</span>
                    <input
                      value={q}
                      onChange={(e) => setQuestion(i, e.target.value)}
                      placeholder="e.g. Which populations show the strongest effect sizes?"
                      className="input !py-2 text-sm"
                      aria-label={`Research question ${i + 1}`}
                    />
                    <button type="button" onClick={() => removeQuestion(i)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Remove question">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addQuestion} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-cyan-400 hover:text-cyan-300">
                <Plus size={13} /> Add question
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-[13px] text-rose-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
          </div>

          {/* Right: configuration */}
          <div className="flex flex-col gap-5">
            {/* Depth */}
            <fieldset className="card p-5">
              <legend className="label">Research depth</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Research depth">
                {DEPTHS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={depth === d.id}
                    onClick={() => setDepth(d.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      depth === d.id ? 'border-cyan-400/50 bg-cyan-400/10 ring-1 ring-cyan-400/40' : 'border-slate-400/15 bg-white/[0.03] hover:border-slate-400/30'
                    }`}
                  >
                    <d.icon size={17} className={depth === d.id ? 'text-cyan-300' : 'text-slate-400'} />
                    <div className="mt-2 text-[13px] font-bold text-slate-100">{d.title}</div>
                    <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{d.desc}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Timeframe */}
            <div className="card p-5">
              <label htmlFor="timeframe" className="label flex items-center gap-1.5"><CalendarClock size={12} /> Timeframe</label>
              <select id="timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="input">
                {TIMEFRAMES.map((t) => <option key={t} value={t}>{t || 'Any (no restriction)'}</option>)}
              </select>
            </div>

            {/* Source preferences */}
            <fieldset className="card p-5">
              <legend className="label flex items-center gap-1.5"><Globe2 size={12} /> Preferred source types</legend>
              <div className="flex flex-wrap gap-2">
                {SOURCE_PREFS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={prefs.includes(p)}
                    onClick={() => togglePref(p)}
                    className={`chip transition-all ${prefs.includes(p) ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300' : 'hover:border-slate-400/30'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Output format */}
            <fieldset className="card p-5">
              <legend className="label">Output</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'report', icon: FileText, label: 'Full report', sub: '18 sections + PDF' },
                  { id: 'brief', icon: ListChecks, label: 'Briefing', sub: 'Executive summary focus' },
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={outputFormat === o.id}
                    onClick={() => setOutputFormat(o.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      outputFormat === o.id ? 'border-violet-400/50 bg-violet-400/10 ring-1 ring-violet-400/40' : 'border-slate-400/15 bg-white/[0.03]'
                    }`}
                  >
                    <o.icon size={16} className={outputFormat === o.id ? 'text-violet-300' : 'text-slate-400'} />
                    <div className="mt-1.5 text-[13px] font-semibold text-slate-100">{o.label}</div>
                    <div className="text-[10px] text-slate-500">{o.sub}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Submit */}
            <button type="submit" disabled={!valid || submitting} className="btn-primary !py-4 text-base">
              {submitting ? (<><Loader2 size={18} className="animate-spin" /> Dispatching agents…</>) : (<><Sparkles size={18} /> Start Research</>)}
            </button>
            <p className="-mt-2 text-center text-[11px] text-slate-600">Runs live agents — expect {depth === 'quick' ? 'a few' : depth === 'deep' ? '10–20' : '5–15'} minutes. You can follow progress in real time.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
