import React, { useState } from 'react';
import chestPurpleImg from '../assets/dashboard/chest_purple.png';
import { 
  Send, 
  MessageCircle, 
  Share2, 
  Users, 
  Crown, 
  CalendarCheck, 
  Cookie, 
  Clock, 
  Disc, 
  Sparkles, 
  Trophy, 
  Check, 
  ShieldCheck, 
  Gift,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { Mission, MissionCategory } from '../config/gameConfig';
import { formatNumber } from '../utils/probability';
import { sound } from '../utils/sound';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Send,
  MessageCircle,
  Share2,
  Users,
  Crown,
  CalendarCheck,
  Cookie,
  Clock,
  Disc,
  Sparkles,
  Trophy
};

export const Missions: React.FC = () => {
  const { missions, verifyMission, claimMission, user, showToast } = useGame();
  const [activeCategory, setActiveCategory] = useState<MissionCategory | 'all'>('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // 4 Filter categories per prompt specifications
  const categories: { id: 'all' | MissionCategory; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: missions.length },
    { id: 'daily', label: 'Daily', count: missions.filter(m => m.category === 'daily').length },
    { id: 'social', label: 'Social', count: missions.filter(m => m.category === 'social').length },
    { id: 'special', label: 'Special', count: missions.filter(m => m.category === 'special').length },
  ];

  const filteredMissions = missions.filter(m => 
    activeCategory === 'all' ? true : m.category === activeCategory
  );

  const totalRewardsAvailable = missions.reduce((sum, m) => sum + m.reward, 0);

  // Fully connected mission interaction handler
  const handleMissionInteraction = async (mission: Mission) => {
    sound.playTap();

    if (mission.status === 'claimed') {
      showToast('Already Claimed', 'You have already claimed this mission bounty!', 'info');
      return;
    }

    if (mission.status === 'completed') {
      setClaimingId(mission.id);
      claimMission(mission.id);
      setTimeout(() => setClaimingId(null), 1000);
      return;
    }

    if (mission.status === 'verify' || mission.status === 'in_progress') {
      setVerifyingId(mission.id);
      verifyMission(mission.id);
      setTimeout(() => setVerifyingId(null), 1500);
      return;
    }

    // Status: 'start'
    if (mission.actionUrl) {
      if (window.Telegram?.WebApp?.openTelegramLink && mission.actionUrl.includes('t.me/')) {
        window.Telegram.WebApp.openTelegramLink(mission.actionUrl);
      } else {
        window.open(mission.actionUrl, '_blank', 'noopener,noreferrer');
      }
      setVerifyingId(mission.id);
      setTimeout(() => {
        verifyMission(mission.id);
        setVerifyingId(null);
      }, 2500);
      return;
    }

    if (mission.id === 'm4_invite_3') {
      const botUser = 'SuperrTombot';
      const refCode = user?.referralCode || 'TOMVIP';
      const shareUrl = `https://t.me/${botUser}?startapp=${refCode}`;
      if (mission.status === 'start') {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl);
        }
        showToast('Invite Friends', 'Share your link with 3 friends! Rewards unlock when they open the bot.', 'info');
        verifyMission(mission.id);
        return;
      }
      setVerifyingId(mission.id);
      verifyMission(mission.id);
      setTimeout(() => setVerifyingId(null), 1200);
      return;
    }

    if (mission.id === 'm5_feed_5_biscuits') {
      showToast('Feed Tom', 'Feed King Tom biscuits on the home screen to progress on this quest!', 'info');
      verifyMission(mission.id);
      return;
    }

    setVerifyingId(mission.id);
    verifyMission(mission.id);
    setTimeout(() => setVerifyingId(null), 1200);
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* 3. REWARD BANNER featuring SuperTom cat mascot & 3D treasure chest */}
      <div className="rounded-3xl glass-panel p-4.5 border border-purple-500/40 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#1b0838] via-[#120526] to-[#080214]">
        {/* Ambient neon purple and gold glow rings */}
        <div className="absolute -top-14 -right-14 w-40 h-40 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-center justify-between gap-3">
          {/* Text & Headlines */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Gift className="w-3 h-3" />
              <span>Royal Bounty</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-300 font-display tracking-tight leading-tight drop-shadow-[0_2px_8px_rgba(234,179,8,0.3)]">
              Complete Missions!
            </h2>
            <h3 className="text-base sm:text-lg font-black text-white font-display leading-tight">
              Earn Free Poops!
            </h3>

            <p className="text-xs text-purple-200/80 mt-1 leading-snug">
              Complete tasks to unlock instant Poops rewards and boost King Tom!
            </p>

            {/* Total Rewards Available in Catalogue */}
            <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-purple-500/20 text-xs">
              <div>
                <span className="text-[10px] text-purple-300/70 block uppercase font-bold">Total Rewards Pool</span>
                <span className="text-sm font-black text-amber-400 font-mono">
                  +{totalRewardsAvailable.toLocaleString()} 💩
                </span>
              </div>
              <div className="w-[1px] h-6 bg-purple-500/30" />
              <div>
                <span className="text-[10px] text-purple-300/70 block uppercase font-bold">Quests</span>
                <span className="text-sm font-black text-purple-200 font-mono">
                  {missions.length} Available
                </span>
              </div>
            </div>
          </div>

          {/* Dual 3D Graphic: Cat Mascot with Treasure Chest */}
          <div className="relative shrink-0 flex items-center">
            {/* Treasure Chest */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-amber-400/50 p-0.5 bg-purple-950/80 shadow-[0_0_20px_rgba(234,179,8,0.35)] -mr-4 z-10">
              <img
                src={chestPurpleImg}
                alt="Treasure Chest"
                className="w-full h-full object-contain p-1 rounded-xl"
              />
            </div>

            {/* Cat Mascot Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-amber-400 p-0.5 bg-purple-900 shadow-[0_0_25px_rgba(168,85,247,0.5)] z-20">
              <img
                src="/assets/dashboard/avatar.png"
                alt="SuperTom Cat Mascot"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Live Quests Banner */}
        <div className="mt-3.5 p-2.5 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-[11px] text-purple-200/90 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong className="text-emerald-300">Live Quests:</strong> Complete quests and claim verified rewards directly to your balance. All progress is server-validated.
          </p>
        </div>
      </div>

      {/* 4. MISSION CATEGORIES (4 Filters: All, Daily, Social, Special) */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-purple-950/60 border border-purple-500/25">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => {
                if (activeCategory !== cat.id) {
                  sound.playTabSwitch();
                } else {
                  sound.playTap();
                }
                setActiveCategory(cat.id);
              }}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-amber-300/50 scale-[1.02]'
                  : 'text-purple-300/70 hover:text-white hover:bg-purple-900/40'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                isActive ? 'bg-black/40 text-amber-200' : 'bg-purple-900/60 text-purple-300'
              }`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 5. MISSION CARDS LIST */}
      <div className="space-y-3">
        {filteredMissions.map((mission) => {
          const Icon = iconMap[mission.icon] || Sparkles;
          const isCompleted = mission.status === 'completed';
          const isClaimed = mission.status === 'claimed';

          return (
            <div
              key={mission.id}
              className="rounded-3xl p-4 glass-panel border border-purple-500/25 hover:border-purple-400/50 bg-[#120524] transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                {/* 3D Icon Container */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-purple-400/50 bg-gradient-to-br from-purple-700 to-pink-700 text-white shadow-lg shadow-purple-600/30">
                  <Icon className="w-6 h-6 drop-shadow-md" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-extrabold text-white font-display tracking-tight">
                      {mission.title}
                    </h4>
                    {mission.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-900/60 text-amber-300 border border-purple-400/30">
                        {mission.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-purple-200/80 mt-1 leading-relaxed">
                    {mission.description}
                  </p>

                  {/* Progress Indicator */}
                  {mission.total > 1 && (
                    <div className="mt-2.5">
                      <div className="flex justify-between items-center text-[10px] font-semibold text-purple-300/80 mb-1">
                        <span>Progress</span>
                        <span className="font-mono text-amber-300 font-bold">
                          {Math.min(mission.progress || 0, mission.total)} / {mission.total}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-purple-950 border border-purple-500/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-amber-400 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.round(((mission.progress || 0) / mission.total) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Reward Amount */}
                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-xs">💩</span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      +{formatNumber(mission.reward)}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase font-bold text-purple-300/70">
                    POOPS
                  </span>
                </div>
              </div>

              {/* Status and Action Button Bar */}
              <div className="mt-3.5 pt-3 border-t border-purple-500/20 flex items-center justify-between gap-2">
                {/* Status Indicator */}
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className="text-purple-300/70">Status:</span>
                  {isClaimed ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Claimed
                    </span>
                  ) : isCompleted ? (
                    <span className="text-amber-400 font-bold animate-pulse">
                      Ready to Claim!
                    </span>
                  ) : mission.status === 'verify' || mission.status === 'in_progress' ? (
                    <span className="text-cyan-400 font-bold">
                      In Progress
                    </span>
                  ) : (
                    <span className="text-purple-300 font-bold">
                      Available
                    </span>
                  )}
                </div>

                {/* Action Button: State-driven interactive UI */}
                <div>
                  {isClaimed ? (
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Claimed</span>
                    </div>
                  ) : isCompleted ? (
                    <button
                      onClick={() => handleMissionInteraction(mission)}
                      disabled={claimingId === mission.id}
                      className="px-4 py-1.5 rounded-xl btn-gold-3d text-purple-950 text-xs font-extrabold flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {claimingId === mission.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Claiming...</span>
                        </>
                      ) : (
                        <>
                          <Gift className="w-3.5 h-3.5" />
                          <span>Claim Reward</span>
                        </>
                      )}
                    </button>
                  ) : mission.status === 'verify' || verifyingId === mission.id ? (
                    <button
                      onClick={() => handleMissionInteraction(mission)}
                      disabled={verifyingId === mission.id}
                      className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${verifyingId === mission.id ? 'animate-spin' : ''}`} />
                      <span>{verifyingId === mission.id ? 'Verifying...' : 'Verify Quest'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMissionInteraction(mission)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800/70 text-white border border-purple-400/30 text-xs font-bold flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <span>{mission.actionUrl ? 'Open Link' : 'Start Quest'}</span>
                      <ArrowRight className="w-3 h-3 text-amber-300" />
                    </button>
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
