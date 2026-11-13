import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApiClient';
import { DashboardStats } from '../types/admin';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import {
  Users,
  Coins,
  Pickaxe,
  ArrowDownRight,
  ArrowUpRight,
  Trophy,
  Share2,
  RefreshCw,
  TrendingUp,
  Clock,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    const res = await adminApi.getDashboardStats();
    if (res.success && res.data) {
      setStats(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white font-display">System Overview & Analytics</h3>
          <p className="text-xs text-slate-400">Live operational data from Supabase PostgreSQL.</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Metrics Row 1: Users & Economy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Players"
          value={stats?.users.total ?? 0}
          subtitle={`${stats?.users.active ?? 0} active • ${stats?.users.newLast24h ?? 0} new today`}
          icon={Users}
          variant="purple"
        />
        <StatCard
          title="TomCoins In Circulation"
          value={stats?.economy.poopsInCirculation ?? 0}
          subtitle={`≈ $${((stats?.economy.poopsInCirculation ?? 0) / 2000).toFixed(2)} USDT`}
          icon={Coins}
          variant="gold"
        />
        <StatCard
          title="Total TomCoins Mined"
          value={stats?.economy.totalPoopsMined ?? 0}
          subtitle="Accrued from royal cat mining"
          icon={Pickaxe}
          variant="emerald"
        />
        <StatCard
          title="Pending Withdrawals"
          value={`$${(stats?.withdrawals.pendingUsdt ?? 0).toFixed(2)}`}
          subtitle={`${stats?.withdrawals.pendingCount ?? 0} requests awaiting review`}
          icon={ArrowDownRight}
          variant={stats && stats.withdrawals.pendingCount > 0 ? 'rose' : 'sky'}
        />
      </div>

      {/* Metrics Row 2: Secondary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Paid Out"
          value={`$${(stats?.withdrawals.completedUsdt ?? 0).toFixed(2)} USDT`}
          subtitle={`${stats?.withdrawals.completedCount ?? 0} withdrawals completed`}
          icon={ArrowUpRight}
          variant="emerald"
        />
        <StatCard
          title="Quests Completed"
          value={stats?.missions.totalCompleted ?? 0}
          subtitle={`Across ${stats?.missions.totalCatalog ?? 0} catalog missions`}
          icon={Trophy}
          variant="gold"
        />
        <StatCard
          title="Referral Network"
          value={stats?.referrals.totalReferrals ?? 0}
          subtitle={`${(stats?.referrals.totalBonusesDistributed ?? 0).toLocaleString()} TomCoins awarded`}
          icon={Share2}
          variant="purple"
        />
      </div>

      {/* Growth Chart & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Registration Velocity Chart */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-b from-[#140C2A] to-[#0A0617] border border-purple-900/40 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Player Registration Velocity (7 Days)</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Real daily new player signups.</p>
            </div>
            <span className="text-xs font-mono text-purple-400 bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-900/60">
              Live DB
            </span>
          </div>

          {stats?.users.growthChart && stats.users.growthChart.length > 0 ? (
            <div className="flex items-end gap-3 h-48 pt-4">
              {stats.users.growthChart.map((bar, idx) => {
                const max = Math.max(...stats.users.growthChart.map((b) => b.count), 5);
                const heightPercent = Math.max(8, Math.round((bar.count / max) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[10px] font-mono font-bold text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      {bar.count}
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full rounded-t-lg bg-gradient-to-t from-purple-800 to-amber-400 hover:from-purple-700 hover:to-amber-300 transition-all shadow-md shadow-purple-950"
                    />
                    <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                      {bar.date.substring(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-xs font-mono">
              No historical registration points recorded yet.
            </div>
          )}
        </div>

        {/* Live Admin Audit Activity Feed */}
        <div className="rounded-2xl bg-gradient-to-b from-[#140C2A] to-[#0A0617] border border-purple-900/40 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Recent Audit Trail</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">Latest 5</span>
            </div>

            <div className="space-y-3">
              {stats?.recentActivity.auditLogs && stats.recentActivity.auditLogs.length > 0 ? (
                stats.recentActivity.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/30 flex items-start justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-200">{log.action}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        By <span className="text-amber-400 font-semibold">{log.adminName}</span> ({log.role})
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No administrative actions logged yet.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-purple-900/30 text-center">
            <span className="text-[11px] text-slate-500">
              Double-entry balance ledger is synced and immutable.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

