import React from 'react';
import { ShieldCheck, Server } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Badge } from './Badge';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actionButton }) => {
  const { admin } = useAdminAuth();

  return (
    <header className="sticky top-0 z-30 bg-[#0B0717]/80 backdrop-blur-md border-b border-purple-900/30 px-8 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl lg:text-2xl font-black text-white font-display tracking-tight flex items-center gap-3">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {actionButton}

        {/* Live Backend Connection Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <Server className="w-3.5 h-3.5" />
          <span>Render Live</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>

        {/* Admin Role Status */}
        {admin?.role && (
          <div className="flex items-center gap-2 pl-2 border-l border-purple-900/40">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <Badge status={admin.role} />
          </div>
        )}
      </div>
    </header>
  );
};
