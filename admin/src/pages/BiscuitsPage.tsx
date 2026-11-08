import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApiClient';
import { BiscuitItem } from '../types/admin';
import { Modal } from '../components/Modal';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Cookie, Edit3, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react';

const PRESET_COLORS = [
  { name: 'Ruby Red', color: '#EF4444' },
  { name: 'Emerald Green', color: '#10B981' },
  { name: 'Royal Purple', color: '#A855F7' },
  { name: 'Cosmic Pink', color: '#EC4899' },
  { name: 'Sunfire Amber', color: '#F97316' },
  { name: 'Sapphire Cyan', color: '#06B6D4' },
];

export const BiscuitsPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [biscuits, setBiscuits] = useState<BiscuitItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Edit State
  const [editingBiscuit, setEditingBiscuit] = useState<BiscuitItem | null>(null);
  const [costPoops, setCostPoops] = useState<number>(0);
  const [boostPerHour, setBoostPerHour] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Launch New Biscuit State
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newCostPoops, setNewCostPoops] = useState<number>(2500);
  const [newBoostPerHour, setNewBoostPerHour] = useState<number>(1500);
  const [newBadge, setNewBadge] = useState('Mythic');
  const [newColor, setNewColor] = useState('#EC4899');
  const [newDescription, setNewDescription] = useState('Gourmet cosmic feline delicacy granting massive continuous boost.');
  const [newIsActive, setNewIsActive] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

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
    setDescription(b.description || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBiscuit) return;

    setIsSaving(true);
    const res = await adminApi.updateBiscuit(editingBiscuit.id, {
      costPoops,
      productionBoostPerHour: boostPerHour,
      isActive,
      description,
    });
    setIsSaving(false);

    if (res.success) {
      setEditingBiscuit(null);
      fetchBiscuits();
    } else {
      alert(res.error || 'Failed to update biscuit');
    }
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaunchError(null);

    const slug = newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!slug) {
      setLaunchError('Biscuit ID is required.');
      return;
    }

    if (!newName.trim()) {
      setLaunchError('Biscuit Name is required.');
      return;
    }

    setIsLaunching(true);
    const res = await adminApi.createBiscuit({
      id: slug,
      name: newName.trim(),
      costPoops: newCostPoops,
      productionBoostPerHour: newBoostPerHour,
      badge: newBadge.trim() || 'Special',
      color: newColor,
      borderColor: `${newColor}80`,
      glowColor: `${newColor}40`,
      description: newDescription.trim(),
      isActive: newIsActive,
    });
    setIsLaunching(false);

    if (res.success) {
      setIsLaunchModalOpen(false);
      // Reset form
      setNewId('');
      setNewName('');
      setNewCostPoops(2500);
      setNewBoostPerHour(1500);
      setNewBadge('Mythic');
      setNewColor('#EC4899');
      setNewDescription('Gourmet cosmic feline delicacy granting massive continuous boost.');
      fetchBiscuits();
    } else {
      setLaunchError(res.error || 'Failed to launch new biscuit.');
    }
  };

  const handleDelete = async (b: BiscuitItem) => {
    const isDefault = ['common', 'silver', 'gold', 'diamond'].includes(b.id);
    const confirmMsg = isDefault
      ? `Disable ${b.name}? It will be hidden from the game store.`
      : `Are you sure you want to delete or deactivate "${b.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    const res = await adminApi.deleteBiscuit(b.id);
    if (res.success) {
      fetchBiscuits();
    } else {
      alert(res.error || 'Failed to remove biscuit');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <Cookie className="w-5 h-5 text-amber-400" />
            <span>Biscuit Catalog & Store Pricing</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage live biscuits, launch custom feline snacks, and tune mining speed multipliers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
            <button
              onClick={() => {
                setLaunchError(null);
                setIsLaunchModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white text-xs font-black shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Launch New Biscuit</span>
            </button>
          )}

          <button
            onClick={fetchBiscuits}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Biscuits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {biscuits.map((b) => (
          <div
            key={b.id}
            className="rounded-2xl bg-gradient-to-b from-[#140C2A] to-[#0A0617] border border-purple-900/40 p-5 shadow-xl flex flex-col justify-between relative overflow-hidden"
          >
            {/* Top Color Accent Bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: b.color || '#A855F7' }}
            />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: `${b.color || '#A855F7'}20`,
                    color: b.color || '#A855F7',
                    borderColor: `${b.color || '#A855F7'}50`,
                  }}
                >
                  {b.badge || 'Treat'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    b.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {b.isActive ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>

              <h4 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full inline-block shadow-sm"
                  style={{ backgroundColor: b.color || '#A855F7' }}
                />
                <span>{b.name}</span>
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4 min-h-[32px]">{b.description}</p>

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
                    +{b.productionBoostPerHour.toLocaleString()} Poops/hr
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-purple-900/20 text-[11px]">
                  <span className="text-slate-500">Fed Count:</span>
                  <span className="font-mono text-slate-300">{b.totalFedCount || 0} times</span>
                </div>
              </div>
            </div>

            {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
              <div className="mt-4 flex items-center gap-2 pt-2 border-t border-purple-950/40">
                <button
                  onClick={() => handleOpenEdit(b)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-300" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(b)}
                  title="Deactivate or Remove"
                  className="p-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 text-rose-400 text-xs transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Launch New Biscuit Modal */}
      <Modal
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
        title="Launch New Royal Biscuit"
        maxWidth="lg"
      >
        <form onSubmit={handleLaunch} className="space-y-4 text-xs">
          {launchError && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs">
              {launchError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">
                Biscuit ID / Slug (lowercase)
              </label>
              <input
                type="text"
                required
                pattern="^[a-z0-9_-]+$"
                placeholder="e.g. ruby_treat"
                value={newId}
                onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:border-purple-400 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500">Unique identifier for database and API</span>
            </div>

            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ruby Crown Biscuit"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:border-purple-400 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500">Name shown to players in Mini App</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">
                Store Cost (Poops)
              </label>
              <input
                type="number"
                min={1}
                required
                value={newCostPoops}
                onChange={(e) => setNewCostPoops(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:border-purple-400 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">
                Hourly Boost (+Poops/hr)
              </label>
              <input
                type="number"
                min={1}
                required
                value={newBoostPerHour}
                onChange={(e) => setNewBoostPerHour(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:border-purple-400 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">
                Badge / Tier Label
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mythic, Rare"
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:border-purple-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1.5">
              Theme Color & Visual Identity
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {PRESET_COLORS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setNewColor(p.color)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                    newColor === p.color
                      ? 'border-white bg-white/20 text-white scale-105'
                      : 'border-purple-900/40 bg-purple-950/40 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-28 px-2.5 py-1.5 rounded-lg bg-[#090415] border border-purple-900/60 text-white font-mono text-xs focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400">Custom Hex Code</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Description / Flavor Text
            </label>
            <textarea
              rows={2}
              required
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:border-purple-400 focus:outline-hidden"
            />
          </div>

          {/* Live Preview Box */}
          <div className="p-3 rounded-2xl bg-[#0d071c] border border-purple-800/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md font-black text-sm"
                style={{ backgroundColor: newColor }}
              >
                🍪
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm">{newName || 'Preview Biscuit'}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: `${newColor}30`, color: newColor }}
                  >
                    {newBadge || 'Special'}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">
                  +{newBoostPerHour.toLocaleString()} Poops/hr
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono font-black text-amber-400 text-sm">
                {newCostPoops.toLocaleString()} 💩
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="newIsActiveCheck"
              checked={newIsActive}
              onChange={(e) => setNewIsActive(e.target.checked)}
              className="w-4 h-4 rounded-md accent-purple-600 bg-[#090415] border-purple-900 cursor-pointer"
            />
            <label htmlFor="newIsActiveCheck" className="font-bold text-slate-300 cursor-pointer">
              Launch directly as active & purchasable in the Game Store
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-purple-900/30">
            <button
              type="button"
              onClick={() => setIsLaunchModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLaunching}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-lg"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isLaunching ? 'Publishing...' : 'Launch Biscuit'}</span>
            </button>
          </div>
        </form>
      </Modal>

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

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded-md accent-purple-600 bg-[#090415] border-purple-900 cursor-pointer"
            />
            <label htmlFor="isActiveCheck" className="font-bold text-slate-300 cursor-pointer">
              Product is available for purchase in game store
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-purple-900/30">
            <button
              type="button"
              onClick={() => setEditingBiscuit(null)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Update Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
