import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { BiscuitSvg } from './BiscuitSvg';
import { BiscuitConfig } from '../config/gameConfig';
import { Cookie, Sparkles, Plus, Zap, ArrowRight, Heart } from 'lucide-react';
import { sound } from '../utils/sound';

interface BiscuitShowcaseProps {
  onOpenStore?: () => void;
  onOpenFeedingModal?: () => void;
}

export const BiscuitShowcase: React.FC<BiscuitShowcaseProps> = ({
  onOpenStore,
  onOpenFeedingModal,
}) => {
  const { biscuitCatalog, biscuitInventory, feedTom, showToast } = useGame();
  const [feedingId, setFeedingId] = useState<string | null>(null);

  // Compute total biscuits owned
  const totalBiscuitsOwned = biscuitCatalog.reduce((sum, b) => {
    return sum + (biscuitInventory?.[b.id] || 0);
  }, 0);

  const handleBiscuitClick = (biscuit: BiscuitConfig) => {
    sound.playTap();
    const count = biscuitInventory?.[biscuit.id] || 0;

    if (count > 0) {
      // Instant 1-tap feed
      setFeedingId(biscuit.id);
      sound.playMunch();
      const success = feedTom(biscuit.id, 1);
      if (success) {
        showToast(
          'Nom Nom Nom! 😻',
          `Fed King Tom 1x ${biscuit.name}! Mining speed boosted by +${biscuit.productionBoost}/hr 🚀`,
          'reward'
        );
      }
      setTimeout(() => setFeedingId(null), 800);
    } else {
      // Prompt user to obtain from store
      if (onOpenStore) {
        onOpenStore();
      } else if (onOpenFeedingModal) {
        onOpenFeedingModal();
      }
    }
  };

  return (
    <div className="w-full rounded-3xl p-3.5 glass-panel border border-purple-500/30 shadow-xl relative overflow-hidden bg-gradient-to-br from-[#180833] via-[#110424] to-[#0a0217] select-none">
      {/* Ambient Neon Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-[0_0_10px_rgba(245,158,11,0.4)] flex items-center justify-center shrink-0">
            <Cookie className="w-4 h-4 text-purple-950 fill-purple-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-white font-display tracking-wide uppercase">
                King Tom's Royal Treat Tray
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-900/60 border border-purple-400/30 text-amber-300 font-bold">
                Live
              </span>
            </div>
            <p className="text-[10px] text-purple-200/70 leading-none mt-0.5">
              Tap any owned biscuit to feed & boost mining speed
            </p>
          </div>
        </div>

        {/* Total Owned Counter */}
        <div className="shrink-0 text-right">
          <span className="text-[9px] uppercase font-bold text-purple-300 block">Total Treats</span>
          <span className="text-xs font-black font-mono text-amber-400 bg-purple-950/80 px-2 py-0.5 rounded-lg border border-purple-500/30">
            {totalBiscuitsOwned} in Bag
          </span>
        </div>
      </div>

      {/* Biscuits Horizontal Showcase Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {biscuitCatalog.map((biscuit) => {
          const count = biscuitInventory?.[biscuit.id] || 0;
          const isOwned = count > 0;
          const isCurrentlyFeeding = feedingId === biscuit.id;

          return (
            <div
              key={biscuit.id}
              onClick={() => handleBiscuitClick(biscuit)}
              className={`relative rounded-2xl p-2.5 border transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-95 group overflow-hidden ${
                isOwned
                  ? 'bg-gradient-to-b from-[#220c42] to-[#14062a] border-amber-400/40 hover:border-amber-400 shadow-[0_4px_16px_rgba(234,179,8,0.2)]'
                  : 'bg-[#100522]/80 border-purple-900/40 hover:border-purple-500/40 opacity-80 hover:opacity-100'
              }`}
            >
              {/* Top Row: Quantity Badge & Boost Rate */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                    isOwned
                      ? 'bg-amber-400 text-purple-950 shadow-sm'
                      : 'bg-purple-950 text-purple-400 border border-purple-800/40'
                  }`}
                >
                  {isOwned ? `x${count}` : '0'}
                </span>

                <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/20">
                  +{biscuit.productionBoost}/h
                </span>
              </div>

              {/* Center SVG Biscuit Image (Pixel-perfect & Scaled) */}
              <div className="py-1 flex items-center justify-center relative">
                <div className={`transition-transform duration-200 ${isCurrentlyFeeding ? 'scale-125 animate-bounce' : 'group-hover:scale-105'}`}>
                  <BiscuitSvg
                    biscuitId={biscuit.id}
                    color={biscuit.color?.startsWith('#') ? biscuit.color : undefined}
                    size={46}
                  />
                </div>

                {isCurrentlyFeeding && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Heart className="w-5 h-5 text-pink-500 fill-pink-500 animate-ping" />
                  </div>
                )}
              </div>

              {/* Bottom Label & Action Hint */}
              <div className="mt-1 text-center">
                <p className="text-[11px] font-black text-white truncate leading-tight">
                  {biscuit.name}
                </p>
                <div className="mt-1">
                  {isOwned ? (
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-md group-hover:bg-amber-400 group-hover:text-purple-950 transition-colors">
                      Tap to Feed
                    </span>
                  ) : (
                    <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-purple-300/80 bg-purple-950/60 px-1.5 py-0.5 rounded-md border border-purple-500/20 group-hover:text-white">
                      Get Treat +
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

