import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Flame,
  CheckCircle2,
  RefreshCw,
  Clock,
  Play,
  Download,
  AlertCircle,
  Save,
  Users,
  Coins,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { adminApi } from '../services/adminApiClient';
import { Badge } from '../components/Badge';

export const CampaignPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [isActive, setIsActive] = useState(true);
  const [title, setTitle] = useState('5K Members Celebration');
  const [description, setDescription] = useState('');
  const [minDeposit, setMinDeposit] = useState(5.0);
  const [maxDeposit, setMaxDeposit] = useState(10.0);
  const [cashbackPercent, setCashbackPercent] = useState(30.0);
  const [dailyRewardPoops, setDailyRewardPoops] = useState(2000);
  const [minRewardDays, setMinRewardDays] = useState(5);
  const [maxRewardDays, setMaxRewardDays] = useState(13);
  const [allowMultipleCashbacks, setAllowMultipleCashbacks] = useState(false);

  const fetchCampaign = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await (adminApi as any).getCampaignConfig();
      if (res.success && res.data) {
        setData(res.data);
        const c = res.data.campaign;
        setIsActive(c.isActive);
        setTitle(c.title);
        setDescription(c.description || '');
        setMinDeposit(c.minDepositUsdt);
        setMaxDeposit(c.maxDepositUsdt);
        setCashbackPercent(c.cashbackPercent);
        setDailyRewardPoops(c.dailyRewardPoops);
        setMinRewardDays(c.minRewardDays);
        setMaxRewardDays(c.maxRewardDays);
        setAllowMultipleCashbacks(c.allowMultipleCashbacks);
      } else {
        setErrorMessage(res.error || 'Failed to load campaign data');
      }
    } catch {
      setErrorMessage('Network error fetching campaign data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      const res = await (adminApi as any).updateCampaignConfig({
        isActive,
        title,
        description,
        minDepositUsdt: Number(minDeposit),
        maxDepositUsdt: Number(maxDeposit),
        cashbackPercent: Number(cashbackPercent),
        dailyRewardPoops: Number(dailyRewardPoops),
        minRewardDays: Number(minRewardDays),
        maxRewardDays: Number(maxRewardDays),
        allowMultipleCashbacks,
      });

      if (res.success) {
        setSaveMessage('Campaign configuration updated successfully!');
        fetchCampaign();
      } else {
        setErrorMessage(res.error || 'Failed to update campaign configuration');
      }
    } catch {
      setErrorMessage('Network error updating campaign configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerProcessor = async () => {
    if (!confirm('Execute scheduled daily reward processor now? Eligible participants will receive their daily 2,000 Poops.')) {
      return;
    }

    setIsProcessing(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      const res = await (adminApi as any).triggerProcessDailyRewards();
      if (res.success) {
        setSaveMessage(res.data?.message || 'Daily reward processing completed successfully!');
        fetchCampaign();
      } else {
        setErrorMessage(res.error || 'Failed to process daily rewards');
      }
    } catch {
      setErrorMessage('Network error executing daily reward processor');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportData = async () => {
    try {
      const res = await (adminApi as any).exportCampaignParticipants();
      if (res.success && res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `supertom_5k_campaign_participants_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(res.error || 'Export failed');
      }
    } catch {
      alert('Network error exporting campaign data');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-amber-400" />
        <span>Loading 5K Members Celebration Campaign...</span>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentParticipations = data?.recentParticipations || [];

  return (
    <div className="space-y-6">
      {/* Top Controls & Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0e0720] border border-purple-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
            <Trophy className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white font-display">
                5K Members Celebration Campaign
              </h2>
              <Badge status={isActive ? 'ACTIVE' : 'DISABLED'} />
            </div>
            <p className="text-xs text-slate-400">
              30% Instant Cashback + $1 USDT (2,000 Poops/day) tiered daily reward engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleTriggerProcessor}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run Reward Processor</span>
          </button>

          <button
            type="button"
            onClick={handleExportData}
            className="px-3.5 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0c061a] border border-purple-900/40 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Enrolled</span>
          <div className="text-2xl font-black text-white font-mono flex items-baseline gap-1.5">
            <span>{stats.totalParticipants ?? 0}</span>
            <span className="text-xs font-normal text-emerald-400">({stats.activeParticipants ?? 0} active)</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Unique eligible users</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c061a] border border-purple-900/40 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Qualifying Volume</span>
          <div className="text-2xl font-black text-amber-400 font-mono">
            ${(stats.totalQualifyingVolumeUsdt ?? 0).toFixed(2)} USDT
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Total verified deposit volume</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c061a] border border-purple-900/40 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">30% Cashback Paid</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {(stats.totalCashbackPoopsAwarded ?? 0).toLocaleString()} 💩
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            ≈ ${((stats.totalCashbackPoopsAwarded ?? 0) / 2000).toFixed(2)} USDT value
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c061a] border border-purple-900/40 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Daily Rewards Disbursed</span>
          <div className="text-2xl font-black text-cyan-400 font-mono">
            {(stats.totalDailyRewardsPoopsAwarded ?? 0).toLocaleString()} 💩
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            Across {stats.totalDailyRewardsCount ?? 0} daily rewards
          </span>
        </div>
      </div>

      {/* Main Configuration Form & Reward Tier Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Configuration Form */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0c061a] border border-purple-900/40 shadow-xl space-y-4">
          <div className="border-b border-purple-900/30 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white font-display">
                Campaign Rules & Eligibility Settings
              </h3>
              <p className="text-xs text-slate-400">
                Configure minimum thresholds, percentages, and multi-deposit rules.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-900/30">
              <div>
                <span className="font-bold text-white block">Campaign Active Status</span>
                <span className="text-[11px] text-slate-400">
                  When enabled, verified deposits of $5 to $10 automatically receive cashback and daily rewards.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Min Qualifying Deposit ($ USDT)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={minDeposit}
                  onChange={(e) => setMinDeposit(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#05020d] border border-purple-900/60 text-white font-mono font-bold focus:border-amber-400 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Standard: $5.00</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Max Tier Deposit Cap ($ USDT)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="5"
                  required
                  value={maxDeposit}
                  onChange={(e) => setMaxDeposit(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#05020d] border border-purple-900/60 text-white font-mono font-bold focus:border-amber-400 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Standard: $10.00</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Instant Cashback Percentage (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  required
                  value={cashbackPercent}
                  onChange={(e) => setCashbackPercent(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#05020d] border border-purple-900/60 text-white font-mono font-bold focus:border-amber-400 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Standard: 30%</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Daily Reward Rate (Poops/day)
                </label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  required
                  value={dailyRewardPoops}
                  onChange={(e) => setDailyRewardPoops(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-[#05020d] border border-purple-900/60 text-white font-mono font-bold focus:border-amber-400 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Standard: 2,000 (=$1.00 USDT)</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Min Reward Days ($5 Tier)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={minRewardDays}
                  onChange={(e) => setMinRewardDays(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-[#05020d] border border-purple-900/60 text-white font-mono font-bold focus:border-amber-400 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Standard: 5 Days</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Max Reward Days ($10 Tier)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={maxRewardDays}
                  onChange={(e) => setMaxRewardDays(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-[#05020d] border border-purple-900/60 text-white font-mono font-bold focus:border-amber-400 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Standard: 13 Days</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-900/30">
              <div>
                <span className="font-bold text-white block">Allow Multiple Cashbacks per User</span>
                <span className="text-[11px] text-slate-400">
                  Section 6 Policy: When disabled (default), only the first qualifying deposit triggers rewards.
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowMultipleCashbacks}
                onChange={(e) => setAllowMultipleCashbacks(e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-purple-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Campaign Settings</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Col: Live Reward Matrix Table */}
        <div className="p-5 rounded-2xl bg-[#0c061a] border border-purple-900/40 shadow-xl space-y-3">
          <div className="border-b border-purple-900/30 pb-2 flex items-center gap-2 text-white">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black font-display">Deposit Reward Schedule</h3>
          </div>
          <p className="text-xs text-slate-400">
            Formula: <code className="text-amber-300">FLOOR(5 + (Deposit - 5) × 1.6)</code>
          </p>

          <div className="overflow-hidden rounded-xl border border-purple-900/40 text-xs">
            <table className="w-full text-left">
              <thead className="bg-purple-950/60 text-slate-300 font-bold border-b border-purple-900/40">
                <tr>
                  <th className="p-2">Deposit</th>
                  <th className="p-2">Cashback</th>
                  <th className="p-2">Days</th>
                  <th className="p-2 text-right">Total Daily</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20 text-slate-200 font-mono">
                <tr className="hover:bg-purple-900/20">
                  <td className="p-2 font-bold text-white">$5.00</td>
                  <td className="p-2 text-emerald-400">3,000 💩</td>
                  <td className="p-2 text-cyan-300">5 days</td>
                  <td className="p-2 text-right text-amber-300">10,000 💩</td>
                </tr>
                <tr className="hover:bg-purple-900/20">
                  <td className="p-2 font-bold text-white">$6.00</td>
                  <td className="p-2 text-emerald-400">3,600 💩</td>
                  <td className="p-2 text-cyan-300">6 days</td>
                  <td className="p-2 text-right text-amber-300">12,000 💩</td>
                </tr>
                <tr className="hover:bg-purple-900/20">
                  <td className="p-2 font-bold text-white">$7.00</td>
                  <td className="p-2 text-emerald-400">4,200 💩</td>
                  <td className="p-2 text-cyan-300">8 days</td>
                  <td className="p-2 text-right text-amber-300">16,000 💩</td>
                </tr>
                <tr className="hover:bg-purple-900/20">
                  <td className="p-2 font-bold text-white">$8.00</td>
                  <td className="p-2 text-emerald-400">4,800 💩</td>
                  <td className="p-2 text-cyan-300">9 days</td>
                  <td className="p-2 text-right text-amber-300">18,000 💩</td>
                </tr>
                <tr className="hover:bg-purple-900/20">
                  <td className="p-2 font-bold text-white">$9.00</td>
                  <td className="p-2 text-emerald-400">5,400 💩</td>
                  <td className="p-2 text-cyan-300">11 days</td>
                  <td className="p-2 text-right text-amber-300">22,000 💩</td>
                </tr>
                <tr className="bg-amber-950/20 font-bold">
                  <td className="p-2 text-amber-300">$10.00</td>
                  <td className="p-2 text-emerald-400">6,000 💩</td>
                  <td className="p-2 text-cyan-300">13 days</td>
                  <td className="p-2 text-right text-amber-300">26,000 💩</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Participants Table */}
      <div className="p-5 rounded-2xl bg-[#0c061a] border border-purple-900/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white font-display">
              Eligible Participants ({recentParticipations.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Server-authoritative schedules and daily progress
          </span>
        </div>

        {recentParticipations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No participants enrolled in the 5K Members Celebration yet. Qualifying deposits of $5–$10 will appear here automatically!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-purple-950/40 text-slate-400 uppercase text-[10px] tracking-wider border-b border-purple-900/30">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3">Qualifying Deposit</th>
                  <th className="p-3">30% Cashback</th>
                  <th className="p-3">Daily Progress</th>
                  <th className="p-3">Total Daily Paid</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Enrolled Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20 text-slate-300 font-mono">
                {recentParticipations.map((p: any) => (
                  <tr key={p.id} className="hover:bg-purple-900/20 transition-colors">
                    <td className="p-3">
                      <span className="font-sans font-bold text-white block">
                        {p.username ? `@${p.username}` : p.firstName || 'Telegram User'}
                      </span>
                      <span className="text-[10px] text-slate-500">ID: {p.telegramId || p.userId.slice(0, 8)}</span>
                    </td>
                    <td className="p-3 font-bold text-amber-400">
                      ${p.qualifyingDepositAmount.toFixed(2)} USDT
                    </td>
                    <td className="p-3 text-emerald-400 font-bold">
                      +{p.cashbackPoops.toLocaleString()} 💩
                    </td>
                    <td className="p-3 text-cyan-300 font-bold">
                      {p.daysClaimed} / {p.totalRewardDays} Days
                    </td>
                    <td className="p-3 text-purple-300">
                      +{p.totalDailyPoopsCredited.toLocaleString()} 💩
                    </td>
                    <td className="p-3 font-sans">
                      <Badge status={p.status} />
                    </td>
                    <td className="p-3 text-right font-sans text-slate-400 text-[11px]">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
