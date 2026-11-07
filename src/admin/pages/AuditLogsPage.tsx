import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../services/adminApiClient';
import { AuditLogItem } from '../types/admin';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { ShieldAlert, Search, Eye, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    const res = await adminApi.getAuditLogs({
      page,
      limit: 20,
      action: actionFilter || undefined,
    });
    if (res.success && res.data) {
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }
    setIsLoading(false);
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0C061A] p-4 rounded-2xl border border-purple-900/30">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Search by action (e.g. USER_STATUS, WITHDRAWAL)..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#080412] border border-purple-900/60 text-white text-xs focus:outline-hidden"
          />
        </div>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-900/40 text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-[#120A25] to-[#090414] border border-purple-900/30 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090415] border-b border-purple-900/40 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Admin Operator</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Target ID</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {logs.length > 0 ? (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-purple-950/20 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-white">{l.adminName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{l.adminEmail}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-900/40">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-purple-300">{l.targetEntity}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] max-w-[120px] truncate">
                      {l.targetId || 'Global / Config'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {l.ipAddress || 'Internal'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(l)}
                        title="Inspect Payload"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-900/40"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No audit records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-purple-900/40 flex items-center justify-between text-xs text-slate-400">
          <span>
            Total: <strong className="text-white font-mono">{total}</strong> records (Page {page} of {totalPages || 1})
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

      {/* Inspect Log Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Trail Log Inspection"
        subtitle={`Action: ${selectedLog?.action} • Log ID: ${selectedLog?.id}`}
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">Operator:</span>
                <span className="text-white font-bold">{selectedLog.adminName} ({selectedLog.adminRole})</span>
              </div>
              <div>
                <span className="text-slate-400 block">IP Address:</span>
                <span className="text-white">{selectedLog.ipAddress || 'Internal'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Target Entity:</span>
                <span className="text-purple-300">{selectedLog.targetEntity}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Timestamp:</span>
                <span className="text-slate-300">{new Date(selectedLog.createdAt).toISOString()}</span>
              </div>
            </div>

            {selectedLog.previousValue && (
              <div>
                <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
                  Previous State:
                </span>
                <pre className="p-3 rounded-xl bg-[#080412] border border-purple-900/50 text-rose-300 overflow-x-auto text-[11px]">
                  {selectedLog.previousValue}
                </pre>
              </div>
            )}

            {selectedLog.newValue && (
              <div>
                <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
                  New Mutated State:
                </span>
                <pre className="p-3 rounded-xl bg-[#080412] border border-purple-900/50 text-emerald-300 overflow-x-auto text-[11px]">
                  {selectedLog.newValue}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

