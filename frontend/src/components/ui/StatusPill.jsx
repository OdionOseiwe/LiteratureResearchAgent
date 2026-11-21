import { Loader2, CheckCircle2, XCircle, Circle, Clock } from 'lucide-react';

const config = {
  pending: { icon: Clock, label: 'Pending', cls: 'text-slate-400 border-slate-500/25 bg-slate-500/10' },
  working: { icon: Loader2, label: 'Working', cls: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10', spin: true },
  completed: { icon: CheckCircle2, label: 'Completed', cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
  failed: { icon: XCircle, label: 'Failed', cls: 'text-rose-300 border-rose-400/30 bg-rose-400/10' },
  skipped: { icon: Circle, label: 'Skipped', cls: 'text-amber-300 border-amber-400/30 bg-amber-400/10' },
};

export default function StatusPill({ status, size = 'sm' }) {
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${c.cls}`}>
      <Icon size={size === 'sm' ? 12 : 14} className={c.spin ? 'animate-spin' : ''} strokeWidth={2.2} />
      {c.label}
    </span>
  );
}
