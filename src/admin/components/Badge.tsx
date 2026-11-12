import React from 'react';

interface BadgeProps {
  status: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const s = status.toUpperCase();

  let styles = 'bg-slate-800 text-slate-300 border-slate-700';

  if (s === 'ACTIVE' || s === 'COMPLETED' || s === 'CONFIRMED' || s === 'SUPER_ADMIN' || s === 'CONNECTED' || s === 'VERIFIED') {
    styles = 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10';
  } else if (s === 'PENDING' || s === 'WAITING_FOR_PAYMENT' || s === 'CREATED' || s === 'IN_PROGRESS' || s === 'RUNNING' || s === 'ADMIN' || s === 'PENDING_APPROVAL') {
    styles = 'bg-amber-950/70 text-amber-300 border-amber-500/40 shadow-amber-500/10';
  } else if (s === 'APPROVED' || s === 'CONFIRMING' || s === 'PAYMENT_DETECTED' || s === 'CONFIGURED') {
    styles = 'bg-sky-950/70 text-sky-300 border-sky-500/40 shadow-sky-500/10';
  } else if (s === 'PROCESSING' || s === 'PUBLISHED') {
    styles = 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40 shadow-indigo-500/10';
  } else if (s === 'SUSPENDED' || s === 'VERIFY' || s === 'SUPPORT') {
    styles = 'bg-purple-950/70 text-purple-300 border-purple-500/40 shadow-purple-500/10';
  } else if (s === 'BANNED' || s === 'REJECTED' || s === 'CANCELLED' || s === 'EXPIRED' || s === 'FAILED' || s === 'ERROR' || s === 'DISCONNECTED') {
    styles = 'bg-rose-950/70 text-rose-300 border-rose-500/40 shadow-rose-500/10';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border shadow-xs ${styles} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
      {status}
    </span>
  );
};

