import React from 'react';
import { Home, Trophy, ShoppingBag, Wallet, User } from 'lucide-react';
import { useGame } from '../context/GameContext';

export type NavTab = 'home' | 'missions' | 'store' | 'payout' | 'profile';

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  const { isSpinReady, missions } = useGame();

  const claimableMissionsCount = missions.filter(m => m.status === 'completed').length;

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number | boolean }[] = [
    { id: 'home', label: 'Home', icon: Home, badge: isSpinReady },
    { id: 'missions', label: 'Missions', icon: Trophy, badge: claimableMissionsCount > 0 ? claimableMissionsCount : false },
    { id: 'store', label: 'Store', icon: ShoppingBag },
    { id: 'payout', label: 'Withdraw', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-1 pointer-events-none">
      <div className="max-w-[440px] mx-auto pointer-events-auto">
        <div className="relative rounded-[26px] p-[1.5px] bg-gradient-to-r from-purple-600/40 via-fuchsia-500/30 to-purple-600/40 shadow-[0_-8px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl bg-[#0e0422]/90">
          <div className="flex items-center justify-between p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative flex-1 flex flex-col items-center justify-center py-2 px-1 transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'rounded-[20px] p-[1.5px] bg-gradient-to-r from-[#ffd700] via-[#ff9900] to-[#ffaa00] shadow-[0_0_18px_rgba(255,165,0,0.55)]'
                      : 'text-purple-300/70 hover:text-white'
                  }`}
                >
                  {isActive ? (
                    <div className="w-full h-full rounded-[18px] bg-gradient-to-b from-[#24103e] via-[#1a0833] to-[#140529] py-1.5 flex flex-col items-center justify-center">
                      <Icon className="w-5 h-5 text-[#ffd700] fill-[#ffd700] stroke-[#ffd700] drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]" />
                      <span className="text-[11px] font-black text-[#ffd700] mt-0.5 tracking-tight">
                        {item.label}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-1.5">
                      <div className="relative">
                        <Icon className="w-5 h-5 stroke-[1.8] text-purple-300/80" />
                        {item.badge && (
                          <span className="absolute -top-1 -right-2 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-[9px] font-black text-white">
                            {typeof item.badge === 'number' ? item.badge : '•'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-purple-300/70 mt-0.5 tracking-tight">
                        {item.label}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

