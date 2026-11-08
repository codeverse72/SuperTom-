import React, { useState } from 'react';
import { 
  User, 
  Crown, 
  Copy, 
  Share2, 
  Check, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  Info, 
  ChevronRight, 
  Sparkles,
  Users,
  Trophy,
  Cookie,
  Headphones,
  ExternalLink
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useTelegram } from '../hooks/useTelegram';
import { generateReferralLink } from '../utils/telegram';
import { formatNumber, poopsToUsdt } from '../utils/probability';

export const Profile: React.FC = () => {
  const { 
    balance, 
    user, 
    productionRate, 
    soundEnabled, 
    toggleSound, 
    showToast 
  } = useGame();

  const { shareLink, hapticSelection } = useTelegram();

  const [copiedLink, setCopiedLink] = useState(false);
  const [activeModal, setActiveModal] = useState<'stats' | 'referral' | 'faq' | 'about' | null>(null);

  const referralUrl = generateReferralLink(user?.referralCode || 'UNLINKED');

  const handleCopyReferral = () => {
    hapticSelection();
    navigator.clipboard?.writeText(referralUrl);
    setCopiedLink(true);
    showToast('Copied!', 'Your SuperTom referral link was copied to clipboard.', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareReferral = () => {
    hapticSelection();
    shareLink(referralUrl, 'Join me on SuperTom and start mining with King Tom! 👑🐱');
  };

  const displayUsername = user?.username || 'Guest Player';
  const displayLevel = user ? `Lvl ${user.level}` : 'Lvl --';
  const displayPlayerId = user?.id || 'Unlinked';
  const displayRank = user?.levelTitle || 'Unauthenticated';

  return (
    <div className="space-y-4 pb-20">
      {/* Player Profile Card */}
      <div className="rounded-3xl glass-panel p-5 border border-purple-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-4">
          {/* Avatar with golden border */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 p-0.5 bg-purple-900 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
              <img
                src="/assets/dashboard/avatar.png"
                alt="Profile Avatar"
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-purple-950 flex items-center justify-center text-xs font-black shadow-md">
              👑
            </div>
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white font-display truncate">
                {displayUsername}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 shrink-0">
                {displayLevel}
              </span>
            </div>

            <p className="text-xs text-purple-300/80 font-mono mt-0.5">
              Player ID: <span className="text-white font-bold">{displayPlayerId}</span>
            </p>

            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-300 font-bold">
              <Crown className="w-3.5 h-3.5" />
              <span>{displayRank}</span>
            </div>
          </div>
        </div>

        {/* Highlight Stats Row */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-purple-500/20 text-center">
          <div className="p-2 rounded-2xl bg-purple-950/40 border border-purple-500/20">
            <span className="text-[10px] uppercase font-bold text-purple-300/80 block">Poops</span>
            <span className="text-sm font-black text-amber-400 font-mono tabular-nums">
              {formatNumber(balance)}
            </span>
          </div>

          <div className="p-2 rounded-2xl bg-purple-950/40 border border-purple-500/20">
            <span className="text-[10px] uppercase font-bold text-purple-300/80 block">USDT Value</span>
            <span className="text-sm font-black text-emerald-400 font-mono tabular-nums">
              {poopsToUsdt(balance) === '--' ? '--' : `$${poopsToUsdt(balance)}`}
            </span>
          </div>

          <div className="p-2 rounded-2xl bg-purple-950/40 border border-purple-500/20">
            <span className="text-[10px] uppercase font-bold text-purple-300/80 block">Mining Rate</span>
            <span className="text-sm font-black text-purple-200 font-mono tabular-nums">
              {productionRate !== null ? `+${productionRate}/h` : '--/h'}
            </span>
          </div>
        </div>

        {/* Empty state disclaimer if unauthenticated */}
        {!user && (
          <div className="mt-3.5 p-2.5 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-[11px] text-purple-200/90 text-center">
            <span>No account data available. Connect your account to access this feature.</span>
          </div>
        )}
      </div>

      {/* Profile Menu Sections */}
      <div className="rounded-3xl glass-panel p-2 border border-purple-500/30 shadow-2xl space-y-1">
        {/* 1. My Stats */}
        <button
          onClick={() => setActiveModal('stats')}
          className="w-full p-3.5 rounded-2xl flex items-center justify-between hover:bg-purple-900/30 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-amber-300">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-display">My Stats & Records</span>
              <p className="text-[11px] text-purple-300/70">Feeding totals, missions & achievements</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </button>

        {/* 2. Referral Program */}
        <button
          onClick={() => setActiveModal('referral')}
          className="w-full p-3.5 rounded-2xl flex items-center justify-between hover:bg-purple-900/30 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-600/30 border border-pink-400/40 flex items-center justify-center text-pink-300">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-display">Referral Program</span>
              <p className="text-[11px] text-purple-300/70">{user?.friendsInvited ?? 0} friends invited · +{user?.referralEarnings ?? 0} Poops earned</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </button>

        {/* 3. Audio & Haptics Toggle */}
        <div className="p-3.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-sm font-bold text-white font-display">Sound Effects</span>
              <p className="text-[11px] text-purple-300/70">Crunch, coin dings and fanfare</p>
            </div>
          </div>
          <button
            onClick={toggleSound}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              soundEnabled
                ? 'bg-amber-400 text-purple-950 shadow-md'
                : 'bg-purple-950/60 text-purple-400 border border-purple-500/20'
            }`}
          >
            {soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* 4. 24/7 Live Customer Support */}
        <a
          href="https://t.me/SuperTomCare"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (window.Telegram?.WebApp?.openTelegramLink) {
              e.preventDefault();
              window.Telegram.WebApp.openTelegramLink('https://t.me/SuperTomCare');
            }
          }}
          className="w-full p-3.5 rounded-2xl flex items-center justify-between hover:bg-purple-900/30 transition-all text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white font-display">Customer Support</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  @SuperTomCare
                </span>
              </div>
              <p className="text-[11px] text-purple-300/70">24/7 Live Agent & Payout Help</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-emerald-400" />
        </a>

        {/* 6. Help & Support */}
        <button
          onClick={() => setActiveModal('faq')}
          className="w-full p-3.5 rounded-2xl flex items-center justify-between hover:bg-purple-900/30 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-display">Help & Support</span>
              <p className="text-[11px] text-purple-300/70">How to play, mining rules & conversions</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </button>

        {/* 6. About SuperTom */}
        <button
          onClick={() => setActiveModal('about')}
          className="w-full p-3.5 rounded-2xl flex items-center justify-between hover:bg-purple-900/30 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-800/40 border border-purple-500/40 flex items-center justify-center text-purple-200">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white font-display">About SuperTom</span>
              <p className="text-[11px] text-purple-300/70">Lore, tokenomics & roadmap</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </button>
      </div>

      {/* Modals for Profile Sections */}

      {/* Stats Modal */}
      {activeModal === 'stats' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl glass-panel p-5 border border-purple-500/40 shadow-2xl bg-[#140628]">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <h3 className="text-base font-extrabold text-white font-display">
                Player Mining Stats
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300 hover:text-white p-1">✕</button>
            </div>
            <div className="py-4 space-y-2.5 text-xs">
              {!user && (
                <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-500/20 text-purple-300 text-center text-[11px] mb-2">
                  No player statistics available. Connect account to view history.
                </div>
              )}
              <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20 flex justify-between">
                <span className="text-purple-300">Total Biscuits Fed:</span>
                <span className="font-bold text-white">{user ? `${user.totalBiscuitsFed} biscuits` : '--'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20 flex justify-between">
                <span className="text-purple-300">Completed Missions:</span>
                <span className="font-bold text-white">{user ? `${user.totalMissionsDone} quests` : '--'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20 flex justify-between">
                <span className="text-purple-300">Current Production:</span>
                <span className="font-bold text-emerald-400">{productionRate !== null ? `+${productionRate} Poops / hr` : '0 Poops / hr'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20 flex justify-between">
                <span className="text-purple-300">Account Rank:</span>
                <span className="font-bold text-amber-300">{user?.levelTitle || 'Unauthenticated'}</span>
              </div>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-purple-600/60 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {activeModal === 'referral' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl glass-panel p-5 border border-purple-500/40 shadow-2xl bg-[#140628]">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <h3 className="text-base font-extrabold text-white font-display">
                Invite & Earn
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300 hover:text-white p-1">✕</button>
            </div>
            <div className="py-4 space-y-3">
              <p className="text-xs text-purple-200/90 leading-relaxed">
                Earn <strong className="text-amber-300">2,000 Poops</strong> for every friend who joins SuperTom via your referral link, plus 10% of their biscuit production!
              </p>

              <div className="p-3 rounded-2xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-white truncate">
                  {referralUrl}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleCopyReferral}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 text-purple-950 font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer hover:bg-amber-300"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 stroke-[3px]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleShareReferral}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/20">
                  <span className="text-purple-300/70 block text-[10px]">Friends Joined</span>
                  <span className="font-bold text-white text-sm">{user?.friendsInvited ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/20">
                  <span className="text-purple-300/70 block text-[10px]">Bonus Earned</span>
                  <span className="font-bold text-amber-400 text-sm">+{user?.referralEarnings ?? 0} 💩</span>
                </div>
              </div>

              {!user && (
                <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/20 text-[10px] text-amber-300/90 text-center">
                  Referral tracking requires active backend connection.
                </div>
              )}
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl btn-gold-3d font-bold text-xs uppercase"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {activeModal === 'faq' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl glass-panel p-5 border border-purple-500/40 shadow-2xl bg-[#140628] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <h3 className="text-base font-extrabold text-white font-display">
                Help & FAQ
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300 hover:text-white p-1">✕</button>
            </div>
            <div className="py-4 space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-purple-950/60 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Headphones className="w-4 h-4" />
                    <span>Need Help? Contact Support</span>
                  </div>
                  <p className="text-[11px] text-purple-200/80 mt-0.5">
                    Live 24/7 assistance on Telegram at <span className="text-emerald-300 font-mono font-bold">@SuperTomCare</span>
                  </p>
                </div>
                <a
                  href="https://t.me/SuperTomCare"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (window.Telegram?.WebApp?.openTelegramLink) {
                      e.preventDefault();
                      window.Telegram.WebApp.openTelegramLink('https://t.me/SuperTomCare');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md"
                >
                  Chat Now
                </a>
              </div>

              <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20">
                <h4 className="font-bold text-amber-300">How do I mine Poops?</h4>
                <p className="text-purple-200/80 mt-1">
                  King Tom automatically generates Poops every hour. Feed him biscuits in the Store to increase his production rate permanently!
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20">
                <h4 className="font-bold text-amber-300">What is the USDT conversion?</h4>
                <p className="text-purple-200/80 mt-1">
                  2,000 Poops = 1 USDT. You can request withdrawals to your TRC20 wallet in the Payout tab starting from 2,000 Poops.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20">
                <h4 className="font-bold text-amber-300">How does the Free Spin work?</h4>
                <p className="text-purple-200/80 mt-1">
                  Free spins unlock across 3 milestones: 2 hours, 4 hours, and 8 hours. Once claimed, the next timer starts automatically.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-purple-600/60 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* About Modal */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl glass-panel p-5 border border-purple-500/40 shadow-2xl bg-[#140628]">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <h3 className="text-base font-extrabold text-white font-display">
                About SuperTom 🐱
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300 hover:text-white p-1">✕</button>
            </div>
            <div className="py-4 space-y-2.5 text-xs text-purple-200/90 leading-relaxed">
              <p>
                <strong>SuperTom</strong> is the royal feline sovereign of the blockchain bakery. Wearing cool sunglasses and a 24k crown, he turns delicious biscuits into valuable Poop currency.
              </p>
              <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20 font-mono text-[10px]">
                <div>Version: 1.0.0 (Production Frontend)</div>
                <div>Network: Telegram Mini App / Web</div>
                <div>Status: Production Frontend (Telegram Mini App)</div>
              </div>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl btn-gold-3d font-bold text-xs uppercase"
            >
              Long Live The King
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
