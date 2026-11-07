import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Sparkles,
  title,
  description,
  badge,
  actionText,
  onAction,
  className = ''
}) => {
  return (
    <div className={`p-6 rounded-3xl glass-panel border border-purple-500/25 flex flex-col items-center text-center ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-purple-950/70 border border-purple-500/30 flex items-center justify-center text-amber-300 mb-3 shadow-lg shadow-purple-950/50">
        <Icon className="w-6 h-6" />
      </div>

      {badge && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-400/30 mb-2">
          {badge}
        </span>
      )}

      <h4 className="text-sm font-extrabold text-white font-display">
        {title}
      </h4>

      <p className="text-xs text-purple-200/70 mt-1 max-w-xs leading-relaxed">
        {description}
      </p>

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 hover:text-white font-bold text-xs transition-colors border border-purple-500/30"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
