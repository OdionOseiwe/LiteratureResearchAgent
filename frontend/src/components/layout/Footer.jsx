import { Link } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-400/10 bg-navy-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-slate-400">
            <FlaskConical size={16} className="text-cyan-400" />
            <span className="text-sm font-semibold tracking-[0.2em] text-slate-300">PRAXIS</span>
            <span className="text-xs text-slate-600">— Multi-agent AI research, with receipts.</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <Link to="/research" className="hover:text-slate-300">Start research</Link>
            <Link to="/history" className="hover:text-slate-300">Past reports</Link>
            <a href="https://tavily.com" target="_blank" rel="noreferrer" className="hover:text-slate-300">Powered by Tavily Search</a>
            <a href="https://ai.google.dev" target="_blank" rel="noreferrer" className="hover:text-slate-300">LLM: Gemini (configurable)</a>
          </div>
        </div>
        <p className="mt-6 text-[11px] leading-5 text-slate-600">
          PRAXIS retrieves and reads live web sources, verifies claims against them, and cites what it used.
          AI analysis is labelled as such; nothing in a report should be treated as professional advice without independent verification.
        </p>
      </div>
    </footer>
  );
}
