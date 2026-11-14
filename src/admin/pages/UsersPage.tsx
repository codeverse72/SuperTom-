import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../services/adminApiClient';
import { UserListItem, UserDetail } from '../types/admin';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  Search,
  Eye,
  ShieldAlert,
  Coins,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  UserCheck,
  Wallet,
  Copy,
  Check,
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [walletFilter, setWalletFilter] = useState<'all' | 'has_wallet' | 'no_wallet'>('all');
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Selected User for Details Modal
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Status Change Modal
  const [statusModalUser, setStatusModalUser] = useState<UserListItem | null>(null);
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'BANNED'>('ACTIVE');
  const [statusReason, setStatusReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Balance Adjustment Modal
  const [balanceModalUser, setBalanceModalUser] = useState<UserListItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    const res = await adminApi.getUsers({
      page,
      limit: 15,
      search: search || undefined,
      status: statusFilter || undefined,
      hasWallet: walletFilter === 'has_wallet' ? 'true' : walletFilter === 'no_wallet' ? 'false' : undefined,
    });
    if (res.success && res.data) {
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setIsLoading(false);
  }, [page, search, statusFilter, walletFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenDetail = async (userId: string) => {
    setIsLoadingDetail(true);
    setSelectedUserDetail(null);
    const res = await adminApi.getUserDetail(userId);
    if (res.success && res.data) {
      setSelectedUserDetail(res.data);
    }
    setIsLoadingDetail(false);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalUser) return;
    setIsSubmittingStatus(true);
    const res = await adminApi.updateUserStatus(statusModalUser.id, newStatus, statusReason);
    setIsSubmittingStatus(false);
    if (res.success) {
      setStatusModalUser(null);
      setStatusReason('');
      fetchUsers();
    } else {
      alert(res.error || 'Failed to update status');
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalUser || adjustAmount === 0 || !adjustReason.trim()) return;
    setAdjustError(null);
    setIsSubmittingAdjust(true);
    const res = await adminApi.adjustUserBalance(balanceModalUser.id, adjustAmount, adjustReason.trim());
    setIsSubmittingAdjust(false);
    if (res.success) {
      setBalanceModalUser(null);
      setAdjustAmount(0);
      setAdjustReason('');
      setAdjustError(null);
      fetchUsers();
    } else {
      setAdjustError(res.error || 'Failed to adjust balance');
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-gradient-to-r from-[#120A25] to-[#0A0517] p-4 rounded-2xl border border-purple-900/30">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Telegram ID, username, referral code, or wallet address..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#090414] border border-purple-900/60 text-white text-xs focus:outline-hidden focus:border-purple-500 placeholder:text-slate-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Wallet Connection Filter */}
          <div className="flex items-center gap-1 bg-[#090414] p-1 rounded-xl border border-purple-900/60">
            <button
              onClick={() => {
                setWalletFilter('all');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                walletFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Wallets
            </button>
            <button
              onClick={() => {
                setWalletFilter('has_wallet');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                walletFilter === 'has_wallet'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <Wallet className="w-3 h-3" />
              <span>Wallet Connected</span>
            </button>
            <button
              onClick={() => {
                setWalletFilter('no_wallet');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                walletFilter === 'no_wallet'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              No Wallet
            </button>
          </div>

          {/* Account Status Filter */}
          {['', 'ACTIVE', 'SUSPENDED', 'BANNED'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'bg-purple-950/40 text-slate-400 hover:text-white border border-purple-900/40'
              }`}
            >
              {st || 'ALL STATUS'}
            </button>
          ))}
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-900/40 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#090414] border border-purple-900/30 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090415] border-b border-purple-900/40 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Telegram ID</th>
                <th className="py-3 px-4">Connected Wallet</th>
                <th className="py-3 px-4">TomCoins Balance</th>
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4">Mining Rate</th>
                <th className="py-3 px-4">Referrals</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-purple-950/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-800 to-amber-500 flex items-center justify-center text-[10px] text-white font-bold">
                        {(u.username || u.firstName || 'T')[0].toUpperCase()}
                      </div>
                      <span className="truncate max-w-[120px]">
                        {u.username ? `@${u.username}` : u.firstName || 'Anonymous'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{u.telegramId}</td>
                    {/* Connected Wallet Column */}
                    <td className="py-3 px-4">
                      {u.primaryWallet ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-900/50 text-blue-300 border border-blue-500/30 shrink-0">
                            {u.wallets?.[0]?.network || 'TON'}
                          </span>
                          <span
                            className="font-mono text-slate-200 text-[11px] truncate max-w-[110px]"
                            title={u.primaryWallet}
                          >
                            {u.primaryWallet.slice(0, 4)}...{u.primaryWallet.slice(-4)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard?.writeText(u.primaryWallet!);
                              setCopiedWalletId(u.id);
                              setTimeout(() => setCopiedWalletId(null), 2000);
                            }}
                            title="Copy wallet address"
                            className="p-1 rounded hover:bg-purple-900/40 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedWalletId === u.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          {(u.walletsCount ?? 1) > 1 && (
                            <span className="text-[9px] font-bold px-1 rounded bg-purple-900/60 text-purple-300 shrink-0">
                              +{u.walletsCount! - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px] font-mono italic">
                          None
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {u.poopsBalance.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-300">
                      Lvl {u.level}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400">
                      +{u.miningRate}/hr
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">{u.refereesCount}</td>
                    <td className="py-3 px-4">
                      <Badge status={u.accountStatus} />
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(u.id)}
                          title="View Full Profile"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-900/40 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                          <button
                            onClick={() => {
                              setStatusModalUser(u);
                              setNewStatus(u.accountStatus);
                            }}
                            title="Modify Status"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-purple-900/40 transition-colors cursor-pointer"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        )}
                        {hasRole(['SUPER_ADMIN']) && (
                          <button
                            onClick={() => {
                              setBalanceModalUser(u);
                              setAdjustAmount(0);
                              setAdjustReason('');
                              setAdjustError(null);
                            }}
                            title="Audited Balance Adjustment"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-purple-900/40 transition-colors cursor-pointer"
                          >
                            <Coins className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-mono text-xs">
                    {isLoading ? 'Loading players...' : 'No users matching search criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-purple-900/40 flex items-center justify-between text-xs text-slate-400">
          <span>
            Total: <strong className="text-white font-mono">{total}</strong> players (Page {page} of {totalPages || 1})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 disabled:opacity-40 hover:bg-purple-900/60 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 disabled:opacity-40 hover:bg-purple-900/60 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      <Modal
        isOpen={Boolean(selectedUserDetail) || isLoadingDetail}
        onClose={() => setSelectedUserDetail(null)}
        title={selectedUserDetail ? `Player Profile: @${selectedUserDetail.username || selectedUserDetail.telegramId}` : 'Loading...'}
        subtitle={selectedUserDetail ? `Internal ID: ${selectedUserDetail.id}` : ''}
        maxWidth="xl"
      >
        {selectedUserDetail && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40">
                <span className="text-slate-400 block mb-1">TomCoins Balance</span>
                <span className="text-base font-bold text-amber-400 font-mono">
                  {selectedUserDetail.poopsBalance.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40">
                <span className="text-slate-400 block mb-1">Mining Rate</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  +{selectedUserDetail.mining.totalRate}/hr
                </span>
              </div>
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40">
                <span className="text-slate-400 block mb-1">Level Title</span>
                <span className="text-sm font-bold text-white truncate block">
                  {selectedUserDetail.levelTitle}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40">
                <span className="text-slate-400 block mb-1">Referral Code</span>
                <span className="text-base font-bold text-purple-300 font-mono">
                  {selectedUserDetail.referralCode}
                </span>
              </div>
            </div>

            {/* Connected Crypto Wallets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                  <span>Connected Crypto Wallets ({selectedUserDetail.wallets?.length ?? 0})</span>
                </h5>
              </div>
              {selectedUserDetail.wallets && selectedUserDetail.wallets.length > 0 ? (
                <div className="space-y-2">
                  {selectedUserDetail.wallets.map((w) => (
                    <div
                      key={w.id}
                      className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-900/40 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-900/60 text-blue-300 border border-blue-500/40 shrink-0">
                          {w.network}
                        </span>
                        <span className="font-mono text-slate-200 text-xs truncate select-all">
                          {w.walletAddress}
                        </span>
                        {w.isDefault && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                          {new Date(w.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(w.walletAddress);
                            setCopiedWalletId(w.id);
                            setTimeout(() => setCopiedWalletId(null), 2000);
                          }}
                          className="px-2 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-slate-300 hover:text-white flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                        >
                          {copiedWalletId === w.id ? (
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
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/30 text-slate-500 italic text-center">
                  No crypto wallet connected by this user yet.
                </div>
              )}
            </div>

            {/* Inventory & Feeding */}
            <div>
              <h5 className="font-bold text-white uppercase tracking-wider mb-2">Biscuit Inventory</h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {selectedUserDetail.inventory.map((inv) => (
                  <div key={inv.biscuitId} className="p-2.5 rounded-xl bg-slate-900/60 border border-purple-900/30">
                    <span className="font-bold text-slate-200 block">{inv.name}</span>
                    <span className="text-slate-400 font-mono">Qty: {inv.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Ledger Entries */}
            <div>
              <h5 className="font-bold text-white uppercase tracking-wider mb-2">Recent Balance Operations</h5>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {selectedUserDetail.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2 rounded-lg bg-purple-950/20 border border-purple-900/30 flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <span className="font-bold text-slate-200">{tx.type}</span>
                      <p className="text-slate-400">{tx.description}</p>
                    </div>
                    <span
                      className={`font-mono font-bold ${
                        tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modify Status Modal */}
      <Modal
        isOpen={Boolean(statusModalUser)}
        onClose={() => setStatusModalUser(null)}
        title="Account Status Control"
        subtitle={`Target: @${statusModalUser?.username || statusModalUser?.telegramId}`}
        maxWidth="md"
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
              Select Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white text-xs focus:outline-hidden"
            >
              <option value="ACTIVE">ACTIVE (Normal play)</option>
              <option value="SUSPENDED">SUSPENDED (Temporarily blocked)</option>
              <option value="BANNED">BANNED (Permanently restricted)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
              Audit Reason
            </label>
            <textarea
              required
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Provide reason for audit logging..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white text-xs focus:outline-hidden placeholder:text-slate-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStatusModalUser(null)}
              className="px-4 py-2 rounded-xl text-slate-400 text-xs font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingStatus}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSubmittingStatus ? 'Saving...' : 'Apply Status'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Balance Adjustment Modal (SUPER ADMIN ONLY) */}
      <Modal
        isOpen={Boolean(balanceModalUser)}
        onClose={() => setBalanceModalUser(null)}
        title="Audited Balance Adjustment"
        subtitle={`Target: @${balanceModalUser?.username || balanceModalUser?.telegramId}`}
        maxWidth="md"
      >
        <form onSubmit={handleAdjustBalance} className="space-y-4 text-xs">
          {adjustError && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs">
              {adjustError}
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300">
            Current balance:{' '}
            <strong className="font-mono">{balanceModalUser?.poopsBalance.toLocaleString()} Poops</strong>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1.5">
              Adjustment Amount (Poops)
            </label>
            <input
              type="number"
              required
              value={adjustAmount || ''}
              onChange={(e) => setAdjustAmount(parseInt(e.target.value, 10) || 0)}
              placeholder="e.g. 500 for credit, -200 for debit"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-500 block mt-1">
              Use positive numbers to add Poops, negative to deduct.
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1.5">
              Audit Reason
            </label>
            <textarea
              required
              rows={3}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Detailed justification for ledger record..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden placeholder:text-slate-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setBalanceModalUser(null)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAdjust || adjustAmount === 0 || !adjustReason}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all disabled:opacity-50"
            >
              {isSubmittingAdjust ? 'Processing...' : 'Execute Ledger Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

