import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Copy, 
  RefreshCw, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  Coins, 
  Sparkles,
  Info
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { formatNumber, poopsToUsdt } from '../utils/probability';
import { MIN_WITHDRAWAL_POOPS } from '../config/gameConfig';
import { validateNetworkAddress } from '../utils/validation';
import { EmptyState } from '../components/EmptyState';
import { paymentService } from '../services/paymentService';

export interface CurrencyConfig {
  id: string;
  name: string;
  network: string;
  symbol: string;
  networkType: 'TON' | 'TRON' | 'EVM' | 'SOLANA';
  placeholder: string;
  hint: string;
  defaultTreasuryAddress: string;
  renderIcon: () => React.ReactNode;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  {
    id: 'GRAM',
    name: 'GRAM',
    network: 'TON',
    symbol: 'GRAM',
    networkType: 'TON',
    placeholder: 'e.g. EQBvW8Z5huBkMJYdn3PCDKNKKqiqXDjvjjx29JqYpn8SoGSq',
    hint: 'TON addresses start with "EQ" or "UQ" and contain 48 characters.',
    defaultTreasuryAddress: 'EQBvW8Z5huBkMJYdn3PCDKNKKqiqXDjvjjx29JqYpn8SoGSq',
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
    placeholder: 'e.g. 0x55d398326f99059fF775485246999027B3197955',
    hint: 'BEP20 addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0x71C8360216Ac3456952771bEc438F5e85d99623C',
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
    placeholder: 'e.g. TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    hint: 'TRON addresses start with "T" and contain 34 characters.',
    defaultTreasuryAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
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
    placeholder: 'e.g. 0x71C8360216Ac3456952771bEc438F5e85d99623C',
    hint: 'BNB addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0x71C8360216Ac3456952771bEc438F5e85d99623C',
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
    placeholder: 'e.g. TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
    hint: 'TRON addresses start with "T" and contain 34 characters.',
    defaultTreasuryAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
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
    placeholder: 'e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    hint: 'Solana addresses are 32-44 characters Base58 encoded.',
    defaultTreasuryAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
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
    placeholder: 'e.g. 0x71C8360216Ac3456952771bEc438F5e85d99623C',
    hint: 'Base addresses start with "0x" and contain 42 characters.',
    defaultTreasuryAddress: '0x71C8360216Ac3456952771bEc438F5e85d99623C',
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
    showToast 
  } = useGame();

  // Top Section: 'deposit' or 'withdraw'
  const [activeSection, setActiveSection] = useState<'deposit' | 'withdraw'>('withdraw');

  // Selected Currency from the 7 options
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('USDT_TRC20');

  // Withdraw Form State
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Deposit Form State
  const [depositAmountUsdt, setDepositAmountUsdt] = useState('');
  const [depositTxHash, setDepositTxHash] = useState('');
  const [depositNotes, setDepositNotes] = useState('');
  const [depositError, setDepositError] = useState<string | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);

  // Treasury addresses map fetched from server (with defaults)
  const [treasuryWallets, setTreasuryWallets] = useState<Record<string, string>>({});

  // UI helpers
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedCurrency = SUPPORTED_CURRENCIES.find((c) => c.id === selectedCurrencyId) || SUPPORTED_CURRENCIES[2];

  // Fetch Treasury Wallets on mount
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
  }, []);

  const getEffectiveTreasuryAddress = (currency: CurrencyConfig): string => {
    return treasuryWallets[currency.name] || treasuryWallets[currency.id] || currency.defaultTreasuryAddress;
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    showToast('Copied to Clipboard', text, 'info');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleStepAmount = (delta: number) => {
    const current = Number(amountInput) || 0;
    const next = Math.max(MIN_WITHDRAWAL_POOPS, current + delta);
    setAmountInput(next.toString());
    setWithdrawError(null);
  };

  const handleMaxAmount = () => {
    if (balance !== null && balance > 0) {
      setAmountInput(Math.floor(balance).toString());
      setWithdrawError(null);
    } else {
      setAmountInput(MIN_WITHDRAWAL_POOPS.toString());
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);

    // 1. Validate wallet address
    const addressValidation = validateNetworkAddress(selectedCurrency.network, withdrawAddress);
    if (!addressValidation.isValid) {
      setWithdrawError(addressValidation.error || `Invalid ${selectedCurrency.name} address format.`);
      return;
    }

    // 2. Validate numeric amount
    const amountNum = Number(amountInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      setWithdrawError('Please enter a valid numeric amount of Poops.');
      return;
    }

    if (!Number.isInteger(amountNum)) {
      setWithdrawError('Withdrawal amount must be a whole integer.');
      return;
    }

    if (amountNum < MIN_WITHDRAWAL_POOPS) {
      setWithdrawError(`Minimum withdrawal is ${MIN_WITHDRAWAL_POOPS.toLocaleString()} Poops (1.00 USDT).`);
      return;
    }

    if (balance === null || amountNum > balance) {
      setWithdrawError(`Insufficient balance. You currently have ${formatNumber(balance)} Poops.`);
      return;
    }

    setIsWithdrawing(true);
    const res = await requestWithdrawal(withdrawAddress.trim(), amountNum, selectedCurrency.name);
    setIsWithdrawing(false);

    if (res.success) {
      setAmountInput('');
      setWithdrawAddress('');
      setWithdrawError(null);
    } else {
      setWithdrawError(res.error || 'Failed to submit withdrawal request.');
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);

    const amountNum = parseFloat(depositAmountUsdt);
    if (isNaN(amountNum) || amountNum <= 0) {
      setDepositError('Please enter a valid positive deposit amount in USDT.');
      return;
    }

    if (!depositTxHash.trim()) {
      setDepositError('Transaction hash (TXID) is required for verification.');
      return;
    }

    if (depositTxHash.trim().length < 6) {
      setDepositError('Transaction hash is too short. Please provide a valid transaction hash.');
      return;
    }

    setIsDepositing(true);
    const res = await submitDeposit(
      amountNum,
      selectedCurrency.name,
      depositTxHash.trim(),
      depositNotes.trim() || undefined
    );
    setIsDepositing(false);

    if (res.success) {
      setDepositAmountUsdt('');
      setDepositTxHash('');
      setDepositNotes('');
      setDepositError(null);
    } else {
      setDepositError(res.error || 'Failed to submit deposit proof.');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (activeSection === 'withdraw') {
      await refreshWithdrawals();
    } else {
      await refreshDeposits();
    }
    setIsRefreshing(false);
  };

  const getWithdrawalStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending Review
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold">
            <Clock className="w-3 h-3 text-sky-400" />
            Approved
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            Processing
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Paid
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Rejected & Refunded
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
            {status}
          </span>
        );
    }
  };

  const getDepositStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending Verification
          </span>
        );
      case 'Confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Confirmed & Credited
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* 1. Balance Summary Header */}
      <div className="rounded-3xl glass-panel p-4 sm:p-5 border border-purple-500/30 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#1b0838] via-[#120526] to-[#080214]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Wallet className="w-4 h-4" />
              <span>SUPERTOM PAYOUT PORTAL</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-display mt-0.5">
              {activeSection === 'withdraw' ? 'Request Withdrawal' : 'Deposit Treasury'}
            </h2>
            <p className="text-xs text-purple-200/80 mt-1">
              {activeSection === 'withdraw'
                ? 'Exchange mined Poops directly to your preferred crypto wallet'
                : 'Deposit funds to recharge Poops (1.00 USDT = 2,000 Poops)'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-purple-300">Available</span>
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
              {formatNumber(balance)} 💩
            </div>
            <span className="text-xs font-bold text-emerald-400">
              {poopsToUsdt(balance) === '--' ? '-- USDT' : `≈ $${poopsToUsdt(balance)} USDT`}
            </span>
          </div>
        </div>

        {/* Security & Admin Approval Policy Notice */}
        <div className="mt-3 p-3 rounded-2xl bg-purple-950/70 border border-purple-500/30 text-[11px] text-purple-200/90 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Admin-Approved Financial Security:</strong> All withdrawals undergo manual review by authorized administrators. Funds are never transferred automatically or insecurely. Double-spending is prevented by atomic balance reservations.
          </p>
        </div>
      </div>

      {/* 2. Top Segmented Pill Navigation: Single Tab with 2 Options ("Deposit" & "Withdraw") */}
      <div className="p-1 rounded-2xl bg-[#0c051f] border border-purple-500/30 flex items-center gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setActiveSection('deposit');
            setDepositError(null);
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSection === 'deposit'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/40 border border-emerald-400/30'
              : 'text-purple-300 hover:text-white hover:bg-purple-900/30'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4 text-emerald-300" />
          <span>Deposit</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection('withdraw');
            setWithdrawError(null);
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSection === 'withdraw'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/40 border border-purple-400/30'
              : 'text-purple-300 hover:text-white hover:bg-purple-900/30'
          }`}
        >
          <ArrowUpFromLine className="w-4 h-4 text-amber-300" />
          <span>Withdraw</span>
        </button>
      </div>

      {/* 3. Supported Currencies List (Matching Image 2 exactly) */}
      <div className="rounded-3xl glass-panel p-4 border border-purple-500/30 shadow-2xl">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Select Supported Currency</span>
          </span>
          <span className="text-[10px] text-amber-400 font-bold font-mono">
            RATE: 2,000 POOPS = 1.00 USDT
          </span>
        </div>

        {/* The 7 Currencies List */}
        <div className="rounded-2xl bg-[#090415] border border-purple-900/40 divide-y divide-purple-900/30 overflow-hidden shadow-inner">
          {SUPPORTED_CURRENCIES.map((cur) => {
            const isSelected = selectedCurrencyId === cur.id;
            return (
              <button
                key={cur.id}
                type="button"
                onClick={() => {
                  setSelectedCurrencyId(cur.id);
                  setWithdrawError(null);
                  setDepositError(null);
                }}
                className={`w-full p-3 flex items-center justify-between text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-900/40 border-l-4 border-l-amber-400'
                    : 'hover:bg-purple-950/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {cur.renderIcon()}
                  <div>
                    <h4 className="text-sm font-black text-white font-display leading-tight">
                      {cur.name}
                    </h4>
                    <p className="text-[11px] text-purple-300/70 font-mono mt-0.5">
                      Network: <span className="text-purple-200 font-semibold">{cur.network}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-amber-400/20 border border-amber-400 flex items-center justify-center text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-purple-700/60" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. ACTIVE VIEW: WITHDRAW SECTION */}
      {activeSection === 'withdraw' && (
        <div className="rounded-3xl glass-panel p-4 sm:p-5 border border-purple-500/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
            <div className="flex items-center gap-2">
              {selectedCurrency.renderIcon()}
              <div>
                <h3 className="text-sm font-black text-white">
                  Withdraw to {selectedCurrency.name}
                </h3>
                <span className="text-[10px] text-purple-300 font-mono">
                  Network: {selectedCurrency.network}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/30 text-[10px] font-bold text-amber-300">
              Admin Approved
            </span>
          </div>

          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            {/* Wallet Address Input */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-1.5">
                <span>Destination {selectedCurrency.name} Wallet</span>
                <span className="text-[10px] text-purple-400 font-mono">
                  {selectedCurrency.network} Network
                </span>
              </div>
              <input
                type="text"
                required
                value={withdrawAddress}
                onChange={(e) => {
                  setWithdrawAddress(e.target.value);
                  setWithdrawError(null);
                }}
                placeholder={selectedCurrency.placeholder}
                className="w-full px-4 py-3 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-white placeholder-purple-400/40 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />
              <p className="text-[10px] text-purple-300/70 mt-1">
                {selectedCurrency.hint}
              </p>
            </div>

            {/* Amount In Poops Box (MATCHING IMAGE 1 EXACTLY) */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-1.5 px-1">
                <span className="text-sky-300 font-bold">Amount In Poops</span>
                <span className="text-sky-300 font-bold">
                  Min: 2,000 Poops (1.00 USDT)
                </span>
              </div>

              {/* Golden Yellow Border Pill Container matching Image 1 */}
              <div className="relative flex items-center rounded-2xl border-2 border-[#f5a623] bg-[#14082e] px-3.5 py-2 shadow-[0_0_15px_rgba(245,166,35,0.25)] transition-all">
                <input
                  type="number"
                  step="1"
                  min={MIN_WITHDRAWAL_POOPS}
                  required
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setWithdrawError(null);
                  }}
                  placeholder="Minimum 2000"
                  className="w-full bg-transparent text-white placeholder-purple-400/40 text-sm font-mono font-bold focus:outline-none"
                />

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Up/Down Stepper Arrows matching Image 1 */}
                  <div className="flex flex-col items-center justify-center text-purple-300">
                    <button
                      type="button"
                      onClick={() => handleStepAmount(1000)}
                      className="hover:text-amber-300 p-0.5 transition-colors cursor-pointer leading-none"
                      title="Add 1,000 Poops"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepAmount(-1000)}
                      className="hover:text-amber-300 p-0.5 transition-colors cursor-pointer leading-none"
                      title="Subtract 1,000 Poops"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* MAX button matching Image 1 */}
                  <button
                    type="button"
                    onClick={handleMaxAmount}
                    className="px-3.5 py-1.5 rounded-xl bg-[#591ca0] hover:bg-[#6c24be] text-amber-300 font-black text-xs transition-colors cursor-pointer shadow-md"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Estimated Payout preview */}
              {Number(amountInput) > 0 && (
                <div className="mt-2 text-xs text-purple-200 flex items-center justify-between px-1">
                  <span>Estimated payout:</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    ${(Number(amountInput) / 2000).toFixed(2)} USDT ({selectedCurrency.name})
                  </span>
                </div>
              )}
            </div>

            {/* Error Banner */}
            {withdrawError && (
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}

            {/* Submit Withdrawal Request Button */}
            <button
              type="submit"
              disabled={isWithdrawing || !withdrawAddress || !amountInput}
              className="w-full py-3.5 rounded-2xl btn-purple-3d font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-50"
            >
              {isWithdrawing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Submitting for Admin Review...</span>
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="w-4 h-4 text-amber-400" />
                  <span>Submit Withdrawal Request</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* 5. ACTIVE VIEW: DEPOSIT SECTION */}
      {activeSection === 'deposit' && (
        <div className="rounded-3xl glass-panel p-4 sm:p-5 border border-purple-500/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
            <div className="flex items-center gap-2">
              {selectedCurrency.renderIcon()}
              <div>
                <h3 className="text-sm font-black text-white">
                  Deposit via {selectedCurrency.name}
                </h3>
                <span className="text-[10px] text-purple-300 font-mono">
                  Network: {selectedCurrency.network}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
              Verified Treasury
            </span>
          </div>

          {/* Official Treasury Address Card */}
          <div className="p-4 rounded-2xl bg-[#0e0622] border border-purple-900/50 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-purple-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Official Project Treasury Address ({selectedCurrency.network})</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">ACTIVE</span>
            </div>

            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#070312] border border-purple-900/60">
              <span className="text-xs font-mono text-amber-300 break-all select-all leading-tight">
                {getEffectiveTreasuryAddress(selectedCurrency)}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(getEffectiveTreasuryAddress(selectedCurrency), 'treasury')}
                className="px-3 py-1.5 rounded-lg bg-purple-800 hover:bg-purple-700 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'treasury' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-purple-300" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-purple-300/80 leading-relaxed bg-purple-950/40 p-2 rounded-xl border border-purple-900/30">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                Send only <strong>{selectedCurrency.name}</strong> on the <strong>{selectedCurrency.network}</strong> network to this address. Minimum deposit is $1.00 USDT (= 2,000 Poops credited).
              </span>
            </div>
          </div>

          {/* Deposit Submission Form (Proof of Payment) */}
          <form onSubmit={handleDepositSubmit} className="space-y-4 pt-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Submit Deposit Proof
            </h4>

            {/* Amount Deposited */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-1.5">
                <span>Amount Deposited (USDT Equivalent)</span>
                <span className="text-[10px] text-purple-300">Min: $1.00 USDT</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0.5"
                required
                value={depositAmountUsdt}
                onChange={(e) => {
                  setDepositAmountUsdt(e.target.value);
                  setDepositError(null);
                }}
                placeholder="e.g. 5.00"
                className="w-full px-4 py-3 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-white placeholder-purple-400/40 text-sm font-mono font-bold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />

              {parseFloat(depositAmountUsdt) > 0 && (
                <div className="mt-2 text-xs text-purple-200 flex items-center justify-between px-1">
                  <span>Poops to be credited:</span>
                  <span className="font-bold text-amber-400 font-mono text-sm">
                    +{Math.round(parseFloat(depositAmountUsdt) * 2000).toLocaleString()} Poops 💩
                  </span>
                </div>
              )}
            </div>

            {/* Transaction Hash Input */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-1.5">
                <span>Transaction Hash (TXID)</span>
                <span className="text-[10px] text-purple-400 font-mono">On-Chain Proof</span>
              </div>
              <input
                type="text"
                required
                value={depositTxHash}
                onChange={(e) => {
                  setDepositTxHash(e.target.value);
                  setDepositError(null);
                }}
                placeholder="Paste transaction hash / txid here"
                className="w-full px-4 py-3 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-white placeholder-purple-400/40 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />
            </div>

            {/* Optional Memo / Notes */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-1.5">
                <span>Notes / Sender Wallet (Optional)</span>
              </div>
              <input
                type="text"
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
                placeholder="Optional notes for admin verification"
                className="w-full px-4 py-2.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-white placeholder-purple-400/40 text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>

            {/* Error Banner */}
            {depositError && (
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{depositError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isDepositing || !depositAmountUsdt || !depositTxHash}
              className="w-full py-3.5 rounded-2xl btn-purple-3d font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-50"
            >
              {isDepositing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Submitting Deposit Proof...</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                  <span>Submit Deposit for Verification</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* 6. HISTORY SECTION (Withdrawal or Deposit based on active tab) */}
      <div className="rounded-3xl glass-panel p-4 border border-purple-500/30 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white font-display">
              {activeSection === 'withdraw' ? 'Withdrawal History' : 'Deposit History'}
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 font-mono">
              {activeSection === 'withdraw' ? withdrawals.length : deposits.length}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 transition-colors cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Withdrawal History List */}
        {activeSection === 'withdraw' && (
          <>
            {withdrawals.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No withdrawal requests yet"
                description="Your submitted payout requests will appear here with live tracking through review, processing, and on-chain completion."
                badge="Admin Verified"
              />
            ) : (
              <div className="space-y-2.5">
                {withdrawals.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/40 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-purple-900 border border-purple-500/40 text-[10px] font-bold text-amber-300">
                          {tx.network || 'TRC20'}
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          {tx.amountPoops.toLocaleString()} Poops
                        </span>
                        <span className="text-xs text-emerald-400 font-mono font-bold">
                          (${tx.amountUsdt.toFixed(2)} USDT)
                        </span>
                      </div>

                      <div className="shrink-0">
                        {getWithdrawalStatusBadge(tx.status)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-purple-300/70 font-mono pt-0.5 border-t border-purple-900/40">
                      <span title={tx.walletAddress} className="truncate max-w-[200px]">
                        To: {tx.walletAddress}
                      </span>
                      <span>{new Date(tx.timestamp).toLocaleDateString()}</span>
                    </div>

                    {/* Rejection Reason Notice */}
                    {tx.status === 'Rejected' && tx.rejectionReason && (
                      <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/30 text-[11px] text-rose-300">
                        <strong>Admin Reason:</strong> {tx.rejectionReason} (Poops refunded to balance)
                      </div>
                    )}

                    {/* Completed Transaction Hash */}
                    {tx.status === 'Completed' && tx.txHash && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono">
                        <span className="truncate max-w-[220px]" title={tx.txHash}>
                          TX: {tx.txHash}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(tx.txHash!, tx.id)}
                          className="ml-2 text-[10px] px-2 py-0.5 rounded bg-emerald-900 hover:bg-emerald-800 text-emerald-200 transition-colors cursor-pointer"
                        >
                          {copiedKey === tx.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Deposit History List */}
        {activeSection === 'deposit' && (
          <>
            {deposits.length === 0 ? (
              <EmptyState
                icon={ArrowDownToLine}
                title="No deposit records yet"
                description="Submitted deposits will appear here while our admins verify the transaction on-chain."
                badge="On-Chain Verified"
              />
            ) : (
              <div className="space-y-2.5">
                {deposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/40 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-purple-900 border border-purple-500/40 text-[10px] font-bold text-emerald-300">
                          {dep.network}
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          ${dep.amountUsdt.toFixed(2)} USDT
                        </span>
                        <span className="text-xs text-amber-400 font-mono font-bold">
                          (+{dep.amountPoops.toLocaleString()} Poops)
                        </span>
                      </div>

                      <div className="shrink-0">
                        {getDepositStatusBadge(dep.status)}
                      </div>
                    </div>

                    {dep.txHash && (
                      <div className="flex items-center justify-between text-[10px] text-purple-300/70 font-mono pt-0.5 border-t border-purple-900/40">
                        <span title={dep.txHash} className="truncate max-w-[200px]">
                          TX: {dep.txHash}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(dep.txHash!, dep.id)}
                          className="text-[10px] px-2 py-0.5 rounded bg-purple-900 hover:bg-purple-800 text-purple-200 transition-colors cursor-pointer"
                        >
                          {copiedKey === dep.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
