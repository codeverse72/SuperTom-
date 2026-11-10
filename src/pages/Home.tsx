import React, { useState } from 'react';
import { BalanceCard } from '../components/BalanceCard';
import { CatCharacter } from '../components/CatCharacter';
import { SpinTimer } from '../components/SpinTimer';
import { ProductionCard } from '../components/ProductionCard';
import { FeedingModal } from '../components/FeedingModal';
import { SpinWheelModal } from '../components/SpinWheelModal';
import feedTomButtonImg from '../assets/dashboard/feed_tom_button_3d.png';

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
      <div className="pt-1 pb-2 flex justify-center">
        <button
          onClick={() => setIsFeedingModalOpen(true)}
          className="relative w-full max-w-[390px] cursor-pointer active:scale-[0.97] hover:scale-[1.01] transition-transform select-none group focus:outline-hidden"
          aria-label="Feed Tom biscuits to boost mining production"
        >
          {/* Ambient Warm Golden Glow behind button */}
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-12 bg-radial from-amber-500/40 via-orange-500/25 to-transparent blur-xl pointer-events-none group-hover:from-amber-400/50 transition-all" />

          {/* High-Resolution 3D Rendered Feed Tom Pill Button */}
          <img
            src={feedTomButtonImg}
            alt="Feed Tom"
            className="w-full h-auto object-contain filter drop-shadow-[0_8px_18px_rgba(0,0,0,0.65)] drop-shadow-[0_0_15px_rgba(245,158,11,0.35)] transition-all group-hover:brightness-105"
          />
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
