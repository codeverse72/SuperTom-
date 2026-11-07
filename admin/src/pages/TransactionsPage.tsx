import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../services/adminApiClient';
import { TransactionItem } from '../types/admin';
import { Badge } from '../components/Badge';
import { FileText, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    const res = await adminApi.getTransactions({
      page,
      limit: 20,
      type: typeFilter || undefined,
      search: search || undefined,
    });
    if (res.success && res.data) {
      setTransactions(res.data.transactions);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setIsLoading(false);
  }, [page, typeFilter, search]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const ledgerTypes = [
    '',
    'MINING_SETTLEMENT',
    'MISSION_REWARD',
    'SPIN_REWARD',
    'REFERRAL_BONUS',
    'BISCUIT_PURCHASE',
    'WITHDRAWAL_RESERVATION',
    'WITHDRAWAL_REFUND',
    'ADMIN_ADJUSTMENT',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0C061A] p-4 rounded-2xl border border-purple-900/30">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search description, player username, or TG ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#080412] border border-purple-900/60 text-white text-xs focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#080412] border border-purple-900/60 text-white text-xs font-mono focus:outline-hidden"
          >
            {ledgerTypes.map((t) => (
              <option key={t} value={t}>
                {t ? t.replace(/_/g, ' ') : 'ALL TRANSACTION TYPES'}
              </option>
            ))}
          </select>
          <button
            onClick={fetchTransactions}
            disabled={isLoading}
            className="p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-900/40 text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#090414] border border-purple-900/30 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090415] border-b border-purple-900/40 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Ledger Type</th>
                <th className="py-3 px-4">Debit / Credit</th>
                <th className="py-3 px-4">Balance Before</th>
                <th className="py-3 px-4">Balance After</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-purple-950/20 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-white">@{tx.username || tx.telegramId}</p>
                      <p className="text-[10px] text-slate-500 font-mono">TG: {tx.telegramId}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] uppercase font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-900/50">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sm">
                      <span className={tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {tx.amount >= 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {tx.balanceBefore.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {tx.balanceAfter.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No ledger entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-purple-900/40 flex items-center justify-between text-xs text-slate-400">
          <span>
            Total: <strong className="text-white font-mono">{total}</strong> operations (Page {page} of {totalPages || 1})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-900/40 text-slate-300 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

