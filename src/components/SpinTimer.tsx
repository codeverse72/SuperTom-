import React, { useState, useEffect } from 'react';
import { Lock, Check, Info, Clock } from 'lucide-react';
import { useGame } from '../context/GameContext';
import wheel3dImg from '../assets/dashboard/wheel_3d.png';

export const SpinTimer: React.FC = () => {
  const { setIsWheelOpen, triggerNotice } = useGame();

  // Reference countdown: 04:12:36 with live second tick down
  const [secondsLeft, setSecondsLeft] = useState(4 * 3600 + 12 * 60 + 36);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 4 * 3600 + 12 * 60 + 36));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSpinClick = () => {
    setIsWheelOpen(true);
  };

  return (
    <div className="relative rounded-[26px] p-[2px] bg-gradient-to-r from-[#ff00aa] via-[#a855f7] to-[#ffaa00] shadow-[0_0_24px_rgba(255,0,153,0.3)]">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-[#180a33] via-[#120527] to-[#0c031d] px-3.5 py-3 sm:py-3.5">
        
        {/* Top Half: 3D Wheel + Info + 04:12:36 Timer + Spin Now Button */}
        <div className="flex items-center justify-between gap-2.5">
          {/* Left: 3D Colorful Lucky Wheel */}
          <div 
            onClick={handleSpinClick}
            className="relative shrink-0 w-16 h-18 sm:w-20 sm:h-22 cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-200 select-none flex items-center justify-center group"
          >
            {/* Ambient golden glow behind wheel */}
            <div className="absolute inset-0 bg-radial from-amber-500/25 via-purple-600/15 to-transparent blur-md pointer-events-none group-hover:from-amber-400/35 transition-all" />
            <img
              src={wheel3dImg}
              alt="Lucky Spin Wheel"
              className="w-full h-full object-contain filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.65)] drop-shadow-[0_0_14px_rgba(255,170,0,0.4)]"
            />
          </div>

          {/* Middle: Info Label + Huge 04:12:36 Countdown */}
          <div className="flex-1 min-w-0">
            {/* "ⓘ Free Spin Available In" */}
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-purple-200">
              <Info className="w-3.5 h-3.5 text-purple-300 stroke-[2.2]" />
              <span>Free Spin Available In</span>
            </div>

            {/* "🕒 04:12:36" */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="w-5 h-5 text-[#ffd700] fill-[#ffd700]/20 stroke-[2.5]" />
              <span className="text-xl sm:text-2xl font-black text-[#ffd700] font-mono tracking-wider drop-shadow-[0_0_12px_rgba(255,215,0,0.7)]">
                {formatCountdown(secondsLeft)}
              </span>
            </div>
          </div>

          {/* Right: "🎁 Spin Now" Button with Red Dot + "Next Spin at 8hr" Tag */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={handleSpinClick}
              className="relative px-3 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#2563eb] via-[#7c3aed] to-[#9333ea] hover:brightness-110 active:scale-95 text-white font-black text-xs tracking-tight shadow-[0_4px_14px_rgba(124,58,237,0.5)] flex items-center gap-1 cursor-pointer border border-purple-400/40"
            >
              <span>🎁</span>
              <span>Spin Now</span>
              {/* Red Notification Dot */}
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-[#180a33] animate-pulse" />
            </button>

            {/* Next Spin at 8hr Tag */}
            <span className="text-[10px] font-bold text-purple-200 bg-[#4c1d95]/70 border border-purple-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
              Next Spin at 8hr
            </span>
          </div>
        </div>

        {/* Bottom Half: 4 Milestones Progress Bar (2hr ✓, 4hr ✓, 8hr 🔒, Next Cycle 🔒) */}
        <div className="mt-3.5 pt-2.5 border-t border-purple-500/20">
          <div className="relative flex items-center justify-between px-2 sm:px-4">
            
            {/* Connecting Track Line */}
            <div className="absolute left-6 right-8 top-3 h-[3px] bg-purple-900 -z-0">
              {/* Yellow completed portion (from 2hr through 4hr to mid) */}
              <div className="h-full bg-gradient-to-r from-[#ffd700] via-[#ffd700] to-purple-800 w-[50%]" />
            </div>

            {/* Node 1: 2hr (Completed ✓) */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-[#ffd700] text-[#3a1d00] flex items-center justify-center font-black shadow-[0_0_10px_rgba(255,215,0,0.7)]">
                <Check className="w-3.5 h-3.5 stroke-[3.5]" />
              </div>
              <span className="text-[11px] font-black text-[#ffd700] mt-1">2hr</span>
            </div>

            {/* Node 2: 4hr (Completed ✓) */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-[#ffd700] text-[#3a1d00] flex items-center justify-center font-black shadow-[0_0_10px_rgba(255,215,0,0.7)]">
                <Check className="w-3.5 h-3.5 stroke-[3.5]" />
              </div>
              <span className="text-[11px] font-black text-[#ffd700] mt-1">4hr</span>
            </div>

            {/* Node 3: 8hr (Locked 🔒) */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-[#3b1261] border border-purple-400/50 text-purple-200 flex items-center justify-center">
                <Lock className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-bold text-purple-300 mt-1">8hr</span>
            </div>

            {/* Node 4: Next Cycle (Locked 🔒) */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-[#3b1261] border border-purple-400/50 text-purple-200 flex items-center justify-center">
                <Lock className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-bold text-purple-300 mt-1 whitespace-nowrap">Next Cycle</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

