import React, { useState } from 'react';
import { Volume2, VolumeX, X, HelpCircle, Bell, Sparkles, Headset } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useTelegram } from '../hooks/useTelegram';
import { formatNumber } from '../utils/probability';
import { NavTab } from './BottomNavigation';
import { sound } from '../utils/sound';

interface HeaderProps {
  activeTab?: NavTab;
}

export const Header: React.FC<HeaderProps> = ({ activeTab = 'home' }) => {
  const { soundEnabled, toggleSound, balance, showToast } = useGame();
  const { close: closeTelegram, isTelegram } = useTelegram();
  const [showMenu, setShowMenu] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 px-3.5 pt-3 pb-2 bg-transparent">
        <div className="flex items-center justify-between">
          {/* Logo & Brand Zone */}
          <div className="flex items-center gap-2.5">
            {/* Avatar with golden circular ring */}
            <div className="relative">
              <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-b from-amber-300 via-amber-500 to-yellow-600 shadow-[0_0_12px_rgba(245,158,11,0.5)]">
                <img
                  src="/assets/dashboard/avatar.png"
                  alt="SuperTom"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-black text-white tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  SuperTom
                </h1>
                {/* Blue Verified Checkmark Badge */}
                <div className="w-4 h-4 rounded-full bg-[#1d9bf0] flex items-center justify-center shadow-sm shrink-0">
                  <svg className="w-2.5 h-2.5 text-white stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <p className="text-[12px] font-medium text-purple-200/90 tracking-wide mt-0.5">
                Mine • Feed • Earn
              </p>
            </div>
          </div>

          {/* Right Action Icons: Telegram-style circular buttons */}
          <div className="flex items-center gap-2">
            {/* Customer Support SVG Button (Left side to "...") */}
            <button
              onClick={() => {
                sound.playTap();
                if (window.Telegram?.WebApp?.openTelegramLink) {
                  window.Telegram.WebApp.openTelegramLink('https://t.me/SuperTomCare');
                } else {
                  window.open('https://t.me/SuperTomCare', '_blank');
                }
              }}
              className="relative w-9 h-9 rounded-full bg-[#180a33]/80 hover:bg-[#281353] border border-emerald-500/40 hover:border-emerald-400 flex items-center justify-center text-emerald-400 hover:text-emerald-300 transition-all active:scale-95 shadow-md shadow-black/40 cursor-pointer group"
              title="Customer Support (@SuperTomCare)"
              aria-label="Customer Support (@SuperTomCare)"
            >
              <Headset className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              {/* Online Live Status Pulse */}
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 border border-[#180a33] animate-pulse" />
            </button>

            {/* ... Menu Button */}
            <button
              onClick={() => setShowMenu(true)}
              className="w-9 h-9 rounded-full bg-[#180a33]/80 hover:bg-[#281353] border border-purple-500/30 flex items-center justify-center text-white/90 hover:text-white transition-all active:scale-95 shadow-md shadow-black/40 cursor-pointer"
              title="More options"
            >
              <div className="flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-white/90" />
                <span className="w-1 h-1 rounded-full bg-white/90" />
                <span className="w-1 h-1 rounded-full bg-white/90" />
              </div>
            </button>

            {/* ✕ Close Button */}
            <button
              onClick={() => setShowCloseModal(true)}
              className="w-9 h-9 rounded-full bg-[#180a33]/80 hover:bg-[#281353] border border-purple-500/30 flex items-center justify-center text-white/90 hover:text-white transition-all active:scale-95 shadow-md shadow-black/40 cursor-pointer"
              title="Close Mini App"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu / Options Modal */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-5 border border-purple-500/30 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white font-display">SuperTom Settings & Info</h3>
              </div>
              <button
                onClick={() => setShowMenu(false)}
                className="text-purple-300/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Audio Synthesizer</p>
                  <p className="text-xs text-purple-300/70">Crunch sounds, coin dings & fanfare</p>
                </div>
                <button
                  onClick={toggleSound}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    soundEnabled ? 'bg-amber-500 text-purple-950 shadow-md shadow-amber-500/30' : 'bg-purple-900/60 text-purple-300'
                  }`}
                >
                  {soundEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* 24/7 Official Customer Support */}
              <a
                href="https://t.me/SuperTomCare"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  sound.playTap();
                  if (window.Telegram?.WebApp?.openTelegramLink) {
                    e.preventDefault();
                    window.Telegram.WebApp.openTelegramLink('https://t.me/SuperTomCare');
                  }
                  setShowMenu(false);
                }}
                className="p-3 rounded-2xl bg-purple-950/40 border border-emerald-500/30 flex items-center justify-between hover:bg-purple-900/40 transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white">Customer Support</p>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      @SuperTomCare
                    </span>
                  </div>
                  <p className="text-xs text-purple-300/70">24/7 Live Assistance on Telegram</p>
                </div>
                <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                  Chat
                </div>
              </a>

              <div className="p-3 rounded-2xl bg-purple-900/30 border border-purple-500/20 text-xs text-purple-200/80 leading-relaxed">
                <span className="font-bold text-amber-300">Conversion Rule:</span> 2,000 Poops = 1 USDT. Feed King Tom biscuits to increase production per hour!
              </div>
            </div>

            <button
              onClick={() => setShowMenu(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600/50 hover:bg-purple-600 text-white font-semibold text-sm transition-colors border border-purple-400/40 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Mini App Close Dialog */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-5 border border-purple-500/30 shadow-2xl">
            <h3 className="text-base font-bold text-white font-display text-center">Close SuperTom Mini App?</h3>
            <p className="text-xs text-purple-200/80 text-center mt-2 leading-relaxed">
              Your cat is actively mining poops! All game calculations continue server-side.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="py-2.5 rounded-xl bg-purple-900/60 text-purple-200 hover:text-white font-semibold text-xs border border-purple-500/30 cursor-pointer"
              >
                Keep Playing
              </button>
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  if (isTelegram) {
                    closeTelegram();
                  } else {
                    showToast('Telegram Mini App', 'App session paused. Your mining rate continues in background!', 'info');
                  }
                }}
                className="py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                Close App
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
