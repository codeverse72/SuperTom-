import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { X, Sparkles, Trophy, CheckCircle2 } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { SPIN_REWARDS, SpinRewardConfig } from '../config/gameConfig';
import { sound } from '../utils/sound';

export const SpinWheelModal: React.FC = () => {
  const { isWheelOpen, setIsWheelOpen, executeSpin, claimSpinMilestone } = useGame();

  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [wonReward, setWonReward] = useState<SpinRewardConfig | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);

  const numSectors = SPIN_REWARDS.length;
  const sectorAngle = 360 / numSectors;

  const currentRotationRef = useRef(0);

  const handleStartSpin = () => {
    if (isSpinning) return;

    sound.playTap();
    setIsSpinning(true);
    setWonReward(null);

    // 1. Select reward via weighted probability algorithm
    const { reward, index } = executeSpin();

    // 2. Calculate target angle so pointer at top (12 o'clock / 0 deg) lands exactly on selected sector
    // Sector i center is at: i * sectorAngle + sectorAngle / 2
    const sectorCenter = index * sectorAngle + sectorAngle / 2;

    // Minimum 5 full rotations (1800 deg) + angle to bring sectorCenter to top (360 - sectorCenter)
    // Add subtle randomized offset within sector bounds (+/- 12 deg) for natural feel
    const randomJitter = (Math.random() - 0.5) * (sectorAngle * 0.4);
    const extraRotations = 5 * 360;
    const targetAngle = currentRotationRef.current + extraRotations + (360 - (currentRotationRef.current % 360)) + (360 - sectorCenter) + randomJitter;

    currentRotationRef.current = targetAngle;
    setRotationAngle(targetAngle);

    // Periodic tick sounds during rotation
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      sound.playWheelTick();
      tickCount++;
      if (tickCount > 28) clearInterval(tickInterval);
    }, 140);

    // 3. Wait for spin animation to complete (4.5s)
    setTimeout(() => {
      clearInterval(tickInterval);
      setIsSpinning(false);
      setWonReward(reward);
      setShowRewardModal(true);
      sound.playWin();

      // Trigger Confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#eab308', '#a855f7', '#ec4899', '#3b82f6', '#10b981']
        });
      } catch {
        // ignore
      }
    }, 4500);
  };

  const handleClaimReward = () => {
    if (wonReward) {
      claimSpinMilestone(wonReward);
      setShowRewardModal(false);
      setIsWheelOpen(false);
      setWonReward(null);
    }
  };

  if (!isWheelOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl glass-panel p-5 border border-purple-500/40 shadow-2xl flex flex-col items-center">
        {/* Top Close Button */}
        <button
          onClick={() => {
            if (!isSpinning) setIsWheelOpen(false);
          }}
          disabled={isSpinning}
          className="absolute top-4 right-4 p-1.5 rounded-full text-purple-300 hover:text-white bg-purple-950/60 border border-purple-500/30 transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>LUCKY REWARD WHEEL</span>
          </div>
          <h2 className="text-lg font-black text-white font-display tracking-tight">
            Spin King Tom’s Wheel
          </h2>
          <p className="text-[11px] text-purple-300/80">
            Win up to 2,000 Poops or Mythic Biscuits!
          </p>
        </div>

        {/* Wheel Container with Top Pointer */}
        <div className="relative w-72 h-72 my-2 flex items-center justify-center select-none">
          {/* Outer Neon Glow Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-amber-400/40 shadow-[0_0_35px_rgba(168,85,247,0.4)] pointer-events-none" />

          {/* Golden Pointer at 12 o'clock pointing downward */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
            <div className="w-5 h-7 bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-600 rounded-t-sm shadow-xl border border-yellow-200 clip-pointer"
                 style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-200 -mt-7 shadow-sm border border-amber-500" />
          </div>

          {/* Rotating Wheel Canvas/SVG */}
          <motion.div
            animate={{ rotate: rotationAngle }}
            transition={{
              duration: 4.5,
              ease: [0.15, 0.95, 0.25, 1.0] // Realistic natural deceleration curve
            }}
            className="w-full h-full rounded-full overflow-hidden shadow-2xl relative border-2 border-amber-400/80 bg-[#14062a]"
          >
            <svg viewBox="0 0 300 300" className="w-full h-full">
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.8" />
                </filter>
              </defs>

              {SPIN_REWARDS.map((reward, i) => {
                const angle = 360 / numSectors;
                const startAngle = i * angle;
                const endAngle = (i + 1) * angle;

                // SVG Arc Path coordinates (center 150, 150, radius 146)
                const r = 146;
                const cx = 150;
                const cy = 150;
                const rad = (deg: number) => (deg - 90) * (Math.PI / 180);

                const x1 = cx + r * Math.cos(rad(startAngle));
                const y1 = cy + r * Math.sin(rad(startAngle));
                const x2 = cx + r * Math.cos(rad(endAngle));
                const y2 = cy + r * Math.sin(rad(endAngle));

                const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;

                // Text angle in the center of sector
                const midAngle = startAngle + angle / 2;

                return (
                  <g key={reward.id}>
                    <path
                      d={pathData}
                      fill={reward.color}
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                      opacity="0.95"
                    />
                    <g transform={`rotate(${midAngle}, 150, 150)`}>
                      <text
                        x="150"
                        y="46"
                        fill={reward.textColor}
                        fontSize="11"
                        fontWeight="800"
                        fontFamily="Outfit, sans-serif"
                        textAnchor="middle"
                        filter="url(#shadow)"
                      >
                        {reward.label}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Center golden hub button */}
              <circle cx="150" cy="150" r="28" fill="#ca8a04" stroke="#fef08a" strokeWidth="3" />
              <circle cx="150" cy="150" r="20" fill="#422006" />
              <text x="150" y="154" fill="#fef08a" fontSize="13" fontWeight="900" textAnchor="middle">
                TOM
              </text>
            </svg>
          </motion.div>
        </div>

        {/* Probabilities Note */}
        <div className="w-full mt-2 text-[10px] text-purple-300/70 text-center flex items-center justify-center gap-1">
          <span>Configured Odds: 100 Poops (99%) · Others (1%)</span>
        </div>

        {/* Action Button */}
        <div className="w-full mt-3">
          <button
            onClick={handleStartSpin}
            disabled={isSpinning}
            className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl ${
              isSpinning
                ? 'bg-purple-900/50 text-purple-400 cursor-not-allowed border border-purple-500/20'
                : 'btn-gold-3d cursor-pointer'
            }`}
          >
            {isSpinning ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>SPINNING WHEEL...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-950 fill-purple-950" />
                <span>SPIN NOW</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Reward Reveal Modal */}
      <AnimatePresence>
        {showRewardModal && wonReward && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-xs rounded-3xl glass-panel p-6 border-2 border-amber-400 shadow-[0_0_50px_rgba(234,179,8,0.4)] flex flex-col items-center text-center bg-[#180930]"
            >
              <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 mb-3 shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                <Trophy className="w-8 h-8 animate-bounce" />
              </div>

              <span className="text-xs font-bold text-amber-300 tracking-widest uppercase">
                Congratulations!
              </span>

              <h3 className="text-2xl font-black text-white font-display mt-1">
                {wonReward.label}
              </h3>

              <p className="text-xs text-purple-200/90 mt-1.5 leading-relaxed">
                {wonReward.rewardType === 'poops'
                  ? `Wheel landed on ${wonReward.label}. Real reward claiming will be verified on backend servers upon official launch.`
                  : `Wheel landed on ${wonReward.label}. Inventory delivery requires backend connection.`}
              </p>

              <div className="w-full mt-3 p-2.5 rounded-xl bg-purple-950/80 border border-purple-500/30 text-[10px] text-amber-300 font-semibold">
                🛡️ Preview Mode: No fabricated balance changes are made.
              </div>

              <button
                onClick={handleClaimReward}
                className="w-full mt-4 py-3 rounded-2xl btn-purple-3d font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Acknowledge & Close</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
