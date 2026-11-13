import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApiClient';
import { ReferralStats } from '../types/admin';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { Network, Trophy, AlertTriangle, Users, RefreshCw } from 'lucide-react';

export const ReferralsPage: React.FC = () => {
  const [data, setData] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReferrals = async () => {
    setIsLoading(true);
    const res = await adminApi.getReferrals();
    if (res.success && res.data) {
      setData(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white font-display">Referral Network & Abuse Detection</h3>
          <p className="text-xs text-slate-400">Track player invite statistics and investigate bot rings.</p>
        </div>
        <button
          onClick={fetchReferrals}
          disabled={isLoading}
          className="p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-900/40 text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Referrals"
          value={data?.overview.totalReferrals ?? 0}
          subtitle="Successful player attributions"
          icon={Users}
          variant="purple"
        />
        <StatCard
          title="Referral Bonuses Paid"
          value={data?.overview.totalRewardsDistributed ?? 0}
          subtitle="450 TomCoins signup bounty"
          icon={Trophy}
          variant="gold"
        />
        <StatCard
          title="Commission Paid Out"
          value={data?.overview.totalCommissionsPaid ?? 0}
          subtitle="10% ongoing mining cut"
          icon={Network}
          variant="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Referrers */}
        <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#090414] border border-purple-900/30 p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Top 10 Royal Ambassadors
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090415] text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Ambassador</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Invites</th>
                  <th className="py-2.5 px-3">Balance</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20">
                {data?.topReferrers && data.topReferrers.length > 0 ? (
                  data.topReferrers.map((r, i) => (
                    <tr key={r.userId} className="hover:bg-purple-950/20">
                      <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                        <span className="text-amber-400 font-mono text-[11px]">#{i + 1}</span>
                        <span>@{r.username}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-purple-300">{r.referralCode}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{r.refereesCount}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-400">{r.balance.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <Badge status={r.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono text-xs">
                      No referrals recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Suspicious Activity Investigator */}
        <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#090414] border border-purple-900/30 p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Abuse & Bot Ring Investigation
            </h4>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Accounts with suspicious behavior (such as banned referrers or rapid unverified invites).
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090415] text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Telegram ID</th>
                  <th className="py-2.5 px-3">Referees</th>
                  <th className="py-2.5 px-3">Flagged Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20">
                {data?.suspicious && data.suspicious.length > 0 ? (
                  data.suspicious.map((s) => (
                    <tr key={s.userId} className="hover:bg-purple-950/20">
                      <td className="py-2.5 px-3 font-bold text-white">@{s.username || s.telegramId}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{s.telegramId}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-400">{s.refereesCount}</td>
                      <td className="py-2.5 px-3">
                        <Badge status={s.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-emerald-400 font-mono text-xs">
                      ✔ Zero suspicious referral anomalies detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

