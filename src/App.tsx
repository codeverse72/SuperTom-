import React, { useState, useEffect } from 'react';
import { GameProvider } from './context/GameContext';
import { Header } from './components/Header';
import { BottomNavigation, NavTab } from './components/BottomNavigation';
import { Toast } from './components/Toast';
import { Home } from './pages/Home';
import { Missions } from './pages/Missions';
import { Store } from './pages/Store';
import { Payout } from './pages/Payout';
import { Profile } from './pages/Profile';
import { useTelegram } from './hooks/useTelegram';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const { showBack, hideBack, hapticSelection } = useTelegram();

  // Telegram native BackButton integration:
  // Shows native BackButton on secondary tabs, returns to Home dashboard on click.
  // Hides BackButton when user is on the main Home screen.
  useEffect(() => {
    if (activeTab !== 'home') {
      showBack(() => {
        hapticSelection();
        setActiveTab('home');
      });
    } else {
      hideBack();
    }
  }, [activeTab, showBack, hideBack, hapticSelection]);

  const handleTabChange = (tab: NavTab) => {
    if (tab !== activeTab) {
      hapticSelection();
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <GameProvider>
      <div className="min-h-screen bg-[#070114] text-white flex justify-center items-center sm:py-4 selection:bg-purple-600 selection:text-white">
        {/* Mobile-first Telegram Mini App container with neon glowing border matching reference */}
        <div
          className="w-full max-w-[440px] min-h-screen sm:min-h-[920px] flex flex-col relative bg-gradient-to-b from-[#14052e] via-[#0c021d] to-[#070112] shadow-[0_0_50px_rgba(168,85,247,0.35)] sm:rounded-[36px] border sm:border-2 border-fuchsia-500/40 overflow-hidden"
          style={{ minHeight: 'var(--tg-viewport-height, 100vh)' }}
        >
          {/* Subtle cosmic glow overlay */}
          <div className="absolute top-0 left-0 right-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(192,38,211,0.25),transparent_70%)] pointer-events-none" />
          <div className="absolute bottom-20 left-0 right-0 h-64 bg-[radial-gradient(ellipse_at_bottom,rgba(147,51,234,0.2),transparent_70%)] pointer-events-none" />

          {/* Notification Toast */}
          <Toast />

          {/* Sticky Top Header */}
          <Header activeTab={activeTab} />

          {/* Active Tab Screen Content */}
          <main className="flex-1 p-4 pb-24 overflow-y-auto">
            {activeTab === 'home' && (
              <Home onNavigateToStore={() => handleTabChange('store')} />
            )}
            {activeTab === 'missions' && <Missions />}
            {activeTab === 'store' && <Store />}
            {activeTab === 'payout' && <Payout />}
            {activeTab === 'profile' && <Profile />}
          </main>

          {/* Fixed Bottom Navigation Bar (The ONLY primary navigation) */}
          <BottomNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>
      </div>
    </GameProvider>
  );
}
