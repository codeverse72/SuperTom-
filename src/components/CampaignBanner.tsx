import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Clock, 
  Gift, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Flame, 
  DollarSign, 
  ArrowRight 
} from 'lucide-react';
import { campaignService } from '../services/campaignService';
import { CampaignStatusResponseDto } from '../services/types';

interface CampaignBannerProps {
  onApplyDeposit?: (amount: number) => void;
}

export const CampaignBanner: React.FC<CampaignBannerProps> = ({ onApplyDeposit }) => {
  const [data, setData] = useState<CampaignStatusResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);

  const fetchCampaign = async () => {
    try {
      const res = await campaignService.getStatus();
      if (res.success && res.data) {
        setData(res.data);
        if (res.data.participation?.nextRewardTimestamp) {
          const diff = res.data.participation.nextRewardTimestamp - Date.now();
          setTimeLeftMs(Math.max(0, diff));
        }
      }
    } catch (e) {
      console.error('Failed to load campaign data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, []);

  // Real-time ticking countdown based on server timestamp
  useEffect(() => {
    if (!data?.participation?.nextRewardTimestamp) return;

    const interval = setInterval(() => {
      const diff = data.participation!.nextRewardTimestamp - Date.now();
      setTimeLeftMs(Math.max(0, diff));
    }, 1000);

    return () => clearInterval(interval);
  }, [data]);

  const formatCountdown = (ms: number) => {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading || !data || !data.campaign.isActive) {
    return null;
  }

  const { campaign, isParticipating, participation } = data;

  // =========================================================================
  // VIEW 1: USER IS ALREADY ENROLLED (User Campaign Dashboard)
  // =========================================================================
  if (isParticipating && participation) {
    const isCompleted = participation.status === 'COMPLETED' || participation.remainingDays === 0;

    return (
      <div className="rounded-3xl bg-gradient-to-br from-[#1c0c30] via-[#120624] to-[#0a0217] border-2 border-amber-400/50 p-4 shadow-2xl space-y-3 relative overflow-hidden select-none animate-in fade-in">
        {/* Ambient Cosmic Lights */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-fuchsia-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header Badge */}
        <div className="flex items-center justify-between text-xs">
          <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>5K MEMBERS CELEBRATION</span>
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
            isCompleted
              ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
              : 'bg-indigo-950 text-indigo-300 border-indigo-500/40 animate-pulse'
          }`}>
            {isCompleted ? '✓ COMPLETED' : '⚡ SCHEDULE ACTIVE'}
          </span>
        </div>

        {/* Headline & Overview */}
        <div className="flex items-start gap-3 pt-1">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-purple-950 font-black shadow-lg shadow-amber-500/30 shrink-0">
            <Flame className="w-6 h-6 fill-current text-purple-950" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black text-white font-display">
              Tiered Daily Mining Rewards
            </h4>
            <p className="text-[11px] text-purple-200/90 leading-tight mt-0.5">
              Qualifying Deposit: <strong className="text-amber-300 font-mono">${participation.qualifyingDepositAmount.toFixed(2)} USDT</strong> · 30% Instant Cashback Credited!
            </p>
          </div>
        </div>

        {/* 3 Core Stats Cards */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="p-2.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-center shadow-md">
            <span className="text-[9px] uppercase font-bold text-purple-300/80 block">Cashback</span>
            <span className="text-xs font-black text-amber-400 font-mono">
              +{participation.cashbackPoops.toLocaleString()} 💩
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-center shadow-md">
            <span className="text-[9px] uppercase font-bold text-purple-300/80 block">Schedule</span>
            <span className="text-xs font-black text-cyan-300 font-mono">
              {participation.daysClaimed} / {participation.totalRewardDays} Days
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-center shadow-md">
            <span className="text-[9px] uppercase font-bold text-purple-300/80 block">Earned Total</span>
            <span className="text-xs font-black text-emerald-400 font-mono">
              +{participation.totalDailyPoopsCredited.toLocaleString()} 💩
            </span>
          </div>
        </div>

        {/* Server-Authoritative Countdown Banner */}
        <div className="p-3 rounded-2xl bg-[#0e051c] border border-amber-400/40 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-xs font-bold text-purple-200">
              {isCompleted ? 'Campaign Duration Finished' : 'Next Daily Reward (2,000 💩):'}
            </span>
          </div>
          <span className="text-xs font-black font-mono text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-400/30 shadow-sm">
            {isCompleted ? 'COMPLETE' : formatCountdown(timeLeftMs)}
          </span>
        </div>

        {/* Expandable Reward History Button */}
        {participation.dailyRewards && participation.dailyRewards.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full py-1.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-purple-300 hover:text-white transition-colors cursor-pointer"
            >
              <span>View Daily Disbursement History ({participation.dailyRewards.length})</span>
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showHistory && (
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {participation.dailyRewards.map((r) => (
                  <div
                    key={r.id}
                    className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold text-white">Day {r.dayIndex} Reward</span>
                      <span className="text-[10px] text-purple-300/70 font-mono">{r.rewardDate}</span>
                    </div>
                    <span className="font-mono font-bold text-amber-300">
                      +{r.rewardPoops.toLocaleString()} 💩
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: NEW 5K MEMBERS CELEBRATION CAMPAIGN PROMOTION BANNER
  // =========================================================================
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#1e0a38] via-[#120424] to-[#080114] border-2 border-amber-400/60 p-4 shadow-2xl space-y-3.5 relative overflow-hidden select-none animate-in fade-in">
      {/* Ambient Cosmic Lights */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />

      {/* Top Badge Row */}
      <div className="flex items-center justify-between text-xs">
        <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-purple-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/30">
          <Trophy className="w-3.5 h-3.5 text-purple-950" />
          <span>5K MEMBERS CELEBRATION!</span>
        </span>
        <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1.5 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>🎉 Special Milestone Rewards</span>
        </span>
      </div>

      {/* Main Benefit Headline */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 flex items-center justify-center text-purple-950 shadow-xl shadow-amber-500/30 shrink-0">
          <Gift className="w-6 h-6 text-purple-950" />
        </div>
        <div>
          <h4 className="text-sm font-black text-white leading-tight font-display tracking-tight">
            💰 30% INSTANT CASHBACK + 🎁 $1 USDT DAILY
          </h4>
          <p className="text-[11px] text-purple-200/90 mt-1 leading-relaxed">
            Deposit <strong className="text-amber-300 font-mono">$5–$10 USDT</strong> to unlock 30% cashback in Poops plus up to <strong className="text-cyan-300 font-bold">13 days</strong> of 2,000 Poops/day automated rewards!
          </p>
        </div>
      </div>

      {/* Three Specification Info Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-2xl bg-purple-950/70 border border-purple-500/30 text-center shadow-md">
          <span className="text-[9px] uppercase font-bold text-purple-300/80 block">MINIMUM DEPOSIT</span>
          <span className="text-xs font-black text-amber-300 font-mono">$5.00 USDT</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-purple-950/70 border border-purple-500/30 text-center shadow-md">
          <span className="text-[9px] uppercase font-bold text-purple-300/80 block">INSTANT BONUS</span>
          <span className="text-xs font-black text-emerald-400 font-mono">30% Cashback</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-purple-950/70 border border-purple-500/30 text-center shadow-md">
          <span className="text-[9px] uppercase font-bold text-purple-300/80 block">DAILY REWARDS</span>
          <span className="text-xs font-black text-cyan-300 font-mono">Up to 13 Days</span>
        </div>
      </div>

      {/* Call to Action Button */}
      <button
        type="button"
        onClick={() => {
          if (onApplyDeposit) {
            onApplyDeposit(10.0);
          }
        }}
        className="w-full py-3 rounded-2xl btn-gold-3d font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 cursor-pointer active:scale-95 transition-all text-purple-950"
      >
        <Sparkles className="w-4 h-4 text-purple-950" />
        <span>Celebrate & Earn More! ($10 Deposit)</span>
        <ArrowRight className="w-4 h-4 text-purple-950" />
      </button>
    </div>
  );
};
