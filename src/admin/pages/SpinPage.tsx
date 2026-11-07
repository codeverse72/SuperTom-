import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApiClient';
import { SpinConfig, SpinRewardItem } from '../types/admin';
import { useAdminAuth } from '../context/AdminAuthContext';
import { RotateCw, ShieldCheck, AlertCircle, Check, Clock } from 'lucide-react';

export const SpinPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [rewards, setRewards] = useState<SpinRewardItem[]>([]);
  const [milestone1, setMilestone1] = useState(2);
  const [milestone2, setMilestone2] = useState(4);
  const [milestone3, setMilestone3] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProb, setIsSavingProb] = useState(false);
  const [isSavingCooldown, setIsSavingCooldown] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    const res = await adminApi.getSpinConfig();
    if (res.success && res.data) {
      setConfig(res.data);
      setRewards(res.data.rewards);
      setMilestone1(res.data.cooldowns.milestone1Hours);
      setMilestone2(res.data.cooldowns.milestone2Hours);
      setMilestone3(res.data.cooldowns.milestone3Hours);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const totalPercentage = rewards.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0);
  const isSumValid = Math.abs(totalPercentage - 100) < 0.001;

  const handleUpdatePercentage = (id: string, val: number) => {
    setRewards((prev) =>
      prev.map((r) => (r.id === id ? { ...r, percentage: val } : r))
    );
  };

  const handleSaveProbabilities = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSumValid) {
      alert(`Probabilities must total exactly 100%. Current total: ${totalPercentage.toFixed(3)}%`);
      return;
    }

    setIsSavingProb(true);
    setSuccessMsg(null);
    const res = await adminApi.updateSpinProbabilities(rewards);
    setIsSavingProb(false);

    if (res.success) {
      setSuccessMsg('Probabilities successfully validated and applied server-side.');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchConfig();
    } else {
      alert(res.error || 'Failed to update probabilities');
    }
  };

  const handleSaveCooldowns = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCooldown(true);
    setSuccessMsg(null);
    const res = await adminApi.updateSpinCooldowns({
      milestone1Hours: milestone1,
      milestone2Hours: milestone2,
      milestone3Hours: milestone3,
    });
    setIsSavingCooldown(false);

    if (res.success) {
      setSuccessMsg('Spin milestone cooldowns updated.');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchConfig();
    } else {
      alert(res.error || 'Failed to update cooldowns');
    }
  };

  const handleResetCooldown = async (resetAll: boolean) => {
    if (!resetAll && !resetIdentifier.trim()) {
      alert('Please enter a username or Telegram ID to reset.');
      return;
    }

    if (resetAll && !confirm('Are you sure you want to unlock free spin immediately for ALL players?')) {
      return;
    }

    setIsResetting(true);
    setSuccessMsg(null);
    const res = await adminApi.resetSpinCooldown({
      identifier: resetAll ? undefined : resetIdentifier.trim(),
      resetAll,
    });
    setIsResetting(false);

    if (res.success) {
      setSuccessMsg(res.data?.message || 'Spin cooldown reset successfully!');
      setResetIdentifier('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      alert(res.error || 'Failed to reset cooldown');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white font-display">Lucky Wheel Cryptographic Probability</h3>
          <p className="text-xs text-slate-400">
            Enforce strict mathematical odds for spin wheel outcomes. Total spins awarded: {config?.totalSpinsAwarded ?? 0}.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Probabilities Form */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-b from-[#120A25] to-[#0A0617] border border-purple-900/30 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-amber-400" />
              <span>Reward Probabilities Distribution</span>
            </h4>
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                isSumValid
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
              }`}
            >
              {isSumValid ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>Total: {totalPercentage.toFixed(2)}%</span>
            </div>
          </div>

          <form onSubmit={handleSaveProbabilities} className="space-y-3">
            <div className="rounded-xl border border-purple-900/40 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090415] text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Reward Segment</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Probability %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/20">
                  {rewards.map((r) => (
                    <tr key={r.id} className="hover:bg-purple-950/20">
                      <td className="py-2.5 px-3 font-bold text-white">{r.label}</td>
                      <td className="py-2.5 px-3 font-mono uppercase text-slate-400 text-[11px]">{r.rewardType}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-400">
                        {r.amount ? `${r.amount} Poops` : r.biscuitId}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            disabled={!hasRole(['SUPER_ADMIN'])}
                            value={r.percentage}
                            onChange={(e) =>
                              handleUpdatePercentage(r.id, parseFloat(e.target.value) || 0)
                            }
                            className="w-20 px-2 py-1 rounded-lg bg-[#080413] border border-purple-900/60 text-right text-white font-mono text-xs focus:outline-hidden focus:border-purple-500 disabled:opacity-50"
                          />
                          <span className="text-slate-500 font-mono">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 flex items-center justify-between">
              <p className="text-[11px] text-slate-500">
                Default: 100 Poops is 99.0%, remaining rewards combined equal 1.0%.
              </p>
              {hasRole(['SUPER_ADMIN']) && (
                <button
                  type="submit"
                  disabled={isSavingProb || !isSumValid}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingProb ? 'Validating...' : 'Apply Probability Table'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Milestone Cooldowns */}
        <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#0A0617] border border-purple-900/30 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Progressive Timer Sequence
              </h4>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Standard cooldown pattern: Milestone 1 (2h) → Milestone 2 (4h) → Milestone 3 (8h).
            </p>

            <form onSubmit={handleSaveCooldowns} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Milestone 1 Cooldown (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  disabled={!hasRole(['SUPER_ADMIN', 'ADMIN'])}
                  value={milestone1}
                  onChange={(e) => setMilestone1(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-[#080413] border border-purple-900/60 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Milestone 2 Cooldown (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  disabled={!hasRole(['SUPER_ADMIN', 'ADMIN'])}
                  value={milestone2}
                  onChange={(e) => setMilestone2(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-[#080413] border border-purple-900/60 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Milestone 3 Cooldown (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  disabled={!hasRole(['SUPER_ADMIN', 'ADMIN'])}
                  value={milestone3}
                  onChange={(e) => setMilestone3(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-[#080413] border border-purple-900/60 text-white font-mono"
                />
              </div>

              {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                <button
                  type="submit"
                  disabled={isSavingCooldown}
                  className="w-full mt-4 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-white font-bold transition-all"
                >
                  {isSavingCooldown ? 'Saving...' : 'Update Cooldowns'}
                </button>
              )}
            </form>

            {/* Instant Unlock & Cooldown Reset Section */}
            {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
              <div className="mt-5 pt-4 border-t border-purple-900/30 space-y-3">
                <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Instant Free Spin Unlock</span>
                </h5>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Manually reset the spin timer to zero for test accounts or all players.
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Player username or Telegram ID..."
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#080413] border border-purple-900/60 text-white text-xs font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isResetting || !resetIdentifier.trim()}
                      onClick={() => handleResetCooldown(false)}
                      className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-purple-950 font-black text-xs transition-all disabled:opacity-40"
                    >
                      {isResetting ? 'Resetting...' : 'Unlock Free Spin'}
                    </button>
                    <button
                      type="button"
                      disabled={isResetting}
                      onClick={() => handleResetCooldown(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-950 border border-purple-800 text-purple-300 hover:text-white font-bold text-[11px] transition-all"
                      title="Reset for everyone"
                    >
                      Reset All
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-purple-900/30 text-center">
            <span className="text-[11px] text-slate-500">
              CSPRNG uniformity checked via Crypto Suite
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

