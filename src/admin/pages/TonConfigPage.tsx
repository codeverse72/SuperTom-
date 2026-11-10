import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApiClient';
import { DepositItem } from '../types/admin';

interface TonConfig {
  id: string;
  tonReceivingAddress: string;
  requiredConfirmations: number;
  depositExpiryMinutes: number;
  minDepositTon: number;
  maxDepositTon: number;
  monitoringEnabled: boolean;
  tonConnectManifestUrl: string;
}

export const TonConfigPage: React.FC = () => {
  const [config, setConfig] = useState<TonConfig | null>(null);
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<Partial<TonConfig>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, depositsRes] = await Promise.all([
        adminApi.getTonConfig(),
        adminApi.getTonDeposits({ network: 'TON', limit: 50 }),
      ]);
      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
        setForm(configRes.data);
      }
      if (depositsRes.success && depositsRes.data) {
        setDeposits(depositsRes.data.deposits || []);
      }
    } catch {
      // silently ignore fetch errors
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminApi.updateTonConfig(form);
      if (res.success) {
        setMessage({ type: 'success', text: 'TON configuration saved successfully!' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: (res.error as string) || 'Failed to save' });
      }
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Error saving config' });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading TON Configuration...
      </div>
    );

  // Count deposit statuses
  const tonDeposits = deposits.filter(
    (d) =>
      (d.network || '').toUpperCase() === 'TON' ||
      (d.currency || '').toUpperCase() === 'TON'
  );
  const pendingCount = tonDeposits.filter((d) =>
    ['PENDING', 'WAITING_FOR_PAYMENT', 'PAYMENT_DETECTED', 'CONFIRMING', 'CREATED'].includes(
      (d.status || '').toUpperCase()
    )
  ).length;
  const confirmedCount = tonDeposits.filter((d) =>
    ['CONFIRMED', 'COMPLETED'].includes((d.status || '').toUpperCase())
  ).length;
  const failedCount = tonDeposits.filter((d) =>
    ['FAILED', 'EXPIRED', 'REJECTED'].includes((d.status || '').toUpperCase())
  ).length;
  const totalUsd = tonDeposits.reduce((sum, d) => sum + (Number(d.amountUsdt) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">💎 TON Payment Configuration</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage TON wallet integration, receiving addresses, and deposit monitoring
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold border border-slate-700 cursor-pointer"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total TON Deposits', value: tonDeposits.length, color: 'text-cyan-400' },
          { label: 'Pending', value: pendingCount, color: 'text-yellow-400' },
          { label: 'Confirmed', value: confirmedCount, color: 'text-green-400' },
          { label: 'Failed', value: failedCount, color: 'text-red-400' },
          { label: 'Total USD', value: `$${totalUsd.toFixed(2)}`, color: 'text-purple-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Config Form */}
      {message && (
        <div
          className={`p-3 rounded-xl border text-sm font-bold ${
            message.type === 'success'
              ? 'bg-green-950 border-green-500/50 text-green-300'
              : 'bg-red-950 border-red-500/50 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-black text-white">⚙️ Configuration Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 block">TON Receiving Address</label>
            <input
              type="text"
              value={form.tonReceivingAddress || ''}
              onChange={(e) => setForm((f) => ({ ...f, tonReceivingAddress: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-cyan-500"
              placeholder="UQ..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 block">Required Confirmations</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.requiredConfirmations ?? 1}
              onChange={(e) =>
                setForm((f) => ({ ...f, requiredConfirmations: parseInt(e.target.value) }))
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 block">Deposit Expiry (minutes)</label>
            <input
              type="number"
              min={5}
              value={form.depositExpiryMinutes ?? 1440}
              onChange={(e) =>
                setForm((f) => ({ ...f, depositExpiryMinutes: parseInt(e.target.value) }))
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 block">Min Deposit (TON)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={form.minDepositTon ?? 0.1}
              onChange={(e) =>
                setForm((f) => ({ ...f, minDepositTon: parseFloat(e.target.value) }))
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 block">Max Deposit (TON)</label>
            <input
              type="number"
              min={1}
              value={form.maxDepositTon ?? 10000}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxDepositTon: parseFloat(e.target.value) }))
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 block">TON Connect Manifest URL</label>
            <input
              type="text"
              value={form.tonConnectManifestUrl || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, tonConnectManifestUrl: e.target.value }))
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-300">Monitoring Enabled</label>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, monitoringEnabled: !f.monitoringEnabled }))}
            className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${
              form.monitoringEnabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${
                form.monitoringEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white font-black text-sm cursor-pointer disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving...' : '💾 Save Configuration'}
        </button>
      </div>

      {/* Recent TON Deposits Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-black text-white">📋 Recent TON Deposits</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                {['User', 'Amount USD', 'TON Amount', 'Reference', 'Status', 'TX Hash', 'Date'].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {tonDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No TON deposits found
                  </td>
                </tr>
              ) : (
                tonDeposits.slice(0, 20).map((d) => {
                  const statusRaw = (d.status || '').toUpperCase();
                  const isConfirmed = statusRaw.includes('COMPLET') || statusRaw.includes('CONFIRM');
                  const isFailed = statusRaw.includes('FAIL') || statusRaw.includes('EXPIRED');
                  return (
                    <tr key={d.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-xs text-slate-300">
                        {d.username || d.telegramId || '—'}
                      </td>
                      <td className="py-3 px-4 text-cyan-300 font-bold">
                        ${Number(d.amountUsdt).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-300">
                        {d.expectedCryptoAmount
                          ? `${Number(d.expectedCryptoAmount).toFixed(4)} TON`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-amber-300">
                        {d.paymentReference || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isConfirmed
                              ? 'bg-green-900 text-green-300'
                              : isFailed
                              ? 'bg-red-900 text-red-300'
                              : 'bg-yellow-900 text-yellow-300'
                          }`}
                        >
                          {d.status || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-blue-400">
                        {d.txHash ? `${d.txHash.slice(0, 8)}...` : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
