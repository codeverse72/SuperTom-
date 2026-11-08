import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../services/adminApiClient';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  Send,
  Radio,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  DollarSign,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Zap,
  Clock,
  Edit3,
  Trash2,
  Plus,
  Play,
  Eye,
  Layers,
  Sliders,
  Check,
  Copy,
  AlertCircle,
  Bot
} from 'lucide-react';

export const PayoutAutomationPage: React.FC = () => {
  const { hasRole } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'templates' | 'extractor' | 'logs'>('overview');

  // Config & Counts
  const [config, setConfig] = useState<any>(null);
  const [counts, setCounts] = useState<{
    pendingCount: number;
    publishedCount: number;
    failedCount: number;
    totalTemplates: number;
  }>({ pendingCount: 0, publishedCount: 0, failedCount: 0, totalTemplates: 0 });

  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isVerifyingRef, setIsVerifyingRef] = useState(false);
  const [isVerifyingDest, setIsVerifyingDest] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form Inputs for Config
  const [refChannelInput, setRefChannelInput] = useState('');
  const [destChannelInput, setDestChannelInput] = useState('https://t.me/+W9ypwO2_Pm0xZTJl');
  const [destChatId, setDestChatId] = useState<string | null>(null);
  const [autoReflectReference, setAutoReflectReference] = useState(true);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [publishingMode, setPublishingMode] = useState<'AUTOMATIC' | 'MANUAL_APPROVAL'>('MANUAL_APPROVAL');
  const [isSyncingReflect, setIsSyncingReflect] = useState(false);
  const [isDetectingBot, setIsDetectingBot] = useState(false);

  // Announcements Queue State
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementStatus, setAnnouncementStatus] = useState<string>('PENDING_APPROVAL');
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [announcementTotalPages, setAnnouncementTotalPages] = useState(1);
  const [totalAnnouncements, setTotalAnnouncements] = useState(0);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);

  // Edit / Preview Modal
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [editedMessage, setEditedMessage] = useState('');
  const [isPublishingId, setIsPublishingId] = useState<string | null>(null);

  // Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [livePreviewText, setLivePreviewText] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    heading: '✅ SuperTom Withdrawal Complete',
    successMessage: 'Payment verified and transferred on-chain!',
    footer: '🐱 Thank you for mining with SuperTom! 24/7 Support: @SuperTomCare',
    currencyDisplay: 'USDT',
    showUsd: true,
    showPoops: true,
    showExplorerLink: true,
    maskUserAddress: true,
  });

  // Extractor State
  const [rawReferencePost, setRawReferencePost] = useState('');
  const [extractedResult, setExtractedResult] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Analytics & Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [analyticsStats, setAnalyticsStats] = useState<any | null>(null);

  // Load Config
  const loadConfig = useCallback(async () => {
    try {
      setIsLoadingConfig(true);
      const res = await adminApi.getPayoutAutomationConfig();
      if (res.success && res.data) {
        setConfig(res.data.config);
        setCounts(res.data.counts);
        setRefChannelInput(res.data.config.referenceChannel || '');
        setDestChannelInput(res.data.config.destinationChannel || 'https://t.me/+W9ypwO2_Pm0xZTJl');
        setDestChatId(res.data.config.destinationChatId || null);
        setAutomationEnabled(res.data.config.automationEnabled);
        setPublishingMode(res.data.config.publishingMode);
        setAutoReflectReference(res.data.config.autoReflectReference ?? true);
        setSelectedTemplateId(res.data.config.activeTemplateId);
      }
    } catch (err: any) {
      console.error('Failed to load automation config:', err);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  // Load Announcements
  const loadAnnouncements = useCallback(async () => {
    try {
      setIsLoadingAnnouncements(true);
      const res = await adminApi.getPayoutAnnouncements({
        page: announcementPage,
        limit: 10,
        status: announcementStatus || undefined,
      });
      if (res.success && res.data) {
        setAnnouncements(res.data.announcements);
        setTotalAnnouncements(res.data.total);
        setAnnouncementTotalPages(res.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setIsLoadingAnnouncements(false);
    }
  }, [announcementPage, announcementStatus]);

  // Load Templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await adminApi.getPayoutTemplates();
      if (res.success && res.data) {
        setTemplates(res.data.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, []);

  // Load Analytics Logs
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await adminApi.getPayoutAutomationAnalytics();
      if (res.success && res.data) {
        setAnalyticsStats(res.data.stats);
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadTemplates();
  }, [loadConfig, loadTemplates]);

  useEffect(() => {
    if (activeTab === 'queue') {
      loadAnnouncements();
    } else if (activeTab === 'logs') {
      loadAnalytics();
    }
  }, [activeTab, loadAnnouncements, loadAnalytics]);

  // Save Config Changes
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    setActionMessage(null);
    try {
      const res = await adminApi.updatePayoutAutomationConfig({
        referenceChannel: refChannelInput,
        destinationChannel: destChannelInput,
        destinationChatId: destChatId,
        automationEnabled,
        publishingMode,
        autoReflectReference,
        activeTemplateId: selectedTemplateId,
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Payout automation settings saved successfully!' });
        loadConfig();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to update settings.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error updating settings.' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Auto-Detect Bot Admin Channels
  const handleDetectChannels = async () => {
    setIsDetectingBot(true);
    setActionMessage(null);
    try {
      const res = await adminApi.detectBotChannels();
      if (res.success && res.data?.channels && res.data.channels.length > 0) {
        const found = res.data.channels[0];
        setDestChatId(found.id);
        await adminApi.updatePayoutAutomationConfig({
          destinationChatId: found.id,
          destinationChannel: destChannelInput || 'https://t.me/+W9ypwO2_Pm0xZTJl',
        });
        setActionMessage({
          type: 'success',
          text: `Detected bot channel "${found.title}" (${found.id})! Successfully linked with @SuperrTombot.`,
        });
        loadConfig();
      } else {
        setActionMessage({
          type: 'error',
          text: 'No bot channel detected yet. Make sure @SuperrTombot was added to your channel as an Administrator, or post a message in the channel.',
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error detecting bot channels.' });
    } finally {
      setIsDetectingBot(false);
    }
  };

  // Sync & Reflect Reference Payout
  const handleSyncAndReflect = async () => {
    setIsSyncingReflect(true);
    setActionMessage(null);
    try {
      const res = await adminApi.syncAndReflectReferencePayout();
      if (res.success && res.data?.reflected) {
        setActionMessage({
          type: 'success',
          text: res.data.message || 'Reference payout synced and reflected to SuperTom channel successfully!',
        });
        loadConfig();
        loadAnnouncements();
      } else {
        setActionMessage({
          type: 'error',
          text: res.data?.message || res.error || 'No new reference payout could be reflected at this moment.',
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Sync error.' });
    } finally {
      setIsSyncingReflect(false);
    }
  };

  // Verify Reference Channel
  const handleVerifyRef = async () => {
    setIsVerifyingRef(true);
    setActionMessage(null);
    try {
      const res = await adminApi.verifyReferenceChannel(refChannelInput);
      if (res.success && res.data?.success) {
        setActionMessage({
          type: 'success',
          text: `Reference Channel "${res.data.channelTitle || refChannelInput}" connected successfully!`,
        });
        loadConfig();
      } else {
        setActionMessage({
          type: 'error',
          text: res.data?.error || res.error || 'Failed to verify reference channel.',
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error reaching Telegram API.' });
    } finally {
      setIsVerifyingRef(false);
    }
  };

  // Verify Destination Channel
  const handleVerifyDest = async () => {
    setIsVerifyingDest(true);
    setActionMessage(null);
    try {
      const res = await adminApi.verifyDestinationChannel(destChannelInput, destChatId || undefined);
      if (res.success && res.data?.success) {
        if (res.data.channelId) {
          setDestChatId(res.data.channelId);
        }
        setActionMessage({
          type: 'success',
          text: `SuperTom Payout Channel "${res.data.channelTitle || destChannelInput}" verified! Bot has posting permissions.`,
        });
        loadConfig();
      } else {
        setActionMessage({
          type: 'error',
          text: res.data?.error || res.error || 'Bot is not admin or missing post permissions.',
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error reaching Telegram API.' });
    } finally {
      setIsVerifyingDest(false);
    }
  };

  // Test Broadcast
  const handleTestBroadcast = async () => {
    if (!window.confirm(`Broadcast test payout announcement to ${destChannelInput}?`)) return;
    setActionMessage(null);
    try {
      const res = await adminApi.testSendPayoutAnnouncement();
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Test announcement broadcasted to Telegram successfully! Message ID: ${res.data?.messageId}`,
        });
        loadConfig();
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to broadcast test announcement.',
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Broadcast error.' });
    }
  };

  // Publish Announcement
  const handlePublishAnnouncement = async (id: string) => {
    setIsPublishingId(id);
    try {
      const res = await adminApi.publishPayoutAnnouncement(id);
      if (res.success) {
        setActionMessage({ type: 'success', text: `Announcement published to Telegram channel!` });
        loadAnnouncements();
        loadConfig();
        if (selectedAnnouncement?.id === id) {
          setSelectedAnnouncement(null);
        }
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Publishing failed.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Publish error.' });
    } finally {
      setIsPublishingId(null);
    }
  };

  // Reject Announcement
  const handleRejectAnnouncement = async (id: string) => {
    const reason = window.prompt('Enter rejection reason for this announcement:');
    if (!reason) return;
    try {
      const res = await adminApi.rejectPayoutAnnouncement(id, reason);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Announcement rejected.' });
        loadAnnouncements();
        if (selectedAnnouncement?.id === id) {
          setSelectedAnnouncement(null);
        }
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Rejection error.' });
    }
  };

  // Save Edited Announcement
  const handleSaveEditedAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    try {
      const res = await adminApi.editPayoutAnnouncement(selectedAnnouncement.id, editedMessage);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Announcement text updated.' });
        setSelectedAnnouncement(null);
        loadAnnouncements();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to update.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Edit error.' });
    }
  };

  // Analyze Reference Post
  const handleAnalyzeReferencePost = async () => {
    if (!rawReferencePost.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await adminApi.analyzeReferenceMessage(rawReferencePost);
      if (res.success && res.data) {
        setExtractedResult(res.data);
        setActionMessage({ type: 'success', text: 'Reference post analyzed successfully!' });
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to analyze post.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Analysis error.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Adopt Extracted Template
  const handleAdoptExtractedTemplate = () => {
    if (!extractedResult) return;
    setTemplateForm({
      name: `Inspired by ${extractedResult.detectedHeading.slice(0, 20)}`,
      description: 'Extracted from live reference payout channel post structure',
      heading: extractedResult.recommendedTemplate.heading,
      successMessage: extractedResult.recommendedTemplate.successMessage,
      footer: extractedResult.recommendedTemplate.footer,
      currencyDisplay: extractedResult.recommendedTemplate.currencyDisplay,
      showUsd: extractedResult.recommendedTemplate.showUsd,
      showPoops: extractedResult.recommendedTemplate.showPoops,
      showExplorerLink: extractedResult.recommendedTemplate.showExplorerLink,
      maskUserAddress: extractedResult.recommendedTemplate.maskUserAddress,
    });
    setIsCreatingTemplate(true);
    setActiveTab('templates');
  };

  // Create Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminApi.createPayoutTemplate(templateForm);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'New payout template created!' });
        setIsCreatingTemplate(false);
        loadTemplates();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to create template.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Creation error.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-semibold transition-all shadow-lg ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs px-2 py-1 rounded-lg bg-black/40 hover:bg-black/60 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Controls & Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Published"
          value={counts.publishedCount}
          icon={Send}
          variant="emerald"
          subtitle={`Failed attempts: ${config?.failedAttemptsCount ?? 0}`}
        />
        <StatCard
          title="Pending Approvals"
          value={counts.pendingCount}
          icon={Clock}
          variant="gold"
          subtitle="Awaiting manual review"
        />
        <StatCard
          title="Automation Mode"
          value={publishingMode === 'AUTOMATIC' ? 'AUTO-PILOT' : 'MANUAL APPROVAL'}
          icon={Zap}
          variant={publishingMode === 'AUTOMATIC' ? 'sky' : 'purple'}
          subtitle={automationEnabled ? '● Automation ACTIVE' : '○ Automation PAUSED'}
        />
        <StatCard
          title="Active Templates"
          value={counts.totalTemplates}
          icon={Layers}
          variant="purple"
          subtitle="Adaptive formatting styles"
        />
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Channel Configuration', icon: Sliders },
            { id: 'queue', label: `Announcements Queue (${counts.pendingCount})`, icon: Send },
            { id: 'templates', label: 'Message Templates', icon: Layers },
            { id: 'extractor', label: 'Reference Channel Analyzer', icon: Bot },
            { id: 'logs', label: 'Automation Activity', icon: Radio },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-900/80 text-white border border-purple-500/40 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-purple-950/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestBroadcast}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-amber-300 text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Broadcast test announcement"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Broadcast</span>
          </button>
          <button
            onClick={() => {
              loadConfig();
              if (activeTab === 'queue') loadAnnouncements();
              if (activeTab === 'logs') loadAnalytics();
            }}
            className="p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & CHANNEL CONFIG */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Reference Payout Channel Card */}
            <div className="p-6 rounded-3xl bg-[#0F0821] border border-purple-900/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white font-display">
                      1. Reference Payout Channel
                    </h3>
                    <p className="text-xs text-slate-400">Source channel for layout & format inspiration</p>
                  </div>
                </div>
                <Badge status={config?.referenceStatus || 'CONNECTED'} />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Telegram Channel URL or Channel Username:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={refChannelInput}
                    onChange={(e) => setRefChannelInput(e.target.value)}
                    placeholder="@ReferencePayoutChannel or https://t.me/..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={handleVerifyRef}
                    disabled={isVerifyingRef || !refChannelInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {isVerifyingRef ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    <span>Verify Connection</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ⚡ <strong>Zero permissions needed:</strong> Reads public channel feeds directly without owner approval or bot invites.
                  </p>
                  <button
                    onClick={handleSyncAndReflect}
                    disabled={isSyncingReflect || !refChannelInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    title="Fetch reference payout and adapt into SuperTom layout"
                  >
                    {isSyncingReflect ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Sync & Reflect</span>
                  </button>
                </div>
              </div>

              {config?.lastSyncAt && (
                <div className="pt-3 border-t border-purple-900/30 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Last Synchronization:</span>
                  <span className="font-mono text-slate-300">{new Date(config.lastSyncAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* 2. SuperTom Payout Destination Channel Card */}
            <div className="p-6 rounded-3xl bg-[#0F0821] border border-purple-900/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white font-display">
                      2. SuperTom Payout Channel
                    </h3>
                    <p className="text-xs text-slate-400">Target channel where payout proofs are published</p>
                  </div>
                </div>
                <Badge status={config?.destinationStatus || 'CONFIGURED'} />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Destination Telegram Channel (Invite link, @handle, or Chat ID):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={destChannelInput}
                    onChange={(e) => setDestChannelInput(e.target.value)}
                    placeholder="https://t.me/+W9ypwO2_Pm0xZTJl or @SuperTomPayouts or -100..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    onClick={handleVerifyDest}
                    disabled={isVerifyingDest || !destChannelInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {isVerifyingDest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    <span>Verify Permissions</span>
                  </button>
                </div>

                {destChatId && (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                    <span>Linked Chat ID: <strong>{destChatId}</strong></span>
                    <span className="text-[10px] text-emerald-400">✓ Ready to broadcast</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Supports direct invite links (e.g. <code>https://t.me/+W9ypwO2_Pm0xZTJl</code>). Ensure <strong>@SuperrTombot</strong> is added as Administrator with <strong>"Post Messages"</strong> enabled.
                  </p>
                  <button
                    onClick={handleDetectChannels}
                    disabled={isDetectingBot}
                    className="px-3 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800/70 border border-purple-500/30 text-purple-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    title="Auto-detect channel ID where @SuperrTombot was made Admin"
                  >
                    {isDetectingBot ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    <span>Auto-Detect</span>
                  </button>
                </div>
              </div>

              {config?.lastPublishedAt && (
                <div className="pt-3 border-t border-purple-900/30 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Last Published Payout:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    ${config.lastPublishedAmount ?? '0.00'} USDT • {new Date(config.lastPublishedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Automation Engine Settings Card */}
          <div className="p-6 rounded-3xl bg-[#0F0821] border border-purple-900/40 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-purple-900/30">
              <div>
                <h3 className="text-base font-extrabold text-white font-display">
                  Automation Controls & Policy
                </h3>
                <p className="text-xs text-slate-400">
                  Configure execution triggers, automatic vs manual approvals, and active presentation template.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-300">Automation Engine:</label>
                <button
                  onClick={() => setAutomationEnabled(!automationEnabled)}
                  className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer ${
                    automationEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform shadow-md ${
                      automationEnabled ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Publishing Mode Radio */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Publishing Mode
                </label>
                <div className="space-y-2">
                  <label
                    onClick={() => setPublishingMode('MANUAL_APPROVAL')}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      publishingMode === 'MANUAL_APPROVAL'
                        ? 'bg-purple-900/40 border-amber-400/60 shadow-md'
                        : 'bg-purple-950/20 border-purple-900/30 text-slate-400 hover:border-purple-700/40'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-bold text-white block">
                        Mode B: Manual Admin Approval (Recommended)
                      </span>
                      <span className="text-xs text-slate-400">
                        Completed withdrawals enter the queue. Admins preview and edit before one-click Telegram broadcast.
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        publishingMode === 'MANUAL_APPROVAL' ? 'border-amber-400 bg-amber-400' : 'border-slate-600'
                      }`}
                    >
                      {publishingMode === 'MANUAL_APPROVAL' && <Check className="w-3 h-3 text-black stroke-[3]" />}
                    </div>
                  </label>

                  <label
                    onClick={() => setPublishingMode('AUTOMATIC')}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      publishingMode === 'AUTOMATIC'
                        ? 'bg-purple-900/40 border-cyan-400/60 shadow-md'
                        : 'bg-purple-950/20 border-purple-900/30 text-slate-400 hover:border-purple-700/40'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-bold text-white block">
                        Mode A: Fully Automatic Publishing
                      </span>
                      <span className="text-xs text-slate-400">
                        Automatically broadcasts payout announcement to Telegram the instant an admin confirms on-chain txHash.
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        publishingMode === 'AUTOMATIC' ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'
                      }`}
                    >
                      {publishingMode === 'AUTOMATIC' && <Check className="w-3 h-3 text-black stroke-[3]" />}
                    </div>
                  </label>
                </div>
              </div>

              {/* Active Template Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Active Message Template
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedTemplateId || ''}
                    onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs font-sans focus:outline-none focus:border-purple-400"
                  >
                    <option value="">Default (SuperTom Classic Gold)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400">
                    Determines heading, emojis, currency, and footer formatting for all incoming payout broadcasts.
                  </p>
                </div>
              </div>
            </div>

            {/* Auto-Reflect Toggle */}
            <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  Auto-Reflect Reference Channel Payouts
                </span>
                <span className="text-[11px] text-slate-400">
                  Automatically parse reference channel proofs into SuperTom branded format and queue/broadcast them.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoReflectReference(!autoReflectReference)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  autoReflectReference ? 'bg-amber-400' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform shadow-md ${
                    autoReflectReference ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="pt-4 border-t border-purple-900/30 flex items-center justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingConfig ? 'Saving Settings...' : 'Save Configuration Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANNOUNCEMENT QUEUE & HISTORY */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {['PENDING_APPROVAL', 'PUBLISHED', 'FAILED', 'REJECTED', ''].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setAnnouncementStatus(st);
                    setAnnouncementPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    announcementStatus === st
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-purple-950/40 text-slate-400 hover:text-white'
                  }`}
                >
                  {st === '' ? 'ALL RECORDS' : st.replace('_', ' ')}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total Announcements: <strong>{totalAnnouncements}</strong>
            </span>
          </div>

          {isLoadingAnnouncements ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading announcement queue...</div>
          ) : announcements.length === 0 ? (
            <div className="p-12 rounded-3xl bg-[#0F0821] border border-purple-900/40 text-center text-slate-400 text-xs">
              No payout announcements found for status "{announcementStatus || 'ALL'}".
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="p-5 rounded-2xl bg-[#0F0821] border border-purple-900/30 hover:border-purple-700/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-sm font-mono">
                        ${a.amountUsdt.toFixed(2)} {a.currency}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-700/40 font-mono text-purple-300">
                        {a.network}
                      </span>
                      <Badge status={a.status} />
                    </div>

                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                      <span>Recipient: <strong className="text-slate-200">{a.recipientMasked}</strong></span>
                      <span>Tx: <a href={a.explorerUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-mono hover:underline">{a.txHash.slice(0, 10)}...</a></span>
                      <span>Template: <strong className="text-purple-300">{a.templateName}</strong></span>
                      <span>Created: {new Date(a.createdAt).toLocaleString()}</span>
                    </div>

                    {a.failureReason && (
                      <p className="text-[11px] text-rose-400 font-mono">Error: {a.failureReason}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedAnnouncement(a);
                        setEditedMessage(a.renderedMessage);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview / Edit</span>
                    </button>

                    {a.status !== 'PUBLISHED' && (
                      <>
                        <button
                          onClick={() => handlePublishAnnouncement(a.id)}
                          disabled={isPublishingId === a.id}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isPublishingId === a.id ? 'Publishing...' : 'Approve & Publish'}</span>
                        </button>
                        <button
                          onClick={() => handleRejectAnnouncement(a.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                          title="Reject Announcement"
                        >
                          ✕
                        </button>
                      </>
                    )}

                    {a.status === 'PUBLISHED' && (
                      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/30">
                        <Check className="w-3.5 h-3.5" />
                        <span>Live on Telegram</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {announcementTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-purple-900/30">
                  <button
                    onClick={() => setAnnouncementPage((p) => Math.max(1, p - 1))}
                    disabled={announcementPage <= 1}
                    className="px-3 py-1.5 rounded-xl bg-purple-950/60 text-xs font-bold text-slate-300 disabled:opacity-50 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-400">
                    Page {announcementPage} of {announcementTotalPages}
                  </span>
                  <button
                    onClick={() => setAnnouncementPage((p) => Math.min(announcementTotalPages, p + 1))}
                    disabled={announcementPage >= announcementTotalPages}
                    className="px-3 py-1.5 rounded-xl bg-purple-950/60 text-xs font-bold text-slate-300 disabled:opacity-50 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEMPLATES MANAGER */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white font-display">
                Payout Message Templates
              </h3>
              <p className="text-xs text-slate-400">
                Design custom message layouts, emoji combinations, and explorer token links.
              </p>
            </div>
            <button
              onClick={() => setIsCreatingTemplate(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Template</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="p-5 rounded-2xl bg-[#0F0821] border border-purple-900/30 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-white text-sm font-display">{tmpl.name}</h4>
                  {tmpl.isDefault && <Badge status="ACTIVE" />}
                </div>
                <p className="text-xs text-slate-400">{tmpl.description || 'Custom payout style'}</p>

                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20 text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  <div className="font-bold text-amber-300">{tmpl.heading}</div>
                  <div className="text-[11px] text-purple-200/80 mt-1">{tmpl.footer}</div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => {
                      setSelectedTemplateId(tmpl.id);
                      handleSaveConfig();
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedTemplateId === tmpl.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-purple-950/60 text-purple-300 hover:bg-purple-800'
                    }`}
                  >
                    {selectedTemplateId === tmpl.id ? 'Active' : 'Set as Active'}
                  </button>

                  {!tmpl.isDefault && (
                    <button
                      onClick={async () => {
                        if (window.confirm(`Delete template "${tmpl.name}"?`)) {
                          await adminApi.deletePayoutTemplate(tmpl.id);
                          loadTemplates();
                        }
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Create Template Modal */}
          {isCreatingTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-purple-500/30 bg-[#0E061E] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-purple-900/30">
                  <h3 className="text-base font-extrabold text-white font-display">
                    Create Payout Announcement Template
                  </h3>
                  <button onClick={() => setIsCreatingTemplate(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleCreateTemplate} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Template Name</label>
                    <input
                      type="text"
                      required
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white"
                      placeholder="e.g. Royal Feline Celebration"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Announcement Heading</label>
                    <input
                      type="text"
                      required
                      value={templateForm.heading}
                      onChange={(e) => setTemplateForm({ ...templateForm, heading: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Success Message / Subtitle</label>
                    <input
                      type="text"
                      required
                      value={templateForm.successMessage}
                      onChange={(e) => setTemplateForm({ ...templateForm, successMessage: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Footer Message</label>
                    <input
                      type="text"
                      required
                      value={templateForm.footer}
                      onChange={(e) => setTemplateForm({ ...templateForm, footer: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={templateForm.maskUserAddress}
                        onChange={(e) => setTemplateForm({ ...templateForm, maskUserAddress: e.target.checked })}
                      />
                      <span>Mask Player Address</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={templateForm.showExplorerLink}
                        onChange={(e) => setTemplateForm({ ...templateForm, showExplorerLink: e.target.checked })}
                      />
                      <span>Include Blockchain Explorer</span>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-purple-900/30 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingTemplate(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      Save Template
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REFERENCE CHANNEL EXTRACTOR */}
      {activeTab === 'extractor' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[#0F0821] border border-purple-900/40 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-white font-display">
                Reference Channel Format Analyzer
              </h3>
              <p className="text-xs text-slate-400">
                Paste any sample payout message from your reference channel. The AI extraction engine will identify headings, emojis, currency formats, and generate a tailored SuperTom template.
              </p>
            </div>

            <div className="space-y-3">
              <textarea
                rows={6}
                value={rawReferencePost}
                onChange={(e) => setRawReferencePost(e.target.value)}
                placeholder={`Paste reference payout post here, for example:\n✅ Payout Completed!\n💰 Amount: 10.00 USDT\n👤 User: @crypto_player\n🔗 Tx: 7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c...`}
                className="w-full p-4 rounded-2xl bg-purple-950/50 border border-purple-500/30 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
              />

              <div className="flex items-center justify-between">
                <button
                  onClick={handleAnalyzeReferencePost}
                  disabled={isAnalyzing || !rawReferencePost.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 active:scale-95 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  <span>Analyze & Extract Structure</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRawReferencePost(`✅ Withdrawal Completed!\n💰 Amount: 25.00 USDT ($25.00)\n👤 User: @lucky_miner\n🔗 Tx: 7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a\n🌐 Explorer: https://tronscan.org/#/transaction/7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c\n🚀 Instant on-chain payout!`);
                  }}
                  className="text-xs text-amber-300 hover:underline"
                >
                  Insert Sample Post
                </button>
              </div>
            </div>

            {/* Analysis Results */}
            {extractedResult && (
              <div className="mt-6 p-5 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Extracted Structure & Formatting Profile</span>
                  </h4>
                  <button
                    onClick={handleAdoptExtractedTemplate}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
                  >
                    Adopt as SuperTom Template
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-900/30">
                    <span className="text-slate-400 block text-[10px]">Detected Heading</span>
                    <span className="font-bold text-amber-300">{extractedResult.detectedHeading}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-900/30">
                    <span className="text-slate-400 block text-[10px]">Currency & Amount</span>
                    <span className="font-bold text-white">{extractedResult.detectedAmount || 'Dynamic'} {extractedResult.detectedCurrency}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-900/30">
                    <span className="text-slate-400 block text-[10px]">Explorer Domain</span>
                    <span className="font-bold text-cyan-300 font-mono">{extractedResult.detectedExplorerDomain || 'Multi-Chain'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-900/30">
                    <span className="text-slate-400 block text-[10px]">Detected Emojis</span>
                    <span className="font-bold text-lg">{extractedResult.detectedEmojis.join(' ')}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-purple-900/40 text-xs font-mono text-purple-200">
                  <span className="text-slate-400 block text-[10px] mb-1">Generated SuperTom Announcement Preview:</span>
                  <div className="whitespace-pre-wrap">{extractedResult.recommendedTemplate.heading}</div>
                  <div className="text-emerald-400 mt-1">💎 Network: TRC20</div>
                  <div className="text-amber-300">💰 Amount: 10.00 USDT</div>
                  <div className="text-slate-300">👤 Recipient: @st***</div>
                  <div className="text-cyan-400">🔗 TxHash: [7d2a5...9f8a](https://tronscan.org)</div>
                  <div className="text-slate-400 mt-1">{extractedResult.recommendedTemplate.footer}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AUTOMATION LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-white font-display">
              Automation Audit & Publishing Logs
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Live updates via Render backend
            </span>
          </div>

          <div className="rounded-3xl bg-[#0F0821] border border-purple-900/40 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-purple-950/50 text-slate-400 font-bold border-b border-purple-900/30">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Event Type</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Message / Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20 text-slate-300">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No automation logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-purple-950/30">
                      <td className="p-3.5 font-mono text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-bold text-white font-mono">{log.eventType}</td>
                      <td className="p-3.5">
                        <Badge
                          status={log.status === 'SUCCESS' ? 'COMPLETED' : log.status === 'ERROR' ? 'FAILED' : 'PENDING'}
                        />
                      </td>
                      <td className="p-3.5 text-slate-200">{log.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Announcement Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-purple-500/30 bg-[#0E061E] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/30">
              <h3 className="text-base font-extrabold text-white font-display">
                Preview & Edit Telegram Announcement
              </h3>
              <button onClick={() => setSelectedAnnouncement(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Withdrawal ID: <strong className="font-mono text-slate-300">{selectedAnnouncement.withdrawalId}</strong></span>
                <span>Amount: <strong className="text-amber-400">${selectedAnnouncement.amountUsdt.toFixed(2)} USDT</strong></span>
              </div>

              <label className="text-xs font-bold text-slate-300 block">Rendered Telegram Message:</label>
              <textarea
                rows={8}
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                disabled={selectedAnnouncement.status === 'PUBLISHED'}
                className="w-full p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
              />

              <div className="pt-3 border-t border-purple-900/30 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                >
                  Close
                </button>

                {selectedAnnouncement.status !== 'PUBLISHED' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEditedAnnouncement}
                      className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePublishAnnouncement(selectedAnnouncement.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Approve & Broadcast Now</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
