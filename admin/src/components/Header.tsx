import React, { useState } from 'react';
import { ShieldCheck, Server, Key, Check, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { adminApi } from '../services/adminApiClient';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actionButton }) => {
  const { admin } = useAdminAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    const res = await adminApi.changePassword(currentPassword, newPassword);
    setIsLoading(false);

    if (res.success) {
      setSuccess('Password updated successfully! Please use it on your next login.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess(null);
      }, 2500);
    } else {
      setError(res.error || 'Failed to update password. Verify your current password.');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#0B0717]/80 backdrop-blur-md border-b border-purple-900/30 px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-white font-display tracking-tight flex items-center gap-3">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-4">
          {actionButton}

          {/* Change Password Button */}
          <button
            onClick={() => {
              setIsModalOpen(true);
              setError(null);
              setSuccess(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-700/40 text-purple-200 text-xs font-bold transition-all hover:scale-105 cursor-pointer shadow-sm"
            title="Change Admin Password"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Change Password</span>
          </button>

          {/* Live Backend Connection Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Server className="w-3.5 h-3.5" />
            <span>Render Live</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          {/* Admin Role Status */}
          {admin?.role && (
            <div className="flex items-center gap-2 pl-2 border-l border-purple-900/40">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <Badge status={admin.role} />
            </div>
          )}
        </div>
      </header>

      {/* Change Password Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Change Admin Password"
        subtitle={`Logged in as: ${admin?.email}`}
        maxWidth="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              New Password (Min. 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 uppercase mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 rounded-xl bg-[#090415] border border-purple-900/60 text-white focus:outline-hidden focus:border-purple-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-purple-900/30">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-400 font-semibold hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-purple-900/40"
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
