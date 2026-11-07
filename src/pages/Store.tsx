import React, { useState } from 'react';
import { ShoppingBag, Sparkles, Cookie, ServerOff, ShieldCheck } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { BISCUIT_CONFIGS, BiscuitConfig } from '../config/gameConfig';
import { formatNumber } from '../utils/probability';

export const Store: React.FC = () => {
  const { balance, biscuitInventory, productionRate, triggerNotice } = useGame();
  const [selectedBiscuit, setSelectedBiscuit] = useState<BiscuitConfig | null>(null);

  const handlePurchaseAttempt = (biscuit: BiscuitConfig) => {
    setSelectedBiscuit(biscuit);
    triggerNotice(
      `Store Purchase (${biscuit.name})`,
      'Purchases are currently unavailable.',
      'Purchases Unavailable'
    );
  };

  const handleFeedAttempt = (biscuit: BiscuitConfig) => {
    triggerNotice(
      `Feed (${biscuit.name})`,
      'Feeding is temporarily unavailable.',
      'Feeding Unavailable'
    );
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* Store Header Banner */}
      <div className="rounded-3xl glass-panel p-4 border border-purple-500/30 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#1b0838] via-[#120526] to-[#080214]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <ShoppingBag className="w-4 h-4" />
              <span>ROYAL BISCUIT BAKERY</span>
            </div>
            <h2 className="text-xl font-black text-white font-display mt-0.5">
              Biscuit Store
            </h2>
            <p className="text-xs text-purple-200/80 mt-1">
              Feed King Tom treats to boost continuous Poop mining rate!
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-purple-300">Your Balance</span>
            <div className="text-lg font-black text-amber-400 font-mono">
              {formatNumber(balance)} 💩
            </div>
            <span className="text-[10px] text-purple-300 font-bold">
              {productionRate !== null ? `+${productionRate} / hr` : '-- / hr'}
            </span>
          </div>
        </div>

        {/* Biscuit Showcase Tray Image */}
        <div className="mt-3 relative rounded-2xl overflow-hidden border border-purple-500/40 h-28 bg-[#120626]">
          <img
            src="/assets/dashboard/biscuit_collection.jpg"
            alt="Royal Biscuit Collection"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d051e] via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] font-bold text-purple-200 bg-black/60 px-2 py-0.5 rounded-full border border-purple-400/30">
            <span>Common</span> • <span>Silver</span> • <span>Gold</span> • <span>Diamond</span>
          </div>
        </div>

        {/* Feature status notice */}
        <div className="mt-3 p-2.5 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-[11px] text-purple-200/90 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Store prices & production multipliers are synchronized. Purchases will open with game servers.
          </span>
        </div>
      </div>

      {/* 4 Biscuit Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.values(BISCUIT_CONFIGS).map((biscuit) => {
          const owned = biscuitInventory !== null ? (biscuitInventory[biscuit.id] ?? 0) : '--';

          return (
            <div
              key={biscuit.id}
              className={`rounded-3xl p-4 glass-panel border transition-all duration-200 flex flex-col justify-between ${biscuit.borderColor} shadow-xl hover:shadow-2xl relative overflow-hidden`}
            >
              {/* Top Row: Badge & Name */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/70 border border-purple-400/30 text-amber-300">
                    {biscuit.badge}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+{biscuit.productionBoost}/hr</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${biscuit.color} border border-white/30 flex items-center justify-center text-white shadow-lg shrink-0`}>
                    <Cookie className="w-6 h-6 drop-shadow-md" />
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-white font-display">
                      {biscuit.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-black text-amber-400 font-mono">
                        {biscuit.cost} POOPS
                      </span>
                      <span className="text-purple-400">·</span>
                      <span className="text-[11px] text-purple-200/80">
                        In Bag: <strong className="text-white">{owned}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-purple-200/80 mt-2.5 leading-relaxed">
                  {biscuit.description}
                </p>
              </div>

              {/* Action Buttons: Buy and Feed (Safe Backend-ready triggers) */}
              <div className="mt-4 pt-3 border-t border-purple-500/20 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handlePurchaseAttempt(biscuit)}
                  className="py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1 transition-all bg-purple-900/50 hover:bg-purple-800 text-purple-200 hover:text-white border border-purple-500/30 cursor-pointer active:scale-95"
                >
                  <ServerOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Buy</span>
                </button>

                <button
                  onClick={() => handleFeedAttempt(biscuit)}
                  className="py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1 transition-all bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 hover:text-white border border-purple-500/20 cursor-pointer active:scale-95"
                >
                  <Cookie className="w-3.5 h-3.5" />
                  <span>Feed</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
