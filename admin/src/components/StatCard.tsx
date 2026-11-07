import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'purple' | 'gold' | 'emerald' | 'rose' | 'sky';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'purple',
}) => {
  const variantStyles = {
    purple: {
      border: 'border-purple-500/20 hover:border-purple-500/40',
      iconBg: 'bg-purple-950/60 text-purple-400 border-purple-500/30',
      glow: 'shadow-purple-950/20',
      accent: 'text-purple-400',
    },
    gold: {
      border: 'border-amber-500/20 hover:border-amber-500/40',
      iconBg: 'bg-amber-950/60 text-amber-400 border-amber-500/30',
      glow: 'shadow-amber-950/20',
      accent: 'text-amber-400',
    },
    emerald: {
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      iconBg: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30',
      glow: 'shadow-emerald-950/20',
      accent: 'text-emerald-400',
    },
    rose: {
      border: 'border-rose-500/20 hover:border-rose-500/40',
      iconBg: 'bg-rose-950/60 text-rose-400 border-rose-500/30',
      glow: 'shadow-rose-950/20',
      accent: 'text-rose-400',
    },
    sky: {
      border: 'border-sky-500/20 hover:border-sky-500/40',
      iconBg: 'bg-sky-950/60 text-sky-400 border-sky-500/30',
      glow: 'shadow-sky-950/20',
      accent: 'text-sky-400',
    },
  }[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#140C2A]/90 to-[#0C071A]/95 p-5 border ${variantStyles.border} shadow-lg ${variantStyles.glow} transition-all duration-300 hover:-translate-y-0.5`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-xl border ${variantStyles.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <span className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight font-mono">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
};
