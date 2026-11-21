import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Sparkles, Search, BookOpenCheck, ShieldCheck, LineChart, Compass, UserCog,
  FileText, Link2, FileDown, ListChecks, Quote, FileSearch, Workflow, ScanSearch, BadgeCheck,
  Database, Rocket, ArrowDownRight,
} from 'lucide-react';

const EXAMPLE_PROMPTS = [
  'What does the evidence say about intermittent fasting and metabolic health in adults?',
  'The state of solid-state batteries: commercial readiness, players, and bottlenecks',
  'How are EU AI Act transparency rules being implemented by enterprises in 2026?',
  'Compare LoRA vs full fine-tuning for adapting LLMs to domain-specific tasks',
];

const AGENTS = [
  { icon: Compass, name: 'Web Discovery Agent', role: 'Finds sources', desc: 'Plans multi-query searches, retrieves candidate sources, deduplicates URLs, and ranks by authority — academic, official, news, documentation.', color: 'text-cyan-300 border-cyan-400/25 bg-cyan-400/10' },
  { icon: BookOpenCheck, name: 'Deep Research Agent', role: 'Reads & extracts', desc: 'Fetches and reads the actual pages — not snippets — extracting evidence, statistics, and arguments tied to each research question.', color: 'text-violet-300 border-violet-400/25 bg-violet-400/10' },
  { icon: ShieldCheck, name: 'Fact-Checking Agent', role: 'Verifies claims', desc: 'Checks URL reachability, matches every claim to source content, and assigns six verification grades — flagging weak or conflicting evidence.', color: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10' },
  { icon: LineChart, name: 'Analysis Agent', role: 'Synthesizes insights', desc: 'Finds patterns, disagreements and trends across sources; surfaces risks, opportunities and concrete recommendations.', color: 'text-amber-300 border-amber-400/25 bg-amber-400/10' },
];

const WORKFLOW = [
  { n: '01', title: 'Brief', desc: 'You describe the topic, depth, timeframe and source preferences.' },
  { n: '02', title: 'Plan', desc: 'The Research Manager scopes the objective and writes research questions.' },
  { n: '03', title: 'Discover', desc: 'The Discovery Agent runs multi-query searches and dedupes sources.' },
  { n: '04', title: 'Read & Verify', desc: 'Deep Research reads pages; Fact-Checking grades every claim against them.' },
  { n: '05', title: 'Analyze', desc: 'The Analysis Agent converts verified evidence into insights and recommendations.' },
  { n: '06', title: 'Report & PDF', desc: 'A cited, sectioned report is compiled and rendered to a professional PDF.' },
];

const FEATURES = [
  { icon: ScanSearch, title: 'Live web research', desc: 'Real Tavily-powered searches and actual page retrieval — never generated-from-memory citations.' },
  { icon: Quote, title: 'Verifiable citations', desc: 'Every factual claim carries a numbered marker mapped to a stored source with a clickable URL.' },
  { icon: FileDown, title: 'Professional PDF', desc: 'Cover page, TOC, headers, footers, page numbers, and clickable references in the PDF.' },
  { icon: ShieldCheck, title: 'Claim verification', desc: 'Verified / Supported / Partially supported / Conflicting / Unverified / Unsupported — per finding.' },
  { icon: Workflow, title: 'Transparent orchestration', desc: 'LangGraph-coordinated agents with live status, retries, and sufficiency reviews before synthesis.' },
  { icon: Database, title: 'Persistent history', desc: 'Reports and PDFs stored in MongoDB — reopen, re-download, or delete any past run.' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');

  const submit = (q) => {
    const t = (q ?? topic).trim();
    navigate(t ? `/research?topic=${encodeURIComponent(t)}` : '/research');
  };

  return (
    <div className="grid-bg">
      {/* ============ HERO ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[11px] font-medium tracking-wide text-cyan-300">
              <Sparkles size={12} /> MULTI-AGENT RESEARCH SYSTEM — NOT A CHATBOT
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-50 sm:text-5xl xl:text-6xl">
              Research that reads<br />
              the web <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">for you.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              PRAXIS deploys four specialized AI agents — discovery, deep reading, fact-checking and analysis —
              coordinated by a Research Manager, to compile a cited, verified, professionally typeset PDF report.
            </p>

            {/* Research input */}
            <form
              className="mt-8 max-w-xl"
              onSubmit={(e) => { e.preventDefault(); submit(); }}
            >
              <label htmlFor="hero-topic" className="label">Ask any research question</label>
              <textarea
                id="hero-topic"
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. What does the peer-reviewed evidence say about GLP-1 agonists for weight maintenance?"
                className="input resize-none text-[15px]"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="submit" className="btn-primary">
                  Start Research <ArrowRight size={16} />
                </button>
                <span className="text-xs text-slate-500">Quick · Standard · Deep — results in minutes</span>
              </div>
            </form>

            {/* Example prompts */}
            <div className="mt-6 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => submit(p)}
                  className="max-w-xs truncate rounded-full border border-slate-400/15 bg-white/[0.03] px-3.5 py-1.5 text-left text-[11px] text-slate-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-300"
                  title={p}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Stylized agent console (illustrative, not live data) */}
          <div className="relative animate-fade-up" style={{ animationDelay: '120ms' }} aria-hidden="true">
            <div className="card overflow-hidden shadow-2xl">
              <div className="flex items-center gap-1.5 border-b border-slate-400/10 bg-navy-850 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 font-mono text-[10px] uppercase tracking-widest text-slate-500">praxis — agent console</span>
              </div>
              <div className="space-y-2.5 bg-navy-900/60 p-4 font-mono text-[11px] leading-5">
                <ConsoleLine who="MANAGER" color="text-violet-300" text="Scoping objective · 7 research questions · plan locked" state="ok" />
                <ConsoleLine who="DISCOVER" color="text-cyan-300" text="6 queries → 38 raw hits → 17 unique sources (academic:4 official:5 news:3)" state="ok" />
                <ConsoleLine who="DEEP-READ" color="text-blue-300" text="Read 12 pages · extracted 23 evidence-backed findings" state="ok" />
                <ConsoleLine who="FACT-CHECK" color="text-emerald-300" text="Reachability 16/17 · 19 Supported · 3 Partially · 1 Conflicting" state="ok" />
                <ConsoleLine who="ANALYSIS" color="text-amber-300" text="6 insights · 4 risks · 5 recommendations synthesized" state="ok" />
                <ConsoleLine who="MANAGER" color="text-violet-300" text="Sufficiency: PASS (round 1/2) → compiling report & PDF…" state="run" />
              </div>
              <div className="border-t border-slate-400/10 bg-navy-850 px-4 py-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
                  <span>report.pdf</span>
                  <span className="flex items-center gap-1 text-emerald-400"><BadgeCheck size={11} /> 22 citations linked</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
                </div>
              </div>
            </div>
            <div className="absolute -right-3 -top-3 -z-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute -bottom-6 -left-6 -z-10 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
          </div>
        </div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section className="border-y border-slate-400/10 bg-navy-950/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 text-[10.5px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:px-6">
          <span className="flex items-center gap-2"><Search size={12} className="text-cyan-400" /> Live web retrieval</span>
          <span className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-400" /> Claim verification</span>
          <span className="flex items-center gap-2"><Link2 size={12} className="text-violet-400" /> Clickable citations</span>
          <span className="flex items-center gap-2"><FileText size={12} className="text-amber-400" /> PDF export</span>
          <span className="flex items-center gap-2"><UserCog size={12} className="text-rose-400" /> LangGraph orchestration</span>
        </div>
      </section>

      {/* ============ AGENTS ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 max-w-2xl">
          <p className="section-title">The dispatch team</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">Four agents, one manager,<br />zero fabricated sources.</h2>
          <p className="mt-4 text-slate-400">Each agent does one job well and hands structured results to the next. The Research Manager plans, dispatches, reviews sufficiency, and only then writes the report — grounded strictly in what the agents retrieved and verified.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {AGENTS.map((a) => (
            <div key={a.name} className="card card-hover flex flex-col p-5">
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border ${a.color}`}>
                <a.icon size={20} strokeWidth={1.7} />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{a.role}</div>
              <h3 className="mt-1 text-[15px] font-semibold text-slate-100">{a.name}</h3>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ WORKFLOW ============ */}
      <section className="border-t border-slate-400/10 bg-navy-950/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="section-title">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">From question to PDF,<br />in six stages.</h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {WORKFLOW.map((s) => (
              <li key={s.n} className="relative rounded-2xl border border-slate-400/10 bg-white/[0.02] p-4">
                <div className="font-mono text-[11px] font-semibold text-cyan-400/80">{s.n}</div>
                <div className="mt-1.5 text-sm font-semibold text-slate-100">{s.title}</div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{s.desc}</p>
                <ArrowDownRight size={14} className="absolute right-3 top-4 hidden text-slate-700 xl:block" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="section-title">Why trust the output</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">Built for reports you can<br />actually cite.</h2>
          </div>
          <a href="/research" className="btn-ghost text-[13px]">Open the workspace <ArrowRight size={14} /></a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <f.icon size={18} className="text-cyan-400" strokeWidth={1.8} />
              <h3 className="mt-3 text-sm font-semibold text-slate-100">{f.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="border-t border-slate-400/10">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
          <ListChecks size={26} className="mx-auto text-violet-400" strokeWidth={1.6} />
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">Your next literature review<br />starts with one sentence.</h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-400">Paste a question, pick a depth, and watch the agents work. You get a cited report — and a PDF you can hand to a board, a class, or yourself.</p>
          <button onClick={() => navigate('/research')} className="btn-primary mx-auto mt-8 !px-7 !py-4 text-base">
            <Rocket size={18} /> Start your research
          </button>
        </div>
      </section>
    </div>
  );
}

function ConsoleLine({ who, text, color, state }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`w-[74px] shrink-0 font-semibold ${color}`}>[{who}]</span>
      <span className="text-slate-400">{text}</span>
      {state === 'ok' && <span className="ml-auto shrink-0 text-emerald-400">✓</span>}
      {state === 'run' && <span className="ml-auto shrink-0 animate-pulse-soft text-cyan-300">●</span>}
    </div>
  );
}
