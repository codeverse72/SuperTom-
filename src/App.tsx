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
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTelegram } from './hooks/useTelegram';
import { sound } from './utils/sound';
import { initAdexiumAutoAds, requestAdBreak, setAdPaused } from './utils/adexium';

// Lazy-load AdminApp so Telegram Mini App users do not download any admin bundle assets
const AdminApp = React.lazy(() =>
  import('./admin/AdminApp').then((m) => ({ default: m.AdminApp }))
);

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    return (
      window.location.pathname.startsWith('/admin') ||
      window.location.hash.startsWith('#/admin') ||
      window.location.search.includes('admin=true')
    );
  });

  useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(
        window.location.pathname.startsWith('/admin') ||
        window.location.hash.startsWith('#/admin') ||
        window.location.search.includes('admin=true')
      );
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const { showBack, hideBack, hapticSelection } = useTelegram();

  // Telegram native BackButton integration:
  // Shows native BackButton on secondary tabs, returns to Home dashboard on click.
  // Hides BackButton when user is on the main Home screen.
  useEffect(() => {
    if (isAdminRoute) return;
    if (activeTab !== 'home') {
      showBack(() => {
        hapticSelection();
        setActiveTab('home');
      });
    } else {
      hideBack();
    }
  }, [isAdminRoute, activeTab, showBack, hideBack, hapticSelection]);

  // Initialize Adexium Interstitial ads only inside real Telegram Mini App player views
  useEffect(() => {
    setAdPaused('admin', isAdminRoute);
    if (isAdminRoute) return;
    return initAdexiumAutoAds();
  }, [isAdminRoute]);

  // Never interrupt Deposit or Withdrawal wallet flows on the Payout tab
  useEffect(() => {
    setAdPaused('payout_tab', activeTab === 'payout');
  }, [activeTab]);

  // If user navigates to /admin, render the SuperTom Command Center
  if (isAdminRoute) {
    return (
      <React.Suspense
        fallback={
          <div className="min-h-screen w-full flex items-center justify-center bg-[#07040D] text-white">
            <span className="font-display font-bold text-amber-400 animate-pulse tracking-widest text-sm uppercase">
              Loading SuperTom Control Center...
            </span>
          </div>
        }
      >
        <AdminApp />
      </React.Suspense>
    );
  }

  const handleTabChange = (tab: NavTab) => {
    if (tab !== activeTab) {
      sound.playTabSwitch();
      hapticSelection();
      setActiveTab(tab);
      setAdPaused('payout_tab', tab === 'payout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (tab === 'home' || tab === 'missions' || tab === 'profile') {
        requestAdBreak('tab_switch', 250);
      }
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
            <ErrorBoundary>
              {activeTab === 'home' && (
                <Home onNavigateToStore={() => handleTabChange('store')} />
              )}
              {activeTab === 'missions' && <Missions />}
              {activeTab === 'store' && (
                <Store onNavigateToDeposit={() => handleTabChange('payout')} />
              )}
              {activeTab === 'payout' && <Payout />}
              {activeTab === 'profile' && <Profile />}
            </ErrorBoundary>
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
