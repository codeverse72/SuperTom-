import React, { useState, useEffect, useMemo } from 'react';
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
  Cpu
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { formatNumber, poopsToUsdt } from '../utils/probability';
import { MIN_WITHDRAWAL_POOPS } from '../config/gameConfig';
import { validateNetworkAddress } from '../utils/validation';
import { paymentService } from '../services/paymentService';
import { QRCode } from '../components/QRCode';
import { DepositDto } from '../services/types';

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
  renderIcon: () => React.ReactNode;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  {
    id: 'GRAM',
    name: 'GRAM',
    network: 'TON',
    symbol: 'GRAM',
    networkType: 'TON',
    minDepositUsd: 1.0,
    minWithdrawUsd: 0.1,
    placeholder: 'e.g. UQA64uUd0dZ1JiywxEtHYl1OPjOWEMPAE15N5zq73IamtcW6',
    hint: 'TON addresses start with "EQ" or "UQ" and contain 48 characters.',
    defaultTreasuryAddress: 'UQA64uUd0dZ1JiywxEtHYl1OPjOWEMPAE15N5zq73IamtcW6',
    hasMemoSupport: true,
    walletUriScheme: (addr, _amt, memo) => `ton://transfer/${addr}${memo ? `?text=${encodeURIComponent(memo)}` : ''}`,
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
    minWithdrawUsd: 0.1,
    placeholder: 'e.g. 0x55d398326f99059fF775485246999027B3197955',
    hint: 'BEP20 addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0x71C8360216Ac3456952771bEc438F5e85d99623C',
    hasMemoSupport: false,
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
    minWithdrawUsd: 0.1,
    placeholder: 'e.g. TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    hint: 'TRON addresses start with "T" and contain 34 characters.',
    defaultTreasuryAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    hasMemoSupport: false,
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
    minWithdrawUsd: 0.1,
    placeholder: 'e.g. 0x71C8360216Ac3456952771bEc438F5e85d99623C',
    hint: 'BNB addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0x71C8360216Ac3456952771bEc438F5e85d99623C',
    hasMemoSupport: false,
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
    minWithdrawUsd: 0.1,
    placeholder: 'e.g. TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
    hint: 'TRON addresses start with "T" and contain 34 characters.',
    defaultTreasuryAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    hasMemoSupport: false,
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
    minWithdrawUsd: 0.1,
    placeholder: 'e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    hint: 'Solana addresses are 32-44 characters Base58 encoded.',
    defaultTreasuryAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    hasMemoSupport: false,
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
    minWithdrawUsd: 0.1,
    placeholder: 'e.g. 0x71C8360216Ac3456952771bEc438F5e85d99623C',
    hint: 'Base addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0x71C8360216Ac3456952771bEc438F5e85d99623C',
    hasMemoSupport: false,
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

  // Withdrawal Form State (Screenshot 3)
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmountUsd, setWithdrawAmountUsd] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Treasury dynamic addresses map
  const [treasuryWallets, setTreasuryWallets] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // User's verified Telegram ID
  const telegramUserId = useMemo(() => {
    return user?.telegramId || window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '8441612063';
  }, [user]);

  // Current balance in USD
  const balanceUsd = useMemo(() => {
    if (balance === null || balance === undefined) return '0.0000';
    return (balance / 2000).toFixed(4);
  }, [balance]);

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
  }, [refreshWithdrawals, refreshDeposits]);

  // When selectedPlanForDeposit is set from Store, open deposit view with that currency
  useEffect(() => {
    if (selectedPlanForDeposit) {
      setActiveTab('deposit');
      setActiveDepositCurrency(SUPPORTED_CURRENCIES[2]); // USDT TRC20 by default
      setDepositAmountUsd(selectedPlanForDeposit.usdtAmount);
      setCustomAmountInput(selectedPlanForDeposit.usdtAmount.toFixed(2));
    }
  }, [selectedPlanForDeposit]);

  const getEffectiveTreasuryAddress = (currency: CurrencyConfig): string => {
    return treasuryWallets[currency.name] || treasuryWallets[currency.id] || currency.defaultTreasuryAddress;
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
    const amt = initialAmount || 10.0;
    setDepositAmountUsd(amt);
    setCustomAmountInput(amt.toFixed(2));
    setDepositTxHash('');
    setDepositError(null);
    setDepositStatus('WAITING_FOR_PAYMENT');

    // Create formal tracked deposit record on backend
    paymentService.createDepositIntent({
      amountUsdt: amt,
      currency: currency.symbol,
      network: currency.network,
      notes: selectedPlanForDeposit 
        ? `[Mining Plan: ${selectedPlanForDeposit.name} (+${selectedPlanForDeposit.boostPerHour.toLocaleString()}/hr)]`
        : undefined,
    }).then((res) => {
      if (res.success && res.data) {
        setActiveDepositId(res.data.id);
      }
    });
  };

  // Verify Deposit Proof
  const handleVerifyDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);

    if (!depositTxHash.trim()) {
      setDepositError('Transaction hash (TXID) is required.');
      return;
    }

    if (depositTxHash.trim().length < 6) {
      setDepositError('Transaction hash is too short. Please paste a valid transaction hash.');
      return;
    }

    setIsVerifyingDeposit(true);
    setDepositStatus('CONFIRMING');

    if (activeDepositId) {
      const res = await paymentService.verifyDeposit(activeDepositId, depositTxHash.trim());
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
        submitDeposit(depositAmountUsd, activeDepositCurrency?.name || 'USDT', depositTxHash.trim()).then((subRes) => {
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
      const res = await submitDeposit(depositAmountUsd, activeDepositCurrency?.name || 'USDT', depositTxHash.trim());
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
      setWithdrawError(`Minimum withdrawal is $${currency.minWithdrawUsd.toFixed(2)} USD.`);
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
    } else {
      setWithdrawError(res.error || 'Failed to submit withdrawal request.');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshWithdrawals(), refreshDeposits()]);
    setIsRefreshing(false);
  };

  // =========================================================================
  // VIEW 1: DEPOSIT DETAILS PAGE (Matching Screenshot 1 Exactly)
  // =========================================================================
  if (activeTab === 'deposit' && activeDepositCurrency) {
    const cur = activeDepositCurrency;
    const treasuryAddress = getEffectiveTreasuryAddress(cur);
    const walletDeepLink = cur.walletUriScheme 
      ? cur.walletUriScheme(treasuryAddress, depositAmountUsd, telegramUserId)
      : `ethereum:${treasuryAddress}`;

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
              OFFICIAL {cur.name} DEPOSIT ADDRESS
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
              {telegramUserId}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(telegramUserId, 'memo_id', 'Telegram ID')}
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
            Tip: Paste your Telegram ID in the transfer comment/memo for guaranteed instant credit!
          </p>
        </div>

        {/* Big Open in Wallet Button matching Screenshot 1 */}
        <a
          href={walletDeepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#0098EA] via-[#00B4D8] to-[#0077B5] hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,180,216,0.35)] transition-all cursor-pointer border border-cyan-300/40"
        >
          <span>OPEN IN TELEGRAM WALLET / ANY {cur.network.toUpperCase()} WALLET</span>
          <ExternalLink className="w-4 h-4" />
        </a>

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

          {/* Quick Amount Buttons: $1, $3, $5, $10, $15, $50 */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[1, 3, 5, 10, 15, 50].map((amt) => {
              const isSelected = depositAmountUsd === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setDepositAmountUsd(amt);
                    setCustomAmountInput(amt.toFixed(2));
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-300 shadow-md ring-1 ring-cyan-400'
                      : 'bg-[#0d162b] border-cyan-900/50 text-cyan-200 hover:bg-[#121e3b]'
                  }`}
                >
                  ${amt}
                  {amt === 10 && (
                    <span className="block text-[8px] text-amber-300 font-mono font-normal">
                      +20% bonus
                    </span>
                  )}
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
                  if (!isNaN(val) && val > 0) setDepositAmountUsd(val);
                }}
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#050811] border border-cyan-900/70 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-400"
                placeholder="Custom USD amount"
              />
            </div>
            <div className="text-right text-[11px] font-mono text-cyan-300">
              ≈ {(depositAmountUsd * 2000).toLocaleString()} Poops 💩
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
            <div className="p-3 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-center space-y-1">
              <div className="text-xs font-bold text-indigo-300 flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>Payment Proof Under Review</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Your transaction hash has been sent to the Admin Panel. Your Poops will be credited as soon as an Admin approves the on-chain transfer!
              </p>
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
          {activeTab === 'deposit' ? 'Deposit' : 'Payout'}
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

      {/* 3. Segmented Pill Tab Switcher: "↗ Payout" | "↙ Deposit" matching Screenshot 2, 3, 4 */}
      <div className="p-1 rounded-2xl bg-[#090e1c] border border-cyan-500/20 flex items-center gap-1 shadow-xl">
        <button
          type="button"
          onClick={() => {
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
          <span>Payout</span>
        </button>

        <button
          type="button"
          onClick={() => {
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

      {/* 4. Limited Flash Deal Promotion Card (Deposit Tab Only, matching Screenshot 2) */}
      {activeTab === 'deposit' && (
        <div className="rounded-2xl bg-gradient-to-b from-[#14120a] via-[#0f0e07] to-[#0a0a06] border border-[#f59e0b]/50 p-4 shadow-2xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-[#f59e0b] text-[#1a1202] text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <span>⚡</span>
              <span>LIMITED FLASH DEAL</span>
            </span>
            <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Instant 20% Cashback</span>
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] flex items-center justify-center text-white shadow-lg shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white leading-tight">
                Deposit $10.00 ➔ Get <span className="text-emerald-400">+$2.00 USDT Instant!</span>
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5 font-sans">
                Earn <span className="text-cyan-300 font-bold">+1.00 USDT Daily</span> automated passive mining income!
              </p>
            </div>
          </div>

          {/* 3 Stat Boxes matching Screenshot 2 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-xl bg-[#1a1405] border border-amber-500/20 text-center">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Instant Bonus</span>
              <span className="text-xs font-black text-cyan-400 font-mono">+$2.00 USDT</span>
            </div>
            <div className="p-2 rounded-xl bg-[#1a1405] border border-amber-500/20 text-center">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Daily Income</span>
              <span className="text-xs font-black text-blue-400 font-mono">+1.00 USDT/d</span>
            </div>
            <div className="p-2 rounded-xl bg-[#1a1405] border border-amber-500/20 text-center">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Withdrawals</span>
              <span className="text-xs font-black text-amber-300 font-mono">Instant / No Fee</span>
            </div>
          </div>

          {/* Clickable offer link */}
          <button
            type="button"
            onClick={() => handleOpenDepositDetails(SUPPORTED_CURRENCIES[2], 10.0)}
            className="w-full text-center text-xs font-bold text-[#f59e0b] hover:text-amber-300 flex items-center justify-center gap-1 transition-colors cursor-pointer pt-0.5"
          >
            <span>Tap to apply $10 offer & view deposit address</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. Live Payout Proofs Banner matching Screenshot 2, 3, 4 */}
      <a
        href="https://t.me"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl p-2.5 bg-[#091515] border border-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-md"
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
                View verified receipts on @SuperTomPayouts
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400" />
        </div>
      </a>

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
                          Max: ${balanceUsd}
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
                          placeholder="0.00"
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
                    </div>

                    {withdrawError && (
                      <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{withdrawError}</span>
                      </div>
                    )}

                    {/* Big Cyan Confirm Button matching Screenshot 3 */}
                    <button
                      type="submit"
                      disabled={isWithdrawing || !withdrawAddress.trim() || !withdrawAmountUsd}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isWithdrawing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <span>CONFIRM WITHDRAWAL (${parseFloat(withdrawAmountUsd) > 0 ? parseFloat(withdrawAmountUsd).toFixed(2) : '0.00'})</span>
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
            {activeTab === 'deposit' ? 'Recent Deposits' : 'Recent Payout Requests'}
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
              No payout requests yet.
            </p>
          )
        )}
      </div>
    </div>
  );
};
