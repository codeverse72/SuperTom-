import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';
import { useGame } from '../context/GameContext';
import catThroneImg from '../assets/dashboard/cat_throne_coins.png';
import { sound } from '../utils/sound';

interface FloatingTap {
  id: number;
  x: number;
  y: number;
}

interface CatCharacterProps {
  onNavigateToDeposit?: () => void;
}

const CAT_SPEECHES = [
  { text: 'Feed me more biscuits! 😻', isDeposit: false },
  { text: '⚡ Deposit $1 to unlock instant cashouts! 💰', isDeposit: true },
  { text: '👑 King VIPs get +30% cashback & infinite payouts!', isDeposit: true },
  { text: '🐾 Top up crypto to boost mining by +30%! ⚡', isDeposit: true },
  { text: 'Purr... your biscuits make me mine 30% faster! 🚀', isDeposit: false },
];

export const CatCharacter: React.FC<CatCharacterProps> = ({ onNavigateToDeposit }) => {
  const { petCat } = useGame();
  const [floatingTaps, setFloatingTaps] = useState<FloatingTap[]>([]);
  const [speechIndex, setSpeechIndex] = useState(0);

  // Cycle persuasive & playful cat speech bubbles every 4.2 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSpeechIndex((prev) => (prev + 1) % CAT_SPEECHES.length);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  const currentSpeech = CAT_SPEECHES[speechIndex];

  const handleCatClick = (e: React.MouseEvent<HTMLDivElement>) => {
    petCat();
    sound.playCatMeow();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newTap: FloatingTap = { id: Date.now() + Math.random(), x, y };
    setFloatingTaps((prev) => [...prev.slice(-4), newTap]);

    setTimeout(() => {
      setFloatingTaps((prev) => prev.filter((t) => t.id !== newTap.id));
    }, 900);
  };

  return (
    <div className="relative w-full my-0.5 select-none flex flex-col items-center">
      {/* Floating Neon Purple Paw Prints in ambient space */}
      {/* Left glowing paw print */}
      <div className="absolute left-1 top-6 text-xl sm:text-2xl text-[#c026d3] opacity-80 filter drop-shadow-[0_0_12px_#d946ef] pointer-events-none animate-pulse">
        🐾
      </div>
      {/* Right glowing upper paw print */}
      <div className="absolute right-3 top-1 text-xl sm:text-2xl text-[#c026d3] opacity-80 filter drop-shadow-[0_0_12px_#d946ef] pointer-events-none animate-pulse">
        🐾
      </div>
      {/* Right glowing lower paw print */}
      <div className="absolute right-1 bottom-6 text-2xl sm:text-3xl text-[#c026d3] opacity-80 filter drop-shadow-[0_0_14px_#d946ef] pointer-events-none animate-pulse">
        🐾
      </div>

      {/* Speech Bubble - Precisely positioned at top-right of King Tom */}
      <div className="relative w-full max-w-[400px] flex justify-end pr-2 z-20 -mb-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={speechIndex}
            initial={{ scale: 0.85, opacity: 0, y: 5 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => {
              e.stopPropagation();
              sound.playCatMeow();
              if (currentSpeech.isDeposit && onNavigateToDeposit) {
                onNavigateToDeposit();
              }
            }}
            className={`relative px-3.5 py-1.5 rounded-2xl shadow-[0_4px_18px_rgba(0,0,0,0.6)] flex items-center gap-1 border cursor-pointer select-none ${
              currentSpeech.isDeposit
                ? 'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 text-slate-950 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.5)]'
                : 'bg-white text-black border-white/80'
            }`}
          >
            <span className="text-[12px] sm:text-[12.5px] font-black tracking-tight whitespace-nowrap">
              {currentSpeech.text}
            </span>
            {currentSpeech.isDeposit && (
              <span className="text-[9px] font-black uppercase bg-slate-950 text-amber-300 px-1 py-0.2 rounded-xs ml-0.5">
                GO &gt;
              </span>
            )}
            {/* Bubble tail pointing down-left towards King Tom */}
            <div
              className={`absolute -bottom-2 left-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${
                currentSpeech.isDeposit ? 'border-t-amber-300' : 'border-t-white'
              }`}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Main King Tom Throne and Gold Coins Container */}
      <div
        onClick={handleCatClick}
        className="relative w-full max-w-[410px] cursor-pointer flex justify-center items-center active:scale-[0.98] transition-transform group"
      >
        {/* Soft Radial Ambient Backglows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-radial from-fuchsia-600/30 via-purple-700/20 to-transparent blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-60 h-16 bg-amber-500/25 blur-2xl rounded-full pointer-events-none -z-10" />

        {/* High-Resolution King Tom Throne Image */}
        <img
          src={catThroneImg}
          alt="King Tom on Royal Throne with Gold Coins"
          className="w-full h-auto object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] drop-shadow-[0_0_20px_rgba(217,70,239,0.25)] transition-all group-hover:brightness-105"
        />

        {/* Floating Tap Hearts when petting */}
        {floatingTaps.map((tap) => (
          <motion.div
            key={tap.id}
            initial={{ opacity: 1, y: tap.y, x: tap.x, scale: 0.8 }}
            animate={{ opacity: 0, y: tap.y - 65, scale: 1.3 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute pointer-events-none z-30 flex items-center gap-1 font-black text-amber-300 text-sm drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
          >
            <span>Purr ✨</span>
            <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
