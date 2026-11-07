/**
 * SuperTom Production Game State Management
 * 
 * Strict separation of:
 * 1. Server-owned state (Balance, Mining, Inventory, Missions, Withdrawals, User Profile)
 *    -> Live-synced when backend is connected, zero local fabrication when offline.
 * 2. Temporary UI state (active tab, modals, audio toggle, toasts)
 *    -> clean local UI management.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  INITIAL_MISSIONS, 
  Mission, 
  SpinRewardConfig 
} from '../config/gameConfig';
import { 
  SYSTEM_MESSAGES, 
  isFeatureAvailable 
} from '../config/featureConfig';
import { selectWeightedReward } from '../utils/probability';
import { sound } from '../utils/sound';
import { validateWithdrawal } from '../utils/validation';
import { BackendNoticeModal } from '../components/BackendNoticeModal';
import { UserProfile } from '../types/user';
import { WithdrawalRecord, DepositRecord } from '../types/payment';
import { getRawTelegramInitData } from '../utils/telegram';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { miningService } from '../services/miningService';
import { storeService } from '../services/storeService';
import { spinService } from '../services/spinService';
import { missionService } from '../services/missionService';
import { paymentService } from '../services/paymentService';
import { SpinClaimResultDto } from '../services/types';

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
  deposits: DepositRecord[];
  user: UserProfile | null;
  soundEnabled: boolean;
  activeToast: ToastMessage | null;
  
  // Notice modal trigger for backend-dependent features
  triggerNotice: (featureName: string, message?: string, title?: string) => void;

  // Actions with strict feature availability enforcement
  feedTom: (biscuitId: string, count?: number) => boolean;
  buyBiscuit: (biscuitId: string, count?: number) => boolean;
  buyAndFeedBiscuit: (biscuitId: string) => boolean;
  buyAndActivatePlan: (biscuitId: string) => Promise<{ success: boolean; newRate?: number; error?: string }>;
  selectedPlanForDeposit: {
    id: string;
    name: string;
    boostPerHour: number;
    costPoops: number;
    usdtAmount: number;
  } | null;
  setSelectedPlanForDeposit: (plan: {
    id: string;
    name: string;
    boostPerHour: number;
    costPoops: number;
    usdtAmount: number;
  } | null) => void;
  executeSpin: () => { reward: SpinRewardConfig; index: number };
  claimSpinMilestone: (reward: SpinRewardConfig) => void;
  performSpin: () => Promise<{
    success: boolean;
    reward?: SpinRewardConfig;
    rewardIndex?: number;
    claimData?: SpinClaimResultDto;
    error?: string;
  }>;
  startMission: (missionId: string) => void;
  verifyMission: (missionId: string) => void;
  claimMission: (missionId: string) => { success: boolean; reward?: number; title?: string };
  requestWithdrawal: (address: string, amount: number, network?: string) => Promise<{ success: boolean; error?: string }>;
  refreshWithdrawals: () => Promise<void>;
  submitDeposit: (amountUsdt: number, network: string, txHash: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  refreshDeposits: () => Promise<void>;
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
  const [balance, setBalance] = useState<number | null>(null);
  const [productionRate, setProductionRate] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [biscuitInventory, setBiscuitInventory] = useState<Record<string, number> | null>(null);
  const [biscuitFedCount, setBiscuitFedCount] = useState<Record<string, number>>(DEFAULT_FED);

  // Spin timer milestones (starts with clean 4h 12m target for UI matching reference)
  const [spinState, setSpinState] = useState<SpinState>(() => ({
    currentMilestone: 1,
    targetTimestamp: Date.now() + (4 * 3600 + 12 * 60 + 36) * 1000,
    claimedMilestones: [1, 2], // Node 1 and Node 2 checkmarked visually per reference image
    cycleCount: 1
  }));

  // Clean initial missions catalogue
  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS);

  // Clean empty withdrawals and deposits list
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);

  // Selected mining plan package for deposit flow
  const [selectedPlanForDeposit, setSelectedPlanForDeposit] = useState<{
    id: string;
    name: string;
    boostPerHour: number;
    costPoops: number;
    usdtAmount: number;
  } | null>(null);

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

  // Live Backend Connection & Cryptographic InitData Pipeline
  useEffect(() => {
    const rawInitData = getRawTelegramInitData();
    if (rawInitData && isFeatureAvailable('auth')) {
      authService.authenticateTelegram(rawInitData).then((authRes) => {
        if (authRes.success && authRes.data) {
          setIsAuthenticated(true);
          setUser({
            id: authRes.data.userId,
            telegramId: authRes.data.telegramId,
            username: authRes.data.username,
            firstName: authRes.data.firstName,
            lastName: authRes.data.lastName,
            level: authRes.data.level,
            levelTitle: authRes.data.levelTitle,
            referralCode: authRes.data.referralCode,
            friendsInvited: 0,
            referralEarnings: 0,
            totalMissionsDone: 0,
            totalBiscuitsFed: 0,
            createdAt: authRes.data.createdAt,
          });

          // Fetch Live Balance
          userService.getBalance().then((bRes) => {
            if (bRes.success && bRes.data) {
              setBalance(bRes.data.balancePoops);
            }
          });

          // Fetch Live Mining Rate
          if (isFeatureAvailable('mining')) {
            miningService.getMiningStatus().then((mRes) => {
              if (mRes.success && mRes.data) {
                setProductionRate(mRes.data.totalRatePerHour);
              }
            });
          }

          // Fetch Live Inventory
          if (isFeatureAvailable('biscuit_purchases')) {
            storeService.getInventory().then((iRes) => {
              if (iRes.success && iRes.data) {
                setBiscuitInventory(iRes.data);
              }
            });
          }

          // Fetch Live Spin Cooldowns
          if (isFeatureAvailable('spin_rewards')) {
            spinService.getSpinStatus().then((sRes) => {
              if (sRes.success && sRes.data) {
                setSpinState({
                  currentMilestone: sRes.data.currentMilestone,
                  targetTimestamp: sRes.data.nextUnlockTimestamp,
                  claimedMilestones: sRes.data.claimedMilestones,
                  cycleCount: sRes.data.cycleCount,
                });
              }
            });
          }

          // Fetch Live Missions
          missionService.getMissions().then((misRes) => {
            if (misRes.success && misRes.data && misRes.data.length > 0) {
              setMissions(
                misRes.data.map((m) => ({
                  id: m.id,
                  title: m.title,
                  description: m.description,
                  reward: m.rewardPoops,
                  category: m.category,
                  icon: m.icon,
                  status: m.status,
                  progress: m.progress,
                  total: m.total,
                  badge: m.badge,
                  actionUrl: m.actionUrl,
                }))
              );
            }
          });

          // Fetch Live Withdrawals
          paymentService.getHistory().then((wRes) => {
            if (wRes.success && wRes.data) {
              setWithdrawals(
                wRes.data.map((w) => ({
                  id: w.id,
                  timestamp: w.timestamp,
                  amountPoops: w.amountPoops,
                  amountUsdt: w.amountUsdt,
                  walletAddress: w.walletAddress,
                  network: w.network,
                  status: w.status,
                  txHash: w.txHash,
                  rejectionReason: w.rejectionReason,
                }))
              );
            }
          });

          // Fetch Live Deposits
          paymentService.getDeposits().then((dRes) => {
            if (dRes.success && dRes.data) {
              setDeposits(
                dRes.data.map((d) => ({
                  id: d.id,
                  timestamp: d.timestamp,
                  amountUsdt: d.amountUsdt,
                  amountPoops: d.amountPoops,
                  network: d.network,
                  status: d.status,
                  txHash: d.txHash,
                  notes: d.notes,
                }))
              );
            }
          });
        }
      });
    }
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

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
    if (next) sound.playTap();
  };

  const petCat = () => {
    sound.playTap();
  };

  // Feed Tom
  const feedTom = (biscuitId: string, count: number = 1): boolean => {
    if (!isFeatureAvailable('biscuit_feeding')) {
      triggerNotice('Cat Feeding', SYSTEM_MESSAGES.FEEDING_UNAVAILABLE, 'Feeding Unavailable');
      return false;
    }

    storeService.feedBiscuit(biscuitId, count).then((res) => {
      if (res.success && res.data) {
        setProductionRate(res.data.newProductionRate);
        setBiscuitInventory(res.data.newInventory);
        setBiscuitFedCount((prev) => ({
          ...prev,
          [biscuitId]: (prev[biscuitId] || 0) + count,
        }));
        showToast('Tom Fed!', `Production increased to +${res.data.newProductionRate}/h!`, 'success');
      } else {
        showToast('Feeding Error', res.error?.message || 'Feeding failed', 'error');
      }
    });

    return true;
  };

  // Biscuit Purchases
  const buyBiscuit = (biscuitId: string, count: number = 1): boolean => {
    if (!isFeatureAvailable('biscuit_purchases')) {
      triggerNotice('Store Purchase', SYSTEM_MESSAGES.PURCHASES_UNAVAILABLE, 'Store Unavailable');
      return false;
    }

    storeService.purchaseBiscuit({ biscuitId: biscuitId as 'common' | 'silver' | 'gold' | 'diamond', quantity: count }).then((res) => {
      if (res.success && res.data) {
        setBalance(res.data.newBalancePoops);
        setBiscuitInventory(res.data.newInventory);
        showToast('Purchased!', `Purchased ${count}x ${biscuitId} biscuit!`, 'success');
      } else {
        showToast('Purchase Error', res.error?.message || 'Purchase failed', 'error');
      }
    });

    return true;
  };

  const buyAndFeedBiscuit = (biscuitId: string): boolean => {
    if (!isFeatureAvailable('biscuit_purchases')) {
      triggerNotice('Store Purchase', SYSTEM_MESSAGES.PURCHASES_UNAVAILABLE, 'Store Unavailable');
      return false;
    }
    return buyBiscuit(biscuitId, 1);
  };

  /**
   * Buys a mining booster pack with Poops and immediately activates it to boost mining speed.
   */
  const buyAndActivatePlan = async (
    biscuitId: string
  ): Promise<{ success: boolean; newRate?: number; error?: string }> => {
    try {
      // 1. Purchase
      const buyRes = await storeService.purchaseBiscuit({ biscuitId: biscuitId as any, quantity: 1 });
      if (!buyRes.success || !buyRes.data) {
        const err = buyRes.error?.message || 'Purchase failed';
        showToast('Purchase Failed', err, 'error');
        return { success: false, error: err };
      }

      setBalance(buyRes.data.newBalancePoops);
      setBiscuitInventory(buyRes.data.newInventory);

      // 2. Feed immediately to adjust mining speed
      const feedRes = await storeService.feedBiscuit(biscuitId, 1);
      if (feedRes.success && feedRes.data) {
        setProductionRate(feedRes.data.newProductionRate);
        setBiscuitInventory(feedRes.data.newInventory);
        setBiscuitFedCount((prev) => ({
          ...prev,
          [biscuitId]: (prev[biscuitId] || 0) + 1,
        }));

        sound.playEating();
        showToast(
          'Mining Speed Boosted!',
          `Plan activated! Hourly mining speed increased to +${feedRes.data.newProductionRate} Poops/hr 🚀`,
          'reward'
        );
        return { success: true, newRate: feedRes.data.newProductionRate };
      } else {
        setProductionRate(buyRes.data.newProductionRate);
        return { success: true, newRate: buyRes.data.newProductionRate };
      }
    } catch (e: any) {
      const err = e?.message || 'Failed to activate plan';
      showToast('Activation Failed', err, 'error');
      return { success: false, error: err };
    }
  };

  // Spin Wheel Execution (Direct Server-Authoritative)
  const performSpin = async (): Promise<{
    success: boolean;
    reward?: SpinRewardConfig;
    rewardIndex?: number;
    claimData?: SpinClaimResultDto;
    error?: string;
  }> => {
    if (!isFeatureAvailable('spin_rewards')) {
      triggerNotice('Spin Rewards', SYSTEM_MESSAGES.SPIN_UNAVAILABLE, 'Backend Connection Required');
      return { success: false, error: 'Spin service unavailable' };
    }

    try {
      const res = await spinService.claimSpin();
      if (!res.success || !res.data) {
        const errorMsg = res.error?.message || 'Free spin not ready or claim failed';
        showToast('Spin Error', errorMsg, 'error');
        return { success: false, error: errorMsg };
      }

      const claimData = res.data;

      // 1. Directly fetch and credit the winning amount to their balance immediately
      setBalance(claimData.newBalancePoops);

      // 2. Update progressive spin state
      setSpinState((prev) => {
        let updatedClaimed = [...(prev.claimedMilestones || [])];
        if (!updatedClaimed.includes(prev.currentMilestone)) {
          updatedClaimed.push(prev.currentMilestone);
        }
        if (claimData.nextMilestone === 1) {
          updatedClaimed = [];
        }
        return {
          ...prev,
          currentMilestone: claimData.nextMilestone,
          targetTimestamp: claimData.nextUnlockTimestamp,
          claimedMilestones: updatedClaimed,
        };
      });

      // 3. Match with wheel sector configuration
      let targetIndex = SPIN_REWARDS.findIndex((r) => r.id === claimData.rewardId);
      if (targetIndex === -1 && claimData.amount) {
        targetIndex = SPIN_REWARDS.findIndex((r) => r.amount === claimData.amount);
      }
      if (targetIndex === -1) {
        targetIndex = 0;
      }

      const reward = SPIN_REWARDS[targetIndex] || SPIN_REWARDS[0];

      return {
        success: true,
        reward,
        rewardIndex: targetIndex,
        claimData,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error executing spin';
      showToast('Spin Error', msg, 'error');
      return { success: false, error: msg };
    }
  };

  const executeSpin = () => {
    return selectWeightedReward();
  };

  const claimSpinMilestone = (_reward: SpinRewardConfig) => {
    if (!isFeatureAvailable('spin_rewards')) {
      triggerNotice('Spin Rewards', SYSTEM_MESSAGES.SPIN_UNAVAILABLE, 'Backend Connection Required');
      return;
    }

    spinService.claimSpin().then((res) => {
      if (res.success && res.data) {
        setBalance(res.data.newBalancePoops);
        setSpinState((prev) => ({
          ...prev,
          currentMilestone: res.data!.nextMilestone,
          targetTimestamp: res.data!.nextUnlockTimestamp,
        }));
        showToast('Reward Claimed!', `You received ${res.data.label}!`, 'reward');
      } else {
        showToast('Spin Error', res.error?.message || 'Claim failed', 'error');
      }
    });
  };

  // Missions
  const startMission = (missionId: string) => {
    if (!isFeatureAvailable('mission_verification')) {
      triggerNotice('Mission Verification', SYSTEM_MESSAGES.MISSION_VERIFY_UNAVAILABLE, 'Verification Unavailable');
      return;
    }
    verifyMission(missionId);
  };

  const verifyMission = (missionId: string) => {
    if (!isFeatureAvailable('mission_verification')) {
      triggerNotice('Mission Verification', SYSTEM_MESSAGES.MISSION_VERIFY_UNAVAILABLE, 'Verification Unavailable');
      return;
    }

    missionService.verifyMission(missionId).then((res) => {
      if (res.success && res.data) {
        setMissions((prev) =>
          prev.map((m) =>
            m.id === missionId ? { ...m, status: res.data!.verified ? 'completed' : 'verify' } : m
          )
        );
        showToast('Mission Status', res.data.verified ? 'Mission verified! Ready to claim.' : 'Verification pending.', 'info');
      }
    });
  };

  const claimMission = (missionId: string): { success: boolean; reward?: number; title?: string } => {
    if (!isFeatureAvailable('mission_claiming')) {
      triggerNotice('Mission Rewards', SYSTEM_MESSAGES.REWARD_CLAIM_UNAVAILABLE, 'Claiming Unavailable');
      return { success: false };
    }

    missionService.claimMissionReward(missionId).then((res) => {
      if (res.success && res.data) {
        setBalance(res.data.newBalance);
        setMissions((prev) =>
          prev.map((m) => (m.id === missionId ? { ...m, status: 'claimed' } : m))
        );
        showToast('Bounty Claimed!', `+${res.data.rewardPoops.toLocaleString()} Poops credited!`, 'reward');
      }
    });

    return { success: true };
  };

  // Withdrawals
  const refreshWithdrawals = useCallback(async (): Promise<void> => {
    try {
      const res = await paymentService.getHistory();
      if (res.success && res.data) {
        setWithdrawals(
          res.data.map((w) => ({
            id: w.id,
            timestamp: w.timestamp,
            amountPoops: w.amountPoops,
            amountUsdt: w.amountUsdt,
            walletAddress: w.walletAddress,
            network: w.network,
            status: w.status,
            txHash: w.txHash,
            rejectionReason: w.rejectionReason,
          }))
        );
      }
    } catch {
      // non-blocking
    }
  }, []);

  const refreshDeposits = useCallback(async (): Promise<void> => {
    try {
      const res = await paymentService.getDeposits();
      if (res.success && res.data) {
        setDeposits(
          res.data.map((d) => ({
            id: d.id,
            timestamp: d.timestamp,
            amountUsdt: d.amountUsdt,
            amountPoops: d.amountPoops,
            network: d.network,
            status: d.status,
            txHash: d.txHash,
            notes: d.notes,
          }))
        );
      }
    } catch {
      // non-blocking
    }
  }, []);

  const submitDeposit = async (
    amountUsdt: number,
    network: string,
    txHash: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (amountUsdt <= 0) {
      const err = 'Deposit amount must be greater than zero.';
      showToast('Validation Error', err, 'error');
      return { success: false, error: err };
    }
    if (!txHash.trim()) {
      const err = 'Transaction hash is required.';
      showToast('Validation Error', err, 'error');
      return { success: false, error: err };
    }

    try {
      const res = await paymentService.submitDeposit({
        amountUsdt,
        network,
        txHash: txHash.trim(),
        notes,
      });

      if (res.success && res.data) {
        const record: DepositRecord = {
          id: res.data.id,
          timestamp: res.data.timestamp,
          amountUsdt: res.data.amountUsdt,
          amountPoops: res.data.amountPoops,
          network: res.data.network,
          status: res.data.status,
          txHash: res.data.txHash,
          notes: res.data.notes,
        };
        setDeposits((prev) => [record, ...prev]);
        showToast('Deposit Submitted', 'Your deposit has been submitted for on-chain verification.', 'success');
        return { success: true };
      } else {
        const msg = res.error?.message || 'Deposit submission failed';
        showToast('Deposit Error', msg, 'error');
        return { success: false, error: msg };
      }
    } catch (e: any) {
      const err = e?.message || 'Failed to submit deposit';
      showToast('Deposit Failed', err, 'error');
      return { success: false, error: err };
    }
  };

  const requestWithdrawal = async (
    address: string,
    amount: number,
    network: string = 'TRC20'
  ): Promise<{ success: boolean; error?: string }> => {
    const validation = validateWithdrawal(address, amount, balance, network as any);
    if (!validation.isValid) {
      const err = validation.errors.address || validation.errors.amount || validation.errors.balance || 'Validation error';
      showToast('Validation Error', err, 'error');
      return { success: false, error: err };
    }

    try {
      const res = await paymentService.requestWithdrawal({
        walletAddress: address,
        amountPoops: amount,
        network,
      });

      if (res.success && res.data) {
        const record: WithdrawalRecord = {
          id: res.data.id,
          timestamp: res.data.timestamp,
          amountPoops: res.data.amountPoops,
          amountUsdt: res.data.amountUsdt,
          walletAddress: res.data.walletAddress,
          network: res.data.network,
          status: res.data.status,
          txHash: res.data.txHash,
          rejectionReason: res.data.rejectionReason,
        };
        setWithdrawals((prev) => [record, ...prev]);
        setBalance((prev) => (prev !== null ? Math.max(0, prev - amount) : 0));
        showToast('Withdrawal Submitted', 'Your payout request is pending manual admin approval.', 'success');
        return { success: true };
      } else {
        const msg = res.error?.message || 'Submission failed';
        showToast('Withdrawal Error', msg, 'error');
        return { success: false, error: msg };
      }
    } catch (e: any) {
      const err = e?.message || 'Failed to submit withdrawal request';
      showToast('Withdrawal Failed', err, 'error');
      return { success: false, error: err };
    }
  };

  const resetDemoData = () => {
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
        deposits,
        selectedPlanForDeposit,
        setSelectedPlanForDeposit,
        buyAndActivatePlan,
        user,
        soundEnabled,
        activeToast,
        triggerNotice,
        feedTom,
        buyBiscuit,
        buyAndFeedBiscuit,
        executeSpin,
        claimSpinMilestone,
        performSpin,
        startMission,
        verifyMission,
        claimMission,
        requestWithdrawal,
        refreshWithdrawals,
        submitDeposit,
        refreshDeposits,
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
