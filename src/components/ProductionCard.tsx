import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';

interface ProductionCardProps {
  onOpenFeeding: () => void;
}

export const ProductionCard: React.FC<ProductionCardProps> = ({ onOpenFeeding }) => {
  const { productionRate } = useGame();

  const displayRate = productionRate !== null ? `${productionRate} / hr` : '-- / hr';

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {/* Left Card: Poop Rate */}
      <div 
        onClick={onOpenFeeding}
        className="relative rounded-[22px] p-[2px] bg-gradient-to-r from-[#9333ea] via-[#c026d3] to-[#7c3aed] shadow-[0_0_16px_rgba(192,38,211,0.35)] cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
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

      {/* Right Card: Next Level */}
      <div 
        onClick={onOpenFeeding}
        className="relative rounded-[22px] p-[2px] bg-gradient-to-r from-[#9333ea] via-[#c026d3] to-[#7c3aed] shadow-[0_0_16px_rgba(192,38,211,0.35)] cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-b from-[#180a33] via-[#120527] to-[#0c031d] p-3 flex items-center justify-between h-full">
          <div className="flex items-center gap-2.5">
            {/* 3D Golden Crown */}
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img
                src="/assets/dashboard/crown_3d.png"
                alt="Golden Crown"
                className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]"
              />
            </div>

            <div>
              <p className="text-[11px] sm:text-xs font-semibold text-purple-200/90 leading-tight">
                Next Level
              </p>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight mt-0.5">
                <span className="font-normal text-purple-200/90">in </span>
                <span className="font-black text-white">1h 20m</span>
              </p>
            </div>
          </div>

          {/* Right Chevron > */}
          <ChevronRight className="w-5 h-5 text-white/80 shrink-0 stroke-[2.5]" />
        </div>
      </div>
    </div>
  );
};

