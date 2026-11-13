import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApiClient';
import { MiningSettings } from '../types/admin';
import { StatCard } from '../components/StatCard';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Pickaxe, Clock, Zap, Users, ShieldAlert, Check } from 'lucide-react';

export const MiningPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [settings, setSettings] = useState<MiningSettings | null>(null);
  const [baseRate, setBaseRate] = useState<number>(10);
  const [maxHours, setMaxHours] = useState<number>(24);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    const res = await adminApi.getMiningSettings();
    if (res.success && res.data) {
      setSettings(res.data);
      setBaseRate(res.data.baseRatePerHour);
      setMaxHours(res.data.maxAccumulationHours);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasRole(['SUPER_ADMIN', 'ADMIN'])) return;

    setIsSaving(true);
    setSuccessMsg(null);
    const res = await adminApi.updateMiningSettings({
      baseRatePerHour: baseRate,
      maxAccumulationHours: maxHours,
    });
    setIsSaving(false);
    if (res.success) {
      setSuccessMsg('Mining parameters updated and audited successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchSettings();
    } else {
      alert(res.error || 'Failed to update mining settings');
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Base Production"
          value={`+${settings?.baseRatePerHour ?? 10}/hr`}
          subtitle="Default rate for new players"
          icon={Pickaxe}
          variant="gold"
        />
        <StatCard
          title="Accumulation Limit"
          value={`${settings?.maxAccumulationHours ?? 24} Hours`}
          subtitle="Cap before cat stops producing"
          icon={Clock}
          variant="purple"
        />
        <StatCard
          title="Active Miners"
          value={settings?.activeMinersCount ?? 0}
          subtitle="Players with mining settlements"
          icon={Users}
          variant="sky"
        />
        <StatCard
          title="Network Average Rate"
          value={`+${settings?.averageMiningRate ?? 10}/hr`}
          subtitle={`Avg boost: +${settings?.averageBoostRate ?? 0}/hr`}
          icon={Zap}
          variant="emerald"
        />
      </div>

      {/* Configuration Panel */}
      <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#0A0517] border border-purple-900/30 p-6 shadow-xl max-w-2xl">
        <div className="mb-6">
          <h4 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Pickaxe className="w-5 h-5 text-amber-400" />
            <span>Global Mining Engine Rules</span>
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Modifications affect future accrual calculations across all active players.
          </p>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Default Base Rate (TomCoins per Hour)
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={baseRate}
              disabled={!hasRole(['SUPER_ADMIN', 'ADMIN'])}
              onChange={(e) => setBaseRate(parseInt(e.target.value, 10) || 1)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#080413] border border-purple-900/60 text-white font-mono text-sm focus:outline-hidden focus:border-purple-500"
            />
            <span className="text-[11px] text-slate-500 block mt-1">
              Standard base rate is 10 TomCoins/hour (equivalent to 1 USDT every 200 hours at base rate).
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Maximum Offline Accumulation Cap (Hours)
            </label>
            <input
              type="number"
              min={1}
              max={72}
              value={maxHours}
              disabled={!hasRole(['SUPER_ADMIN', 'ADMIN'])}
              onChange={(e) => setMaxHours(parseInt(e.target.value, 10) || 24)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#080413] border border-purple-900/60 text-white font-mono text-sm focus:outline-hidden focus:border-purple-500"
            />
            <span className="text-[11px] text-slate-500 block mt-1">
              Forces users to check in and feed Tom before 24 hours elapse.
            </span>
          </div>

          <div className="pt-2">
            {hasRole(['SUPER_ADMIN', 'ADMIN']) ? (
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? 'Updating...' : 'Save & Publish Rules'}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Requires Super Admin or Admin role to modify production parameters.</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

