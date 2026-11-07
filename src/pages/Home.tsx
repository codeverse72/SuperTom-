import React, { useState } from 'react';
import { Sparkles, Cookie } from 'lucide-react';
import { BalanceCard } from '../components/BalanceCard';
import { CatCharacter } from '../components/CatCharacter';
import { SpinTimer } from '../components/SpinTimer';
import { ProductionCard } from '../components/ProductionCard';
import { FeedingModal } from '../components/FeedingModal';
import { SpinWheelModal } from '../components/SpinWheelModal';

interface HomeProps {
  onNavigateToStore: () => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigateToStore }) => {
  const [isFeedingModalOpen, setIsFeedingModalOpen] = useState(false);

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Poops Balance Card with Treasure Chest & Dynamic USDT */}
      <BalanceCard />

      {/* 2. Main 3D Royal Cat Character sitting on Throne with Speech Bubbles */}
      <CatCharacter />

      {/* 3. FREE SPIN TIMER SYSTEM (3 Milestones: 2h, 4h, 8h) */}
      <SpinTimer />

      {/* 4. Poop Production Rate Card */}
      <ProductionCard onOpenFeeding={() => setIsFeedingModalOpen(true)} />

      {/* 5. Large Golden 3D "Feed Tom" Button */}
      <div className="pt-1 pb-2">
        <button
          onClick={() => setIsFeedingModalOpen(true)}
          className="relative w-full h-[62px] sm:h-[66px] rounded-full p-[2px] bg-gradient-to-r from-[#ffd700] via-[#ff9900] to-[#ff6600] shadow-[0_0_28px_rgba(255,165,0,0.55)] hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group"
        >
          <div className="relative w-full h-full rounded-full bg-gradient-to-b from-[#ffe066] via-[#f59e0b] to-[#d97706] flex items-center justify-center gap-3 px-6 overflow-hidden border border-amber-200/60">
            {/* Top Glossy Specular Glass Reflection */}
            <div className="absolute top-0 left-0 right-0 h-[45%] bg-gradient-to-b from-white/40 to-transparent rounded-t-full pointer-events-none" />

            {/* Left: 3D Biscuit Icon */}
            <div className="relative shrink-0 w-11 h-8 sm:w-12 sm:h-9 flex items-center justify-center">
              <img
                src="/assets/dashboard/biscuit_3d.png"
                alt="Biscuit"
                className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] group-hover:rotate-6 transition-transform"
              />
            </div>

            {/* Text: "Feed Tom" in Dark Bold Brown */}
            <span className="text-xl sm:text-2xl font-black text-[#301600] tracking-tight drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]">
              Feed Tom
            </span>
          </div>
        </button>
      </div>

      {/* Feeding Selection Modal */}
      <FeedingModal
        isOpen={isFeedingModalOpen}
        onClose={() => setIsFeedingModalOpen(false)}
        onNavigateToStore={onNavigateToStore}
      />

      {/* Free Spin Lucky Wheel Modal */}
      <SpinWheelModal />
    </div>
  );
};
