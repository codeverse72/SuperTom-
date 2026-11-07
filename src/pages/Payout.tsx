import React, { useState } from 'react';
import { 
  Wallet, 
  ArrowDownToLine, 
  ShieldAlert, 
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  RefreshCw,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { formatNumber, poopsToUsdt } from '../utils/probability';
import { MIN_WITHDRAWAL_POOPS } from '../config/gameConfig';
import { validateNetworkAddress } from '../utils/validation';
import { EmptyState } from '../components/EmptyState';

type SupportedNetwork = 'TRC20' | 'TON' | 'BEP20';

const NETWORKS: Array<{
  id: SupportedNetwork;
  name: string;
  chain: string;
  icon: string;
  placeholder: string;
  hint: string;
}> = [
  {
    id: 'TRC20',
    name: 'USDT (TRON)',
    chain: 'TRC20',
    icon: '₮',
    placeholder: 'e.g. TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    hint: 'TRON addresses start with "T" and contain 34 characters.',
  },
  {
    id: 'TON',
    name: 'USDT (TON)',
    chain: 'The Open Network',
    icon: '💎',
    placeholder: 'e.g. EQBvW8Z5huBkMJYdn3PCDKNKKqiqXDjvjjx29JqYpn8SoGSq',
    hint: 'TON addresses start with "EQ" or "UQ" and contain 48 characters.',
  },
  {
    id: 'BEP20',
    name: 'USDT (BSC)',
    chain: 'BNB Smart Chain',
    icon: '🟡',
    placeholder: 'e.g. 0x55d398326f99059fF775485246999027B3197955',
    hint: 'BEP20 addresses start with "0x" and contain 42 characters.',
  },
];

export const Payout: React.FC = () => {
  const { balance, withdrawals, requestWithdrawal, refreshWithdrawals } = useGame();

  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetwork>('TRC20');
  const [walletAddress, setWalletAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentNetworkMeta = NETWORKS.find((n) => n.id === selectedNetwork)!;

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // 1. Validate destination wallet address format according to network
    const addressCheck = validateNetworkAddress(selectedNetwork, walletAddress);
    if (!addressCheck.isValid) {
      setValidationError(addressCheck.error || 'Invalid destination wallet address format.');
      return;
    }

    // 2. Validate numeric whole amount
    const amountNum = Number(amountInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      setValidationError('Please enter a valid numeric amount of Poops.');
      return;
    }

    if (!Number.isInteger(amountNum)) {
      setValidationError('Withdrawal amount must be a whole integer.');
      return;
    }

    if (amountNum < MIN_WITHDRAWAL_POOPS) {
      setValidationError(`Minimum withdrawal is ${MIN_WITHDRAWAL_POOPS.toLocaleString()} Poops (1.00 USDT).`);
      return;
    }

    if (balance === null || amountNum > balance) {
      setValidationError(`Insufficient available balance. You have ${formatNumber(balance)} Poops.`);
      return;
    }

    setIsSubmitting(true);
    const res = await requestWithdrawal(walletAddress.trim(), amountNum, selectedNetwork);
    setIsSubmitting(false);

    if (res.success) {
      setAmountInput('');
      setWalletAddress('');
      setValidationError(null);
    } else {
      setValidationError(res.error || 'Failed to submit withdrawal request.');
    }
  };

  const handleMaxAmount = () => {
    if (balance !== null && balance > 0) {
      setAmountInput(Math.floor(balance).toString());
      setValidationError(null);
    } else {
      setAmountInput(MIN_WITHDRAWAL_POOPS.toString());
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshWithdrawals();
    setIsRefreshing(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* Balance Summary Header */}
      <div className="rounded-3xl glass-panel p-4 sm:p-5 border border-purple-500/30 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#1b0838] via-[#120526] to-[#080214]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Wallet className="w-4 h-4" />
              <span>USDT PAYOUT PORTAL</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-display mt-0.5">
              Request Withdrawal
            </h2>
            <p className="text-xs text-purple-200/80 mt-1">
              Exchange mined Poops directly to USDT on your preferred network
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
            <strong className="text-white">Admin-Approved System:</strong> For account security and anti-fraud protection, all withdrawal requests undergo manual verification by SuperTom administrators. The requested Poops are reserved immediately, and payment is dispatched upon approval.
          </p>
        </div>
      </div>

      {/* Withdrawal Form */}
      <div className="rounded-3xl glass-panel p-4 sm:p-5 border border-purple-500/30 shadow-2xl">
        <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
          {/* Network Selector */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-2">
              <span>Select Network</span>
              <span className="text-[10px] text-amber-400 font-bold font-mono">
                RATE: 2,000 POOPS = 1.00 USDT
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {NETWORKS.map((net) => {
                const isSelected = selectedNetwork === net.id;
                return (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => {
                      setSelectedNetwork(net.id);
                      setValidationError(null);
                    }}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-600/30 border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                        : 'bg-purple-950/40 border-purple-500/20 hover:border-purple-500/40 text-purple-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">{net.icon}</span>
                      <span className="text-xs font-black text-white">{net.id}</span>
                    </div>
                    <p className="text-[10px] text-purple-300/70 truncate">{net.chain}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wallet Address Input */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-1.5">
              <span>Destination {selectedNetwork} Wallet</span>
              <span className="text-[10px] text-purple-400 font-mono">
                {currentNetworkMeta.chain}
              </span>
            </div>
            <input
              type="text"
              required
              value={walletAddress}
              onChange={(e) => {
                setWalletAddress(e.target.value);
                setValidationError(null);
              }}
              placeholder={currentNetworkMeta.placeholder}
              className="w-full px-4 py-3 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-white placeholder-purple-400/40 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            <p className="text-[10px] text-purple-300/70 mt-1">
              {currentNetworkMeta.hint}
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-1.5">
              <span>Amount in Poops</span>
              <span className="text-[10px] text-purple-300">
                Min: {MIN_WITHDRAWAL_POOPS.toLocaleString()} Poops (1.00 USDT)
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="1"
                min={MIN_WITHDRAWAL_POOPS}
                required
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setValidationError(null);
                }}
                placeholder={`Minimum ${MIN_WITHDRAWAL_POOPS}`}
                className="w-full pl-4 pr-16 py-3 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-white placeholder-purple-400/40 text-sm font-mono font-bold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={handleMaxAmount}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-purple-800 hover:bg-purple-700 text-amber-300 font-bold text-xs transition-colors cursor-pointer"
              >
                MAX
              </button>
            </div>

            {/* Equivalent USDT preview */}
            {Number(amountInput) > 0 && (
              <div className="mt-2 text-xs text-purple-200 flex items-center justify-between px-1">
                <span>Estimated payout:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  ${(Number(amountInput) / 2000).toFixed(2)} USDT
                </span>
              </div>
            )}
          </div>

          {/* Inline Validation Error Banner */}
          {validationError && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300 font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !walletAddress || !amountInput}
            className="w-full py-3.5 rounded-2xl btn-purple-3d font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Submitting for Admin Review...</span>
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-4 h-4 text-amber-400" />
                <span>Submit Withdrawal Request</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Transaction History Section */}
      <div className="rounded-3xl glass-panel p-4 border border-purple-500/30 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white font-display">
              Withdrawal History
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 font-mono">
              {withdrawals.length}
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
                    {getStatusBadge(tx.status)}
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
                      onClick={() => copyToClipboard(tx.txHash!, tx.id)}
                      className="ml-2 text-[10px] px-2 py-0.5 rounded bg-emerald-900 hover:bg-emerald-800 text-emerald-200 transition-colors cursor-pointer"
                    >
                      {copiedId === tx.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
