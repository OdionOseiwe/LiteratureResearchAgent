import { Link, NavLink, useLocation } from 'react-router-dom';
import { FlaskConical, History, Sparkles, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/research', label: 'Research Workspace' },
  { to: '/history', label: 'History' },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="PRAXIS home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10">
        <FlaskConical className="h-4.5 w-4.5 text-cyan-400" size={18} strokeWidth={1.8} />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-[0.22em] text-slate-50">PRAXIS</span>
        <span className="block text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">Multi-Agent Research</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-400/10 bg-navy-900/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/[0.06] text-cyan-300' : 'text-slate-400 hover:text-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block">
          <Link to="/research" className="btn-primary !px-4 !py-2.5 text-[13px]">
            <Sparkles size={15} /> Start Research
          </Link>
        </div>
        <button
          className="rounded-lg border border-slate-400/15 p-2 text-slate-300 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-400/10 bg-navy-900/95 px-4 pb-4 pt-2 backdrop-blur-xl md:hidden" key={location.pathname}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-white/[0.06] text-cyan-300' : 'text-slate-300'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link to="/research" onClick={() => setOpen(false)} className="btn-primary mt-2 w-full">
            <Sparkles size={15} /> Start Research
          </Link>
        </div>
      )}
    </header>
  );
}
