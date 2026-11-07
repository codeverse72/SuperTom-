/**
 * SuperTom Production Game State Management
 * 
 * Strict separation of:
 * 1. Server-owned state (Balance, Mining, Inventory, Missions, Withdrawals, User Profile)
 *    -> null or empty when backend not connected. Zero fabricated state.
 * 2. Temporary UI state (active tab, modals, audio toggle, toasts)
 *    -> clean local UI management.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  SPIN_MILESTONES, 
  INITIAL_MISSIONS, 
  Mission, 
  SpinRewardConfig 
} from '../config/gameConfig';
import { 
  SYSTEM_MESSAGES, 
  isFeatureAvailable, 
  getFeatureUnavailableMessage 
} from '../config/featureConfig';
import { selectWeightedReward } from '../utils/probability';
import { sound } from '../utils/sound';
import { validateWithdrawal } from '../utils/validation';
import { BackendNoticeModal } from '../components/BackendNoticeModal';
import { UserProfile } from '../types/user';
import { WithdrawalRecord } from '../types/payment';

interface SpinState {
  currentMilestone: 1 | 2 | 3;
  targetTimestamp: number;
  claimedMilestones: number[];
  cycleCount: number;
}

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'reward' | 'error';
}

interface NoticeModalState {
  isOpen: boolean;
  featureName: string;
  title: string;
  message: string;
}

interface GameContextType {
  balance: number | null;
  productionRate: number | null;
  isAuthenticated: boolean;
  biscuitInventory: Record<string, number> | null;
  biscuitFedCount: Record<string, number>;
  spinState: SpinState;
  remainingSpinTimeMs: number;
  isSpinReady: boolean;
  isWheelOpen: boolean;
  setIsWheelOpen: (open: boolean) => void;
  isEating: boolean;
  missions: Mission[];
  withdrawals: WithdrawalRecord[];
  user: UserProfile | null;
  soundEnabled: boolean;
  activeToast: ToastMessage | null;
  
  // Notice modal trigger for backend-dependent features
  triggerNotice: (featureName: string, message?: string, title?: string) => void;

  // Actions with strict feature availability enforcement
  feedTom: (biscuitId: string, count?: number) => boolean;
  buyBiscuit: (biscuitId: string, count?: number) => boolean;
  buyAndFeedBiscuit: (biscuitId: string) => boolean;
  executeSpin: () => { reward: SpinRewardConfig; index: number };
  claimSpinMilestone: (reward: SpinRewardConfig) => void;
  startMission: (missionId: string) => void;
  verifyMission: (missionId: string) => void;
  claimMission: (missionId: string) => { success: boolean; reward?: number; title?: string };
  requestWithdrawal: (address: string, amount: number) => { success: boolean; error?: string };
  toggleSound: () => void;
  petCat: () => void;
  showToast: (title: string, message: string, type?: 'success' | 'info' | 'reward' | 'error') => void;
  dismissToast: () => void;
  resetDemoData: () => void;
}

const DEFAULT_FED: Record<string, number> = {
  common: 0,
  silver: 0,
  gold: 0,
  diamond: 0
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Server-owned state defaults to null / empty: No fake user data, no fake balances
  const [balance] = useState<number | null>(null);
  const [productionRate] = useState<number | null>(null);
  const [isAuthenticated] = useState<boolean>(false);
  const [user] = useState<UserProfile | null>(null);
  const [biscuitInventory] = useState<Record<string, number> | null>(null);
  const [biscuitFedCount] = useState<Record<string, number>>(DEFAULT_FED);

  // Spin timer milestones (starts with clean 4h 12m target for UI matching reference)
  const [spinState] = useState<SpinState>(() => ({
    currentMilestone: 1,
    targetTimestamp: Date.now() + (4 * 3600 + 12 * 60 + 36) * 1000,
    claimedMilestones: [1, 2], // Node 1 and Node 2 checkmarked visually per reference image
    cycleCount: 1
  }));

  // Clean initial missions catalogue (all in uncompleted 'start' state)
  const [missions] = useState<Mission[]>(INITIAL_MISSIONS);

  // Clean empty withdrawals list (no fake past transactions)
  const [withdrawals] = useState<WithdrawalRecord[]>([]);

  // Local UI settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isWheelOpen, setIsWheelOpen] = useState<boolean>(false);
  const [isEating] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<ToastMessage | null>(null);

  // Centralized Notice Modal for backend-dependent interactions
  const [noticeModal, setNoticeModal] = useState<NoticeModalState>({
    isOpen: false,
    featureName: '',
    title: '',
    message: ''
  });

  const triggerNotice = useCallback((featureName: string, message?: string, title?: string) => {
    sound.playTap();
    setNoticeModal({
      isOpen: true,
      featureName,
      title: title || 'Backend Service Required',
      message: message || `This feature requires active server integration. ${featureName} will be available once the backend is connected.`
    });
  }, []);

  const closeNotice = useCallback(() => {
    setNoticeModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Real-time remaining spin countdown in ms
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingSpinTimeMs = Math.max(0, spinState.targetTimestamp - now);
  const isSpinReady = remainingSpinTimeMs === 0;

  const showToast = useCallback((title: string, message: string, type: 'success' | 'info' | 'reward' | 'error' = 'info') => {
    const id = Date.now().toString();
    setActiveToast({ id, title, message, type });
    setTimeout(() => {
      setActiveToast(prev => (prev?.id === id ? null : prev));
    }, 3500);
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
    if (next) sound.playTap();
  };

  // Pet the cat: tactile audio and visual hearts, zero fake balance mutation
  const petCat = () => {
    sound.playTap();
  };

  // Feed Tom: Safely disabled without backend
  const feedTom = (_biscuitId: string, _count: number = 1): boolean => {
    if (!isFeatureAvailable('biscuit_feeding')) {
      triggerNotice(
        'Cat Feeding', 
        SYSTEM_MESSAGES.FEEDING_UNAVAILABLE, 
        'Feeding Unavailable'
      );
      return false;
    }
    return false;
  };

  // Biscuit purchases: Safely disabled without backend
  const buyBiscuit = (_biscuitId: string, _count: number = 1): boolean => {
    if (!isFeatureAvailable('biscuit_purchases')) {
      triggerNotice(
        'Store Purchase', 
        SYSTEM_MESSAGES.PURCHASES_UNAVAILABLE, 
        'Store Unavailable'
      );
      return false;
    }
    return false;
  };

  const buyAndFeedBiscuit = (_biscuitId: string): boolean => {
    if (!isFeatureAvailable('biscuit_purchases')) {
      triggerNotice(
        'Store Purchase', 
        SYSTEM_MESSAGES.PURCHASES_UNAVAILABLE, 
        'Store Unavailable'
      );
      return false;
    }
    return false;
  };

  // Spin wheel: Returns wheel sector for visual UI review, claiming is safely locked
  const executeSpin = () => {
    return selectWeightedReward();
  };

  const claimSpinMilestone = (_reward: SpinRewardConfig) => {
    if (!isFeatureAvailable('spin_rewards')) {
      triggerNotice(
        'Spin Rewards', 
        SYSTEM_MESSAGES.SPIN_UNAVAILABLE, 
        'Backend Connection Required'
      );
      return;
    }
  };

  // Missions: Safely disabled without backend
  const startMission = (_missionId: string) => {
    if (!isFeatureAvailable('mission_verification')) {
      triggerNotice(
        'Mission Verification', 
        SYSTEM_MESSAGES.MISSION_VERIFY_UNAVAILABLE, 
        'Verification Unavailable'
      );
      return;
    }
  };

  const verifyMission = (_missionId: string) => {
    if (!isFeatureAvailable('mission_verification')) {
      triggerNotice(
        'Mission Verification', 
        SYSTEM_MESSAGES.MISSION_VERIFY_UNAVAILABLE, 
        'Verification Unavailable'
      );
      return;
    }
  };

  const claimMission = (_missionId: string): { success: boolean; reward?: number; title?: string } => {
    if (!isFeatureAvailable('mission_claiming')) {
      triggerNotice(
        'Mission Rewards', 
        SYSTEM_MESSAGES.REWARD_CLAIM_UNAVAILABLE, 
        'Claiming Unavailable'
      );
      return { success: false };
    }
    return { success: false };
  };

  // Withdrawals: Full format validation, safely blocks fake submission
  const requestWithdrawal = (address: string, amount: number): { success: boolean; error?: string } => {
    const validation = validateWithdrawal(address, amount, balance);
    if (!validation.isValid) {
      const err = validation.errors.address || validation.errors.amount || validation.errors.balance || 'Validation error';
      showToast('Validation Error', err, 'error');
      return { success: false, error: err };
    }

    if (!isFeatureAvailable('withdrawals')) {
      const msg = SYSTEM_MESSAGES.WITHDRAWALS_UNAVAILABLE;
      triggerNotice('Payouts & Withdrawals', msg, 'Payment Gateway Offline');
      return { success: false, error: msg };
    }

    return { success: false, error: 'Payment services unavailable' };
  };

  const resetDemoData = () => {
    // Clear any leftover local storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    sound.playTap();
    showToast('State Cleared', 'All temporary local state has been reset.', 'info');
  };

  return (
    <GameContext.Provider
      value={{
        balance,
        productionRate,
        isAuthenticated,
        biscuitInventory,
        biscuitFedCount,
        spinState,
        remainingSpinTimeMs,
        isSpinReady,
        isWheelOpen,
        setIsWheelOpen,
        isEating,
        missions,
        withdrawals,
        user,
        soundEnabled,
        activeToast,
        triggerNotice,
        feedTom,
        buyBiscuit,
        buyAndFeedBiscuit,
        executeSpin,
        claimSpinMilestone,
        startMission,
        verifyMission,
        claimMission,
        requestWithdrawal,
        toggleSound,
        petCat,
        showToast,
        dismissToast,
        resetDemoData
      }}
    >
      {children}

      {/* Global Centralized Backend Notice Modal */}
      <BackendNoticeModal
        isOpen={noticeModal.isOpen}
        onClose={closeNotice}
        featureName={noticeModal.featureName}
        title={noticeModal.title}
        message={noticeModal.message}
      />
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
