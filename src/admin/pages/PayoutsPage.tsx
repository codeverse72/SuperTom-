import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../services/adminApiClient';
import { WithdrawalItem, DepositItem } from '../types/admin';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  DollarSign,
  Coins,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

export const PayoutsPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [activeSubTab, setActiveSubTab] = useState<'withdrawals' | 'deposits'>('withdrawals');

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [withdrawalTotalPages, setWithdrawalTotalPages] = useState(1);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>('');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [withdrawalStats, setWithdrawalStats] = useState<{
    totalCompletedUsdt: number;
    totalCompletedPoops: number;
    pendingCount: number;
    processingCount: number;
  } | null>(null);

  // Deposits state
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [depositPage, setDepositPage] = useState(1);
  const [depositTotalPages, setDepositTotalPages] = useState(1);
  const [depositStatus, setDepositStatus] = useState<string>('');
  const [depositStats, setDepositStats] = useState<{
    totalConfirmedUsdt: number;
    totalConfirmedPoops: number;
    pendingCount: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  // Trust Wallet Treasury Settings state
  const [showTrustWalletModal, setShowTrustWalletModal] = useState(false);
  const [trustWalletEvm, setTrustWalletEvm] = useState('');
  const [trustWalletTron, setTrustWalletTron] = useState('');
  const [trustWalletTon, setTrustWalletTon] = useState('');
  const [trustWalletSol, setTrustWalletSol] = useState('');
  const [isSavingTrustWallet, setIsSavingTrustWallet] = useState(false);

  // Modals for actions
  const [completeModalItem, setCompleteModalItem] = useState<WithdrawalItem | null>(null);
  const [completeTxHash, setCompleteTxHash] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const [rejectModalItem, setRejectModalItem] = useState<WithdrawalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [confirmDepositItem, setConfirmDepositItem] = useState<DepositItem | null>(null);
  const [depositTxHash, setDepositTxHash] = useState('');
  const [confirmDepositBoost, setConfirmDepositBoost] = useState('0');
  const [isConfirmingDeposit, setIsConfirmingDeposit] = useState(false);

  // Decline Deposit Modal state
  const [declineDepositItem, setDeclineDepositItem] = useState<DepositItem | null>(null);
  const [declineDepositReason, setDeclineDepositReason] = useState('');
  const [isDecliningDeposit, setIsDecliningDeposit] = useState(false);
  const [depositSearch, setDepositSearch] = useState('');

  // Manual Deposit / Balance Credit Modal
  const [showManualDepositModal, setShowManualDepositModal] = useState(false);
  const [manualDepositUser, setManualDepositUser] = useState('');
  const [manualDepositAmount, setManualDepositAmount] = useState('');
  const [manualDepositNetwork, setManualDepositNetwork] = useState('TRC20');
  const [manualDepositTxHash, setManualDepositTxHash] = useState('');
  const [manualDepositNotes, setManualDepositNotes] = useState('');
  const [manualDepositBoost, setManualDepositBoost] = useState('0');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    const res = await adminApi.getWithdrawals({
      page: withdrawalPage,
      limit: 15,
      status: withdrawalStatus || undefined,
      search: withdrawalSearch || undefined,
    });
    if (res.success && res.data) {
      setWithdrawals(res.data.withdrawals);
      setTotalWithdrawals(res.data.total);
      setWithdrawalTotalPages(res.data.totalPages);
      if (res.data.stats) {
        setWithdrawalStats(res.data.stats);
      }
    }
    setIsLoading(false);
  }, [withdrawalPage, withdrawalStatus, withdrawalSearch]);

  const fetchDeposits = useCallback(async () => {
    setIsLoading(true);
    const res = await adminApi.getDeposits({
      page: depositPage,
      limit: 25,
      status: depositStatus || undefined,
      search: depositSearch || undefined,
    });
    if (res.success && res.data) {
      setDeposits(res.data.deposits);
      setTotalDeposits(res.data.total);
      setDepositTotalPages(res.data.totalPages);
      if (res.data.stats) {
        setDepositStats(res.data.stats);
      }
    }
    setIsLoading(false);
  }, [depositPage, depositStatus, depositSearch]);

  useEffect(() => {
    if (activeSubTab === 'withdrawals') {
      fetchWithdrawals();
    } else {
      fetchDeposits();
    }
  }, [activeSubTab, fetchWithdrawals, fetchDeposits]);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this withdrawal for manual payout?')) return;
    const res = await adminApi.approveWithdrawal(id);
    if (res.success) {
      fetchWithdrawals();
    } else {
      alert(res.error || 'Failed to approve');
    }
  };

  const handleMarkProcessing = async (id: string) => {
    if (!confirm('Mark this withdrawal as PROCESSING (funds currently being dispatched)?')) return;
    const res = await adminApi.markWithdrawalProcessing(id);
    if (res.success) {
      fetchWithdrawals();
    } else {
      alert(res.error || 'Failed to update status');
    }
  };

  const fetchTrustWalletSettings = async () => {
    const res = await adminApi.getTreasurySettings();
    if (res.success && res.data) {
      setTrustWalletEvm(res.data.trustWalletEvm || '');
      setTrustWalletTron(res.data.trustWalletTron || '');
      setTrustWalletTon(res.data.trustWalletTon || '');
      setTrustWalletSol(res.data.trustWalletSol || '');
    }
  };

  const handleSaveTrustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTrustWallet(true);
    const res = await adminApi.updateTreasurySettings({
      trustWalletEvm,
      trustWalletTron,
      trustWalletTon,
      trustWalletSol,
    });
    setIsSavingTrustWallet(false);
    if (res.success) {
      alert('Trust Wallet treasury receiving addresses updated successfully!');
      setShowTrustWalletModal(false);
    } else {
      alert(res.error || 'Failed to update Trust Wallet settings');
    }
  };

  const handleManualDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usdtNum = parseFloat(manualDepositAmount);
    if (isNaN(usdtNum) || usdtNum <= 0) {
      alert('Please enter a valid positive USDT amount');
      return;
    }
    if (!manualDepositUser.trim()) {
      alert('Please enter a target username or Telegram ID');
      return;
    }
    setIsSubmittingDeposit(true);
    const boostNum = parseInt(manualDepositBoost, 10) || 0;
    const res = await adminApi.manualCreditDeposit({
      identifier: manualDepositUser.trim(),
      amountUsdt: usdtNum,
      network: manualDepositNetwork,
      txHash: manualDepositTxHash.trim() || undefined,
      notes: manualDepositNotes.trim() || 'Admin manual balance deposit',
      boostPerHour: boostNum > 0 ? boostNum : undefined,
    });
    setIsSubmittingDeposit(false);
    if (res.success) {
      alert(res.data?.message || 'Deposit balance credited successfully!');
      setShowManualDepositModal(false);
      setManualDepositUser('');
      setManualDepositAmount('');
      setManualDepositTxHash('');
      setManualDepositNotes('');
      setManualDepositBoost('0');
      fetchDeposits();
    } else {
      alert(res.error || 'Failed to credit deposit');
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModalItem || !completeTxHash) return;
    setIsCompleting(true);
    const res = await adminApi.completeWithdrawal(completeModalItem.id, completeTxHash);
    setIsCompleting(false);
    if (res.success) {
      setCompleteModalItem(null);
      setCompleteTxHash('');
      fetchWithdrawals();
    } else {
      alert(res.error || 'Failed to complete withdrawal');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalItem || !rejectReason) return;
    setIsRejecting(true);
    const res = await adminApi.rejectWithdrawal(rejectModalItem.id, rejectReason);
    setIsRejecting(false);
    if (res.success) {
      setRejectModalItem(null);
      setRejectReason('');
      fetchWithdrawals();
    } else {
      alert(res.error || 'Failed to reject withdrawal');
    }
  };

  const handleConfirmDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmDepositItem || !depositTxHash) return;
    setIsConfirmingDeposit(true);
    const boostNum = parseInt(confirmDepositBoost, 10) || 0;
    const res = await adminApi.confirmDeposit(
      confirmDepositItem.id,
      depositTxHash,
      boostNum > 0 ? boostNum : undefined
    );
    setIsConfirmingDeposit(false);
    if (res.success) {
      alert(res.data?.message || 'Deposit confirmed successfully!');
      setConfirmDepositItem(null);
      setDepositTxHash('');
      setConfirmDepositBoost('0');
      fetchDeposits();
    } else {
      alert(res.error || 'Failed to confirm deposit');
    }
  };

  const handleDeclineDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineDepositItem) return;
    setIsDecliningDeposit(true);
    const res = await adminApi.declineDeposit(
      declineDepositItem.id,
      declineDepositReason.trim() || undefined
    );
    setIsDecliningDeposit(false);
    if (res.success) {
      alert(res.data?.message || 'Deposit request has been declined.');
      setDeclineDepositItem(null);
      setDeclineDepositReason('');
      fetchDeposits();
    } else {
      alert(res.error || 'Failed to decline deposit');
    }
  };

  const handleDeleteDeposit = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this deposit record? This action cannot be undone.')) {
      return;
    }
    const res = await adminApi.deleteDeposit(id);
    if (res.success) {
      alert(res.data?.message || 'Deposit deleted successfully');
      fetchDeposits();
    } else {
      alert(res.error || 'Failed to delete deposit');
    }
  };

  const handleClearAllDeposits = async () => {
    const promptAns = window.prompt(
      'Type "DELETE" to confirm deleting ALL deposit records from the database:'
    );
    if (promptAns !== 'DELETE') {
      return;
    }
    const res = await adminApi.clearDeposits({ all: true });
    if (res.success) {
      alert(res.data?.message || 'Successfully cleared deposits.');
      fetchDeposits();
    } else {
      alert(res.error || 'Failed to clear deposits');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-[#0F0822] border border-purple-900/40">
          <button
            onClick={() => setActiveSubTab('withdrawals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'withdrawals'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
            <span>USDT TRC20 Withdrawals</span>
          </button>
          <button
            onClick={() => setActiveSubTab('deposits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'deposits'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span>Player Deposits</span>
          </button>
        </div>

        <button
          onClick={() => (activeSubTab === 'withdrawals' ? fetchWithdrawals() : fetchDeposits())}
          disabled={isLoading}
          className="p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-900/40 text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* WITHDRAWALS VIEW */}
      {activeSubTab === 'withdrawals' && (
        <div className="space-y-4">
          {/* Withdrawal Volume & Queue Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Pending Review"
              value={withdrawalStats ? withdrawalStats.pendingCount : 0}
              subtitle="Withdrawals awaiting approval"
              icon={AlertTriangle}
              variant={withdrawalStats && withdrawalStats.pendingCount > 0 ? 'rose' : 'purple'}
            />
            <StatCard
              title="In Processing Queue"
              value={withdrawalStats ? withdrawalStats.processingCount : 0}
              subtitle="Funds being dispatched"
              icon={Clock}
              variant="gold"
            />
            <StatCard
              title="Total Paid USDT"
              value={withdrawalStats ? `$${withdrawalStats.totalCompletedUsdt.toFixed(2)}` : '$0.00'}
              subtitle="Completed on-chain payouts"
              icon={DollarSign}
              variant="emerald"
            />
            <StatCard
              title="Total Requests"
              value={totalWithdrawals}
              subtitle="All historical requests"
              icon={ArrowDownRight}
              variant="sky"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0C061A] p-3 rounded-2xl border border-purple-900/30">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={withdrawalSearch}
                onChange={(e) => {
                  setWithdrawalSearch(e.target.value);
                  setWithdrawalPage(1);
                }}
                placeholder="Search by wallet address or username..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#080412] border border-purple-900/60 text-white text-xs focus:outline-hidden"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {['', 'PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setWithdrawalStatus(st);
                    setWithdrawalPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${withdrawalStatus === st
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-purple-950/30 text-slate-400 hover:text-white border border-purple-900/30'
                    }`}
                >
                  {st || 'ALL'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#090414] border border-purple-900/30 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090415] border-b border-purple-900/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4">Requested USDT</th>
                    <th className="py-3 px-4">TomCoins Deducted</th>
                    <th className="py-3 px-4">Network & Wallet Address</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/20">
                  {withdrawals.length > 0 ? (
                    withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-purple-950/20 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white">@{w.username || w.telegramId}</p>
                          <p className="text-[10px] text-slate-500 font-mono">TG: {w.telegramId}</p>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-sm">
                          ${w.amountUsdt.toFixed(2)} USDT
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400">
                          {w.amountPoops.toLocaleString()} TomCoins
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300 max-w-[220px]">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-purple-900/70 border border-purple-500/40 text-[10px] font-bold text-purple-200">
                              {w.network || 'TRC20'}
                            </span>
                          </div>
                          <p className="truncate text-[11px]" title={w.walletAddress}>{w.walletAddress}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge status={w.status} />
                          {w.rejectionReason && (
                            <p className="text-[10px] text-rose-400/90 mt-1 max-w-[150px] truncate" title={w.rejectionReason}>
                              Reason: {w.rejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                          {new Date(w.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                            <div className="flex items-center justify-end gap-1.5">
                              {w.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(w.id)}
                                    title="Approve for payout"
                                    className="px-2 py-1 rounded-lg bg-sky-950 border border-sky-500/40 text-sky-300 font-bold hover:bg-sky-900/60 transition-all text-[11px]"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleMarkProcessing(w.id)}
                                    title="Mark processing"
                                    className="px-2 py-1 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold hover:bg-indigo-900/60 transition-all text-[11px]"
                                  >
                                    Process
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectModalItem(w);
                                      setRejectReason('');
                                    }}
                                    title="Reject & refund"
                                    className="px-2 py-1 rounded-lg bg-rose-950 border border-rose-500/40 text-rose-300 font-bold hover:bg-rose-900/60 transition-all text-[11px]"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {w.status === 'APPROVED' && (
                                <>
                                  <button
                                    onClick={() => handleMarkProcessing(w.id)}
                                    title="Mark processing"
                                    className="px-2 py-1 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold hover:bg-indigo-900/60 transition-all text-[11px]"
                                  >
                                    Process
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCompleteModalItem(w);
                                      setCompleteTxHash('');
                                    }}
                                    title="Enter Blockchain Transaction Hash"
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all text-[11px] shadow-sm flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Mark Paid</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectModalItem(w);
                                      setRejectReason('');
                                    }}
                                    title="Reject & refund"
                                    className="px-2 py-1 rounded-lg bg-rose-950 border border-rose-500/40 text-rose-300 font-bold hover:bg-rose-900/60 transition-all text-[11px]"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {w.status === 'PROCESSING' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setCompleteModalItem(w);
                                      setCompleteTxHash('');
                                    }}
                                    title="Enter Blockchain Transaction Hash"
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all text-[11px] shadow-sm flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Mark Paid</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectModalItem(w);
                                      setRejectReason('');
                                    }}
                                    title="Reject & refund"
                                    className="px-2 py-1 rounded-lg bg-rose-950 border border-rose-500/40 text-rose-300 font-bold hover:bg-rose-900/60 transition-all text-[11px]"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {w.status === 'COMPLETED' && w.txHash && (
                                <span className="font-mono text-[10px] text-emerald-400 truncate max-w-[120px] block" title={w.txHash}>
                                  Tx: {w.txHash.substring(0, 10)}...
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                        No withdrawal requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-purple-900/40 flex items-center justify-between text-xs text-slate-400">
              <span>Total: {totalWithdrawals} withdrawals (Page {withdrawalPage} of {withdrawalTotalPages || 1})</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWithdrawalPage((p) => Math.max(1, p - 1))}
                  disabled={withdrawalPage <= 1}
                  className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setWithdrawalPage((p) => Math.min(withdrawalTotalPages, p + 1))}
                  disabled={withdrawalPage >= withdrawalTotalPages}
                  className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEPOSITS VIEW */}
      {activeSubTab === 'deposits' && (
        <div className="space-y-4">
          {/* Deposit Balance & Volume Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Verified Deposit Volume"
              value={depositStats ? `$${depositStats.totalConfirmedUsdt.toFixed(2)} USDT` : '$0.00 USDT'}
              subtitle="Total verified deposits"
              icon={DollarSign}
              variant="emerald"
            />
            <StatCard
              title="Total TomCoins Credited"
              value={depositStats ? `+${depositStats.totalConfirmedPoops.toLocaleString()}` : '0'}
              subtitle="Credited to player balances"
              icon={Coins}
              variant="gold"
            />
            <StatCard
              title="Pending Review"
              value={depositStats ? depositStats.pendingCount : 0}
              subtitle="Awaiting on-chain confirmation"
              icon={Clock}
              variant={depositStats && depositStats.pendingCount > 0 ? 'rose' : 'purple'}
            />
            <StatCard
              title="Total Deposit Submissions"
              value={totalDeposits}
              subtitle="Historical deposit submissions"
              icon={ArrowUpRight}
              variant="sky"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0C061A] p-3 rounded-2xl border border-purple-900/30">
            <div>
              <p className="text-xs font-bold text-white">Player Deposits & Balance Credits</p>
              <p className="text-[11px] text-slate-400">Manage verified on-chain payments and manual deposit adjustments</p>
            </div>
            {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    fetchTrustWalletSettings();
                    setShowTrustWalletModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-950 border border-purple-500/40 hover:bg-purple-900 text-amber-300 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Connect Trust Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualDepositModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>+ Credit Manual Deposit</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllDeposits}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-950/80 border border-rose-500/40 hover:bg-rose-900 text-rose-300 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Purge all deposit requests"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear All Deposits</span>
                </button>
              </div>
            )}
          </div>

          {/* Deposit Controls: Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by player, TG ID, wallet, TXID, or memo..."
                value={depositSearch}
                onChange={(e) => {
                  setDepositSearch(e.target.value);
                  setDepositPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#120A25] border border-purple-900/40 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'ALL SUBMITTED', value: '' },
                { label: 'PENDING REVIEW', value: 'PENDING' },
                { label: 'CONFIRMING', value: 'CONFIRMING' },
                { label: 'AWAITING CONFS', value: 'AWAITING_CONFIRMATIONS' },
                { label: 'CREDITED', value: 'CREDITED' },
                { label: 'UNIDENTIFIED', value: 'UNIDENTIFIED' },
                { label: 'REJECTED', value: 'REJECTED' },
                { label: 'UNSUBMITTED INTENTS', value: 'INTENTS' },
              ].map((filter) => (
                <button
                  key={filter.label}
                  onClick={() => {
                    setDepositStatus(filter.value);
                    setDepositPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${depositStatus === filter.value
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-purple-950/30 text-slate-400 hover:text-white border border-purple-900/30'
                    }`}
                >
                  {filter.label}
                </button>
              ))}
              <button
                type="button"
                onClick={fetchDeposits}
                title="Refresh deposits list"
                className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 hover:text-white cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                <button
                  type="button"
                  onClick={handleClearAllDeposits}
                  title="Clear all deposits from database"
                  className="px-2.5 py-1 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 hover:bg-rose-900/80 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#090414] border border-purple-900/30 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090415] border-b border-purple-900/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4">Deposit Amount</th>
                    <th className="py-3 px-4">TomCoins Credited</th>
                    <th className="py-3 px-4">Network</th>
                    <th className="py-3 px-4">Transaction Hash</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/20">
                  {deposits.length > 0 ? (
                    deposits.map((d) => (
                      <tr key={d.id} className="hover:bg-purple-950/20">
                        <td className="py-3 px-4 font-bold text-white">
                          <p>@{d.username || d.telegramId}</p>
                          <p className="text-[10px] text-slate-500 font-mono">TG: {d.telegramId}</p>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          ${d.amountUsdt.toFixed(2)} USDT
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400">
                          +{d.amountPoops.toLocaleString()} TomCoins
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          <div>{d.currency ? `${d.currency} (${d.network})` : d.network}</div>
                          {d.paymentReference && (
                            <div className="text-[10px] text-amber-400">Memo: {d.paymentReference}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px] max-w-[150px]">
                          {d.txHash ? (
                            <a
                              href={d.explorerUrl || `https://bscscan.com/tx/${d.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 font-mono text-[11px]"
                              title={d.txHash}
                            >
                              <span className="truncate">{d.txHash.length > 16 ? `${d.txHash.slice(0, 8)}...${d.txHash.slice(-6)}` : d.txHash}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-500">Pending TXID</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge status={d.status} />
                          {d.requiredConfirmations && d.requiredConfirmations > 1 && ['CONFIRMING', 'PENDING_CONFIRMATION', 'AWAITING_CONFIRMATIONS', 'VERIFYING'].includes(d.status) && (
                            <div className="text-[10px] text-sky-400 font-mono mt-0.5">
                              {d.confirmations || 0}/{d.requiredConfirmations} confs
                            </div>
                          )}
                          {d.failureReason && (
                            <div className="text-[10px] text-rose-400 font-mono mt-0.5 truncate max-w-[120px]" title={d.failureReason}>
                              {d.failureReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {Boolean(d.txHash) &&
                              ['PENDING', 'PAYMENT_DETECTED', 'CONFIRMING', 'HASH_SUBMITTED', 'VERIFYING', 'AWAITING_CONFIRMATIONS', 'UNDER_REVIEW'].includes(d.status) &&
                              hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                                <>
                                  <button
                                    onClick={() => {
                                      setConfirmDepositItem(d);
                                      setDepositTxHash(d.txHash && d.txHash !== 'Pending on-chain verification' ? d.txHash : '');
                                      let boost = '0';
                                      if (d.notes?.includes('Diamond') || d.notes?.includes('1000') || d.notes?.includes('1,000')) boost = '1000';
                                      else if (d.notes?.includes('Gold') || d.notes?.includes('200')) boost = '200';
                                      else if (d.notes?.includes('Silver') || d.notes?.includes('50')) boost = '50';
                                      else if (d.notes?.includes('Common') || d.notes?.includes('10')) boost = '10';
                                      setConfirmDepositBoost(boost);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 cursor-pointer transition-all"
                                    title="Confirm & credit deposit"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Confirm</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeclineDepositItem(d);
                                      setDeclineDepositReason('');
                                    }}
                                    className="px-2 py-1 rounded-lg bg-rose-950 border border-rose-500/40 text-rose-300 font-bold hover:bg-rose-900/60 text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                                    title="Decline deposit request"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Decline</span>
                                  </button>
                                </>
                            )}
                            {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                              <button
                                onClick={() => handleDeleteDeposit(d.id)}
                                className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 cursor-pointer transition-all"
                                title="Delete this deposit record"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 font-mono text-xs">
                        No deposits recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-purple-900/40 flex items-center justify-between text-xs text-slate-400">
              <span>Total: {totalDeposits} deposits (Page {depositPage} of {depositTotalPages || 1})</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDepositPage((p) => Math.max(1, p - 1))}
                  disabled={depositPage <= 1}
                  className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 disabled:opacity-40 cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDepositPage((p) => Math.min(depositTotalPages, p + 1))}
                  disabled={depositPage >= depositTotalPages}
                  className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 disabled:opacity-40 cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Withdrawal Modal */}
      <Modal
        isOpen={Boolean(completeModalItem)}
        onClose={() => setCompleteModalItem(null)}
        title="Record Payout Completion"
        subtitle={`User: @${completeModalItem?.username} • ${completeModalItem?.amountUsdt} USDT`}
        maxWidth="md"
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40 space-y-1">
            <p className="text-slate-400">Recipient TRC20 Wallet:</p>
            <p className="font-mono font-bold text-amber-300 break-all select-all">
              {completeModalItem?.walletAddress}
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Blockchain Transaction Hash (TXID)
            </label>
            <input
              type="text"
              required
              value={completeTxHash}
              onChange={(e) => setCompleteTxHash(e.target.value)}
              placeholder="Paste 64-character TRON transaction hash..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setCompleteModalItem(null)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCompleting || !completeTxHash}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50"
            >
              {isCompleting ? 'Finalizing...' : 'Confirm & Complete Payout'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Withdrawal Modal */}
      <Modal
        isOpen={Boolean(rejectModalItem)}
        onClose={() => setRejectModalItem(null)}
        title="Reject Withdrawal Request"
        subtitle={`Will immediately refund ${rejectModalItem?.amountPoops} TomCoins to @${rejectModalItem?.username}`}
        maxWidth="md"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Rejection Reason (Audit Trail)
            </label>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid TRON TRC20 address provided, suspect multi-account, etc."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setRejectModalItem(null)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRejecting || !rejectReason}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all disabled:opacity-50"
            >
              {isRejecting ? 'Refunding...' : 'Confirm Rejection & Refund'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deposit Modal */}
      <Modal
        isOpen={Boolean(confirmDepositItem)}
        onClose={() => setConfirmDepositItem(null)}
        title="Confirm Deposit & Credit Player"
        subtitle={`User: @${confirmDepositItem?.username} • ${confirmDepositItem?.amountUsdt} USDT`}
        maxWidth="md"
      >
        <form onSubmit={handleConfirmDepositSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Confirmed Blockchain Transaction Hash
            </label>
            <input
              type="text"
              required
              value={depositTxHash}
              onChange={(e) => setDepositTxHash(e.target.value)}
              placeholder="Paste transaction hash verifying funds received on-chain..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Mining Speed Boost to Activate
            </label>
            <select
              value={confirmDepositBoost}
              onChange={(e) => setConfirmDepositBoost(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
            >
              <option value="0">None / Standard TomCoins Only</option>
              <option value="10">Common Plan (+10 TomCoins / hour)</option>
              <option value="50">Silver Plan (+50 TomCoins / hour)</option>
              <option value="200">Gold Plan (+200 TomCoins / hour)</option>
              <option value="1000">Diamond Plan (+1,000 TomCoins / hour)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Automatically adjusts and increments the player's mining speed upon confirmation.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setConfirmDepositItem(null)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConfirmingDeposit || !depositTxHash}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50"
            >
              {isConfirmingDeposit ? 'Processing...' : 'Confirm & Credit TomCoins'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Decline Deposit Modal */}
      <Modal
        isOpen={Boolean(declineDepositItem)}
        onClose={() => setDeclineDepositItem(null)}
        title="Decline Deposit Request"
        subtitle={`Player: @${declineDepositItem?.username || declineDepositItem?.telegramId} • $${declineDepositItem?.amountUsdt.toFixed(2)} USDT (${declineDepositItem?.network})`}
        maxWidth="md"
      >
        <form onSubmit={handleDeclineDepositSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 text-rose-300">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Are you sure you want to decline this deposit?</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Declining this deposit will mark its status as <strong className="text-rose-400 font-mono">REJECTED</strong>. No TomCoins or mining boosts will be credited to the player.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Decline Reason (Optional)
            </label>
            <input
              type="text"
              value={declineDepositReason}
              onChange={(e) => setDeclineDepositReason(e.target.value)}
              placeholder="e.g. Invalid transaction hash, payment not received on-chain..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setDeclineDepositItem(null)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDecliningDeposit}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>{isDecliningDeposit ? 'Declining...' : 'Decline Deposit'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Manual Deposit / Credit Balance Modal */}
      <Modal
        isOpen={showManualDepositModal}
        onClose={() => setShowManualDepositModal(false)}
        title="Credit Player Deposit Balance"
        subtitle="Credits USDT/TomCoins directly to player account with mandatory audit record"
        maxWidth="md"
      >
        <form onSubmit={handleManualDepositSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Player Telegram ID or Username
            </label>
            <input
              type="text"
              required
              value={manualDepositUser}
              onChange={(e) => setManualDepositUser(e.target.value)}
              placeholder="e.g. @kingtom or 987654321"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">
                Deposit Amount (USDT)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={manualDepositAmount}
                onChange={(e) => setManualDepositAmount(e.target.value)}
                placeholder="e.g. 5.00"
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
              />
              {parseFloat(manualDepositAmount) > 0 && (
                <p className="text-[10px] text-amber-400 mt-1 font-mono">
                  ≈ +{(parseFloat(manualDepositAmount) * 2000).toLocaleString()} TomCoins credited
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">
                Blockchain Network
              </label>
              <select
                value={manualDepositNetwork}
                onChange={(e) => setManualDepositNetwork(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
              >
                <option value="TRC20">TRON (TRC20)</option>
                <option value="TON">The Open Network (TON)</option>
                <option value="BEP20">Binance Smart Chain (BEP20)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Mining Speed Boost to Activate
            </label>
            <select
              value={manualDepositBoost}
              onChange={(e) => setManualDepositBoost(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
            >
              <option value="0">None (Balance Only)</option>
              <option value="10">Common Plan (+10 TomCoins / hour)</option>
              <option value="50">Silver Plan (+50 TomCoins / hour)</option>
              <option value="200">Gold Plan (+200 TomCoins / hour)</option>
              <option value="1000">Diamond Plan (+1,000 TomCoins / hour)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Adds bonus mining speed directly to the player's mining settlement.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              On-Chain Transaction Hash (Optional)
            </label>
            <input
              type="text"
              value={manualDepositTxHash}
              onChange={(e) => setManualDepositTxHash(e.target.value)}
              placeholder="Paste blockchain TXID if payment verified on-chain..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Audit Notes / Reason (Required)
            </label>
            <textarea
              required
              rows={2}
              value={manualDepositNotes}
              onChange={(e) => setManualDepositNotes(e.target.value)}
              placeholder="e.g. Confirmed on-chain USDT deposit received in treasury wallet"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowManualDepositModal(false)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingDeposit || !manualDepositUser || !manualDepositAmount}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
            >
              {isSubmittingDeposit ? 'Crediting...' : 'Confirm Deposit Credit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Trust Wallet Treasury Configuration Modal */}
      <Modal
        isOpen={showTrustWalletModal}
        onClose={() => setShowTrustWalletModal(false)}
        title="Connect Trust Wallet Treasury"
        subtitle="Configure the official receiving addresses where all player deposits are sent"
        maxWidth="md"
      >
        <form onSubmit={handleSaveTrustWallet} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-slate-300 space-y-1">
            <p className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Direct Trust Wallet Receiving Addresses
            </p>
            <p className="text-[11px] text-slate-400">
              When players deposit on the bot, they are given these exact receiving addresses. In Trust Wallet, all EVM chains (BNB Smart Chain, Base, Ethereum) share the same address.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              EVM Trust Wallet Address (BNB Smart Chain / Base / ETH)
            </label>
            <input
              type="text"
              value={trustWalletEvm}
              onChange={(e) => setTrustWalletEvm(e.target.value)}
              placeholder="0x... (from your Trust Wallet BNB or ETH account)"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
            <p className="text-[10px] text-slate-400 mt-1">Used for USDT (BEP20), BNB, and Base network deposits.</p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              TRON Trust Wallet Address (TRC20 / TRX)
            </label>
            <input
              type="text"
              value={trustWalletTron}
              onChange={(e) => setTrustWalletTron(e.target.value)}
              placeholder="T... (from your Trust Wallet TRON account)"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
            <p className="text-[10px] text-slate-400 mt-1">Used for USDT (TRC20) and TRX deposits.</p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              TON Wallet Address (Optional)
            </label>
            <input
              type="text"
              value={trustWalletTon}
              onChange={(e) => setTrustWalletTon(e.target.value)}
              placeholder="EQ... or UQ..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Solana (SOL) Address (Optional)
            </label>
            <input
              type="text"
              value={trustWalletSol}
              onChange={(e) => setTrustWalletSol(e.target.value)}
              placeholder="Solana Base58 address..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowTrustWalletModal(false)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingTrustWallet}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
            >
              {isSavingTrustWallet ? 'Saving...' : 'Save Receiving Addresses'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

