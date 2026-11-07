import React, { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApiClient';
import { MissionItem } from '../types/admin';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Trophy, Plus, Edit3, Trash2, RefreshCw } from 'lucide-react';

export const MissionsPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create / Edit modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardPoops, setRewardPoops] = useState(500);
  const [category, setCategory] = useState<'DAILY' | 'SOCIAL' | 'REFERRAL' | 'SPECIAL'>('SOCIAL');
  const [verificationType, setVerificationType] = useState<'TELEGRAM_CHANNEL' | 'TELEGRAM_GROUP' | 'EXTERNAL_LINK' | 'GAME_ACTION'>('TELEGRAM_CHANNEL');
  const [icon, setIcon] = useState('Send');
  const [badge, setBadge] = useState('Telegram');
  const [actionUrl, setActionUrl] = useState('');
  const [channelId, setChannelId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchMissions = async () => {
    setIsLoading(true);
    const res = await adminApi.getMissions();
    if (res.success && res.data) {
      setMissions(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  const handleOpenCreate = () => {
    setModalMode('create');
    setTargetId(`m_${Date.now()}`);
    setTitle('');
    setDescription('');
    setRewardPoops(500);
    setCategory('SOCIAL');
    setVerificationType('TELEGRAM_CHANNEL');
    setIcon('Send');
    setBadge('Telegram');
    setActionUrl('');
    setChannelId('');
  };

  const handleOpenEdit = (m: MissionItem) => {
    setModalMode('edit');
    setTargetId(m.id);
    setTitle(m.title);
    setDescription(m.description);
    setRewardPoops(m.rewardPoops);
    setCategory(m.category);
    setVerificationType(m.verificationType);
    setIcon(m.icon);
    setBadge(m.badge || '');
    setActionUrl(m.actionUrl || '');
    setChannelId(m.channelId || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (modalMode === 'create') {
      const res = await adminApi.createMission({
        id: targetId,
        title,
        description,
        rewardPoops,
        category,
        verificationType,
        icon,
        badge: badge || undefined,
        actionUrl: actionUrl || undefined,
        channelId: channelId || undefined,
      });
      setIsSaving(false);
      if (res.success) {
        setModalMode(null);
        fetchMissions();
      } else {
        alert(res.error || 'Failed to create quest');
      }
    } else if (modalMode === 'edit') {
      const res = await adminApi.updateMission(targetId, {
        title,
        description,
        rewardPoops,
        category,
        verificationType,
        icon,
        badge: badge || undefined,
        actionUrl: actionUrl || undefined,
        channelId: channelId || undefined,
      });
      setIsSaving(false);
      if (res.success) {
        setModalMode(null);
        fetchMissions();
      } else {
        alert(res.error || 'Failed to update quest');
      }
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this quest?')) return;
    const res = await adminApi.deactivateMission(id);
    if (res.success) {
      fetchMissions();
    } else {
      alert(res.error || 'Failed to deactivate quest');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white font-display">Quest & Mission Management</h3>
          <p className="text-xs text-slate-400">Create, edit, and deactivate rewards across the app.</p>
        </div>
        <div className="flex items-center gap-2">
          {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Quest</span>
            </button>
          )}
          <button
            onClick={fetchMissions}
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
                <th className="py-3 px-4">Quest Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Reward</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Target Channel / URL</th>
                <th className="py-3 px-4">Participants</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {missions.length > 0 ? (
                missions.map((m) => (
                  <tr key={m.id} className="hover:bg-purple-950/20 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-white">{m.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{m.description}</p>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-purple-300">
                      {m.category}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      +{m.rewardPoops.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {m.verificationType}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] max-w-[150px] truncate">
                      {m.channelId || m.actionUrl || 'In-Game Action'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {m.totalParticipants} players
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={m.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-900/40"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {m.isActive && (
                            <button
                              onClick={() => handleDeactivate(m.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-purple-900/40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No missions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={Boolean(modalMode)}
        onClose={() => setModalMode(null)}
        title={modalMode === 'create' ? 'Create New Quest' : 'Edit Quest'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {modalMode === 'create' && (
            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">Quest ID</label>
              <input
                type="text"
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="e.g. m_special_event"
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">Quest Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Join Official Telegram Channel"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">Description</label>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions shown to players..."
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">Reward (Poops)</label>
              <input
                type="number"
                min={1}
                required
                value={rewardPoops}
                onChange={(e) => setRewardPoops(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
              >
                <option value="SOCIAL">SOCIAL</option>
                <option value="DAILY">DAILY</option>
                <option value="REFERRAL">REFERRAL</option>
                <option value="SPECIAL">SPECIAL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">Verification</label>
              <select
                value={verificationType}
                onChange={(e) => setVerificationType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
              >
                <option value="TELEGRAM_CHANNEL">TELEGRAM_CHANNEL (Bot API Check)</option>
                <option value="TELEGRAM_GROUP">TELEGRAM_GROUP (Bot API Check)</option>
                <option value="EXTERNAL_LINK">EXTERNAL_LINK (Click / Callback)</option>
                <option value="GAME_ACTION">GAME_ACTION (Progression trigger)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-300 uppercase mb-1">Badge Tag</label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="e.g. Telegram / Community / Special"
                className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Telegram Channel / Group Handle
            </label>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="@SuperTomCommunity"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">Action URL (Optional)</label>
            <input
              type="url"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="https://t.me/SuperTomCommunity"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white font-mono focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-purple-900/30">
            <button
              type="button"
              onClick={() => setModalMode(null)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Quest'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

