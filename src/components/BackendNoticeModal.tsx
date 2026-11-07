import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ServerOff, ShieldCheck, X, Sparkles, Clock } from 'lucide-react';

interface BackendNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  featureName?: string;
}

export const BackendNoticeModal: React.FC<BackendNoticeModalProps> = ({
  isOpen,
  onClose,
  title = 'Backend Service Required',
  message = 'This feature is safe and backend-ready. It will be enabled as soon as the SuperTom game server and database are connected.',
  featureName = 'Feature'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm rounded-3xl glass-panel p-6 border-2 border-purple-500/40 shadow-2xl bg-[#140628] relative text-center flex flex-col items-center"
          >
            {/* Close Icon */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-purple-300 hover:text-white bg-purple-950/60 border border-purple-500/30"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-purple-900/50 border border-purple-400/40 flex items-center justify-center text-amber-300 mb-3 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
              <ServerOff className="w-8 h-8 text-amber-400" />
            </div>

            {/* Feature Tag */}
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider mb-1.5">
              {featureName} · Coming Soon
            </span>

            {/* Title */}
            <h3 className="text-lg font-black text-white font-display">
              {title}
            </h3>

            {/* Message */}
            <p className="text-xs text-purple-200/80 mt-2 leading-relaxed">
              {message}
            </p>

            {/* Architectural Trust Note */}
            <div className="w-full mt-4 p-3 rounded-2xl bg-purple-950/60 border border-purple-500/20 text-[11px] text-purple-300/80 flex items-center gap-2 text-left">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Zero mock balances or fake transactions are created. Clean backend-ready architecture.
              </span>
            </div>

            {/* Action Button */}
            <button
              onClick={onClose}
              className="w-full mt-5 py-3 rounded-2xl btn-purple-3d font-extrabold text-xs uppercase tracking-wider cursor-pointer"
            >
              Got It
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
