import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Sparkles, Info, X } from 'lucide-react';
import { useGame } from '../context/GameContext';

export const Toast: React.FC = () => {
  const { activeToast, dismissToast } = useGame();

  return (
    <AnimatePresence>
      {activeToast && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md pointer-events-auto"
        >
          <div className="glass-panel p-3.5 rounded-2xl border border-purple-500/40 shadow-2xl flex items-start gap-3 bg-[#130728]/95 backdrop-blur-xl">
            <div className="shrink-0 mt-0.5">
              {activeToast.type === 'reward' && (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
              )}
              {activeToast.type === 'success' && (
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              {activeToast.type === 'error' && (
                <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              {activeToast.type === 'info' && (
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400">
                  <Info className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-sm font-bold text-white tracking-tight font-display">{activeToast.title}</h4>
              <p className="text-xs text-purple-200/90 mt-0.5 leading-relaxed">{activeToast.message}</p>
            </div>

            <button
              onClick={dismissToast}
              className="shrink-0 text-purple-300/60 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
