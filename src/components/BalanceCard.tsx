import React from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber, tomToUsdt } from '../utils/probability';
import crownMascotImg from '../assets/dashboard/crown_3d.png';
import chestPurpleImg from '../assets/dashboard/chest_purple.png';
import { sound } from '../utils/sound';
import { adManager } from '../services/adManager';

interface BalanceCardProps {
  onNavigateToDeposit?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ onNavigateToDeposit }) => {
  const { balance } = useGame();

  // If balance is set or default, format; if null fallback to reference '12,450'
  const displayBalance = balance !== null ? formatNumber(balance) : '12,450';
  const usdtEquivalent = balance !== null ? tomToUsdt(balance) : '0.0062';

  return (
    <div className="relative rounded-[26px] p-[2px] bg-gradient-to-r from-[#ffd700] via-[#ff9900] to-[#bf00ff] shadow-[0_0_24px_rgba(255,215,0,0.35)]">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-[#180a33] via-[#120527] to-[#0c031d] px-4 py-3 sm:py-3.5 flex items-center justify-between">
        {/* Subtle inner purple ambient light */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,215,0,0.15),transparent_60%)] pointer-events-none" />

        {/* Left: 3D Royal Crown / TomCoin Mascot */}
        <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
          <img
            src={crownMascotImg}
            alt="TomCoin Royal Crown"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] drop-shadow-[0_0_12px_rgba(255,215,0,0.5)] select-none transition-transform hover:scale-105"
          />
        </div>

        {/* Center: "Your TomCoins" + Big Balance + Green Tether Conversion & Deposit CTA */}
        <div className="flex-1 min-w-0 px-3 sm:px-4">
          <p className="text-xs sm:text-sm font-semibold text-amber-200/90 tracking-wide flex items-center gap-1">
            <span>Your TomCoins</span>
            <span className="text-xs">👑</span>
          </p>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none my-1 font-display">
            {balance !== null ? formatNumber(balance) : '--'}
          </p>
          
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {/* Tether symbol + USDT text */}
            <div className="flex items-center gap-1 text-xs sm:text-[13px] font-bold text-[#00e676] drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]">
              <span className="w-3.5 h-3.5 rounded-full bg-[#00e676]/20 border border-[#00e676]/60 flex items-center justify-center text-[9px] text-[#00e676] font-black leading-none shrink-0">
                ₮
              </span>
              <span>
                {balance !== null ? `≈ ${tomToUsdt(balance)} USDT` : 'Balance unavailable'}
              </span>
            </div>

            {/* Quick Deposit Pill Button */}
            {onNavigateToDeposit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  sound.playCatMeow();
                  onNavigateToDeposit();
                }}
                className="py-0.5 px-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.5)] cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>+ Deposit</span>
                <span className="text-[8px] bg-slate-950 text-amber-300 font-black px-1 rounded-xs">+30%</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: 3D Glowing Purple Treasure Chest */}
        <div 
          onClick={() => {
            sound.playTap();
            adManager.triggerActionAd('chest_click');
          }}
          className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center cursor-pointer"
        >
          <img
            src={chestPurpleImg}
            alt="Treasure Chest"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)] drop-shadow-[0_0_14px_rgba(168,85,247,0.45)] hover:scale-105 active:scale-95 transition-transform select-none"
          />
        </div>
      </div>
    </div>
  );
};

