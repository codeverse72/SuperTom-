import React from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber, poopsToUsdt } from '../utils/probability';
import poopMascotImg from '../assets/dashboard/poop_character.png';
import chestPurpleImg from '../assets/dashboard/chest_purple.png';

export const BalanceCard: React.FC = () => {
  const { balance, unclaimedPoops, claimMiningEarnings, isClaimingMining } = useGame();

  const displayBalance = balance !== null ? formatNumber(balance) : '--';
  const usdtEquivalent = balance !== null ? poopsToUsdt(balance) : '0.0000';
  const flooredUnclaimed = Math.floor(unclaimedPoops);

  const handleChestClick = () => {
    if (flooredUnclaimed >= 1 && !isClaimingMining) {
      claimMiningEarnings();
    }
  };

  return (
    <div className="relative rounded-[26px] p-[2px] bg-gradient-to-r from-[#ff0099] via-[#bf00ff] to-[#ffaa00] shadow-[0_0_24px_rgba(255,0,153,0.35)] select-none">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-[#180a33] via-[#120527] to-[#0c031d] px-4 py-3 sm:py-3.5 flex items-center justify-between">
        {/* Subtle inner purple ambient light */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(168,85,247,0.18),transparent_60%)] pointer-events-none" />

        {/* Left: 3D Smiling Poop Character Mascot */}
        <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
          <img
            src={poopMascotImg}
            alt="Poop Mascot"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] drop-shadow-[0_0_12px_rgba(255,140,0,0.4)] select-none transition-transform hover:scale-105"
          />
        </div>

        {/* Center: "Your Poops" + Big Balance + Green Tether Conversion */}
        <div className="flex-1 min-w-0 px-3 sm:px-4">
          <p className="text-xs sm:text-sm font-semibold text-purple-200/90 tracking-wide">
            Your Poops
          </p>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none my-1 font-display">
            {displayBalance}
          </p>
          {/* Tether symbol + USDT text */}
          <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-bold text-[#00e676] drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]">
            <span className="w-4 h-4 rounded-full bg-[#00e676]/20 border border-[#00e676]/60 flex items-center justify-center text-[10px] text-[#00e676] font-black leading-none shrink-0">
              ₮
            </span>
            <span>
              {balance !== null ? `≈ ${usdtEquivalent} USDT` : 'Balance unavailable'}
            </span>
          </div>
        </div>

        {/* Right: 3D Glowing Purple Treasure Chest (Tap to harvest accrued poops) */}
        <div
          onClick={handleChestClick}
          className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center select-none group ${
            flooredUnclaimed >= 1 ? 'cursor-pointer' : 'cursor-default'
          }`}
          title={flooredUnclaimed >= 1 ? `Claim +${flooredUnclaimed.toLocaleString()} Poops to Balance!` : 'Treasure Vault'}
        >
          <img
            src={chestPurpleImg}
            alt="Treasure Chest"
            className={`w-full h-full object-contain filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)] drop-shadow-[0_0_14px_rgba(168,85,247,0.45)] transition-transform ${
              flooredUnclaimed >= 1 ? 'group-hover:scale-105 active:scale-95' : ''
            }`}
          />
          {flooredUnclaimed >= 1 && (
            <span className="absolute -top-1 -right-1 bg-[#00e676] text-[#064e3b] text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(0,230,118,0.8)] animate-bounce leading-none">
              +{flooredUnclaimed > 999 ? `${(flooredUnclaimed / 1000).toFixed(1)}k` : flooredUnclaimed}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
