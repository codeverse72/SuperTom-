import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowDownToLine, 
  ArrowUpFromLine,
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Copy, 
  RefreshCw, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Sparkles,
  Info,
  ExternalLink,
  ChevronRight,
  Zap,
  Gift,
  ArrowLeft,
  Cpu,
  Cookie,
  Headphones,
  Wallet,
  Send,
  X,
  Lock,
  Unlock,
  Crown
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { formatNumber, poopsToUsdt } from '../utils/probability';
import { MIN_WITHDRAWAL_POOPS } from '../config/gameConfig';
import { validateNetworkAddress } from '../utils/validation';
import { paymentService } from '../services/paymentService';
import { QRCode } from '../components/QRCode';
import { DepositDto, WithdrawalEntitlementDto, CreateDepositIntentResponseDto } from '../services/types';
import { CampaignBanner } from '../components/CampaignBanner';
import { sound } from '../utils/sound';
import { useTonConnect } from '../hooks/useTonConnect';

export interface CurrencyConfig {
  id: string;
  name: string;
  network: string;
  symbol: string;
  networkType: 'TON' | 'TRON' | 'EVM' | 'SOLANA';
  minDepositUsd: number;
  minWithdrawUsd: number;
  placeholder: string;
  hint: string;
  defaultTreasuryAddress: string;
  hasMemoSupport: boolean;
  walletUriScheme?: (address: string, amount?: number, memo?: string) => string;
  getUniversalWalletUrl?: (address: string, amountUsd?: number, memo?: string) => string;
  getExplorerAddressUrl?: (address: string) => string;
  renderIcon: () => React.ReactNode;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  {
    id: 'TON',
    name: 'TON (Toncoin)',
    network: 'TON',
    symbol: 'TON',
    networkType: 'TON',
    minDepositUsd: 1.0,
    minWithdrawUsd: 1.0,
    placeholder: 'e.g. UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR',
    hint: 'TON addresses start with "EQ" or "UQ" and contain 48 characters.',
    defaultTreasuryAddress: 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR',
    hasMemoSupport: true,
    walletUriScheme: (addr, amt, memo) => `tonkeeper://transfer/${addr}?amount=${amt ? BigInt(Math.round(amt * 1_000_000_000)).toString() : '1000000000'}${memo ? `&text=${encodeURIComponent(memo)}` : ''}`,
    getUniversalWalletUrl: (addr, amt, memo) => `https://app.tonkeeper.com/transfer/${addr}?amount=${amt ? BigInt(Math.round(amt * 1_000_000_000)).toString() : '1000000000'}${memo ? `&text=${encodeURIComponent(memo)}` : ''}`,
    getExplorerAddressUrl: (addr) => `https://tonviewer.com/${addr}`,
    renderIcon: () => (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0098EA] to-[#0077B5] flex items-center justify-center text-white shadow-md shrink-0">
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 2L3 8.5L12 22L21 8.5L12 2ZM12 4.5L17.5 9H6.5L12 4.5ZM5.5 10.5H10.5V17.5L5.5 10.5ZM13.5 17.5V10.5H18.5L13.5 17.5Z" />
        </svg>
      </div>
    ),
  },
  {
    id: 'USDT_BEP20',
    name: 'USDT (BEP20)',
    network: 'BNB',
    symbol: 'USDT',
    networkType: 'EVM',
    minDepositUsd: 1.0,
    minWithdrawUsd: 1.0,
    placeholder: 'e.g. 0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1',
    hint: 'BEP20 addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1',
    hasMemoSupport: false,
    getUniversalWalletUrl: (addr) => `https://link.trustwallet.com/send?address=${addr}&asset=c20000714_t0x55d398326f99059fF775485246999027B3197955`,
    getExplorerAddressUrl: (addr) => `https://bscscan.com/address/${addr}`,
    renderIcon: () => (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#009393] to-[#26A17B] flex items-center justify-center text-white shadow-md font-bold text-xl shrink-0">
        ₮
      </div>
    ),
  },
  {
    id: 'USDT_TRC20',
    name: 'USDT (TRC20)',
    network: 'Tron',
    symbol: 'USDT',
    networkType: 'TRON',
    minDepositUsd: 1.0,
    minWithdrawUsd: 1.0,
    placeholder: 'e.g. TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
    hint: 'TRON addresses start with "T" and contain 34 characters.',
    defaultTreasuryAddress: 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
    hasMemoSupport: false,
    getUniversalWalletUrl: (addr) => `https://link.trustwallet.com/send?address=${addr}&asset=c195_tTR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`,
    getExplorerAddressUrl: (addr) => `https://tronscan.org/#/address/${addr}`,
    renderIcon: () => (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#009393] to-[#26A17B] flex items-center justify-center text-white shadow-md font-bold text-xl shrink-0">
        ₮
      </div>
    ),
  },
  {
    id: 'BNB',
    name: 'BNB',
    network: 'BNB',
    symbol: 'BNB',
    networkType: 'EVM',
    minDepositUsd: 1.0,
    minWithdrawUsd: 1.0,
    placeholder: 'e.g. 0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1',
    hint: 'BNB addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1',
    hasMemoSupport: false,
    getUniversalWalletUrl: (addr) => `https://link.trustwallet.com/send?address=${addr}&asset=c20000714`,
    getExplorerAddressUrl: (addr) => `https://bscscan.com/address/${addr}`,
    renderIcon: () => (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F3BA2F] to-[#D49E17] flex items-center justify-center text-white shadow-md shrink-0">
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 4.2L8.4 7.8L9.8 9.2L12 7L14.2 9.2L15.6 7.8L12 4.2ZM4.2 12L7.8 8.4L9.2 9.8L7 12L9.2 14.2L7.8 15.6L4.2 12ZM19.8 12L16.2 8.4L14.8 9.8L17 12L14.8 14.2L16.2 15.6L19.8 12ZM12 19.8L8.4 16.2L9.8 14.8L12 17L14.2 14.8L15.6 16.2L12 19.8ZM12 9.8L9.8 12L12 14.2L14.2 12L12 9.8Z" />
        </svg>
      </div>
    ),
  },
  {
    id: 'TRX',
    name: 'TRX',
    network: 'Tron',
    symbol: 'TRX',
    networkType: 'TRON',
    minDepositUsd: 1.0,
    minWithdrawUsd: 1.0,
    placeholder: 'e.g. TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
    hint: 'TRON addresses start with "T" and contain 34 characters.',
    defaultTreasuryAddress: 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
    hasMemoSupport: false,
    getUniversalWalletUrl: (addr) => `https://link.trustwallet.com/send?address=${addr}&asset=c195`,
    getExplorerAddressUrl: (addr) => `https://tronscan.org/#/address/${addr}`,
    renderIcon: () => (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EF0027] to-[#B3001B] flex items-center justify-center text-white shadow-md shrink-0">
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M2.5 4.5L21.5 2L15.5 22L2.5 4.5ZM6.5 6.5L14.5 17.5L18.5 4.5L6.5 6.5Z" />
        </svg>
      </div>
    ),
  },
  {
    id: 'SOL',
    name: 'SOL (Solana)',
    network: 'Solana',
    symbol: 'SOL',
    networkType: 'SOLANA',
    minDepositUsd: 1.0,
    minWithdrawUsd: 1.0,
    placeholder: 'e.g. ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk',
    hint: 'Solana addresses are 32-44 characters Base58 encoded.',
    defaultTreasuryAddress: 'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk',
    hasMemoSupport: false,
    getUniversalWalletUrl: () => `https://phantom.app/`,
    getExplorerAddressUrl: (addr) => `https://solscan.io/account/${addr}`,
    renderIcon: () => (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white shadow-md shrink-0">
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M4.5 6.5L16.5 6.5L19.5 3.5L7.5 3.5L4.5 6.5ZM4.5 13.5L16.5 13.5L19.5 10.5L7.5 10.5L4.5 13.5ZM7.5 17.5L19.5 17.5L16.5 20.5L4.5 20.5L7.5 17.5Z" />
        </svg>
      </div>
    ),
  },
  {
    id: 'BASE',
    name: 'Base (USDC / ETH)',
    network: 'Base',
    symbol: 'BASE',
    networkType: 'EVM',
    minDepositUsd: 1.0,
    minWithdrawUsd: 1.0,
    placeholder: 'e.g. 0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1',
    hint: 'Base addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1',
    hasMemoSupport: false,
    getUniversalWalletUrl: (addr) => `https://link.trustwallet.com/send?address=${addr}&asset=c8453_t0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
    getExplorerAddressUrl: (addr) => `https://basescan.org/address/${addr}`,
    renderIcon: () => (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0052FF] to-[#0038B8] flex items-center justify-center text-white shadow-md shrink-0">
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
  },
];

const StatusBadge: React.FC<{status: string}> = ({ status }) => {
  const configs: Record<string, {label: string; color: string}> = {
    WAITING_FOR_PAYMENT: { label: '⏳ Awaiting Payment', color: 'bg-yellow-950/80 border-yellow-500/40 text-yellow-300' },
    PAYMENT_DETECTED:    { label: '🔍 Detected', color: 'bg-blue-950/80 border-blue-500/40 text-blue-300' },
    CONFIRMING:          { label: '⏳ Confirming', color: 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300' },
    COMPLETED:           { label: '✅ Confirmed', color: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' },
    CONFIRMED:           { label: '✅ Confirmed', color: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' },
    EXPIRED:             { label: '⏰ Expired', color: 'bg-red-950/80 border-red-500/40 text-red-300' },
    FAILED:              { label: '❌ Failed', color: 'bg-red-950/80 border-red-500/40 text-red-300' },
    UNDERPAID:           { label: '⚠️ Underpaid', color: 'bg-orange-950/80 border-orange-500/40 text-orange-300' },
    OVERPAID:            { label: '⬆️ Overpaid', color: 'bg-green-950/80 border-green-500/40 text-green-300' },
  };
  const cfg = configs[status] || { label: status, color: 'bg-slate-800 border-slate-600 text-slate-300' };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

export const Payout: React.FC = () => {
  const { 
    balance, 
    withdrawals, 
    deposits, 
    requestWithdrawal, 
    refreshWithdrawals, 
    submitDeposit, 
    refreshDeposits,
    showToast,
    user,
    selectedPlanForDeposit,
    setSelectedPlanForDeposit,
  } = useGame();

  // Top Section: 'deposit' or 'payout'
  const [activeTab, setActiveTab] = useState<'deposit' | 'payout'>('deposit');

  // Active Deposit Currency selected for Deposit Details Page (Matching Screenshot 1)
  const [activeDepositCurrency, setActiveDepositCurrency] = useState<CurrencyConfig | null>(null);

  // Active Withdrawal Currency selected for inline expansion (Matching Screenshot 3)
  const [activeWithdrawCurrencyId, setActiveWithdrawCurrencyId] = useState<string | null>(null);

  // Deposit Form State (Screenshot 1)
  const [depositAmountUsd, setDepositAmountUsd] = useState<number>(10.0);
  const [customAmountInput, setCustomAmountInput] = useState<string>('10.00');
  const [depositTxHash, setDepositTxHash] = useState<string>('');
  const [depositStatus, setDepositStatus] = useState<string>('WAITING_FOR_PAYMENT');
  const [isVerifyingDeposit, setIsVerifyingDeposit] = useState<boolean>(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [activeDepositId, setActiveDepositId] = useState<string | null>(null);
  const [activeDepositQuote, setActiveDepositQuote] = useState<CreateDepositIntentResponseDto | null>(null);

  // Status feedback states matching performance-first specification
  const [isInitiatingPayment, setIsInitiatingPayment] = useState<boolean>(false);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const [isCheckingOnChain, setIsCheckingOnChain] = useState<boolean>(false);

  // Polling references for bounded verification checks (no infinite polling)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef<number>(0);

  // Withdrawal Form State (Screenshot 3)
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmountUsd, setWithdrawAmountUsd] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Entitlement State ($3 for 3 withdrawals, $5 for unlimited)
  const [entitlement, setEntitlement] = useState<WithdrawalEntitlementDto | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [showTonWalletModal, setShowTonWalletModal] = useState<boolean>(false);
  const [showEvmWalletModal, setShowEvmWalletModal] = useState<boolean>(false);
  const [showTronModal, setShowTronModal] = useState<boolean>(false);
  const [showSolanaModal, setShowSolanaModal] = useState<boolean>(false);
  const [baseAsset, setBaseAsset] = useState<'USDC' | 'ETH'>('USDC');

  // Official TON Connect hook - lazily mounted only when modal is open
  const {
    isConnected: isTonConnected,
    walletAddress: tonWalletAddress,
    network: tonNetwork,
    isLoading: isTonLoading,
    error: tonConnectError,
    connectWallet: connectTonWallet,
    disconnectWallet: disconnectTonWallet,
    sendTonTransaction,
  } = useTonConnect(showTonWalletModal);

  // Treasury dynamic addresses map
  const [treasuryWallets, setTreasuryWallets] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Safe Universal URL & Protocol Opener (Telegram WebApp & Mobile Browser Compatible)
  const openSafeUrl = (launcherUrl: string, tonkeeperDeepLink?: string) => {
    if (!launcherUrl) return;
    const webApp = window.Telegram?.WebApp;

    // 1. If Telegram internal link (e.g. https://t.me/wallet)
    if (launcherUrl.startsWith('https://t.me/') || launcherUrl.startsWith('tg:')) {
      if (webApp?.openTelegramLink) {
        webApp.openTelegramLink(launcherUrl);
        return;
      }
    }

    // 2. Telegram WebApp openLink (Only accepts https:// links, safely delegates to OS browser)
    // Note: NEVER pass custom schemes (like ton://) into Telegram WebApp or DOM navigation inside Telegram
    // to avoid net::ERR_UNKNOWN_URL_SCHEME errors in Android WebView.
    if (webApp?.openLink) {
      try {
        webApp.openLink(launcherUrl, { try_instant_view: false });
        return;
      } catch (e) {
        console.warn('Telegram openLink failed:', e);
      }
    }

    // 3. Mobile browser fallback outside Telegram: directly trigger native app scheme
    if (tonkeeperDeepLink) {
      try {
        window.location.href = tonkeeperDeepLink;
        return;
      } catch {}
    }

    // 4. Standard browser fallback (when running outside Telegram WebApp)
    try {
      const opened = window.open(launcherUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.assign(launcherUrl);
      }
    } catch {
      window.location.assign(launcherUrl);
    }
  };

  const openTelegramWallet = () => {
    openSafeUrl('https://t.me/wallet');
  };

  const stopOnChainPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollCountRef.current = 0;
  };

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      stopOnChainPolling();
    };
  }, []);

  /**
   * Check on-chain deposit status against TON blockchain.
   * Atomically verifies transaction and updates balances.
   */
  const checkDepositOnChainStatus = async (depositId: string, isManual: boolean = false): Promise<boolean> => {
    if (isCheckingOnChain) return false;
    setIsCheckingOnChain(true);

    try {
      if (depositId) {
        const res = await paymentService.checkOnChainDeposit(depositId);
        setIsCheckingOnChain(false);

        if (res.success && res.data?.isCompleted) {
          stopOnChainPolling();
          setDepositStatus('COMPLETED');
          setPaymentFeedback('Deposit successful!');
          sound.playReward();
          showToast(
            'Deposit Confirmed!',
            res.data.message || 'Deposit confirmed and balance credited immediately!',
            'reward'
          );

          refreshDeposits();
          refreshWithdrawals();
          fetchEntitlement();
          if (selectedPlanForDeposit) {
            setSelectedPlanForDeposit(null);
          }
          return true;
        } else {
          if (isManual) {
            showToast(
              'Payment Pending Verification',
              res.data?.message || 'Transaction not found on chain yet. Please allow 10-30 seconds for TON network finality.',
              'info'
            );
          }
          return false;
        }
      } else {
        // Fallback: refresh deposits if depositId not assigned yet
        await Promise.all([refreshDeposits(), refreshWithdrawals(), fetchEntitlement()]);
        setIsCheckingOnChain(false);
        if (isManual) {
          showToast('Status Checked', 'Deposit status refreshed. If already sent, it will confirm shortly.', 'info');
        }
        return false;
      }
    } catch {
      setIsCheckingOnChain(false);
      if (isManual) {
        showToast('Status Check Failed', 'Network error checking deposit status. Please try again.', 'error');
      }
      return false;
    }
  };

  /**
   * Start bounded auto-verification polling: every 5s up to 12 iterations (60 seconds)
   */
  const startOnChainPolling = (depositId: string) => {
    stopOnChainPolling();
    pollCountRef.current = 0;

    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      const isConfirmed = await checkDepositOnChainStatus(depositId, false);
      if (isConfirmed || pollCountRef.current >= 12) {
        stopOnChainPolling();
      }
    }, 5000);
  };

  /**
   * Universal Multi-Chain Payment Opener:
   * 1. Validates deposit amount ($1 - $10,000)
   * 2. Uses exact backend-generated quote as single source of truth (no client-side math drift)
   * 3. Opens the respective native wallet scheme or universal link
   * 4. Displays network-specific modal with address, contract, memo & on-chain verification
   */
  const handleOpenPayment = async (cur: CurrencyConfig) => {
    sound.playClick();
    setDepositError(null);

    const amt = depositAmountUsd;
    if (isNaN(amt) || amt < cur.minDepositUsd) {
      setDepositError(`Minimum deposit amount is $${cur.minDepositUsd.toFixed(2)} USD.`);
      showToast('Invalid Amount', `Minimum deposit is $${cur.minDepositUsd.toFixed(2)} USD`, 'error');
      return;
    }

    if (amt > 10000) {
      setDepositError('Maximum deposit amount is $10,000 USD.');
      return;
    }

    setIsInitiatingPayment(true);
    setPaymentFeedback('Preparing payment details...');

    const effectiveSymbol = cur.id === 'BASE' ? baseAsset : cur.symbol;

    try {
      // 1. Ensure we have the latest backend deposit intent and quote
      let quote = activeDepositQuote;
      const isQuoteFresh =
        quote &&
        Math.abs(quote.amountUsdt - amt) < 0.001 &&
        (quote.currency === effectiveSymbol || quote.currency === cur.symbol) &&
        quote.network === cur.network &&
        quote.id;

      if (!isQuoteFresh) {
        const res = await paymentService.createDepositIntent({
          amountUsdt: amt,
          currency: effectiveSymbol,
          network: cur.network,
          notes: selectedPlanForDeposit 
            ? `[Biscuit Purchase: ${selectedPlanForDeposit.name} (+${selectedPlanForDeposit.boostPerHour.toLocaleString()}/hr)]`
            : undefined,
        });

        if (res.success && res.data) {
          quote = res.data;
          setActiveDepositId(res.data.id);
          setActiveDepositQuote(res.data);
          startOnChainPolling(res.data.id);
        } else {
          throw new Error(res.error?.message || 'Failed to generate deposit quote');
        }
      } else if (quote?.id) {
        startOnChainPolling(quote.id);
      }

      setIsInitiatingPayment(false);
      setPaymentFeedback('Payment pending verification.');
      setDepositStatus('WAITING_FOR_PAYMENT');

      const targetAddress = quote?.depositAddress || getEffectiveTreasuryAddress(cur);
      const links = quote?.walletLinks;

      if (cur.networkType === 'TON') {
        const nanoTon = quote?.nanoTonAmount || quote?.rawUnits || BigInt(Math.round((amt / (quote?.tonPriceUsd || 5.20)) * 1_000_000_000)).toString();
        const memo = quote?.paymentReference || telegramUserId || `DEP-${telegramUserId}`;
        const baseOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://super-tom.vercel.app';
        const launcherUrl = links?.webLauncherUrl || `${baseOrigin}/open-tonkeeper.html?address=${encodeURIComponent(targetAddress)}&amount=${nanoTon}&text=${encodeURIComponent(memo)}&usd=${amt.toFixed(2)}`;
        const deepLink = links?.tonDeepLink || `tonkeeper://transfer/${targetAddress}?amount=${nanoTon}&text=${encodeURIComponent(memo)}`;

        openSafeUrl(launcherUrl, deepLink);
        setShowTonWalletModal(true);
      } else if (cur.networkType === 'EVM') {
        setShowEvmWalletModal(true);
        if (links?.trustWalletUrl) {
          openSafeUrl(links.trustWalletUrl, links.eip681Uri);
        }
      } else if (cur.networkType === 'TRON') {
        setShowTronModal(true);
        if (links?.trustWalletUrl) {
          openSafeUrl(links.trustWalletUrl, links.tronUri);
        }
      } else if (cur.networkType === 'SOLANA') {
        setShowSolanaModal(true);
        if (links?.phantomUrl) {
          openSafeUrl(links.phantomUrl, links.solanaPayUri);
        }
      }
    } catch (err: unknown) {
      setIsInitiatingPayment(false);
      setPaymentFeedback(null);
      const msg = err instanceof Error ? err.message : 'Failed to connect to payment gateway';
      setDepositError(msg);
      showToast('Payment Error', msg, 'error');
    }
  };

  const getDepositButtonLabel = (cur: CurrencyConfig) => {
    switch (cur.id) {
      case 'TON':
        return 'OPEN IN TONKEEPER / ANY TON WALLET';
      case 'USDT_BEP20':
        return 'PAY WITH TRUST WALLET / METAMASK (USDT BEP20)';
      case 'USDT_TRC20':
        return 'PAY WITH TRUST WALLET / TRONLINK (USDT TRC20)';
      case 'BNB':
        return 'PAY WITH TRUST WALLET / METAMASK (BNB)';
      case 'TRX':
        return 'PAY WITH TRUST WALLET / TRONLINK (TRX)';
      case 'SOL':
        return 'PAY WITH PHANTOM / SOLANA PAY (SOL)';
      case 'BASE':
        return `PAY WITH TRUST WALLET / METAMASK (${baseAsset})`;
      default:
        return `PAY WITH ${cur.name.toUpperCase()} WALLET`;
    }
  };

  const getButtonGradient = (cur: CurrencyConfig) => {
    switch (cur.id) {
      case 'TON':
        return 'bg-gradient-to-r from-[#0098EA] via-[#00B4D8] to-[#0077B5]';
      case 'USDT_BEP20':
      case 'USDT_TRC20':
        return 'bg-gradient-to-r from-[#009393] via-[#26A17B] to-[#009393]';
      case 'BNB':
        return 'bg-gradient-to-r from-[#F3BA2F] via-[#D49E17] to-[#B28210]';
      case 'TRX':
        return 'bg-gradient-to-r from-[#EF0027] via-[#B3001B] to-[#8C0015]';
      case 'SOL':
        return 'bg-gradient-to-r from-[#9945FF] via-[#7B2CBF] to-[#14F195]';
      case 'BASE':
        return 'bg-gradient-to-r from-[#0052FF] via-[#0038B8] to-[#002680]';
      default:
        return 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600';
    }
  };

  const handleCopyAllPaymentDetails = (
    cur: CurrencyConfig,
    address: string,
    amountUsd: number,
    memo: string
  ) => {
    const symbol = cur.id === 'BASE' ? baseAsset : cur.symbol;
    const cryptoAmount = activeDepositQuote?.expectedCryptoAmount?.toString() || amountUsd.toString();
    const tokenContract = activeDepositQuote?.tokenContract;

    let text = `--- SuperTom Deposit Details ---
Network: ${cur.name} (${cur.network})
Official Address: ${address}
Transfer Amount: $${amountUsd.toFixed(2)} USD (Exact: ${cryptoAmount} ${symbol})
Payment Reference / Memo: ${memo}`;

    if (tokenContract) {
      text += `\nToken Contract: ${tokenContract}`;
    }

    text += `\nNote: Compatible with Trust Wallet, MetaMask, Phantom, OKX, Binance, or any crypto wallet!`;

    navigator.clipboard?.writeText(text);
    setCopiedKey('all_details');
    showToast('Payment Details Copied!', 'Address, Memo & Amount copied to clipboard. Paste into your wallet/exchange to send.', 'reward');
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // User's verified Telegram ID
  const telegramUserId = useMemo(() => {
    return user?.telegramId || window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '8441612063';
  }, [user]);

  // Current balance in USD
  const balanceUsd = useMemo(() => {
    if (balance === null || balance === undefined) return '0.0000';
    return (balance / 2000).toFixed(4);
  }, [balance]);

  // Dynamic quick deposit buttons including selected biscuit price
  const quickDepositAmounts = useMemo(() => {
    const list = [1, 3, 5, 10, 15, 50];
    if (selectedPlanForDeposit && !list.includes(selectedPlanForDeposit.usdtAmount)) {
      list.push(selectedPlanForDeposit.usdtAmount);
    }
    return list.sort((a, b) => a - b);
  }, [selectedPlanForDeposit]);

  const fetchEntitlement = async () => {
    try {
      const res = await paymentService.getWithdrawalEntitlement();
      if (res.success && res.data) {
        setEntitlement(res.data);
      }
    } catch {
      // fallback
    }
  };

  const handleSelectUnlockTier = (amount: number, label: string) => {
    setShowUnlockModal(false);
    setActiveTab('deposit');
    const defaultCur = SUPPORTED_CURRENCIES[0]; // GRAM / TON by default
    setActiveDepositCurrency(defaultCur);
    setDepositAmountUsd(amount);
    setCustomAmountInput(amount.toFixed(2));
    setDepositTxHash('');
    setDepositError(null);
    setDepositStatus('WAITING_FOR_PAYMENT');

    paymentService.createDepositIntent({
      amountUsdt: amount,
      currency: defaultCur.symbol,
      network: defaultCur.network,
      notes: `[Withdrawal Activation: ${label}]`,
    }).then((res) => {
      if (res.success && res.data) {
        setActiveDepositId(res.data.id);
        setActiveDepositQuote(res.data);
      }
    });

    showToast(
      'Activation Deposit Selected',
      `Deposit $${amount.toFixed(2)} to unlock ${amount >= 5 ? 'Unlimited Lifetime' : '3 Free'} Withdrawals!`,
      'reward'
    );
  };

  // Fetch Treasury Wallets & refresh user payout data on mount
  useEffect(() => {
    paymentService.getTreasuryWallets().then((res) => {
      if (res.success && res.data?.wallets) {
        const map: Record<string, string> = {};
        Object.entries(res.data.wallets).forEach(([key, val]) => {
          map[key] = val.address;
        });
        setTreasuryWallets(map);
      }
    });
    refreshWithdrawals();
    refreshDeposits();
    fetchEntitlement();
  }, [refreshWithdrawals, refreshDeposits]);

  // When selectedPlanForDeposit is set from Store (Buy Biscuit), open deposit view with that exact amount
  useEffect(() => {
    if (selectedPlanForDeposit) {
      setActiveTab('deposit');
      const defaultCur = SUPPORTED_CURRENCIES[0]; // GRAM / TON by default
      setActiveDepositCurrency(defaultCur);
      const amt = selectedPlanForDeposit.usdtAmount;
      setDepositAmountUsd(amt);
      setCustomAmountInput(amt.toFixed(2));
      setDepositTxHash('');
      setDepositError(null);
      setDepositStatus('WAITING_FOR_PAYMENT');

      // Create formal tracked deposit record on backend
      paymentService.createDepositIntent({
        amountUsdt: amt,
        currency: defaultCur.symbol,
        network: defaultCur.network,
        notes: `[Biscuit Purchase: ${selectedPlanForDeposit.name} (+${selectedPlanForDeposit.boostPerHour.toLocaleString()}/hr)]`,
      }).then((res) => {
        if (res.success && res.data) {
          setActiveDepositId(res.data.id);
          setActiveDepositQuote(res.data);
        }
      });
    }
  }, [selectedPlanForDeposit]);

  const getEffectiveTreasuryAddress = (currency: CurrencyConfig): string => {
    // 1. Direct name or id match
    if (treasuryWallets[currency.name]) return treasuryWallets[currency.name];
    if (treasuryWallets[currency.id]) return treasuryWallets[currency.id];

    // 2. Strict network-type fallback
    if (currency.networkType === 'TON') {
      return (
        treasuryWallets['TON'] ||
        treasuryWallets['TON (Toncoin)'] ||
        treasuryWallets['GRAM'] ||
        currency.defaultTreasuryAddress ||
        'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR'
      );
    }
    if (currency.networkType === 'EVM') {
      return (
        treasuryWallets['TRUST_WALLET_EVM_ADDRESS'] ||
        treasuryWallets['TREASURY_EVM_ADDRESS'] ||
        treasuryWallets['USDT (BEP20)'] ||
        treasuryWallets['BNB'] ||
        treasuryWallets['Base (USDC / ETH)'] ||
        currency.defaultTreasuryAddress ||
        '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1'
      );
    }
    if (currency.networkType === 'TRON') {
      return (
        treasuryWallets['TRUST_WALLET_TRON_ADDRESS'] ||
        treasuryWallets['TREASURY_TRON_ADDRESS'] ||
        treasuryWallets['USDT (TRC20)'] ||
        treasuryWallets['TRX'] ||
        currency.defaultTreasuryAddress ||
        'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv'
      );
    }
    if (currency.networkType === 'SOLANA') {
      return (
        treasuryWallets['TRUST_WALLET_SOL_ADDRESS'] ||
        treasuryWallets['TREASURY_SOL_ADDRESS'] ||
        treasuryWallets['SOL (Solana)'] ||
        currency.defaultTreasuryAddress ||
        'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk'
      );
    }

    return currency.defaultTreasuryAddress;
  };

  const handleCopy = (text: string, key: string, label: string = 'Address') => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    showToast('Copied to Clipboard!', `${label} copied to clipboard`, 'info');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Open Deposit Details Page
  const handleOpenDepositDetails = (currency: CurrencyConfig, initialAmount?: number) => {
    setActiveDepositCurrency(currency);
    const defaultAmt = selectedPlanForDeposit ? selectedPlanForDeposit.usdtAmount : 10.0;
    const amt = initialAmount !== undefined ? initialAmount : defaultAmt;
    setDepositAmountUsd(amt);
    setCustomAmountInput(amt.toFixed(2));
    setDepositTxHash('');
    setDepositError(null);
    setDepositStatus('WAITING_FOR_PAYMENT');

    const effectiveSymbol = currency.id === 'BASE' ? baseAsset : currency.symbol;

    // Create formal tracked deposit record on backend
    paymentService.createDepositIntent({
      amountUsdt: amt,
      currency: effectiveSymbol,
      network: currency.network,
      notes: selectedPlanForDeposit 
        ? `[Biscuit Purchase: ${selectedPlanForDeposit.name} (+${selectedPlanForDeposit.boostPerHour.toLocaleString()}/hr)]`
        : undefined,
    }).then((res) => {
      if (res.success && res.data) {
        setActiveDepositId(res.data.id);
        setActiveDepositQuote(res.data);
      }
    });
  };

  // Verify Deposit Proof
  const handleVerifyDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);

    let cleanTx = depositTxHash.trim();
    if (!cleanTx) {
      setDepositError('Transaction hash (TXID) is required.');
      return;
    }

    // Automatically strip explorer URL if user pasted the entire link
    if (cleanTx.includes('/')) {
      const parts = cleanTx.split('/');
      cleanTx = parts[parts.length - 1].replace(/^[#?]/, '').trim() || cleanTx;
    }

    if (cleanTx.length < 6) {
      setDepositError('Transaction hash is too short. Please paste a valid transaction hash.');
      return;
    }

    setIsVerifyingDeposit(true);
    setDepositStatus('CONFIRMING');

    if (activeDepositId) {
      const res = await paymentService.verifyDeposit(activeDepositId, cleanTx, depositAmountUsd);
      setIsVerifyingDeposit(false);

      if (res.success) {
        setDepositStatus('PAYMENT_DETECTED');
        showToast('Proof Submitted!', res.data?.message || 'Transaction submitted for Admin verification. Your balance will be credited once confirmed on-chain.', 'info');
        refreshDeposits();
        if (selectedPlanForDeposit) {
          setSelectedPlanForDeposit(null);
        }
      } else {
        // Fallback to manual submit if needed
        submitDeposit(depositAmountUsd, activeDepositCurrency?.name || 'USDT', cleanTx).then((subRes) => {
          if (subRes.success) {
            setDepositStatus('PAYMENT_DETECTED');
            showToast('Deposit Proof Submitted', 'Pending on-chain admin confirmation', 'info');
            refreshDeposits();
          } else {
            setDepositStatus('WAITING_FOR_PAYMENT');
            setDepositError(res.error?.message || subRes.error || 'Verification failed');
          }
        });
      }
    } else {
      const res = await submitDeposit(depositAmountUsd, activeDepositCurrency?.name || 'USDT', cleanTx);
      setIsVerifyingDeposit(false);
      if (res.success) {
        setDepositStatus('PAYMENT_DETECTED');
        showToast('Deposit Submitted', 'Deposit received and queued for Admin approval!', 'info');
        refreshDeposits();
      } else {
        setDepositStatus('WAITING_FOR_PAYMENT');
        setDepositError(res.error || 'Failed to submit deposit');
      }
    }
  };

  // Handle Withdrawal Submit (Matching Screenshot 3)
  const handleWithdrawSubmit = async (e: React.FormEvent, currency: CurrencyConfig) => {
    e.preventDefault();
    setWithdrawError(null);

    // Strictly enforce deposit requirement for withdrawals:
    // Deposit $3 for 3 withdrawals or $5 for unlimited lifetime withdrawals.
    if (!entitlement || !entitlement.canWithdraw) {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
      }
      setShowUnlockModal(true);
      return;
    }

    const addressValidation = validateNetworkAddress(currency.network, withdrawAddress);
    if (!addressValidation.isValid) {
      setWithdrawError(addressValidation.error || `Invalid ${currency.name} address format.`);
      return;
    }

    const amountUsdNum = parseFloat(withdrawAmountUsd);
    if (isNaN(amountUsdNum) || amountUsdNum <= 0) {
      setWithdrawError('Please enter a valid positive withdrawal amount in USD.');
      return;
    }

    if (amountUsdNum < currency.minWithdrawUsd) {
      setWithdrawError(`Minimum withdrawal is $${currency.minWithdrawUsd.toFixed(2)} USD (2,000 Poops).`);
      return;
    }

    const currentUsdAvailable = parseFloat(balanceUsd);
    if (amountUsdNum > currentUsdAvailable) {
      setWithdrawError(`Insufficient balance. You currently have $${currentUsdAvailable.toFixed(4)} USD.`);
      return;
    }

    // Convert USD to integer Poops
    const poopsToDeduct = Math.round(amountUsdNum * 2000);
    if (balance === null || poopsToDeduct > balance) {
      setWithdrawError('Insufficient balance.');
      return;
    }

    setIsWithdrawing(true);
    const res = await requestWithdrawal(withdrawAddress.trim(), poopsToDeduct, currency.name);
    setIsWithdrawing(false);

    if (res.success) {
      setWithdrawAddress('');
      setWithdrawAmountUsd('');
      setWithdrawError(null);
      setActiveWithdrawCurrencyId(null);
      showToast('Withdrawal Requested', `Submitted for admin approval: $${amountUsdNum.toFixed(2)} USD`, 'success');
      refreshWithdrawals();
      fetchEntitlement();
    } else {
      if (res.code === 'WITHDRAWAL_DEPOSIT_REQUIRED') {
        setShowUnlockModal(true);
      }
      setWithdrawError(res.error || 'Failed to submit withdrawal request.');
    }
  };

  // Render Pay with TON Wallet Choice Modal
  const renderTonWalletModal = (cur: CurrencyConfig) => {
    if (!showTonWalletModal) return null;

    const amt = depositAmountUsd || activeDepositQuote?.amountUsdt || 10;
    const currentPrice = activeDepositQuote?.tonPriceUsd || 5.20;
    const tonAmount = activeDepositQuote?.expectedCryptoAmount || Math.round((amt / currentPrice) * 10000) / 10000;
    const nanoTon = activeDepositQuote?.nanoTonAmount || BigInt(Math.round(tonAmount * 1_000_000_000)).toString();
    const memo = activeDepositQuote?.paymentReference || telegramUserId || 'DEP-TON';
    const officialTonAddress = 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';
    const targetAddress = (cur.networkType === 'TON' ? getEffectiveTreasuryAddress(cur) : null) || activeDepositQuote?.depositAddress || officialTonAddress;

    const tonkeeperUniversalUrl = `https://app.tonkeeper.com/transfer/${targetAddress}?amount=${nanoTon}&text=${encodeURIComponent(memo)}`;
    const tonkeeperDeepLink = `tonkeeper://transfer/${targetAddress}?amount=${nanoTon}&text=${encodeURIComponent(memo)}`;
    const baseOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://super-tom.vercel.app';
    const launcherUrl = `${baseOrigin}/open-tonkeeper.html?address=${encodeURIComponent(targetAddress)}&amount=${nanoTon}&text=${encodeURIComponent(memo)}&usd=${amt.toFixed(2)}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-3xl bg-[#090e1c] border border-cyan-500/40 p-4 space-y-3.5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowTonWalletModal(false)}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="text-center pt-1 space-y-1">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#0098EA]/30 via-cyan-500/20 to-blue-600/30 border border-cyan-400/50 flex items-center justify-center shadow-lg mb-1">
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-base font-black text-white font-display tracking-tight">
              Pay with TON Wallet
            </h3>
            <p className="text-[11px] text-slate-300 leading-snug px-1">
              Transfer instantly via Tonkeeper, @wallet, or any TON wallet
            </p>
          </div>

          {/* Deposit Summary Box */}
          <div className="p-3 rounded-2xl bg-[#040711] border border-cyan-950/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Deposit Amount:</span>
              <span className="font-bold text-white font-mono">${amt.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between items-center text-cyan-300">
              <span className="text-slate-400">Exact TON to Send:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-cyan-200 font-mono text-sm">{tonAmount} TON</span>
                <button
                  type="button"
                  onClick={() => handleCopy(tonAmount.toString(), 'modal_ton_amt', 'TON Amount')}
                  className="text-cyan-400 hover:text-white cursor-pointer"
                  title="Copy TON Amount"
                >
                  {copiedKey === 'modal_ton_amt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center text-amber-300 pt-1 border-t border-cyan-950/50">
              <span className="text-slate-400">Transfer Comment / Memo:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold">{memo}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(memo, 'modal_memo', 'Memo')}
                  className="text-cyan-400 hover:text-white cursor-pointer"
                  title="Copy Memo"
                >
                  {copiedKey === 'modal_memo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="space-y-2 pt-1">
            {/* 1. Tonkeeper Universal Link */}
            <a
              href={launcherUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                openSafeUrl(launcherUrl, tonkeeperDeepLink);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0098EA] via-[#00B4D8] to-[#0077B5] hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-[0_0_20px_rgba(0,180,216,0.35)] transition-all cursor-pointer border border-cyan-300/40 text-center select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🟢</span>
                <div className="text-left">
                  <div className="leading-tight">Pay with Tonkeeper</div>
                  <div className="text-[9px] font-normal text-cyan-100 opacity-90">Auto-fills address, {tonAmount} TON & memo</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </a>

            {/* 2. Telegram @wallet */}
            <button
              type="button"
              onClick={() => {
                if (window.Telegram?.WebApp?.openTelegramLink) {
                  window.Telegram.WebApp.openTelegramLink('https://t.me/wallet');
                } else {
                  window.open('https://t.me/wallet', '_blank');
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0c162c] hover:bg-[#132247] border border-cyan-500/30 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-95"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">💎</span>
                <div className="text-left">
                  <div className="leading-tight">Pay with Telegram Wallet</div>
                  <div className="text-[9px] font-normal text-slate-300">Open @wallet bot inside Telegram</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* 3. TON Connect */}
            {!isTonConnected ? (
              <button
                type="button"
                disabled={isTonLoading}
                onClick={async () => {
                  try {
                    await connectTonWallet();
                  } catch {
                    // Handled in hook
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#141b33] hover:bg-[#1c2647] border border-blue-500/40 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔗</span>
                  <div className="text-left">
                    <div className="leading-tight">Connect Wallet (TON Connect)</div>
                    <div className="text-[9px] font-normal text-slate-300">Tonkeeper, MyTonWallet, OpenMask</div>
                  </div>
                </div>
                {isTonLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-[#09152e] border border-blue-500/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[11px] text-cyan-200">
                      {tonWalletAddress ? `${tonWalletAddress.slice(0, 6)}...${tonWalletAddress.slice(-4)}` : 'Connected'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 text-[9px] uppercase font-bold border border-cyan-800">
                      {tonNetwork || 'TON'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={disconnectTonWallet}
                    className="text-[10px] text-red-400 hover:text-red-300 underline cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isVerifyingDeposit || isTonLoading}
                  onClick={async () => {
                    try {
                      sound.playTap();
                      setIsVerifyingDeposit(true);
                      const boc = await sendTonTransaction(targetAddress, nanoTon, memo);
                      if (boc) {
                        showToast('Transaction Sent', 'Verifying on TON blockchain...', 'info');
                        setPaymentFeedback('Payment broadcasted! Verifying on-chain...');
                        setDepositStatus('PAYMENT_DETECTED');
                        if (activeDepositId) {
                          checkDepositOnChainStatus(activeDepositId, true);
                        }
                      }
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : 'Transaction failed';
                      showToast('Payment Failed', msg, 'error');
                    } finally {
                      setIsVerifyingDeposit(false);
                    }
                  }}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingDeposit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Signing & Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Pay {tonAmount} TON via Wallet</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {tonConnectError && (
              <div className="p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-[10px] text-red-300 text-center">
                {tonConnectError}
              </div>
            )}
          </div>

          {/* Copyable Address Box */}
          <div className="p-2.5 rounded-xl bg-[#050811] border border-cyan-950/70 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              <span>Official TON Address:</span>
              <button
                type="button"
                onClick={() => handleCopy(targetAddress, 'modal_addr', 'TON Address')}
                className="text-cyan-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
              >
                {copiedKey === 'modal_addr' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[11px] font-mono text-cyan-200 break-all bg-black/40 p-2 rounded-lg select-all">
              {targetAddress}
            </div>
          </div>

          {/* Copy All Details Button */}
          <button
            type="button"
            onClick={() => handleCopyAllPaymentDetails(cur, targetAddress, amt, memo)}
            className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700/50 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy All Details (for Binance, OKX, etc.)</span>
          </button>

          {/* On-Chain Verification Trigger */}
          <div className="pt-1 border-t border-cyan-950/60">
            <button
              type="button"
              disabled={isCheckingOnChain}
              onClick={() => checkDepositOnChainStatus(activeDepositId || '', true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingOnChain ? 'animate-spin' : ''}`} />
              <span>{isCheckingOnChain ? 'Checking Blockchain...' : 'I Have Paid — Check Status'}</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Instant auto-credit upon blockchain finality (usually 5–15 seconds).
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render EVM Wallet Choice Modal (BSC & Base)
  const renderEvmWalletModal = (cur: CurrencyConfig) => {
    if (!showEvmWalletModal) return null;

    const amt = depositAmountUsd || activeDepositQuote?.amountUsdt || 10;
    const isBase = cur.id === 'BASE';
    const symbol = isBase ? baseAsset : cur.symbol;
    const cryptoAmount = activeDepositQuote?.expectedCryptoAmount || amt;
    const memo = activeDepositQuote?.paymentReference || telegramUserId || 'DEP-EVM';
    const evmAddress = activeDepositQuote?.depositAddress || getEffectiveTreasuryAddress(cur);
    const tokenContract = activeDepositQuote?.tokenContract;
    const links = activeDepositQuote?.walletLinks;

    const networkTitle = isBase ? 'Base Network (Chain ID: 8453)' : 'BNB Smart Chain (BEP20, Chain ID: 56)';
    const trustWalletUrl = links?.trustWalletUrl || (isBase 
      ? `https://link.trustwallet.com/send?asset=c8453${tokenContract ? `_t${tokenContract}` : ''}&address=${evmAddress}&amount=${cryptoAmount}`
      : `https://link.trustwallet.com/send?asset=c20000714${tokenContract ? `_t${tokenContract}` : ''}&address=${evmAddress}&amount=${cryptoAmount}`);
    const eip681Uri = links?.eip681Uri || (isBase
      ? (tokenContract ? `ethereum:${tokenContract}@8453/transfer?address=${evmAddress}&uint256=${activeDepositQuote?.rawUnits || ''}` : `ethereum:${evmAddress}@8453?value=${activeDepositQuote?.rawUnits || ''}`)
      : (tokenContract ? `ethereum:${tokenContract}@56/transfer?address=${evmAddress}&uint256=${activeDepositQuote?.rawUnits || ''}` : `ethereum:${evmAddress}@56?value=${activeDepositQuote?.rawUnits || ''}`));

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-3xl bg-[#090e1c] border border-cyan-500/40 p-4 space-y-3.5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowEvmWalletModal(false)}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="text-center pt-1 space-y-1">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 via-blue-500/20 to-cyan-500/20 border border-cyan-400/50 flex items-center justify-center shadow-lg mb-1">
              <Wallet className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-base font-black text-white font-display tracking-tight">
              Pay with EVM Wallet
            </h3>
            <p className="text-[11px] text-cyan-300 font-mono font-bold leading-snug px-1">
              {networkTitle}
            </p>
          </div>

          {/* Deposit Summary Box */}
          <div className="p-3 rounded-2xl bg-[#040711] border border-cyan-950/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Deposit Amount:</span>
              <span className="font-bold text-white font-mono">${amt.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between items-center text-cyan-300">
              <span className="text-slate-400">Exact {symbol} to Send:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-cyan-200 font-mono text-sm">{cryptoAmount} {symbol}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(cryptoAmount.toString(), 'modal_evm_amt', `${symbol} Amount`)}
                  className="text-cyan-400 hover:text-white cursor-pointer"
                  title="Copy Amount"
                >
                  {copiedKey === 'modal_evm_amt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {tokenContract && (
              <div className="flex justify-between items-center text-emerald-300 pt-1 border-t border-cyan-950/50">
                <span className="text-slate-400">Token Contract:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-emerald-200">{tokenContract.slice(0, 6)}...{tokenContract.slice(-4)}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(tokenContract, 'modal_evm_contract', 'Token Contract')}
                    className="text-emerald-400 hover:text-white cursor-pointer"
                    title="Copy Contract"
                  >
                    {copiedKey === 'modal_evm_contract' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center text-amber-300 pt-1 border-t border-cyan-950/50">
              <span className="text-slate-400">Payment Reference:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold">{memo}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(memo, 'modal_evm_memo', 'Reference')}
                  className="text-cyan-400 hover:text-white cursor-pointer"
                  title="Copy Reference"
                >
                  {copiedKey === 'modal_evm_memo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="space-y-2 pt-1">
            {/* 1. Pay with Trust Wallet */}
            <a
              href={trustWalletUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                openSafeUrl(trustWalletUrl, eip681Uri);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0052FF] via-[#0077B5] to-[#0098EA] hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-[0_0_20px_rgba(0,180,216,0.35)] transition-all cursor-pointer border border-cyan-300/40 text-center select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🛡️</span>
                <div className="text-left">
                  <div className="leading-tight">Pay with Trust Wallet</div>
                  <div className="text-[9px] font-normal text-cyan-100 opacity-90">Auto-fills recipient & {cryptoAmount} {symbol}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </a>

            {/* 2. Pay with MetaMask / Web3 */}
            <a
              href={eip681Uri}
              onClick={(e) => {
                e.preventDefault();
                openSafeUrl(eip681Uri);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0c162c] hover:bg-[#132247] border border-cyan-500/30 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-95"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🦊</span>
                <div className="text-left">
                  <div className="leading-tight">Pay with MetaMask / Web3 App</div>
                  <div className="text-[9px] font-normal text-slate-300">Opens EIP-681 Web3 deep link</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Copyable Address Box */}
          <div className="p-2.5 rounded-xl bg-[#050811] border border-cyan-950/70 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              <span>Official Recipient Address:</span>
              <button
                type="button"
                onClick={() => handleCopy(evmAddress, 'modal_evm_addr', 'EVM Address')}
                className="text-cyan-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
              >
                {copiedKey === 'modal_evm_addr' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[11px] font-mono text-cyan-200 break-all bg-black/40 p-2 rounded-lg select-all">
              {evmAddress}
            </div>
          </div>

          {/* Copy All Details Button */}
          <button
            type="button"
            onClick={() => handleCopyAllPaymentDetails(cur, evmAddress, amt, memo)}
            className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700/50 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy All Details (for Binance, Bybit, OKX)</span>
          </button>

          {/* On-Chain Verification Trigger */}
          <div className="pt-1 border-t border-cyan-950/60">
            <button
              type="button"
              disabled={isCheckingOnChain}
              onClick={() => checkDepositOnChainStatus(activeDepositId || '', true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingOnChain ? 'animate-spin' : ''}`} />
              <span>{isCheckingOnChain ? 'Checking Blockchain...' : 'I Have Paid — Check Status'}</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Auto-verifies on BSC / Base blockchain. Instant credit upon confirmation!
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render TRON Wallet Choice Modal
  const renderTronWalletModal = (cur: CurrencyConfig) => {
    if (!showTronModal) return null;

    const amt = depositAmountUsd || activeDepositQuote?.amountUsdt || 10;
    const symbol = cur.symbol;
    const cryptoAmount = activeDepositQuote?.expectedCryptoAmount || amt;
    const memo = activeDepositQuote?.paymentReference || telegramUserId || 'DEP-TRON';
    const tronAddress = activeDepositQuote?.depositAddress || getEffectiveTreasuryAddress(cur);
    const tokenContract = activeDepositQuote?.tokenContract;
    const links = activeDepositQuote?.walletLinks;

    const trustWalletUrl = links?.trustWalletUrl || (tokenContract
      ? `https://link.trustwallet.com/send?asset=c195_t${tokenContract}&address=${tronAddress}&amount=${cryptoAmount}`
      : `https://link.trustwallet.com/send?asset=c195&address=${tronAddress}&amount=${cryptoAmount}`);
    const tronUri = links?.tronUri || (tokenContract
      ? `tron:${tronAddress}?token=${tokenContract}&amount=${activeDepositQuote?.rawUnits || ''}`
      : `tron:${tronAddress}?amount=${activeDepositQuote?.rawUnits || ''}`);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-3xl bg-[#090e1c] border border-red-500/40 p-4 space-y-3.5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowTronModal(false)}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="text-center pt-1 space-y-1">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-red-600/30 via-red-500/20 to-rose-600/30 border border-red-400/50 flex items-center justify-center shadow-lg mb-1">
              <Wallet className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-base font-black text-white font-display tracking-tight">
              Pay with TRON Wallet
            </h3>
            <p className="text-[11px] text-red-300 font-mono font-bold leading-snug px-1">
              TRON Network (TRC20 / TRX)
            </p>
          </div>

          {/* Deposit Summary Box */}
          <div className="p-3 rounded-2xl bg-[#040711] border border-red-950/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Deposit Amount:</span>
              <span className="font-bold text-white font-mono">${amt.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between items-center text-red-300">
              <span className="text-slate-400">Exact {symbol} to Send:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-red-200 font-mono text-sm">{cryptoAmount} {symbol}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(cryptoAmount.toString(), 'modal_tron_amt', `${symbol} Amount`)}
                  className="text-red-400 hover:text-white cursor-pointer"
                  title="Copy Amount"
                >
                  {copiedKey === 'modal_tron_amt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {tokenContract && (
              <div className="flex justify-between items-center text-emerald-300 pt-1 border-t border-red-950/50">
                <span className="text-slate-400">USDT Contract:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-emerald-200">{tokenContract.slice(0, 6)}...{tokenContract.slice(-4)}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(tokenContract, 'modal_tron_contract', 'USDT TRC20 Contract')}
                    className="text-emerald-400 hover:text-white cursor-pointer"
                    title="Copy Contract"
                  >
                    {copiedKey === 'modal_tron_contract' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center text-amber-300 pt-1 border-t border-red-950/50">
              <span className="text-slate-400">Payment Reference:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold">{memo}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(memo, 'modal_tron_memo', 'Reference')}
                  className="text-red-400 hover:text-white cursor-pointer"
                  title="Copy Reference"
                >
                  {copiedKey === 'modal_tron_memo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="space-y-2 pt-1">
            {/* 1. Pay with Trust Wallet */}
            <a
              href={trustWalletUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                openSafeUrl(trustWalletUrl, tronUri);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#EF0027] via-[#B3001B] to-[#8C0015] hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-[0_0_20px_rgba(239,0,39,0.35)] transition-all cursor-pointer border border-red-400/40 text-center select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🛡️</span>
                <div className="text-left">
                  <div className="leading-tight">Pay with Trust Wallet</div>
                  <div className="text-[9px] font-normal text-red-100 opacity-90">Auto-fills recipient & {cryptoAmount} {symbol}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </a>

            {/* 2. Pay with TronLink */}
            <a
              href={tronUri}
              onClick={(e) => {
                e.preventDefault();
                openSafeUrl(tronUri);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#140b10] hover:bg-[#201018] border border-red-500/30 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-95"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">💎</span>
                <div className="text-left">
                  <div className="leading-tight">Pay with TronLink</div>
                  <div className="text-[9px] font-normal text-slate-300">Opens TronLink native protocol link</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Copyable Address Box */}
          <div className="p-2.5 rounded-xl bg-[#050811] border border-red-950/70 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              <span>Official TRON Address:</span>
              <button
                type="button"
                onClick={() => handleCopy(tronAddress, 'modal_tron_addr', 'TRON Address')}
                className="text-red-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
              >
                {copiedKey === 'modal_tron_addr' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[11px] font-mono text-red-200 break-all bg-black/40 p-2 rounded-lg select-all">
              {tronAddress}
            </div>
          </div>

          {/* Copy All Details Button */}
          <button
            type="button"
            onClick={() => handleCopyAllPaymentDetails(cur, tronAddress, amt, memo)}
            className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700/50 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy All Details (for Binance, Bybit, OKX)</span>
          </button>

          {/* On-Chain Verification Trigger */}
          <div className="pt-1 border-t border-red-950/60">
            <button
              type="button"
              disabled={isCheckingOnChain}
              onClick={() => checkDepositOnChainStatus(activeDepositId || '', true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingOnChain ? 'animate-spin' : ''}`} />
              <span>{isCheckingOnChain ? 'Checking Blockchain...' : 'I Have Paid — Check Status'}</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Auto-verifies on TRON blockchain. Instant credit upon confirmation!
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render Solana Wallet Choice Modal
  const renderSolanaWalletModal = (cur: CurrencyConfig) => {
    if (!showSolanaModal) return null;

    const amt = depositAmountUsd || activeDepositQuote?.amountUsdt || 10;
    const symbol = 'SOL';
    const cryptoAmount = activeDepositQuote?.expectedCryptoAmount || Math.round((amt / 180) * 10000) / 10000;
    const memo = activeDepositQuote?.paymentReference || telegramUserId || 'DEP-SOL';
    const solAddress = activeDepositQuote?.depositAddress || getEffectiveTreasuryAddress(cur);
    const links = activeDepositQuote?.walletLinks;

    const phantomUrl = links?.phantomUrl || `https://phantom.app/ul/browse/${encodeURIComponent(`solana:${solAddress}?amount=${cryptoAmount}&memo=${memo}`)}`;
    const solanaPayUri = links?.solanaPayUri || `solana:${solAddress}?amount=${cryptoAmount}&reference=${memo}&memo=${encodeURIComponent(memo)}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-3xl bg-[#090e1c] border border-purple-500/40 p-4 space-y-3.5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowSolanaModal(false)}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="text-center pt-1 space-y-1">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-purple-600/30 via-[#9945FF]/20 to-[#14F195]/20 border border-purple-400/50 flex items-center justify-center shadow-lg mb-1">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-base font-black text-white font-display tracking-tight">
              Pay with Solana Wallet
            </h3>
            <p className="text-[11px] text-purple-300 font-mono font-bold leading-snug px-1">
              Solana Mainnet-Beta
            </p>
          </div>

          {/* Deposit Summary Box */}
          <div className="p-3 rounded-2xl bg-[#040711] border border-purple-950/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Deposit Amount:</span>
              <span className="font-bold text-white font-mono">${amt.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between items-center text-purple-300">
              <span className="text-slate-400">Exact SOL to Send:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-purple-200 font-mono text-sm">{cryptoAmount} SOL</span>
                <button
                  type="button"
                  onClick={() => handleCopy(cryptoAmount.toString(), 'modal_sol_amt', 'SOL Amount')}
                  className="text-purple-400 hover:text-white cursor-pointer"
                  title="Copy Amount"
                >
                  {copiedKey === 'modal_sol_amt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center text-amber-300 pt-1 border-t border-purple-950/50">
              <span className="text-slate-400">Transfer Memo:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold">{memo}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(memo, 'modal_sol_memo', 'Memo')}
                  className="text-purple-400 hover:text-white cursor-pointer"
                  title="Copy Memo"
                >
                  {copiedKey === 'modal_sol_memo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="space-y-2 pt-1">
            {/* 1. Pay with Phantom */}
            <a
              href={phantomUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                openSafeUrl(phantomUrl, solanaPayUri);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#7B2CBF] hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-[0_0_20px_rgba(153,69,255,0.35)] transition-all cursor-pointer border border-purple-400/40 text-center select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">👻</span>
                <div className="text-left">
                  <div className="leading-tight">Pay with Phantom</div>
                  <div className="text-[9px] font-normal text-purple-100 opacity-90">Auto-fills address, {cryptoAmount} SOL & memo</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </a>

            {/* 2. Solana Pay Standard URI */}
            <a
              href={solanaPayUri}
              onClick={(e) => {
                e.preventDefault();
                openSafeUrl(solanaPayUri);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#130b24] hover:bg-[#1e113a] border border-purple-500/30 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-95"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">⚡</span>
                <div className="text-left">
                  <div className="leading-tight">Pay with Solana Pay</div>
                  <div className="text-[9px] font-normal text-slate-300">Opens Solana Pay compatible wallets</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Copyable Address Box */}
          <div className="p-2.5 rounded-xl bg-[#050811] border border-purple-950/70 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              <span>Official Solana Address:</span>
              <button
                type="button"
                onClick={() => handleCopy(solAddress, 'modal_sol_addr', 'Solana Address')}
                className="text-purple-400 hover:text-white flex items-center gap-1 font-sans cursor-pointer"
              >
                {copiedKey === 'modal_sol_addr' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[11px] font-mono text-purple-200 break-all bg-black/40 p-2 rounded-lg select-all">
              {solAddress}
            </div>
          </div>

          {/* Copy All Details Button */}
          <button
            type="button"
            onClick={() => handleCopyAllPaymentDetails(cur, solAddress, amt, memo)}
            className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700/50 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy All Details (for Binance, Bybit, OKX)</span>
          </button>

          {/* On-Chain Verification Trigger */}
          <div className="pt-1 border-t border-purple-950/60">
            <button
              type="button"
              disabled={isCheckingOnChain}
              onClick={() => checkDepositOnChainStatus(activeDepositId || '', true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingOnChain ? 'animate-spin' : ''}`} />
              <span>{isCheckingOnChain ? 'Checking Blockchain...' : 'I Have Paid — Check Status'}</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Auto-verifies on Solana blockchain. Instant credit upon confirmation!
            </p>
          </div>
        </div>
      </div>
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshWithdrawals(), refreshDeposits(), fetchEntitlement()]);
    setIsRefreshing(false);
  };

  // =========================================================================
  // VIEW 1: DEPOSIT DETAILS PAGE (Matching Screenshot 1 Exactly)
  // =========================================================================
  if (activeTab === 'deposit' && activeDepositCurrency) {
    const cur = activeDepositCurrency;
    const treasuryAddress = getEffectiveTreasuryAddress(cur);

    return (
      <div className="space-y-4 animate-in fade-in duration-200 select-none pb-12">
        {/* Back navigation button */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveDepositCurrency(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0e1628] hover:bg-[#131d35] border border-cyan-500/30 text-cyan-300 font-bold text-xs transition-all cursor-pointer shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Currencies</span>
          </button>
          <span className="text-[11px] font-mono text-cyan-400 font-bold">
            DEPOSIT DETAILS
          </span>
        </div>

        {/* Selected Biscuit Buying Banner if user clicked Buy Biscuit in Store */}
        {selectedPlanForDeposit && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 via-purple-900/40 to-amber-500/10 border border-amber-400/40 p-3.5 shadow-xl flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                <Cookie className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                  BUYING BISCUIT
                </span>
                <h4 className="text-sm font-black text-white font-display">
                  {selectedPlanForDeposit.name}
                </h4>
                <p className="text-[11px] text-emerald-400 font-mono font-bold">
                  +{selectedPlanForDeposit.boostPerHour}/hr Mining Boost
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-amber-400 font-mono block">
                ${selectedPlanForDeposit.usdtAmount.toFixed(2)} USDT
              </span>
              <button
                type="button"
                onClick={() => setSelectedPlanForDeposit(null)}
                className="text-[10px] text-purple-300 hover:text-white underline cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Currency Card Header matching Screenshot 1 */}
        <div className="rounded-2xl bg-[#090e1c] border border-cyan-500/30 p-3.5 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cur.renderIcon()}
            <div>
              <h3 className="text-base font-black text-white font-display tracking-wide flex items-center gap-2">
                {cur.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Network: <span className="text-cyan-300 font-semibold">{cur.network}</span>
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-black text-cyan-400 tracking-wider">
              DEPOSIT
            </span>
            <p className="text-[11px] text-slate-400 font-mono">
              Min: ${cur.minDepositUsd.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Base Network Asset Selector: USDC vs ETH */}
        {cur.id === 'BASE' && (
          <div className="p-1 rounded-2xl bg-[#090e1c] border border-blue-500/30 flex items-center gap-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setBaseAsset('USDC');
                paymentService.createDepositIntent({
                  amountUsdt: depositAmountUsd,
                  currency: 'USDC',
                  network: cur.network,
                  notes: selectedPlanForDeposit 
                    ? `[Biscuit Purchase: ${selectedPlanForDeposit.name} (+${selectedPlanForDeposit.boostPerHour.toLocaleString()}/hr)]`
                    : undefined,
                }).then((res) => {
                  if (res.success && res.data) {
                    setActiveDepositId(res.data.id);
                    setActiveDepositQuote(res.data);
                  }
                });
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                baseAsset === 'USDC'
                  ? 'bg-gradient-to-r from-[#0052FF] to-[#0038B8] text-white shadow-md ring-1 ring-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔵</span>
              <span>USDC (Base ERC-20)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setBaseAsset('ETH');
                paymentService.createDepositIntent({
                  amountUsdt: depositAmountUsd,
                  currency: 'ETH',
                  network: cur.network,
                  notes: selectedPlanForDeposit 
                    ? `[Biscuit Purchase: ${selectedPlanForDeposit.name} (+${selectedPlanForDeposit.boostPerHour.toLocaleString()}/hr)]`
                    : undefined,
                }).then((res) => {
                  if (res.success && res.data) {
                    setActiveDepositId(res.data.id);
                    setActiveDepositQuote(res.data);
                  }
                });
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                baseAsset === 'ETH'
                  ? 'bg-gradient-to-r from-[#0052FF] to-[#0038B8] text-white shadow-md ring-1 ring-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>ETH (Base Native)</span>
            </button>
          </div>
        )}

        {/* Big QR Code Card matching Screenshot 1 */}
        <div className="rounded-2xl bg-[#090e1c] border border-cyan-500/30 p-5 shadow-2xl flex flex-col items-center text-center space-y-3">
          {/* Real Scannable QR Code */}
          <div className="relative p-1 rounded-2xl bg-gradient-to-br from-cyan-400/40 via-purple-500/20 to-cyan-400/40 shadow-[0_0_25px_rgba(6,182,212,0.2)]">
            <QRCode
              value={treasuryAddress}
              size={190}
              className="rounded-xl"
            />
          </div>

          <p className="text-xs text-slate-300 font-medium">
            Scan with ANY crypto wallet or copy address below
          </p>

          {/* Supported Wallets Tag matching Screenshot 1 */}
          <div className="w-full py-1.5 px-3 rounded-full bg-[#0d162b] border border-cyan-500/20 text-[11px] text-cyan-300 font-semibold flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
            <span>Binance • Telegram Wallet • MetaMask • Phantom • OKX • Any App</span>
          </div>
        </div>

        {/* Official Deposit Address Card matching Screenshot 1 */}
        <div className="rounded-2xl bg-[#090e1c] border border-cyan-500/30 p-3.5 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 tracking-wider uppercase text-[11px]">
              OFFICIAL {cur.id === 'BASE' ? `${baseAsset} (Base)` : cur.name} DEPOSIT ADDRESS
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
              ALL WALLETS SUPPORTED
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#050811] border border-cyan-950/60">
            <span className="text-xs font-mono text-cyan-200 break-all select-all leading-tight font-medium">
              {treasuryAddress}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(treasuryAddress, 'deposit_addr', 'Deposit Address')}
              className="p-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Copy Address"
            >
              {copiedKey === 'deposit_addr' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Token Contract Card (For USDT BEP20, USDT TRC20, and USDC Base) */}
        {((cur.id === 'USDT_BEP20') || (cur.id === 'USDT_TRC20') || (cur.id === 'BASE' && baseAsset === 'USDC')) && (
          <div className="rounded-2xl bg-[#090e1c] border border-emerald-500/30 p-3.5 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-300 tracking-wider uppercase text-[11px] flex items-center gap-1.5">
                <span>🪙</span>
                <span>TOKEN CONTRACT ADDRESS ({cur.id === 'BASE' ? 'USDC - Base' : cur.id === 'USDT_BEP20' ? 'USDT - BSC' : 'USDT - TRON'})</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold">
                {cur.id === 'USDT_BEP20' ? '18 Decimals' : '6 Decimals'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#050811] border border-emerald-950/60">
              <span className="text-xs font-mono text-emerald-200 break-all select-all leading-tight font-medium">
                {cur.id === 'USDT_BEP20' ? '0x55d398326f99059fF775485246999027B3197955' : cur.id === 'USDT_TRC20' ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(
                  cur.id === 'USDT_BEP20' ? '0x55d398326f99059fF775485246999027B3197955' : cur.id === 'USDT_TRC20' ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                  'token_contract',
                  'Token Contract'
                )}
                className="p-2 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-white transition-all shrink-0 cursor-pointer"
                title="Copy Token Contract"
              >
                {copiedKey === 'token_contract' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Tip: In Trust Wallet or MetaMask, use this contract to import the token if not already visible.
            </p>
          </div>
        )}

        {/* Transfer Comment / Memo Card (Matching Screenshot 1 exactly) */}
        <div className="rounded-2xl bg-[#090e1c] border border-cyan-500/30 p-3.5 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 tracking-wider uppercase text-[11px] flex items-center gap-1.5">
              <span>📄</span>
              <span>TRANSFER COMMENT / MEMO (OPTIONAL)</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
              FASTEST AUTO-CREDIT
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#050811] border border-cyan-950/60">
            <span className="text-base font-black text-amber-400 font-mono tracking-wider">
              {activeDepositQuote?.paymentReference || telegramUserId}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(activeDepositQuote?.paymentReference || telegramUserId, 'memo_id', 'Deposit Memo')}
              className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 hover:text-white font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === 'memo_id' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            Tip: Paste this reference in the transfer comment/memo for guaranteed instant credit!
          </p>
        </div>

        {/* Uniform Primary Wallet Button */}
        <button
          type="button"
          disabled={isInitiatingPayment}
          onClick={() => {
            handleOpenPayment(cur);
          }}
          className={`w-full py-3.5 rounded-2xl ${getButtonGradient(cur)} hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,180,216,0.35)] transition-all cursor-pointer border border-cyan-300/40 text-center select-none disabled:opacity-60`}
        >
          {isInitiatingPayment ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>{paymentFeedback || 'Preparing your payment...'}</span>
            </>
          ) : (
            <>
              <span>{getDepositButtonLabel(cur)}</span>
              <ExternalLink className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Real-time Payment Status Feedback & Verification Card */}
        {paymentFeedback && (
          <div className="rounded-2xl bg-[#090e1c] border border-cyan-500/30 p-3.5 space-y-3 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {paymentFeedback === 'Deposit successful!' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : paymentFeedback === 'Payment pending verification.' ? (
                  <RefreshCw className={`w-4 h-4 text-cyan-400 ${isCheckingOnChain ? 'animate-spin' : ''}`} />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                )}
                <span className="text-xs font-black text-white font-display uppercase tracking-wide">
                  {paymentFeedback}
                </span>
              </div>

              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                paymentFeedback === 'Deposit successful!'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
              }`}>
                {paymentFeedback === 'Deposit successful!' ? 'CONFIRMED' : 'ON-CHAIN VERIFY'}
              </span>
            </div>

            {/* Display Quoted Amounts and Reference */}
            {activeDepositQuote && (
              <div className="p-2.5 rounded-xl bg-[#050811] border border-cyan-950/60 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Deposit Amount:</span>
                  <span className="font-bold text-white">${activeDepositQuote.amountUsdt.toFixed(2)} USD</span>
                </div>
                <div className="flex items-center justify-between text-cyan-300">
                  <span className="text-slate-400">Required {cur.id === 'BASE' ? baseAsset : cur.symbol}:</span>
                  <span className="font-black text-cyan-200">
                    {activeDepositQuote.expectedCryptoAmount} {cur.id === 'BASE' ? baseAsset : cur.symbol}
                    {activeDepositQuote.cryptoPriceUsd && activeDepositQuote.cryptoPriceUsd !== 1 ? ` (@ $${activeDepositQuote.cryptoPriceUsd.toFixed(2)})` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between text-amber-300 pt-1 border-t border-cyan-950/40">
                  <span className="text-slate-400">Payment Reference:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">{activeDepositQuote.paymentReference}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeDepositQuote.paymentReference, 'ref_copy', 'Reference')}
                      className="text-cyan-400 hover:text-white"
                      title="Copy Reference"
                    >
                      {copiedKey === 'ref_copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons: Check Payment Status & Re-open */}
            {paymentFeedback !== 'Deposit successful!' && (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isCheckingOnChain}
                  onClick={() => {
                    checkDepositOnChainStatus(activeDepositId || '', true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingOnChain ? 'animate-spin text-cyan-200' : ''}`} />
                  <span>{isCheckingOnChain ? 'Checking Blockchain...' : 'Check Payment Status'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenPayment(cur);
                    }}
                    className="py-2 px-3 rounded-xl bg-[#0d162b] hover:bg-[#121e3b] border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Re-open Wallet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyAllPaymentDetails(cur, treasuryAddress, depositAmountUsd, activeDepositQuote?.paymentReference || telegramUserId)}
                    className="py-2 px-3 rounded-xl bg-[#0d162b] hover:bg-[#121e3b] border border-cyan-900/60 text-slate-300 hover:text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Details</span>
                  </button>
                </div>
              </div>
            )}

            {/* Extended Status Details */}
            {activeDepositQuote && depositStatus !== 'WAITING_FOR_PAYMENT' && (
              <div className="mt-2 p-2.5 rounded-xl bg-[#040711] border border-cyan-900/50 space-y-2 text-[10px]">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Status</span>
                  <StatusBadge status={depositStatus} />
                </div>

                {/* TX Hash (when available) */}
                {activeDepositQuote.txHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">TX Hash:</span>
                    <a
                      href={`https://tonviewer.com/transaction/${activeDepositQuote.txHash}`}
                      onClick={(e) => { e.preventDefault(); openSafeUrl(`https://tonviewer.com/transaction/${activeDepositQuote.txHash!}`); }}
                      className="font-mono text-cyan-400 hover:text-cyan-300 underline"
                    >
                      {activeDepositQuote.txHash.slice(0, 8)}...{activeDepositQuote.txHash.slice(-6)}
                    </a>
                  </div>
                )}

                {/* Deposit details row */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Network:</span>
                  <span className="text-cyan-200 font-mono font-bold">{activeDepositQuote.currency} / {activeDepositQuote.network}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">USD Amount:</span>
                  <span className="text-white font-mono font-bold">${activeDepositQuote.amountUsdt.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Expected TON:</span>
                  <span className="text-cyan-300 font-mono font-bold">{activeDepositQuote.expectedCryptoAmount} TON</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Address:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-slate-300">
                      {activeDepositQuote.depositAddress.slice(0, 6)}...{activeDepositQuote.depositAddress.slice(-6)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeDepositQuote.depositAddress, 'addr_ext_copy', 'Address')}
                      className="text-cyan-400 hover:text-white"
                      title="Copy Address"
                    >
                      {copiedKey === 'addr_ext_copy' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-cyan-900/30">
                  <span className="text-slate-400">Reference:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-amber-300 font-bold">{activeDepositQuote.paymentReference}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeDepositQuote.paymentReference, 'ref_ext_copy', 'Reference')}
                      className="text-cyan-400 hover:text-white"
                      title="Copy Reference"
                    >
                      {copiedKey === 'ref_ext_copy' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                {activeDepositQuote.createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Created:</span>
                    <span className="text-slate-300 font-mono">{new Date(activeDepositQuote.createdAt * 1000).toLocaleTimeString()}</span>
                  </div>
                )}
                {activeDepositQuote.expiresAt && (depositStatus === 'WAITING_FOR_PAYMENT' || depositStatus === 'PAYMENT_DETECTED' || depositStatus === 'CONFIRMING') && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Expires:</span>
                    <span className="text-orange-300 font-mono">{new Date(activeDepositQuote.expiresAt * 1000).toLocaleTimeString()}</span>
                  </div>
                )}

                {/* Confirmation progress for CONFIRMING status */}
                {depositStatus === 'CONFIRMING' && (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Confirmations:</span>
                      <span className="text-cyan-300 font-mono">Waiting...</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="bg-cyan-400 h-1.5 rounded-full animate-pulse" style={{width: '40%'}} />
                    </div>
                  </div>
                )}

                {/* Copy all payment details button */}
                <button
                  type="button"
                  onClick={() => handleCopyAllPaymentDetails(cur, treasuryAddress, depositAmountUsd, activeDepositQuote?.paymentReference || telegramUserId)}
                  className="w-full py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-700/60 transition-all"
                >
                  <Copy className="w-3 h-3 text-slate-400" />
                  <span>Copy Payment Details</span>
                </button>

                {/* Deposit completed actions */}
                {(depositStatus === 'COMPLETED' || depositStatus === 'CONFIRMED') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDepositStatus('WAITING_FOR_PAYMENT');
                      setPaymentFeedback('');
                      setActiveDepositQuote(null);
                      setActiveDepositId('');
                      setDepositAmountUsd(10);
                      setCustomAmountInput('10.00');
                    }}
                    className="w-full py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-500/30 transition-all"
                  >
                    <span>✨ Start New Deposit</span>
                  </button>
                )}

                {/* Expired / Failed actions */}
                {(depositStatus === 'EXPIRED' || depositStatus === 'FAILED') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDepositStatus('WAITING_FOR_PAYMENT');
                      setPaymentFeedback('');
                      setActiveDepositQuote(null);
                      setActiveDepositId('');
                      setDepositAmountUsd(10);
                      setCustomAmountInput('10.00');
                    }}
                    className="w-full py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-red-500/30 transition-all"
                  >
                    <span>↩ Start New Deposit</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Deposit Amount Selector matching Screenshot 1 */}
        <div className="rounded-2xl bg-[#090e1c] border border-cyan-500/30 p-3.5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">
              Select Deposit Amount (USD):
            </span>
            <span className="text-emerald-400 font-mono font-bold text-[11px]">
              Min: $1.00
            </span>
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {quickDepositAmounts.map((amt) => {
              const isSelected = Math.abs(depositAmountUsd - amt) < 0.001;
              const isBiscuitPrice = selectedPlanForDeposit && Math.abs(selectedPlanForDeposit.usdtAmount - amt) < 0.001;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setDepositAmountUsd(amt);
                    setCustomAmountInput(amt.toFixed(2));
                    const effectiveSymbol = cur.id === 'BASE' ? baseAsset : cur.symbol;
                    // Keep deposit intent synchronized with selected amount
                    paymentService.createDepositIntent({
                      amountUsdt: amt,
                      currency: effectiveSymbol,
                      network: cur.network,
                      notes: selectedPlanForDeposit 
                        ? `[Biscuit Purchase: ${selectedPlanForDeposit.name} (+${selectedPlanForDeposit.boostPerHour.toLocaleString()}/hr)]`
                        : undefined,
                    }).then((res) => {
                      if (res.success && res.data) {
                        setActiveDepositId(res.data.id);
                        setActiveDepositQuote(res.data);
                      }
                    });
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-300 shadow-md ring-1 ring-cyan-400'
                      : isBiscuitPrice
                      ? 'bg-amber-950/50 border-amber-500/60 text-amber-300 hover:bg-amber-900/50'
                      : 'bg-[#0d162b] border-cyan-900/50 text-cyan-200 hover:bg-[#121e3b]'
                  }`}
                >
                  ${amt % 1 === 0 ? amt.toFixed(0) : amt.toFixed(2)}
                  {isBiscuitPrice ? (
                    <span className="block text-[8px] text-amber-300 font-mono font-bold uppercase tracking-tight">
                      Biscuit Price
                    </span>
                  ) : amt === 3 ? (
                    <span className="block text-[8px] text-cyan-300 font-mono font-bold">
                      3 Withdrawals
                    </span>
                  ) : amt === 5 ? (
                    <span className="block text-[8px] text-amber-300 font-mono font-bold">
                      Unlimited Payouts
                    </span>
                  ) : amt === 10 ? (
                    <span className="block text-[8px] text-amber-300 font-mono font-bold">
                      +30% + 13d Daily
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Custom USD input */}
          <div className="flex items-center gap-2 pt-1">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 font-bold text-xs">$</span>
              <input
                type="number"
                step="0.5"
                min="1.0"
                value={customAmountInput}
                onChange={(e) => {
                  setCustomAmountInput(e.target.value);
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    setDepositAmountUsd(val);
                    const effectiveSymbol = cur.id === 'BASE' ? baseAsset : cur.symbol;
                    paymentService.createDepositIntent({
                      amountUsdt: val,
                      currency: effectiveSymbol,
                      network: cur.network,
                      notes: selectedPlanForDeposit 
                        ? `[Biscuit Purchase: ${selectedPlanForDeposit.name} (+${selectedPlanForDeposit.boostPerHour.toLocaleString()}/hr)]`
                        : undefined,
                    }).then((res) => {
                      if (res.success && res.data) {
                        setActiveDepositId(res.data.id);
                        setActiveDepositQuote(res.data);
                      }
                    });
                  }
                }}
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#050811] border border-cyan-900/70 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-400"
                placeholder="Custom USD amount"
              />
            </div>
            <div className="text-right text-[11px] font-mono text-cyan-300">
              {activeDepositQuote ? (
                <span>
                  ≈ <strong className="text-white">{activeDepositQuote.expectedCryptoAmount} {cur.id === 'BASE' ? baseAsset : cur.symbol}</strong>
                  {activeDepositQuote.cryptoPriceUsd && activeDepositQuote.cryptoPriceUsd !== 1 && (
                    <span className="text-[10px] text-slate-400 ml-1">(@ ${activeDepositQuote.cryptoPriceUsd.toFixed(2)})</span>
                  )}
                  <span className="text-slate-400 text-[10px] ml-1">({(depositAmountUsd * 2000).toLocaleString()} Poops 💩)</span>
                </span>
              ) : (
                <span>≈ {(depositAmountUsd * 2000).toLocaleString()} Poops 💩</span>
              )}
            </div>
          </div>
        </div>

        {/* Payment Verification / Proof Submission Form */}
        <form onSubmit={handleVerifyDeposit} className="rounded-2xl bg-[#090e1c] border border-cyan-500/30 p-3.5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Verify Blockchain Payment</span>
            </h4>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
              depositStatus === 'COMPLETED'
                ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                : depositStatus === 'PAYMENT_DETECTED'
                ? 'bg-indigo-950 text-indigo-300 border-indigo-500/40 animate-pulse'
                : depositStatus === 'CONFIRMING'
                ? 'bg-blue-950 text-blue-300 border-blue-500/40 animate-pulse'
                : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
            }`}>
              {depositStatus === 'PAYMENT_DETECTED' ? 'AWAITING ADMIN REVIEW' : depositStatus}
            </span>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-semibold mb-1">
              Transaction Hash (TXID)
            </label>
            <input
              type="text"
              required
              disabled={depositStatus === 'PAYMENT_DETECTED'}
              value={depositTxHash}
              onChange={(e) => {
                setDepositTxHash(e.target.value);
                setDepositError(null);
              }}
              placeholder="Paste transaction hash / txid here to verify..."
              className="w-full px-3 py-2 rounded-xl bg-[#050811] border border-cyan-900/70 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-60"
            />
          </div>

          {depositError && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{depositError}</span>
            </div>
          )}

          {depositStatus === 'PAYMENT_DETECTED' ? (
            <div className="p-3.5 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-center space-y-2">
              <div className="text-xs font-bold text-indigo-300 flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>Payment Proof Under Review</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Your transaction hash has been sent to the Admin Panel. Your Poops will be credited as soon as an Admin approves the on-chain transfer!
              </p>
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-[11px] font-bold transition-all cursor-pointer"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Need fast-track verification? Contact @SuperTomCare</span>
              </a>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isVerifyingDeposit || !depositTxHash.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifyingDeposit ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                  <span>Submitting Proof to Admin...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>I HAVE SENT PAYMENT / SUBMIT PROOF</span>
                </>
              )}
            </button>
          )}
        </form>

        {/* Network-Specific Payment Modals */}
        {renderTonWalletModal(cur)}
        {renderEvmWalletModal(cur)}
        {renderTronWalletModal(cur)}
        {renderSolanaWalletModal(cur)}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MAIN DEPOSIT & PAYOUT TABS (Matching Screenshot 2, 3, 4)
  // =========================================================================
  return (
    <div className="space-y-4 animate-in fade-in duration-200 select-none pb-12">
      {/* 1. Header Title matching Screenshot 2 & 4 */}
      <div className="text-center">
        <h2 className="text-lg font-black text-white font-display tracking-tight">
          {activeTab === 'deposit' ? 'Deposit' : 'Withdraw'}
        </h2>
      </div>

      {/* 2. Purple Top Reinvest Banner matching Screenshot 2, 3, 4 */}
      <div className="rounded-2xl p-3.5 bg-gradient-to-r from-[#7c3aed] via-[#8b5cf6] to-[#a855f7] shadow-[0_0_20px_rgba(139,92,246,0.35)] flex items-center justify-between text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner shrink-0">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-tight flex items-center gap-1">
              <span>Reinvest: +5% extra power</span>
              <span className="text-amber-300">✨</span>
            </h4>
            <p className="text-[10px] text-purple-100 font-medium">
              0% Commission
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-purple-200">
            Balance
          </span>
          <div className="text-sm sm:text-base font-black text-white font-mono tracking-tight">
            ${balanceUsd}
          </div>
        </div>
      </div>

      {/* 3. Segmented Pill Tab Switcher: "↗ Withdraw" | "↙ Deposit" matching Screenshot 2, 3, 4 */}
      <div className="p-1 rounded-2xl bg-[#090e1c] border border-cyan-500/20 flex items-center gap-1 shadow-xl">
        <button
          type="button"
          onClick={() => {
            if (activeTab !== 'payout') {
              sound.playTabSwitch();
            }
            setActiveTab('payout');
            setWithdrawError(null);
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'payout'
              ? 'bg-[#0f172a] text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="text-cyan-400">↗</span>
          <span>Withdraw</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeTab !== 'deposit') {
              sound.playTabSwitch();
            }
            setActiveTab('deposit');
            setDepositError(null);
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'deposit'
              ? 'bg-[#0f172a] text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="text-cyan-400">↙</span>
          <span>Deposit</span>
        </button>
      </div>

      {/* 4. 5K Members Celebration Campaign (Replaces old Limited Flash Deal) */}
      {activeTab === 'deposit' && (
        <CampaignBanner
          onApplyDeposit={(amt) => handleOpenDepositDetails(SUPPORTED_CURRENCIES[0], amt)}
        />
      )}

      {/* 5. Live Payout Proofs Banner */}
      <a
        href="https://t.me/+W9ypwO2_Pm0xZTJl"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (window.Telegram?.WebApp?.openTelegramLink) {
            e.preventDefault();
            window.Telegram.WebApp.openTelegramLink('https://t.me/+W9ypwO2_Pm0xZTJl');
          }
        }}
        className="block rounded-2xl p-2.5 bg-[#091515] border border-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-md cursor-pointer active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Zap className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <span className="text-xs font-black text-emerald-300 flex items-center gap-1">
                <span>Live Payout Proofs</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </span>
              <p className="text-[11px] text-emerald-400 font-medium font-sans">
                View verified receipts on Telegram
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400" />
        </div>
      </a>

      {/* 5.5. Withdrawal Entitlement Status Banner */}
      {activeTab === 'payout' && entitlement && (
        <div className="animate-in fade-in duration-200">
          {entitlement.hasUnlimitedWithdrawals ? (
            <div className="rounded-2xl p-3 bg-gradient-to-r from-amber-500/20 via-emerald-500/15 to-amber-500/20 border border-amber-400/50 shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400/30" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white font-display">UNLIMITED WITHDRAWALS</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[9px] font-black uppercase tracking-wider">VIP ACTIVE</span>
                  </div>
                  <p className="text-[10px] text-amber-200/80">Lifetime withdrawal access unlocked. No quota limits.</p>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-[10px] font-black text-amber-300 font-mono shrink-0">
                ∞ SLOTS
              </div>
            </div>
          ) : entitlement.remainingWithdrawals > 0 ? (
            <div className="rounded-2xl p-3 bg-gradient-to-r from-cyan-950/60 via-blue-950/60 to-cyan-950/60 border border-cyan-500/40 shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white font-display">WITHDRAWAL QUOTA ACTIVE</span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 text-[9px] font-black uppercase tracking-wider">READY</span>
                  </div>
                  <p className="text-[10px] text-cyan-200/80">
                    You have {entitlement.remainingWithdrawals} free withdrawal{entitlement.remainingWithdrawals > 1 ? 's' : ''} available.
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-cyan-300 font-mono block">
                  {entitlement.remainingWithdrawals} LEFT
                </span>
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  className="text-[9px] text-cyan-400 underline hover:text-white cursor-pointer"
                >
                  Upgrade to Unlimited
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setShowUnlockModal(true)}
              className="rounded-2xl p-3.5 bg-gradient-to-r from-rose-950/60 via-purple-950/60 to-amber-950/50 border border-rose-500/40 shadow-lg flex items-center justify-between cursor-pointer hover:border-amber-400/60 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shrink-0">
                  <Lock className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white font-display">WITHDRAWALS LOCKED</span>
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-black uppercase tracking-wider">DEPOSIT REQUIRED</span>
                  </div>
                  <p className="text-[10px] text-slate-300">
                    Deposit $3 (for 3 withdrawals) or $5 (for unlimited).
                  </p>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[11px] shadow-md flex items-center gap-1 shrink-0">
                <span>Unlock</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. CURRENCIES LIST (Matching Screenshot 2 for Deposit, Screenshot 4 for Payout) */}
      <div className="space-y-2">
        {SUPPORTED_CURRENCIES.map((cur) => {
          const isExpanded = activeTab === 'payout' && activeWithdrawCurrencyId === cur.id;

          return (
            <div
              key={cur.id}
              className="rounded-2xl bg-[#090e1c] border border-cyan-500/20 hover:border-cyan-500/40 transition-all overflow-hidden shadow-lg"
            >
              {/* Currency Item Header Card */}
              <div
                onClick={() => {
                  if (activeTab === 'deposit') {
                    handleOpenDepositDetails(cur);
                  } else {
                    setActiveWithdrawCurrencyId(isExpanded ? null : cur.id);
                    setWithdrawError(null);
                  }
                }}
                className="p-3.5 flex items-center justify-between cursor-pointer active:bg-cyan-950/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {cur.renderIcon()}
                  <div>
                    <h4 className="text-sm font-black text-white font-display leading-tight">
                      {cur.name}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Network: <span className="text-cyan-300 font-semibold">{cur.network}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-cyan-400 tracking-wider">
                    {activeTab === 'deposit' ? 'DEPOSIT' : 'WITHDRAW'}
                  </span>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Min: ${activeTab === 'deposit' ? cur.minDepositUsd.toFixed(2) : cur.minWithdrawUsd.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Payout (Withdrawal) Inline Form Expansion (Matching Screenshot 3 Exactly) */}
              {isExpanded && activeTab === 'payout' && (
                <div className="px-3.5 pb-4 pt-1 border-t border-cyan-900/30 space-y-3 bg-[#060913] animate-in fade-in duration-150">
                  <form onSubmit={(e) => handleWithdrawSubmit(e, cur)} className="space-y-3 pt-2">
                    {/* Destination Address Input matching Screenshot 3 */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Destination {cur.name} Wallet Address:
                      </label>
                      <input
                        type="text"
                        required
                        value={withdrawAddress}
                        onChange={(e) => {
                          setWithdrawAddress(e.target.value);
                          setWithdrawError(null);
                        }}
                        placeholder={`Enter your ${cur.name} address`}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#090e1c] border border-cyan-900/60 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    {/* Withdraw Amount Input with MAX button matching Screenshot 3 */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                        <span>Withdraw Amount (USD):</span>
                        <span className="text-slate-400 font-mono">
                          Min: $1.00 • Max: ${balanceUsd}
                        </span>
                      </div>

                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step="0.01"
                          min={cur.minWithdrawUsd}
                          required
                          value={withdrawAmountUsd}
                          onChange={(e) => {
                            setWithdrawAmountUsd(e.target.value);
                            setWithdrawError(null);
                          }}
                          placeholder="1.00"
                          className="w-full pl-3 pr-14 py-2.5 rounded-xl bg-[#090e1c] border border-cyan-900/60 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => setWithdrawAmountUsd(balanceUsd)}
                          className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white font-black text-[10px] transition-colors cursor-pointer"
                        >
                          MAX
                        </button>
                      </div>

                      <p className="text-[10px] text-cyan-400 font-mono mt-1 font-semibold flex items-center justify-between">
                        <span>Minimum withdrawal is $1.00 USD (2,000 Poops)</span>
                        {parseFloat(withdrawAmountUsd) > 0 && (
                          <span className="text-amber-300">≈ {Math.round(parseFloat(withdrawAmountUsd) * 2000).toLocaleString()} Poops 💩</span>
                        )}
                      </p>
                    </div>

                    {/* Deposit Required Callout if locked */}
                    {(!entitlement || !entitlement.canWithdraw) && (
                      <div
                        onClick={() => setShowUnlockModal(true)}
                        className="p-2.5 rounded-xl bg-gradient-to-r from-amber-950/70 to-rose-950/70 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between cursor-pointer hover:border-amber-400 transition-colors shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-[11px] font-bold">Deposit required: $3 (3 payouts) or $5 (Unlimited)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] uppercase shrink-0">
                          Unlock Now
                        </span>
                      </div>
                    )}

                    {withdrawError && (
                      <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{withdrawError}</span>
                      </div>
                    )}

                    {/* Big Cyan Confirm Button - Clicking when not entitled opens activation popup */}
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (!entitlement || !entitlement.canWithdraw) {
                          e.preventDefault();
                          if (window.Telegram?.WebApp?.HapticFeedback) {
                            window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
                          }
                          setShowUnlockModal(true);
                        }
                      }}
                      disabled={isWithdrawing || (entitlement?.canWithdraw ? (!withdrawAddress.trim() || !withdrawAmountUsd) : false)}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isWithdrawing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <span>CONFIRM WITHDRAWAL ({parseFloat(withdrawAmountUsd) > 0 ? `$${parseFloat(withdrawAmountUsd).toFixed(2)}` : '$1.00'})</span>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 7. History Section */}
      <div className="rounded-2xl bg-[#090e1c] border border-cyan-500/20 p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">
            {activeTab === 'deposit' ? 'Recent Deposits' : 'Recent Withdrawals'}
          </h4>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {activeTab === 'deposit' ? (
          deposits && deposits.length > 0 ? (
            <div className="divide-y divide-cyan-900/30">
              {deposits.slice(0, 5).map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white font-mono">${d.amountUsdt.toFixed(2)} USDT</span>
                    <p className="text-[10px] text-slate-400 font-mono">{d.network} • {new Date(d.timestamp).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                    d.status === 'Completed' || d.status === 'Confirmed'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                      : d.status === 'Rejected'
                      ? 'bg-rose-950 text-rose-400 border-rose-500/40'
                      : 'bg-amber-950 text-amber-300 border-amber-500/40'
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-4 font-mono">
              No deposit records yet.
            </p>
          )
        ) : (
          withdrawals && withdrawals.length > 0 ? (
            <div className="divide-y divide-cyan-900/30">
              {withdrawals.slice(0, 5).map((w) => (
                <div key={w.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white font-mono">${w.amountUsdt.toFixed(2)} USD</span>
                    <p className="text-[10px] text-slate-400 font-mono">{w.network} • {new Date(w.timestamp).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                    w.status === 'Completed'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                      : w.status === 'Rejected'
                      ? 'bg-rose-950 text-rose-400 border-rose-500/40'
                      : w.status === 'Approved' || w.status === 'Processing'
                      ? 'bg-blue-950 text-blue-300 border-blue-500/40'
                      : 'bg-amber-950 text-amber-300 border-amber-500/40'
                  }`}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-4 font-mono">
              No withdrawal requests yet.
            </p>
          )
        )}

        {/* 24/7 Official Support Link */}
        <div className="pt-3 border-t border-cyan-900/30 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px] text-slate-400">Questions about deposits or withdrawals?</span>
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
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>@SuperTomCare</span>
          </a>
        </div>
      </div>

      {/* TON Wallet & Tonkeeper Payment Modal */}
      {renderTonWalletModal(activeDepositCurrency || SUPPORTED_CURRENCIES[0])}

      {/* 8. Withdrawal Unlock & Activation Modal ($3 for 3 payouts, $5 for Unlimited) */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#090e1c] border border-cyan-500/40 p-4 space-y-3.5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowUnlockModal(false)}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="text-center pt-1 space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/25 via-purple-500/20 to-cyan-400/25 border border-amber-400/50 flex items-center justify-center shadow-lg mb-1.5">
                <Crown className="w-6 h-6 text-amber-400 fill-amber-400/30" />
              </div>
              <h3 className="text-base font-black text-white font-display tracking-tight">
                Activate Withdrawals
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug px-1">
                To guarantee security and instant blockchain payouts, choose an activation deposit to unlock your withdrawals:
              </p>
            </div>

            {/* Plan Options */}
            <div className="space-y-2.5">
              {/* Option 1: $3 Deposit */}
              <div className="rounded-2xl bg-gradient-to-br from-[#0c162c] to-[#070b15] border border-cyan-500/40 p-3 space-y-2 shadow-md hover:border-cyan-400 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Starter Access</h4>
                      <span className="text-[10px] text-cyan-300 font-bold">3 Free Withdrawals</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-cyan-400 font-mono">$3.00</span>
                    <span className="block text-[8px] text-slate-400 font-mono">USDT / Crypto</span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-[#040711] border border-cyan-950/80 text-[10px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-cyan-200">
                    <Check className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Unlocks your next 3 withdrawal requests</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Check className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Full $3.00 (6,000 Poops) credited to balance</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectUnlockTier(3, '3 Free Withdrawals ($3.00)')}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Deposit $3 (Get 3 Withdrawals)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Option 2: $5 Deposit - RECOMMENDED / UNLIMITED */}
              <div className="rounded-2xl bg-gradient-to-br from-[#1a1202] via-[#100e26] to-[#0c162c] border-2 border-amber-400/70 p-3 space-y-2 shadow-[0_0_20px_rgba(245,158,11,0.25)] relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-amber-500 text-slate-950 font-black text-[8px] uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider shadow-md">
                  RECOMMENDED • UNLIMITED
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                      <Crown className="w-4 h-4 text-amber-400 fill-amber-400/30" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-amber-300 font-display">King VIP Pass</h4>
                      <span className="text-[10px] text-amber-200/90 font-bold">Unlimited Lifetime Withdrawals</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-amber-400 font-mono">$5.00</span>
                    <span className="block text-[8px] text-slate-400 font-mono">USDT / Crypto</span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-[#08070d] border border-amber-500/20 text-[10px] space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-200 font-bold">
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Unlimited Withdrawals Forever (Never locked)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Full $5.00 (10,000 Poops) credited to balance</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>+30% Mining Boost + 5 Days Daily Bonus</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectUnlockTier(5, 'Unlimited Lifetime Withdrawals ($5.00)')}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Deposit $5 (Unlock Unlimited)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Note */}
            <p className="text-[10px] text-slate-400 text-center leading-tight">
              ✨ 100% of your deposit is credited to your Poops balance and can be mined or withdrawn!
            </p>

            {/* Dismiss */}
            <button
              type="button"
              onClick={() => setShowUnlockModal(false)}
              className="w-full py-1.5 text-center text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
