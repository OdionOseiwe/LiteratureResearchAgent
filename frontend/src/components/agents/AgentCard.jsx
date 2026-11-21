import { Compass, BookOpenCheck, ShieldCheck, LineChart, UserCog } from 'lucide-react';
import StatusPill from '../ui/StatusPill.jsx';

const icons = {
  'Research Manager': UserCog,
  'Web Discovery Agent': Compass,
  'Deep Research Agent': BookOpenCheck,
  'Fact-Checking Agent': ShieldCheck,
  'Analysis & Insights Agent': LineChart,
};

export default function AgentCard({ agent }) {
  const Icon = icons[agent.agent] || Compass;
  const duration = agent.startedAt && (agent.endedAt || Date.now())
    ? Math.max(0, Math.round((new Date(agent.endedAt || Date.now()) - new Date(agent.startedAt)) / 1000))
    : null;

  return (
    <div
      className={`card relative overflow-hidden p-4 transition-all duration-300 ${
        agent.status === 'working' ? 'border-cyan-400/30 shadow-glow' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            agent.status === 'working' ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' : 'border-slate-400/15 bg-white/[0.04] text-slate-300'
          }`}>
            <Icon size={19} strokeWidth={1.7} />
          </div>
          <div>
            <div className="text-[13px] font-semibold leading-tight text-slate-100">{agent.agent}</div>
            <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{agent.task}</div>
          </div>
        </div>
        <StatusPill status={agent.status} />
      </div>
      {agent.outputSummary && (
        <p className="mt-3 border-t border-slate-400/10 pt-3 text-[11.5px] leading-relaxed text-slate-400">{agent.outputSummary}</p>
      )}
      {agent.error && (
        <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-400/10 px-2.5 py-2 text-[11.5px] text-rose-300">{agent.error}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-600">
        {duration != null && <span>{duration}s</span>}
        {agent.retryCount > 0 && <span>Retry {agent.retryCount}</span>}
      </div>
    </div>
  );
}
