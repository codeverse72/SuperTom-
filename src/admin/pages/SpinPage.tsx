import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApiClient';
import { SpinConfig, SpinRewardItem } from '../types/admin';
import { useAdminAuth } from '../context/AdminAuthContext';
import { RotateCw, ShieldCheck, AlertCircle, Check, Clock, Sparkles, SlidersHorizontal, RefreshCw } from 'lucide-react';

const REWARD_COLORS: Record<string, string> = {
  'poop-100': '#8b5cf6', // purple
  'poop-300': '#06b6d4', // cyan
  'poop-250': '#3b82f6', // electric blue
  'poop-750': '#f59e0b', // amber orange
  'poop-0': '#64748b',   // slate neutral
  'poop-525': '#10b981', // emerald
  'poop-1000': '#ec4899', // hot pink
};

export const SpinPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [rewards, setRewards] = useState<SpinRewardItem[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [milestone1, setMilestone1] = useState(2);
  const [milestone2, setMilestone2] = useState(4);
  const [milestone3, setMilestone3] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProb, setIsSavingProb] = useState(false);
  const [isSavingCooldown, setIsSavingCooldown] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const syncRewardsToInputs = (items: SpinRewardItem[]) => {
    const map: Record<string, string> = {};
    items.forEach((r) => {
      map[r.id] = String(r.percentage);
    });
    setInputs(map);
  };

  const fetchConfig = async () => {
    setIsLoading(true);
    const res = await adminApi.getSpinConfig();
    if (res.success && res.data) {
      setConfig(res.data);
      setRewards(res.data.rewards);
      syncRewardsToInputs(res.data.rewards);
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
  const isSumValid = Math.abs(totalPercentage - 100) < 0.05;

  const handleInputChange = (id: string, text: string) => {
    setInputs((prev) => ({ ...prev, [id]: text }));
    const parsed = parseFloat(text);
    const val = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setRewards((prev) =>
      prev.map((r) => (r.id === id ? { ...r, percentage: val } : r))
    );
  };

  const handleInputBlur = (id: string) => {
    const current = inputs[id];
    const parsed = parseFloat(current);
    const val = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setInputs((prev) => ({ ...prev, [id]: String(val) }));
    setRewards((prev) =>
      prev.map((r) => (r.id === id ? { ...r, percentage: val } : r))
    );
  };

  /**
   * Auto-balances percentages so they sum to exactly 100.00%.
   */
  const handleAutoBalance = () => {
    const rawSum = rewards.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0);
    if (rawSum <= 0) {
      // If all 0, distribute equally
      const each = Number((100 / rewards.length).toFixed(2));
      const balanced = rewards.map((r) => ({ ...r, percentage: each }));
      const sum = balanced.reduce((a, b) => a + b.percentage, 0);
      balanced[0].percentage = Number((balanced[0].percentage + (100 - sum)).toFixed(2));
      setRewards(balanced);
      syncRewardsToInputs(balanced);
      return;
    }

    const balanced = rewards.map((r) => ({
      ...r,
      percentage: Number(((r.percentage / rawSum) * 100).toFixed(2)),
    }));

    const curSum = balanced.reduce((a, b) => a + b.percentage, 0);
    const residue = Number((100 - curSum).toFixed(2));
    if (residue !== 0 && balanced.length > 0) {
      let maxIdx = 0;
      for (let i = 1; i < balanced.length; i++) {
        if (balanced[i].percentage > balanced[maxIdx].percentage) {
          maxIdx = i;
        }
      }
      balanced[maxIdx].percentage = Number((balanced[maxIdx].percentage + residue).toFixed(2));
    }

    setRewards(balanced);
    syncRewardsToInputs(balanced);
    setSuccessMsg('Probabilities auto-balanced to exactly 100.00%!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  /**
   * Apply Quick Preset distributions
   */
  const handleApplyPreset = (presetName: 'default' | 'equal' | 'player_favored') => {
    let preset: Record<string, number> = {};

    if (presetName === 'default') {
      // King Tom Recommended distribution: (250 poops: 15%, 525 poops: 20%, 100 poops: 25%, 0 poops: 20%, 300: 16%, 750: 3%, 1000: 1%)
      preset = {
        'poop-100': 25.0,
        'poop-300': 16.0,
        'poop-250': 15.0,
        'poop-750': 3.0,
        'poop-0': 20.0,
        'poop-525': 20.0,
        'poop-1000': 1.0,
      };
    } else if (presetName === 'equal') {
      // 14.28% each across 7 segments
      preset = {
        'poop-100': 14.29,
        'poop-300': 14.29,
        'poop-250': 14.28,
        'poop-750': 14.28,
        'poop-0': 14.28,
        'poop-525': 14.29,
        'poop-1000': 14.29,
      };
    } else if (presetName === 'player_favored') {
      // Low 0 Poops, high wins
      preset = {
        'poop-100': 25.0,
        'poop-300': 20.0,
        'poop-250': 20.0,
        'poop-750': 10.0,
        'poop-0': 5.0,
        'poop-525': 15.0,
        'poop-1000': 5.0,
      };
    }

    const updated = rewards.map((r) => ({
      ...r,
      percentage: preset[r.id] !== undefined ? preset[r.id] : r.percentage,
    }));

    setRewards(updated);
    syncRewardsToInputs(updated);
    setSuccessMsg(`Applied preset: ${presetName.toUpperCase()}`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveProbabilities = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (totalPercentage <= 0) {
      setErrorMsg('Total percentage must be greater than 0%');
      return;
    }

    setIsSavingProb(true);
    setSuccessMsg(null);

    const res = await adminApi.updateSpinProbabilities(rewards);
    setIsSavingProb(false);

    if (res.success) {
      setSuccessMsg('Spin probabilities successfully validated, auto-normalized, and applied in real-time!');
      if (res.data && (res.data as any).rewards) {
        setRewards((res.data as any).rewards);
        syncRewardsToInputs((res.data as any).rewards);
      }
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchConfig();
    } else {
      setErrorMsg(res.error || 'Failed to update probabilities');
    }
  };

  const handleSaveCooldowns = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCooldown(true);
    setSuccessMsg(null);
    setErrorMsg(null);
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
      setErrorMsg(res.error || 'Failed to update cooldowns');
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
    setErrorMsg(null);
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
      setErrorMsg(res.error || 'Failed to reset cooldown');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white font-display">Lucky Wheel Cryptographic Probability</h3>
          <p className="text-xs text-slate-400">
            Control wheel segment odds in real-time. Changes are applied server-side instantly with CSPRNG weighting. Total spins: {config?.totalSpinsAwarded ?? 0}.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchConfig}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Probabilities Form */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-b from-[#120A25] to-[#0A0617] border border-purple-900/30 p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-amber-400" />
              <span>Reward Probabilities Distribution</span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoBalance}
                className="px-2.5 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 text-purple-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                title="Automatically adjusts percentages to equal exactly 100%"
              >
                <SlidersHorizontal className="w-3 h-3 text-amber-300" />
                <span>Auto-Balance 100%</span>
              </button>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                  isSumValid
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                }`}
              >
                {isSumValid ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>Total: {totalPercentage.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Real-time Segment Distribution Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Visual Segment Weighting</span>
              <span>100% Total Scale</span>
            </div>
            <div className="w-full h-4 rounded-lg bg-black/60 overflow-hidden flex p-0.5 border border-purple-900/50">
              {rewards.map((r) => {
                const widthPct = Math.max(0, (Number(r.percentage) || 0));
                if (widthPct <= 0) return null;
                const col = REWARD_COLORS[r.id] || '#8b5cf6';
                return (
                  <div
                    key={r.id}
                    style={{ width: `${widthPct}%`, backgroundColor: col }}
                    className="h-full transition-all duration-200 relative group cursor-pointer first:rounded-l-md last:rounded-r-md"
                    title={`${r.label}: ${widthPct.toFixed(2)}%`}
                  />
                );
              })}
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Presets:</span>
            </span>
            <button
              type="button"
              onClick={() => handleApplyPreset('default')}
              className="px-2.5 py-1 rounded-lg bg-[#0c061a] hover:bg-purple-950 border border-purple-800/60 text-purple-200 text-[11px] font-mono cursor-pointer transition-colors"
            >
              King Tom Standard
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('equal')}
              className="px-2.5 py-1 rounded-lg bg-[#0c061a] hover:bg-purple-950 border border-purple-800/60 text-purple-200 text-[11px] font-mono cursor-pointer transition-colors"
            >
              Equal Odds (14.28%)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('player_favored')}
              className="px-2.5 py-1 rounded-lg bg-[#0c061a] hover:bg-purple-950 border border-purple-800/60 text-emerald-300 text-[11px] font-mono cursor-pointer transition-colors"
            >
              Player-Favored (Low 0s)
            </button>
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
                  {rewards.map((r) => {
                    const segColor = REWARD_COLORS[r.id] || '#8b5cf6';
                    return (
                      <tr key={r.id} className="hover:bg-purple-950/20">
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: segColor }} />
                          <span>{r.label}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono uppercase text-slate-400 text-[11px]">
                          {r.rewardType}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-400">
                          {r.amount !== undefined ? `${r.amount} Poops` : r.biscuitId || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              disabled={!hasRole(['SUPER_ADMIN', 'ADMIN'])}
                              value={inputs[r.id] ?? String(r.percentage)}
                              onChange={(e) => handleInputChange(r.id, e.target.value)}
                              onBlur={() => handleInputBlur(r.id)}
                              className="w-24 px-2 py-1 rounded-lg bg-[#080413] border border-purple-900/60 text-right text-white font-mono text-xs focus:outline-hidden focus:border-purple-400 disabled:opacity-50"
                            />
                            <span className="text-slate-500 font-mono">%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400 leading-tight">
                {isSumValid
                  ? 'Ready to save. Segments equal 100%.'
                  : `Note: Current sum is ${totalPercentage.toFixed(2)}%. Click save and it will automatically normalize to 100%.`}
              </p>
              {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                <button
                  type="submit"
                  disabled={isSavingProb || totalPercentage <= 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:brightness-110 active:scale-95 text-white text-xs font-black shadow-lg shadow-purple-900/40 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingProb ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving & Normalizing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply Probability Table</span>
                    </>
                  )}
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
                  className="w-full mt-4 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-white font-bold transition-all cursor-pointer"
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
                      className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-purple-950 font-black text-xs transition-all disabled:opacity-40 cursor-pointer"
                    >
                      {isResetting ? 'Resetting...' : 'Unlock Free Spin'}
                    </button>
                    <button
                      type="button"
                      disabled={isResetting}
                      onClick={() => handleResetCooldown(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-950 border border-purple-800 text-purple-300 hover:text-white font-bold text-[11px] transition-all cursor-pointer"
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
