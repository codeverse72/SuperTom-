import React, { useState } from 'react';
import { 
  Wallet, 
  ArrowDownToLine, 
  ShieldAlert, 
  ServerOff,
  Sparkles,
  Info
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { formatNumber, poopsToUsdt } from '../utils/probability';
import { MIN_WITHDRAWAL_POOPS } from '../config/gameConfig';
import { validateTronAddress } from '../utils/validation';
import { EmptyState } from '../components/EmptyState';

export const Payout: React.FC = () => {
  const { balance, withdrawals, triggerNotice } = useGame();

  const [walletAddress, setWalletAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleWithdrawalAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate TRON address format
    const addressCheck = validateTronAddress(walletAddress);
    if (!addressCheck.isValid) {
      setValidationError(addressCheck.error || 'Invalid TRON address.');
      return;
    }

    // Validate numeric whole amount
    const amountNum = Number(amountInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      setValidationError('Please enter a valid numeric amount.');
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

    triggerNotice(
      'USDT TRC20 Withdrawals',
      'Withdrawals are temporarily unavailable.',
      'Withdrawals Unavailable'
    );
  };

  const handleMaxAmount = () => {
    if (balance !== null && balance > 0) {
      setAmountInput(Math.floor(balance).toString());
    } else {
      setAmountInput(MIN_WITHDRAWAL_POOPS.toString());
    }
  };

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* Balance Summary Header */}
      <div className="rounded-3xl glass-panel p-4 border border-purple-500/30 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#1b0838] via-[#120526] to-[#080214]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Wallet className="w-4 h-4" />
              <span>USDT TRC20 WITHDRAWALS</span>
            </div>
            <h2 className="text-xl font-black text-white font-display mt-0.5">
              Request Payout
            </h2>
            <p className="text-xs text-purple-200/80 mt-1">
              Exchange your mined Poops directly to USDT TRC20
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-purple-300">Available</span>
            <div className="text-xl font-black text-amber-400 font-mono">
              {formatNumber(balance)} 💩
            </div>
            <span className="text-xs font-bold text-emerald-400">
              {poopsToUsdt(balance) === '--' ? '-- USDT' : `≈ $${poopsToUsdt(balance)} USDT`}
            </span>
          </div>
        </div>

        {/* Backend Disclaimer */}
        <div className="mt-3 p-2.5 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-[11px] text-purple-200/90 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-amber-300">Notice:</strong> Withdrawals are coming soon. Payment services are not yet connected. No real or simulated transactions will be generated.
          </p>
        </div>
      </div>

      {/* Withdrawal Form */}
      <div className="rounded-3xl glass-panel p-5 border border-purple-500/30 shadow-2xl">
        <form onSubmit={handleWithdrawalAttempt} className="space-y-4">
          {/* Network Selector */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-1.5">
              <span>Transfer Network</span>
              <span className="text-[10px] text-amber-400 font-bold">RATE: 2,000 POOPS = 1 USDT</span>
            </div>
            <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 text-xs font-bold">
                  ₮
                </div>
                <div>
                  <span className="text-xs font-bold text-white">USDT (TRON TRC20)</span>
                  <p className="text-[10px] text-purple-300/70">TRC20 smart contract transfer</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                PENDING API
              </span>
            </div>
          </div>

          {/* Wallet Address Input */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-purple-200 mb-1.5">
              <span>TRON Wallet Address</span>
              <span className="text-[10px] text-purple-400 font-mono">TRC20 format</span>
            </div>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="e.g. TK7j8w1oX98NmP22XqK48Hq7Kk231L991a"
              className="w-full px-4 py-3 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-white placeholder-purple-400/40 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            <p className="text-[10px] text-purple-300/70 mt-1">
              TRON addresses start with 'T' and contain 34 characters.
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
                min="2000"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="Minimum 2000"
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
                <span className="font-bold text-emerald-400 font-mono">
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
            className="w-full py-3.5 rounded-2xl btn-purple-3d font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer"
          >
            <ServerOff className="w-4 h-4 text-amber-400" />
            <span>Request Payout (Offline Mode)</span>
          </button>
        </form>
      </div>

      {/* Transaction History Section (Clean Empty State) */}
      <div className="rounded-3xl glass-panel p-4 border border-purple-500/30 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-white font-display">
            Payout History
          </h3>
          <span className="text-[10px] text-purple-300/80">
            0 transactions
          </span>
        </div>

        {withdrawals.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transaction history."
            description="Withdrawals are temporarily unavailable. Real transaction records will appear here once payment services are connected."
            badge="Immutable Ledger"
          />
        ) : (
          <div className="space-y-2">
            {withdrawals.map((tx) => (
              <div
                key={tx.id}
                className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      {tx.amountPoops.toLocaleString()} Poops
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold">
                      (${tx.amountUsdt.toFixed(2)} USDT)
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-purple-300/70 mt-0.5 truncate max-w-[180px]">
                    {tx.walletAddress}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
