import React, { useState } from 'react';
import { X, Sparkles, Cookie, ArrowRight, ServerOff } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { BISCUIT_CONFIGS } from '../config/gameConfig';
import { PLAN_USDT_RATES } from '../pages/Store';
import { BiscuitSvg } from './BiscuitSvg';
import { SYSTEM_MESSAGES } from '../config/featureConfig';
import { adManager } from '../services/adManager';

interface FeedingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStore: () => void;
}

export const FeedingModal: React.FC<FeedingModalProps> = ({ isOpen, onClose, onNavigateToStore }) => {
  const { biscuitCatalog, biscuitInventory, feedTom, showToast, setSelectedPlanForDeposit } = useGame();
  const [selectedBiscuitId, setSelectedBiscuitId] = useState<string>('common');

  if (!isOpen) return null;

  const currentConfig = biscuitCatalog.find(b => b.id === selectedBiscuitId) || BISCUIT_CONFIGS[selectedBiscuitId] || biscuitCatalog[0] || BISCUIT_CONFIGS.common;
  const ownedCount = biscuitInventory !== null ? (biscuitInventory[selectedBiscuitId] ?? 0) : 0;

  const handleFeed = () => {
    if (typeof ownedCount === 'number' && ownedCount <= 0) {
      const biscuitPrice = PLAN_USDT_RATES[currentConfig.id] ?? Math.max(1, Number((currentConfig.cost / 200).toFixed(2)));
      setSelectedPlanForDeposit({
        id: currentConfig.id,
        name: currentConfig.name,
        boostPerHour: currentConfig.productionBoost,
        costPoops: currentConfig.cost,
        usdtAmount: biscuitPrice,
      });
      showToast('No Biscuits', `Selected ${currentConfig.name} ($${biscuitPrice.toFixed(2)} USDT). Visit the Store to buy biscuits!`, 'info');
      onClose();
      onNavigateToStore();
      return;
    }

    const success = feedTom(selectedBiscuitId, 1);
    if (success) {
      showToast(
        'Tom Fed!',
        `Gave 1x ${currentConfig.name} to King Tom! Hourly mining boosted by +${currentConfig.productionBoost}/hr 🚀`,
        'reward'
      );
      onClose();
      // Frequently trigger ad on feeding milestone
      setTimeout(() => {
        adManager.triggerActionAd('feed_tom');
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl glass-panel p-5 border border-purple-500/40 shadow-2xl bg-[#140628] animate-in slide-in-from-bottom duration-250">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Cookie className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white font-display">
                Feed King Tom
              </h3>
              <p className="text-[11px] text-purple-300/80">
                Give crunchy biscuits to boost hourly TomCoin production
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-purple-300 hover:text-white bg-purple-950/60 border border-purple-500/30 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Biscuit Categories Selector Grid */}
        <div className="grid grid-cols-2 gap-2.5 my-4 max-h-56 overflow-y-auto pr-1">
          {biscuitCatalog.map((biscuit) => {
            const isSelected = selectedBiscuitId === biscuit.id;
            const count = biscuitInventory !== null ? (biscuitInventory[biscuit.id] ?? 0) : 0;

            return (
              <button
                key={biscuit.id}
                onClick={() => setSelectedBiscuitId(biscuit.id)}
                className={`relative rounded-2xl p-2.5 text-left transition-all flex flex-col justify-between min-h-[96px] cursor-pointer ${
                  isSelected
                    ? 'bg-purple-800/40 border-2 border-amber-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] scale-[1.02]'
                    : 'bg-purple-950/40 border border-purple-500/20 hover:border-purple-400/40'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <BiscuitSvg
                      biscuitId={biscuit.id}
                      color={biscuit.color?.startsWith('#') ? biscuit.color : undefined}
                      size={28}
                    />
                    <div>
                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-purple-900/60 text-purple-200 border border-purple-400/20">
                        {biscuit.badge}
                      </span>
                      <h4 className="text-xs font-bold text-white mt-0.5 font-display truncate max-w-[85px]">
                        {biscuit.name}
                      </h4>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-amber-300 shrink-0">
                    +{biscuit.productionBoost}/h
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-purple-500/20 text-[11px]">
                  <span className="text-purple-300/70">
                    Owned: <strong className={count > 0 ? 'text-amber-400' : 'text-slate-400'}>{count}</strong>
                  </span>
                  <span className="text-amber-400 font-bold font-mono text-[10px]">
                    {biscuit.cost} 💩
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Biscuit Detail & Action */}
        <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-300">Selected:</span>
            <span className="font-bold text-white font-display text-sm">
              {currentConfig.name}
            </span>
          </div>

          <p className="text-[11px] text-purple-200/80 my-1 leading-relaxed">
            {currentConfig.description}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-purple-500/20 text-xs">
            <span className="text-purple-300">Boost per biscuit:</span>
            <span className="font-extrabold text-emerald-400 font-mono">
              +{currentConfig.productionBoost} TomCoins / hr
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleFeed}
            className="w-full py-3 rounded-2xl btn-gold-3d font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer"
          >
            {ownedCount > 0 ? (
              <>
                <Cookie className="w-4 h-4 text-purple-950" />
                <span>Feed King Tom (+{currentConfig.productionBoost}/hr)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-950" />
                <span>Get {currentConfig.name} in Store</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              onClose();
              onNavigateToStore();
            }}
            className="w-full py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-purple-500/20 cursor-pointer"
          >
            <span>View All Store Categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
