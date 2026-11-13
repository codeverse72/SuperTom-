import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Megaphone,
  Send,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  StopCircle,
  ExternalLink,
  MessageSquare,
  BellRing,
  FlaskConical,
  History,
} from 'lucide-react';
import { adminApi } from '../services/adminApiClient';
import { Badge } from '../components/Badge';

type AudienceSegment = 'all_active' | 'inactive_24h' | 'inactive_72h' | 'inactive_7d' | 'low_balance';

interface BroadcastTemplate {
  id: string;
  name: string;
  category: 'wake-up' | 'engagement' | 'quests' | 'growth' | 'announcement';
  badge: string;
  defaultAudience: AudienceSegment;
  ctaText: string;
  includeSecondaryButtons: boolean;
  message: string;
}

interface BroadcastJob {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  audience: AudienceSegment;
  templateId?: string | null;
  totalTargets: number;
  processed: number;
  sentCount: number;
  failedCount: number;
  blockedCount: number;
  startedAt: string;
  finishedAt?: string;
  lastError?: string;
}

const AUDIENCE_META: Array<{
  id: AudienceSegment;
  label: string;
  description: string;
  accent: string;
}> = [
  {
    id: 'inactive_24h',
    label: 'Inactive 24h+',
    description: 'Dormant over 24 hours (Best for daily wake-up)',
    accent: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
  },
  {
    id: 'inactive_72h',
    label: 'Dormant 3+ Days',
    description: 'No activity in 72+ hours',
    accent: 'border-orange-500/40 bg-orange-950/20 text-orange-300',
  },
  {
    id: 'inactive_7d',
    label: 'Sleepers 7+ Days',
    description: 'Long-inactive users needing win-back',
    accent: 'border-rose-500/40 bg-rose-950/20 text-rose-300',
  },
  {
    id: 'low_balance',
    label: 'Starters (< 1k 💩)',
    description: 'Active users under 1,000 TomCoins balance',
    accent: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300',
  },
  {
    id: 'all_active',
    label: 'All Active Players',
    description: 'Every non-banned Telegram user',
    accent: 'border-purple-500/40 bg-purple-950/20 text-purple-300',
  },
];

function formatSamplePreview(raw: string): string {
  return raw
    .replace(/\{firstName\}/g, 'Alex')
    .replace(/\{username\}/g, '@alex_miner')
    .replace(/\{balance\}/g, '2,450')
    .replace(/\{referralCode\}/g, 'TOMVIP7')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

export const BroadcastPage: React.FC = () => {
  const [botConfigured, setBotConfigured] = useState(true);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [audienceCounts, setAudienceCounts] = useState<Record<AudienceSegment, number>>({
    all_active: 0,
    inactive_24h: 0,
    inactive_72h: 0,
    inactive_7d: 0,
    low_balance: 0,
  });
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Composer state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [audience, setAudience] = useState<AudienceSegment>('inactive_24h');
  const [message, setMessage] = useState('');
  const [includeMiniAppButton, setIncludeMiniAppButton] = useState(true);
  const [ctaText, setCtaText] = useState('🚀 Wake Up & Mine');
  const [includeSecondaryButtons, setIncludeSecondaryButtons] = useState(false);

  // Test & Send states
  const [testTarget, setTestTarget] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeJob, setActiveJob] = useState<BroadcastJob | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const initializedRef = useRef(false);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getBroadcastOverview();
      if (res.success && res.data) {
        setBotConfigured(res.data.botConfigured);
        setTemplates(res.data.templates);
        setAudienceCounts(res.data.audienceCounts);
        setHistory(res.data.history || []);
        if (res.data.activeJob) {
          setActiveJob(res.data.activeJob);
        }
        if (!initializedRef.current && res.data.templates.length > 0) {
          const first = res.data.templates[0];
          setSelectedTemplateId(first.id);
          setAudience(first.defaultAudience);
          setMessage(first.message);
          setCtaText(first.ctaText);
          setIncludeSecondaryButtons(first.includeSecondaryButtons);
          initializedRef.current = true;
        }
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to load broadcast settings' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error loading broadcast overview' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Poll active broadcast job while RUNNING
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'RUNNING') return;

    const timer = window.setInterval(async () => {
      const res = await adminApi.getBroadcastJobStatus(activeJob.id);
      if (res.success && res.data?.job) {
        setActiveJob(res.data.job);
        if (res.data.job.status !== 'RUNNING') {
          loadOverview();
        }
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [activeJob, loadOverview]);

  const applyTemplate = (tpl: BroadcastTemplate) => {
    setSelectedTemplateId(tpl.id);
    setAudience(tpl.defaultAudience);
    setMessage(tpl.message);
    setCtaText(tpl.ctaText);
    setIncludeMiniAppButton(true);
    setIncludeSecondaryButtons(tpl.includeSecondaryButtons);
    setFeedback(null);
    setConfirmOpen(false);
  };

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setMessage((prev) => prev + snippet);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + snippet + message.slice(end);
    setMessage(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const handleTestSend = async () => {
    if (!testTarget.trim()) {
      setFeedback({ type: 'error', text: 'Enter your Telegram user ID or @username first.' });
      return;
    }
    if (!message.trim()) {
      setFeedback({ type: 'error', text: 'Broadcast message cannot be empty.' });
      return;
    }

    setIsTesting(true);
    setFeedback(null);
    try {
      const res = await adminApi.sendBroadcastTest({
        targetIdentifier: testTarget.trim(),
        message,
        includeMiniAppButton,
        ctaText,
        includeSecondaryButtons,
      });
      if (res.success && res.data) {
        setFeedback({ type: 'success', text: res.data.message });
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to deliver test message' });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleLaunchBroadcast = async () => {
    setIsSending(true);
    setFeedback(null);
    try {
      const res = await adminApi.sendBroadcast({
        audience,
        message,
        templateId: selectedTemplateId,
        includeMiniAppButton,
        ctaText,
        includeSecondaryButtons,
      });
      if (res.success && res.data?.job) {
        setActiveJob(res.data.job);
        setConfirmOpen(false);
        setFeedback({
          type: 'success',
          text: `Broadcast started for ${res.data.job.totalTargets.toLocaleString()} players.`,
        });
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to launch broadcast' });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;
    const res = await adminApi.cancelBroadcastJob(activeJob.id);
    if (res.success && res.data?.job) {
      setActiveJob(res.data.job);
    }
  };

  const selectedCount = audienceCounts[audience] ?? 0;

  return (
    <div className="space-y-6 pb-10">
      {/* Top Warning Banner if Bot Token missing */}
      {!botConfigured && (
        <div className="rounded-2xl bg-rose-950/50 border border-rose-500/40 p-4 flex items-start gap-3 text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Telegram Bot Token Missing</p>
            <p className="text-xs text-rose-300/80 mt-0.5">
              <code>TELEGRAM_BOT_TOKEN</code> is not configured on the backend server. Configure it on Render before sending broadcasts.
            </p>
          </div>
        </div>
      )}

      {/* Status Toast Banner */}
      {feedback && (
        <div
          className={`rounded-2xl p-4 border flex items-center justify-between gap-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active / Most Recent Job Progress Panel */}
      {activeJob && (
        <div className="rounded-2xl bg-[#0F0820] border border-purple-500/35 p-5 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BellRing className={`w-5 h-5 ${activeJob.status === 'RUNNING' ? 'text-amber-400 animate-bounce' : 'text-emerald-400'}`} />
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Broadcast Job <span className="font-mono text-purple-300">{activeJob.id}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Target: <span className="text-amber-300 font-semibold">{activeJob.audience}</span> · Processed{' '}
                  {activeJob.processed.toLocaleString()} / {activeJob.totalTargets.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge status={activeJob.status} />
              {activeJob.status === 'RUNNING' && (
                <button
                  onClick={handleCancelJob}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          </div>

          <div className="w-full h-2.5 rounded-full bg-purple-950 border border-purple-800/50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 transition-all duration-300"
              style={{
                width: `${activeJob.totalTargets > 0 ? Math.min(100, Math.round((activeJob.processed / activeJob.totalTargets) * 100)) : 0}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
              <span className="text-slate-400 block">Delivered</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                {activeJob.sentCount.toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/20">
              <span className="text-slate-400 block">Blocked Bot</span>
              <span className="text-base font-black text-amber-300 font-mono">
                {activeJob.blockedCount.toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/20">
              <span className="text-slate-400 block">Total Failed</span>
              <span className="text-base font-black text-rose-400 font-mono">
                {activeJob.failedCount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Target Audience Segment Selector */}
      <div className="rounded-2xl bg-[#0F0820] border border-purple-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-extrabold text-white">1. Select Target Audience</h2>
          </div>
          <button
            onClick={loadOverview}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/70 border border-purple-700/40 text-xs font-bold text-purple-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Counts</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {AUDIENCE_META.map((seg) => {
            const isSelected = audience === seg.id;
            const count = audienceCounts[seg.id] ?? 0;
            return (
              <button
                key={seg.id}
                onClick={() => {
                  setAudience(seg.id);
                  setConfirmOpen(false);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-br from-purple-900/70 to-amber-950/40 border-amber-400 shadow-lg shadow-amber-500/10 scale-[1.01]'
                    : 'bg-[#140B29] border-purple-900/40 hover:border-purple-600/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-extrabold text-white">{seg.label}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>
                <p className="text-xl font-black font-mono text-amber-300">{count.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">{seg.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Pre-Defined Wake-Up Templates Library */}
      <div className="rounded-2xl bg-[#0F0820] border border-purple-900/40 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-extrabold text-white">2. Pre-Defined Wake-Up Templates</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((tpl) => {
            const active = selectedTemplateId === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => applyTemplate(tpl)}
                className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  active
                    ? 'bg-purple-950/60 border-amber-400/70 shadow-lg shadow-purple-900/30'
                    : 'bg-[#140B29] border-purple-900/40 hover:border-purple-500/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-extrabold text-white">{tpl.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 shrink-0">
                      {tpl.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300/80 line-clamp-3 whitespace-pre-line leading-relaxed">
                    {formatSamplePreview(tpl.message)}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-purple-800/30 text-[11px]">
                  <span className="text-purple-300">
                    Suggested: <strong>{AUDIENCE_META.find((a) => a.id === tpl.defaultAudience)?.label}</strong>
                  </span>
                  <span className="text-amber-400 font-bold">
                    {active ? 'Loaded ✓' : 'Use Template →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Message Composer & Live Telegram Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Composer */}
        <div className="lg:col-span-3 rounded-2xl bg-[#0F0820] border border-purple-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-extrabold text-white">3. Customize Broadcast Message</h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{message.length} / 4000</span>
          </div>

          {/* Placeholder & Formatting Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '+ First Name', val: '{firstName}' },
              { label: '+ Balance', val: '{balance}' },
              { label: '+ Ref Code', val: '{referralCode}' },
              { label: '+ Username', val: '{username}' },
              { label: '<b>Bold</b>', val: '<b></b>' },
              { label: '<i>Italic</i>', val: '<i></i>' },
              { label: '<code>Code</code>', val: '<code></code>' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => insertSnippet(chip.val)}
                className="px-2.5 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-700/50 text-[11px] font-semibold text-purple-200 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            rows={9}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setConfirmOpen(false);
            }}
            placeholder="Write your Telegram HTML message here..."
            className="w-full rounded-2xl bg-[#080312] border border-purple-800/60 focus:border-amber-400/70 focus:outline-none p-3.5 text-sm text-white font-mono leading-relaxed"
          />

          {/* Button Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#140B29] border border-purple-900/40 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMiniAppButton}
                onChange={(e) => setIncludeMiniAppButton(e.target.checked)}
                className="accent-amber-400 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-200">Attach "Open Mini App" Button</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#140B29] border border-purple-900/40 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSecondaryButtons}
                onChange={(e) => setIncludeSecondaryButtons(e.target.checked)}
                className="accent-amber-400 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-200">Attach Payout Channel & Support</span>
            </label>
          </div>

          {includeMiniAppButton && (
            <div>
              <label className="block text-xs font-bold text-purple-300 mb-1">Mini App CTA Button Label</label>
              <input
                type="text"
                maxLength={64}
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="w-full rounded-xl bg-[#080312] border border-purple-800/60 px-3 py-2 text-sm text-white focus:border-amber-400/70 focus:outline-none"
              />
            </div>
          )}

          {/* Test Send Row */}
          <div className="pt-3 border-t border-purple-900/40 space-y-2">
            <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Test Before Sending (Telegram ID or @username)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testTarget}
                onChange={(e) => setTestTarget(e.target.value)}
                placeholder="e.g. 123456789 or @yourhandle"
                className="flex-1 rounded-xl bg-[#080312] border border-purple-800/60 px-3 py-2 text-sm text-white focus:border-cyan-400/70 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTestSend}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>{isTesting ? 'Sending...' : 'Send Test'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Telegram Preview & Launch */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl bg-[#0F0820] border border-purple-900/40 p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-amber-400" />
              <span>Telegram Bot Preview</span>
            </h3>

            <div className="rounded-2xl bg-[#18222d] border border-slate-700/60 p-4 space-y-2.5 text-[13px] text-slate-100 shadow-inner">
              <div className="text-[11px] font-bold text-sky-400">SuperTom Earns · Bot</div>
              <div className="whitespace-pre-wrap leading-relaxed break-words">
                {message.trim() ? formatSamplePreview(message) : 'Your preview will appear here...'}
              </div>

              {(includeMiniAppButton || includeSecondaryButtons) && (
                <div className="pt-2 space-y-1.5">
                  {includeMiniAppButton && (
                    <div className="w-full py-2 px-3 rounded-xl bg-[#2b5278] text-center text-xs font-bold text-white">
                      {ctaText || '🚀 Open SuperTom'}
                    </div>
                  )}
                  {includeSecondaryButtons && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="py-1.5 px-2 rounded-xl bg-[#2b5278] text-center text-[11px] font-bold text-white">
                        💰 Payout Channel
                      </div>
                      <div className="py-1.5 px-2 rounded-xl bg-[#2b5278] text-center text-[11px] font-bold text-white">
                        🆘 Support
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dispatch CTA */}
            {!confirmOpen ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={
                  !message.trim() ||
                  selectedCount === 0 ||
                  activeJob?.status === 'RUNNING'
                }
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-40"
              >
                <Megaphone className="w-4 h-4" />
                <span>Broadcast to {selectedCount.toLocaleString()} Users</span>
              </button>
            ) : (
              <div className="rounded-xl bg-amber-950/40 border border-amber-400/50 p-3.5 space-y-3">
                <p className="text-xs text-amber-200 leading-relaxed">
                  Confirm sending this message via Telegram Bot to{' '}
                  <strong className="text-white">{selectedCount.toLocaleString()}</strong> active users in{' '}
                  <strong className="text-amber-300">
                    {AUDIENCE_META.find((a) => a.id === audience)?.label}
                  </strong>
                  ?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchBroadcast}
                    disabled={isSending}
                    className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Starting...' : 'Confirm & Send'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Broadcast History */}
      <div className="rounded-2xl bg-[#0F0820] border border-purple-900/40 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-extrabold text-white">Recent Broadcast History</h2>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No broadcasts recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-purple-900/40 text-purple-300 uppercase text-[10px]">
                  <th className="py-2.5 pr-4">Time</th>
                  <th className="py-2.5 pr-4">Type / Segment</th>
                  <th className="py-2.5 pr-4">Delivery</th>
                  <th className="py-2.5 pr-4">Preview</th>
                  <th className="py-2.5">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-purple-950/20">
                    <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge
                        status={
                          item.action === 'BROADCAST_TEST'
                            ? 'CONFIGURED'
                            : item.audience || 'COMPLETED'
                        }
                      />
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-slate-200 whitespace-nowrap">
                      {item.action === 'BROADCAST_TEST'
                        ? `Chat ${item.chatId || '-'}`
                        : `${item.sentCount ?? 0} sent / ${item.failedCount ?? 0} failed`}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-300 max-w-xs truncate">
                      {item.messagePreview || '-'}
                    </td>
                    <td className="py-2.5 text-slate-400">{item.adminName || item.adminEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
