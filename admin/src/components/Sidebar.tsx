import React from 'react';
import {
  LayoutDashboard,
  Users,
  Pickaxe,
  Cookie,
  Trophy,
  RotateCw,
  ArrowDownUp,
  Flame,
  FileText,
  Network,
  ShieldAlert,
  LogOut,
  Crown,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Badge } from './Badge';

export type AdminTab =
  | 'dashboard'
  | 'users'
  | 'mining'
  | 'biscuits'
  | 'missions'
  | 'spin'
  | 'payouts'
  | 'campaign'
  | 'transactions'
  | 'referrals'
  | 'audit';

interface SidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { admin, logout } = useAdminAuth();

  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'users' as AdminTab, label: 'User Directory', icon: Users },
    { id: 'mining' as AdminTab, label: 'Mining Engine', icon: Pickaxe },
    { id: 'biscuits' as AdminTab, label: 'Biscuit Catalog', icon: Cookie },
    { id: 'missions' as AdminTab, label: 'Quests & Missions', icon: Trophy },
    { id: 'spin' as AdminTab, label: 'Lucky Wheel', icon: RotateCw },
    { id: 'payouts' as AdminTab, label: 'Payouts & Deposits', icon: ArrowDownUp },
    { id: 'campaign' as AdminTab, label: '5K Celebration', icon: Flame },
    { id: 'transactions' as AdminTab, label: 'Ledger Audit', icon: FileText },
    { id: 'referrals' as AdminTab, label: 'Referral Tree', icon: Network },
    { id: 'audit' as AdminTab, label: 'Admin Audit Trail', icon: ShieldAlert },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#0A0517] border-r border-purple-900/30 flex flex-col justify-between h-screen sticky top-0">
      <div>
        {/* Brand Banner */}
        <div className="p-5 border-b border-purple-900/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950">
            <Crown className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-wide font-display">
              SUPERTOM
            </h1>
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-widest block">
              Control Center
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-900/80 to-purple-800/40 text-white border border-purple-500/40 shadow-md shadow-purple-950/50'
                    : 'text-slate-400 hover:text-white hover:bg-purple-950/30'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-amber-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Admin Profile Footer */}
      <div className="p-4 border-t border-purple-900/30 bg-[#070312]">
        <div className="flex items-center justify-between mb-3">
          <div className="overflow-hidden pr-2">
            <p className="text-xs font-bold text-white truncate">{admin?.name || 'Administrator'}</p>
            <p className="text-[10px] text-slate-400 truncate font-mono">{admin?.email}</p>
          </div>
          {admin?.role && <Badge status={admin.role} />}
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 transition-all shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

