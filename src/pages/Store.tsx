import React from 'react';
import { 
  ShoppingBag, 
  Sparkles, 
  Cookie, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Check 
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { BISCUIT_CONFIGS, BiscuitConfig } from '../config/gameConfig';
import { formatNumber } from '../utils/probability';
import { BiscuitSvg } from '../components/BiscuitSvg';

interface StoreProps {
  onNavigateToDeposit?: () => void;
}

export const PLAN_USDT_RATES: Record<string, number> = {
  common: 1.0,
  silver: 2.5,
  gold: 5.0,
  diamond: 10.0,
};

export const Store: React.FC<StoreProps> = ({ onNavigateToDeposit }) => {
  const { 
    balance, 
    biscuitCatalog,
    biscuitInventory, 
    productionRate, 
    setSelectedPlanForDeposit, 
    feedTom,
    showToast 
  } = useGame();

  const handleBuyWithDeposit = (biscuit: BiscuitConfig) => {
    const biscuitPriceUsdt = PLAN_USDT_RATES[biscuit.id] ?? Math.max(1, Number((biscuit.cost / 200).toFixed(2)));
    setSelectedPlanForDeposit({
      id: biscuit.id,
      name: biscuit.name,
      boostPerHour: biscuit.productionBoost,
      costPoops: biscuit.cost,
      usdtAmount: biscuitPriceUsdt,
    });

    showToast(
      'Opening Deposit',
      `Deposit amount set to $${biscuitPriceUsdt.toFixed(2)} USDT for ${biscuit.name} (+${biscuit.productionBoost}/hr boost)!`,
      'info'
    );

    if (onNavigateToDeposit) {
      onNavigateToDeposit();
    }
  };

  const handleFeedOwned = (biscuit: BiscuitConfig) => {
    const success = feedTom(biscuit.id, 1);
    if (success) {
      showToast('Tom Fed!', `Gave 1x ${biscuit.name} to King Tom!`, 'reward');
    }
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* Store Header Banner */}
      <div className="rounded-3xl glass-panel p-4 border border-purple-500/30 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#1b0838] via-[#120526] to-[#080214]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <ShoppingBag className="w-4 h-4" />
              <span>ROYAL MINING BAKERY</span>
            </div>
            <h2 className="text-xl font-black text-white font-display mt-0.5">
              Mining Speed Plans
            </h2>
            <p className="text-xs text-purple-200/80 mt-1">
              Buy a plan to boost King Tom's continuous hourly TomCoin mining speed!
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-purple-300">Your Balance</span>
            <div className="text-lg font-black text-amber-400 font-mono">
              {formatNumber(balance)} 👑
            </div>
            <span className="text-[10px] text-emerald-400 font-bold font-mono">
              {productionRate !== null ? `+${productionRate} / hr` : '-- / hr'}
            </span>
          </div>
        </div>

        {/* Showcase Tray Image */}
        <div className="mt-3 relative rounded-2xl overflow-hidden border border-purple-500/40 h-28 bg-[#120626]">
          <img
            src="/assets/dashboard/biscuit_collection.jpg"
            alt="Royal Biscuit Collection"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d051e] via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[10px] font-bold text-purple-200 bg-black/60 px-2.5 py-0.5 rounded-full border border-purple-400/30">
            <span>Common +10/h</span> • <span>Silver +50/h</span> • <span>Gold +200/h</span> • <span>Diamond +1,000/h</span>
          </div>
        </div>

        {/* Feature status notice */}
        <div className="mt-3 p-2.5 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-[11px] text-purple-200/90 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Buying any plan automatically connects to the Deposit section. Your mining speed adjusts permanently once activated!
          </span>
        </div>
      </div>

      {/* Mining Plan Cards Grid (All Active Biscuits) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {biscuitCatalog.map((biscuit) => {
          const owned = biscuitInventory !== null ? (biscuitInventory[biscuit.id] ?? 0) : 0;
          const planUsdt = PLAN_USDT_RATES[biscuit.id] || Math.max(1, Number((biscuit.cost / 200).toFixed(1)));

          return (
            <div
              key={biscuit.id}
              className={`rounded-3xl p-4 glass-panel border transition-all duration-200 flex flex-col justify-between ${biscuit.borderColor || 'border-purple-500/40'} shadow-xl hover:shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#14062a] to-[#090214]`}
            >
              {/* Top Row: Badge & Boost */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/70 border border-purple-400/30 text-amber-300">
                    {biscuit.badge}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>+{biscuit.productionBoost}/hr Mining Speed</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <div className="w-14 h-14 rounded-2xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center shadow-lg shrink-0">
                    <BiscuitSvg
                      biscuitId={biscuit.id}
                      color={biscuit.color?.startsWith('#') ? biscuit.color : undefined}
                      size={46}
                    />
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-white font-display">
                      {biscuit.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-black text-amber-400 font-mono">
                        ${planUsdt.toFixed(2)} USDT
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-purple-200/80 mt-2.5 leading-relaxed">
                  {biscuit.description}
                </p>

                {owned > 0 && (
                  <div className="mt-2 text-[11px] text-purple-300 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>In Bag: <strong className="text-white">{owned} ready to feed</strong></span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Buy Biscuit (Paid via Deposit) & Feed if Owned */}
              <div className="mt-4 pt-3 border-t border-purple-500/20 space-y-2">
                {/* Primary Button: Buy Biscuit (Moves to Deposit Section with exact price) */}
                <button
                  type="button"
                  onClick={() => handleBuyWithDeposit(biscuit)}
                  className="w-full py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-purple-950 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-950 fill-purple-950" />
                  <span>Buy Biscuit (${planUsdt.toFixed(2)} USDT)</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>

                {/* Feed King Tom (Only available when user owns biscuits) */}
                {owned > 0 && (
                  <button
                    type="button"
                    onClick={() => handleFeedOwned(biscuit)}
                    className="w-full py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1 transition-all bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 cursor-pointer active:scale-95"
                  >
                    <Cookie className="w-3 h-3" />
                    <span>Feed King Tom (+{biscuit.productionBoost}/hr)</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
