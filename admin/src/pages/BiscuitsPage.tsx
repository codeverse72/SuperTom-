import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApiClient';
import { BiscuitItem } from '../types/admin';
import { Modal } from '../components/Modal';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Cookie, Edit3, Check, RefreshCw } from 'lucide-react';

export const BiscuitsPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [biscuits, setBiscuits] = useState<BiscuitItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBiscuit, setEditingBiscuit] = useState<BiscuitItem | null>(null);
  const [costPoops, setCostPoops] = useState<number>(0);
  const [boostPerHour, setBoostPerHour] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBiscuits = async () => {
    setIsLoading(true);
    const res = await adminApi.getBiscuits();
    if (res.success && res.data) {
      setBiscuits(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBiscuits();
  }, []);

  const handleOpenEdit = (b: BiscuitItem) => {
    setEditingBiscuit(b);
    setCostPoops(b.costPoops);
    setBoostPerHour(b.productionBoostPerHour);
    setIsActive(b.isActive);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBiscuit) return;

    setIsSaving(true);
    const res = await adminApi.updateBiscuit(editingBiscuit.id, {
      costPoops,
      productionBoostPerHour: boostPerHour,
      isActive,
    });
    setIsSaving(false);

    if (res.success) {
      setEditingBiscuit(null);
      fetchBiscuits();
    } else {
      alert(res.error || 'Failed to update biscuit');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white font-display">Biscuit Catalog & Store Pricing</h3>
          <p className="text-xs text-slate-400">Configure prices, feeding boosts, and store visibility.</p>
        </div>
        <button
          onClick={fetchBiscuits}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Catalog</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {biscuits.map((b) => (
          <div
            key={b.id}
            className="rounded-2xl bg-gradient-to-b from-[#140C2A] to-[#0A0617] border border-purple-900/40 p-5 shadow-xl flex flex-col justify-between relative overflow-hidden"
          >
            {/* Top Color Accent Bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: b.color }}
            />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: `${b.color}20`,
                    color: b.color,
                    borderColor: `${b.color}50`,
                  }}
                >
                  {b.badge}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    b.isActive ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                  }`}
                >
                  {b.isActive ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>

              <h4 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <Cookie className="w-4 h-4 text-amber-400" />
                <span>{b.name}</span>
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{b.description}</p>

              <div className="space-y-2 p-3 rounded-xl bg-[#090414] border border-purple-900/30 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Store Cost:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {b.costPoops.toLocaleString()} Poops
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Production Boost:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{b.productionBoostPerHour} Poops/hr
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-purple-900/20 text-[11px]">
                  <span className="text-slate-500">Fed Count:</span>
                  <span className="font-mono text-slate-300">{b.totalFedCount} times</span>
                </div>
              </div>
            </div>

            {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
              <button
                onClick={() => handleOpenEdit(b)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-white text-xs font-bold transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Product</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Edit Biscuit Modal */}
      <Modal
        isOpen={Boolean(editingBiscuit)}
        onClose={() => setEditingBiscuit(null)}
        title={`Edit ${editingBiscuit?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Store Price (Poops)
            </label>
            <input
              type="number"
              min={1}
              required
              value={costPoops}
              onChange={(e) => setCostPoops(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Production Boost (+Poops/hour)
            </label>
            <input
              type="number"
              min={1}
              required
              value={boostPerHour}
              onChange={(e) => setBoostPerHour(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded-md accent-purple-600 bg-[#090415] border-purple-900"
            />
            <label htmlFor="isActiveCheck" className="font-bold text-slate-300 cursor-pointer">
              Product is available for purchase in game store
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-purple-900/30">
            <button
              type="button"
              onClick={() => setEditingBiscuit(null)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Update Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

