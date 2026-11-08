import React from 'react';
import { useGame } from '../context/GameContext';

interface ProductionCardProps {
  onOpenFeeding: () => void;
}

export const ProductionCard: React.FC<ProductionCardProps> = ({ onOpenFeeding }) => {
  const { productionRate, unclaimedPoops, claimMiningEarnings, isClaimingMining } = useGame();

  const displayRate = productionRate !== null ? `${productionRate} / hr` : '-- / hr';
  const flooredUnclaimed = Math.floor(unclaimedPoops);
  const canClaim = flooredUnclaimed >= 1;

  const handleClaim = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canClaim && !isClaimingMining) {
      claimMiningEarnings();
    }
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Top Row: Two Stat Cards */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {/* Left Card: Poop Rate (Tap to Feed Tom & Boost) */}
        <div 
          onClick={onOpenFeeding}
          className="relative rounded-[22px] p-[2px] bg-gradient-to-r from-[#9333ea] via-[#c026d3] to-[#7c3aed] shadow-[0_0_16px_rgba(192,38,211,0.35)] cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform select-none"
        >
          <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-b from-[#180a33] via-[#120527] to-[#0c031d] p-3 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2.5">
              {/* 3D Glossy Yellow Up Arrow */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#ffd700] via-[#f59e0b] to-[#b45309] p-0.5 shadow-[0_0_12px_rgba(255,215,0,0.5)] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#3a1d00] stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </div>

              <div>
                <p className="text-[11px] sm:text-xs font-semibold text-purple-200/90 leading-tight">
                  Poop Rate
                </p>
                <p className="text-sm sm:text-base font-black text-white leading-tight mt-0.5">
                  {displayRate}
                </p>
              </div>
            </div>

            {/* Neon Purple/Magenta Progress Bar */}
            <div className="mt-2.5 w-full h-2 rounded-full bg-[#27104d] overflow-hidden p-[1px]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#a855f7] via-[#c026d3] to-[#e879f9] shadow-[0_0_8px_#c026d3] w-[70%]" />
            </div>
          </div>
        </div>

        {/* Right Card: Mined (Unclaimed Pool) */}
        <div 
          onClick={handleClaim}
          className={`relative rounded-[22px] p-[2px] transition-all select-none ${
            canClaim 
              ? 'bg-gradient-to-r from-[#10b981] via-[#00e676] to-[#059669] shadow-[0_0_18px_rgba(16,185,129,0.45)] cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gradient-to-r from-[#9333ea] via-[#c026d3] to-[#7c3aed] shadow-[0_0_16px_rgba(192,38,211,0.35)]'
          }`}
        >
          <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-b from-[#180a33] via-[#120527] to-[#0c031d] p-3 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {/* 3D Pickaxe / Shovel Icon */}
                <div className={`w-9 h-9 rounded-xl p-0.5 flex items-center justify-center shrink-0 ${
                  canClaim
                    ? 'bg-gradient-to-b from-[#34d399] via-[#10b981] to-[#047857] shadow-[0_0_12px_rgba(52,211,153,0.6)]'
                    : 'bg-gradient-to-b from-[#a855f7] via-[#7c3aed] to-[#581c87]'
                }`}>
                  <span className="text-lg">⛏️</span>
                </div>

                <div>
                  <p className="text-[11px] sm:text-xs font-semibold text-purple-200/90 leading-tight">
                    Mined (Unclaimed)
                  </p>
                  <p className={`text-sm sm:text-base font-black leading-tight mt-0.5 font-display ${
                    canClaim ? 'text-[#00e676]' : 'text-white'
                  }`}>
                    +{flooredUnclaimed.toLocaleString()}
                  </p>
                </div>
              </div>

              {canClaim && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-emerald-400/90">
              <span>{canClaim ? 'Ready to collect!' : 'Accumulating...'}</span>
              <span className="text-xs">{canClaim ? 'Tap ➔' : '⏳'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Full-Width Prominent "Claim Mined Poops" Action Button */}
      <button
        type="button"
        onClick={handleClaim}
        disabled={!canClaim || isClaimingMining}
        className={`w-full relative overflow-hidden rounded-[20px] p-[2px] transition-all duration-300 font-display select-none ${
          canClaim
            ? 'bg-gradient-to-r from-[#10b981] via-[#00e676] to-[#059669] shadow-[0_0_24px_rgba(0,230,118,0.5)] cursor-pointer active:scale-[0.98] hover:scale-[1.01]'
            : 'bg-white/10 opacity-70 cursor-not-allowed'
        }`}
        aria-label="Claim mined poops to main balance"
      >
        <div className={`rounded-[18px] px-4 py-2.5 sm:py-3 flex items-center justify-between ${
          canClaim ? 'bg-gradient-to-r from-[#064e3b]/95 to-[#047857]/95' : 'bg-[#150a2e]/90'
        }`}>
          <div className="flex items-center gap-2.5 text-left">
            <span className="text-xl">💩</span>
            <div>
              <p className="text-xs sm:text-sm font-black text-white leading-tight">
                {isClaimingMining
                  ? 'Harvesting Poops to Balance...'
                  : canClaim
                  ? `Claim +${flooredUnclaimed.toLocaleString()} Poops`
                  : 'Mining Farm Generating'}
              </p>
              <p className="text-[10px] sm:text-[11px] font-medium text-emerald-300/80">
                {canClaim
                  ? 'Transfers directly into your Main Balance'
                  : `Producing +${displayRate} • Generates continuously`}
              </p>
            </div>
          </div>

          <div className={`px-3 py-1 rounded-full text-xs font-black shrink-0 transition-all ${
            canClaim
              ? 'bg-[#00e676] text-[#064e3b] shadow-[0_0_12px_rgba(0,230,118,0.6)] animate-pulse'
              : 'bg-white/10 text-white/50'
          }`}>
            {isClaimingMining ? '...' : canClaim ? 'CLAIM ⚡' : 'MINING ⏳'}
          </div>
        </div>
      </button>
    </div>
  );
};
