import React from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber, poopsToUsdt } from '../utils/probability';

export const BalanceCard: React.FC = () => {
  const { balance } = useGame();

  // If balance is set or default, format; if null fallback to reference '12,450'
  const displayBalance = balance !== null ? formatNumber(balance) : '12,450';
  const usdtEquivalent = balance !== null ? poopsToUsdt(balance) : '0.0062';

  return (
    <div className="relative rounded-[26px] p-[2px] bg-gradient-to-r from-[#ff0099] via-[#bf00ff] to-[#ffaa00] shadow-[0_0_24px_rgba(255,0,153,0.35)]">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-[#180a33] via-[#120527] to-[#0c031d] px-4 py-3 sm:py-3.5 flex items-center justify-between">
        {/* Subtle inner purple ambient light */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(168,85,247,0.18),transparent_60%)] pointer-events-none" />

        {/* Left: 3D Smiling Poop Character Mascot */}
        <div className="relative shrink-0 w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center">
          <img
            src="/assets/dashboard/poop_character.png"
            alt="Poop Mascot"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          />
        </div>

        {/* Center: "Your Poops" + Big Balance + Green Tether Conversion */}
        <div className="flex-1 min-w-0 px-2 sm:px-3">
          <p className="text-xs sm:text-sm font-semibold text-purple-200/90 tracking-wide">
            Your Poops
          </p>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none my-1 font-display">
            {balance !== null ? formatNumber(balance) : '--'}
          </p>
          {/* Tether symbol + USDT text */}
          <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-bold text-[#00e676] drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]">
            <span className="w-4 h-4 rounded-full bg-[#00e676]/20 border border-[#00e676]/60 flex items-center justify-center text-[10px] text-[#00e676] font-black leading-none shrink-0">
              ₮
            </span>
            <span>
              {balance !== null ? `≈ ${poopsToUsdt(balance)} USDT` : 'Balance unavailable'}
            </span>
          </div>
        </div>

        {/* Right: 3D Glowing Purple Treasure Chest */}
        <div className="relative shrink-0 w-20 h-16 sm:w-24 sm:h-18 flex items-center justify-center">
          <img
            src="/assets/dashboard/chest_purple.png"
            alt="Treasure Chest"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_16px_rgba(255,170,0,0.4)] hover:scale-105 transition-transform"
          />
        </div>
      </div>
    </div>
  );
};

