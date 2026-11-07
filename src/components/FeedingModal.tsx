import React, { useState } from 'react';
import { X, Sparkles, Cookie, ArrowRight, ServerOff } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { BISCUIT_CONFIGS } from '../config/gameConfig';
import { SYSTEM_MESSAGES } from '../config/featureConfig';

interface FeedingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStore: () => void;
}

export const FeedingModal: React.FC<FeedingModalProps> = ({ isOpen, onClose, onNavigateToStore }) => {
  const { biscuitInventory, triggerNotice } = useGame();
  const [selectedBiscuitId, setSelectedBiscuitId] = useState<string>('common');

  if (!isOpen) return null;

  const currentConfig = BISCUIT_CONFIGS[selectedBiscuitId];
  const ownedCount = biscuitInventory !== null ? (biscuitInventory[selectedBiscuitId] ?? 0) : '--';

  const handleFeed = () => {
    triggerNotice('Cat Feeding', SYSTEM_MESSAGES.FEEDING_UNAVAILABLE, 'Feeding Unavailable');
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
                Give crunchy biscuits to boost hourly Poop production
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

        {/* 4 Biscuit Categories Selector Grid */}
        <div className="grid grid-cols-2 gap-2.5 my-4">
          {Object.values(BISCUIT_CONFIGS).map((biscuit) => {
            const isSelected = selectedBiscuitId === biscuit.id;
            const count = biscuitInventory !== null ? (biscuitInventory[biscuit.id] ?? 0) : '--';

            return (
              <button
                key={biscuit.id}
                onClick={() => setSelectedBiscuitId(biscuit.id)}
                className={`relative rounded-2xl p-3 text-left transition-all flex flex-col justify-between min-h-[96px] cursor-pointer ${
                  isSelected
                    ? 'bg-purple-800/40 border-2 border-amber-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] scale-[1.02]'
                    : 'bg-purple-950/40 border border-purple-500/20 hover:border-purple-400/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-400/20">
                      {biscuit.badge}
                    </span>
                    <h4 className="text-xs font-bold text-white mt-1 font-display">
                      {biscuit.name}
                    </h4>
                  </div>

                  <span className="text-xs font-mono font-bold text-amber-300">
                    +{biscuit.productionBoost}/h
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-purple-500/20 text-[11px]">
                  <span className="text-purple-300/70">
                    Owned: <strong className="text-white">{count}</strong>
                  </span>
                  <span className="text-amber-400 font-bold">
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
              +{currentConfig.productionBoost} Poops / hr
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleFeed}
            className="w-full py-3 rounded-2xl btn-gold-3d font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer"
          >
            <ServerOff className="w-4 h-4 text-purple-950" />
            <span>Feed Tom (Backend Offline)</span>
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
