import React from 'react';
import { Crown, Sparkles, ChevronRight, Zap, ShieldCheck } from 'lucide-react';
import { sound } from '../utils/sound';

interface VipDepositBannerProps {
  onNavigateToDeposit?: () => void;
}

export const VipDepositBanner: React.FC<VipDepositBannerProps> = ({ onNavigateToDeposit }) => {
  return (
    <div className="relative rounded-[22px] p-[1.5px] bg-gradient-to-r from-amber-400 via-fuchsia-500 to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] select-none overflow-hidden">
      {/* Background radial glow */}
      <div className="relative rounded-[20px] bg-gradient-to-br from-[#1b0a2e] via-[#100624] to-[#0a0218] p-3 sm:p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)] shrink-0">
              <Crown className="w-4 h-4 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  HOT OFFER • +30% BONUS
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-black text-white font-display leading-tight mt-0.5">
                Unlock Instant Crypto Withdrawals!
              </h3>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] font-black text-amber-400 font-mono">FROM $1.00</span>
            <span className="block text-[8px] text-slate-400 font-mono">USDT / TON / BSC</span>
          </div>
        </div>

        {/* 3 Key Selling Points */}
        <div className="grid grid-cols-3 gap-1.5 text-[9px] sm:text-[10px]">
          <div className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-500/20 text-center">
            <span className="block font-black text-emerald-400">⚡ $1.00</span>
            <span className="text-slate-300">3 Payouts</span>
          </div>
          <div className="p-1.5 rounded-lg bg-amber-950/50 border border-amber-400/30 text-center relative overflow-hidden">
            <span className="block font-black text-amber-300">👑 $3.00 VIP</span>
            <span className="text-amber-200">Unlimited</span>
          </div>
          <div className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-500/20 text-center">
            <span className="block font-black text-cyan-300">🚀 +30% Boost</span>
            <span className="text-slate-300">Faster Mining</span>
          </div>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={() => {
            sound.playCatMeow();
            if (onNavigateToDeposit) {
              onNavigateToDeposit();
            } else {
              window.location.hash = '#deposit';
            }
          }}
          className="w-full py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.5)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
          <span>DEPOSIT NOW & UNLOCK WITHDRAWALS</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
        </button>
      </div>
    </div>
  );
};
