import {
  AdminUser,
  DashboardStats,
  UserListItem,
  UserDetail,
  MiningSettings,
  BiscuitItem,
  MissionItem,
  SpinConfig,
  WithdrawalItem,
  DepositItem,
  TransactionItem,
  ReferralStats,
  AuditLogItem,
} from '../types/admin';

const RAW_URL = import.meta.env.VITE_API_BASE_URL || 'https://supertom-backend.onrender.com/api/v1';
const BASE_URL = RAW_URL.replace(/\/+$/, '');

class AdminApiClient {
  private token: string | null = null;

  constructor() {
    this.token = sessionStorage.getItem('supertom_admin_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      sessionStorage.setItem('supertom_admin_token', token);
    } else {
      sessionStorage.removeItem('supertom_admin_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}/admin${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          this.setToken(null);
          window.dispatchEvent(new CustomEvent('admin_auth_expired'));
        }
        const errorMsg = json?.error?.message || json?.message || `Request failed with status ${res.status}`;
        return { success: false, error: errorMsg };
      }

      return {
        success: true,
        data: json?.data !== undefined ? json.data : json,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network failure';
      return { success: false, error: msg };
    }
  }

  // === Auth ===
  public async login(email: string, password: string) {
    const res = await this.request<{ token: string; admin: AdminUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  public async getProfile() {
    return this.request<AdminUser>('/auth/me');
  }

  public async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  public logout() {
    this.setToken(null);
  }

  // === Dashboard ===
  public async getDashboardStats() {
    return this.request<DashboardStats>('/dashboard/stats');
  }

  // === Users ===
  public async getUsers(params: { page?: number; limit?: number; search?: string; status?: string }) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', params.page.toString());
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    return this.request<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      users: UserListItem[];
    }>(`/users?${q.toString()}`);
  }

  public async getUserDetail(userId: string) {
    return this.request<UserDetail>(`/users/${userId}`);
  }

  public async updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED', reason?: string) {
    return this.request<{ id: string; accountStatus: string; message: string }>(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  public async adjustUserBalance(userId: string, amountPoops: number, reason: string) {
    return this.request<{ userId: string; balanceBefore: number; balanceAfter: number }>(
      `/users/${userId}/adjust-balance`,
      {
        method: 'POST',
        body: JSON.stringify({ amountPoops, reason }),
      }
    );
  }

  // === Mining ===
  public async getMiningSettings() {
    return this.request<MiningSettings>('/mining');
  }

  public async updateMiningSettings(settings: { baseRatePerHour?: number; maxAccumulationHours?: number }) {
    return this.request<{ message: string }>('/mining', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // === Biscuits ===
  public async getBiscuits() {
    return this.request<BiscuitItem[]>('/biscuits');
  }

  public async createBiscuit(payload: Partial<BiscuitItem> & { id: string; name: string; costPoops: number; productionBoostPerHour: number }) {
    return this.request<BiscuitItem>('/biscuits', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateBiscuit(id: string, payload: Partial<BiscuitItem>) {
    return this.request<BiscuitItem>(`/biscuits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async deleteBiscuit(id: string) {
    return this.request<{ message: string; deleted?: boolean; deactivated?: boolean }>(`/biscuits/${id}`, {
      method: 'DELETE',
    });
  }

  // === Missions ===
  public async getMissions() {
    return this.request<MissionItem[]>('/missions');
  }

  public async createMission(payload: Partial<MissionItem>) {
    return this.request<MissionItem>('/missions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateMission(id: string, payload: Partial<MissionItem>) {
    return this.request<MissionItem>(`/missions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async deactivateMission(id: string) {
    return this.request<{ id: string; isActive: boolean }>(`/missions/${id}`, {
      method: 'DELETE',
    });
  }

  // === Spin ===
  public async getSpinConfig() {
    return this.request<SpinConfig>('/spin');
  }

  public async updateSpinProbabilities(rewards: SpinConfig['rewards']) {
    return this.request<{ message: string }>('/spin/probabilities', {
      method: 'PUT',
      body: JSON.stringify({ rewards }),
    });
  }

  public async updateSpinCooldowns(cooldowns: SpinConfig['cooldowns']) {
    return this.request<{ message: string }>('/spin/cooldowns', {
      method: 'PUT',
      body: JSON.stringify(cooldowns),
    });
  }

  public async resetSpinCooldown(data: { identifier?: string; resetAll?: boolean }) {
    return this.request<{ message: string }>('/spin/reset-cooldown', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // === Payouts & Deposits ===
  public async getWithdrawals(params: { page?: number; limit?: number; status?: string; search?: string }) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', params.page.toString());
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    return this.request<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      stats?: {
        totalCompletedUsdt: number;
        totalCompletedPoops: number;
        pendingCount: number;
        processingCount: number;
      };
      withdrawals: WithdrawalItem[];
    }>(`/withdrawals?${q.toString()}`);
  }

  public async approveWithdrawal(id: string) {
    return this.request<{ id: string; status: string }>(`/withdrawals/${id}/approve`, {
      method: 'POST',
    });
  }

  public async markWithdrawalProcessing(id: string) {
    return this.request<{ id: string; status: string }>(`/withdrawals/${id}/processing`, {
      method: 'POST',
    });
  }

  public async rejectWithdrawal(id: string, rejectionReason: string) {
    return this.request<{ message: string }>(`/withdrawals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
  }

  public async completeWithdrawal(id: string, txHash: string) {
    return this.request<{ id: string; status: string; txHash: string }>(`/withdrawals/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ txHash }),
    });
  }

  public async getDeposits(params: { page?: number; limit?: number; status?: string }) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', params.page.toString());
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.status) q.set('status', params.status);
    return this.request<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      stats?: {
        totalConfirmedUsdt: number;
        totalConfirmedPoops: number;
        pendingCount: number;
      };
      deposits: DepositItem[];
    }>(`/deposits?${q.toString()}`);
  }

  public async confirmDeposit(id: string, txHash: string, boostPerHour?: number) {
    return this.request<{ message: string }>(`/deposits/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ txHash, boostPerHour }),
    });
  }

  public async manualCreditDeposit(data: {
    identifier: string;
    amountUsdt: number;
    network?: string;
    txHash?: string;
    notes: string;
    boostPerHour?: number;
  }) {
    return this.request<{
      deposit: DepositItem;
      user: { id: string; telegramId: string; username?: string; newBalance: number; productionRate?: number };
      message: string;
    }>('/deposits/manual-credit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getTreasurySettings() {
    return this.request<{
      trustWalletEvm: string;
      trustWalletTron: string;
      trustWalletTon: string;
      trustWalletSol: string;
    }>('/treasury-settings');
  }

  public async updateTreasurySettings(data: {
    trustWalletEvm?: string;
    trustWalletTron?: string;
    trustWalletTon?: string;
    trustWalletSol?: string;
  }) {
    return this.request<{ message: string }>('/treasury-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // === Transactions ===
  public async getTransactions(params: { page?: number; limit?: number; type?: string; search?: string; userId?: string }) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', params.page.toString());
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.type) q.set('type', params.type);
    if (params.search) q.set('search', params.search);
    if (params.userId) q.set('userId', params.userId);
    return this.request<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      transactions: TransactionItem[];
    }>(`/transactions?${q.toString()}`);
  }

  // === Referrals ===
  public async getReferrals() {
    return this.request<ReferralStats>('/referrals');
  }

  // === Audit Logs ===
  public async getAuditLogs(params: { page?: number; limit?: number; action?: string; targetEntity?: string }) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', params.page.toString());
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.action) q.set('action', params.action);
    if (params.targetEntity) q.set('targetEntity', params.targetEntity);
    return this.request<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      logs: AuditLogItem[];
    }>(`/audit-logs?${q.toString()}`);
  }
  // === 5K Celebration Campaign ===
  public async getCampaignConfig() {
    return this.request<{
      campaign: {
        id: string;
        key: string;
        title: string;
        description: string;
        isActive: boolean;
        minDepositAmount: number;
        maxDepositCap: number;
        cashbackPercentage: number;
        dailyRewardPoops: number;
        minRewardDays: number;
        maxRewardDays: number;
        allowMultipleCashbacks: boolean;
        conversionRatePoopsPerUsd: number;
        startsAt: string;
        endsAt: string | null;
      };
      stats: {
        totalEnrolled: number;
        activeSchedules: number;
        completedSchedules: number;
        totalCashbackPoopsDistributed: number;
        totalDailyPoopsDistributed: number;
        totalPoopsDistributed: number;
      };
      participants: Array<{
        id: string;
        userId: string;
        userTelegramId: string;
        username: string | null;
        qualifyingDepositAmount: number;
        cashbackPoops: number;
        totalRewardDays: number;
        daysClaimed: number;
        remainingDays: number;
        totalDailyPoopsCredited: number;
        status: string;
        createdAt: string;
        nextRewardAt: string | null;
      }>;
    }>('/campaign');
  }

  public async updateCampaignConfig(data: {
    isActive?: boolean;
    minDepositAmount?: number;
    maxDepositCap?: number;
    cashbackPercentage?: number;
    dailyRewardPoops?: number;
    minRewardDays?: number;
    maxRewardDays?: number;
    allowMultipleCashbacks?: boolean;
    startsAt?: string;
    endsAt?: string | null;
  }) {
    return this.request<{ campaign: any; message: string }>('/campaign', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async triggerProcessDailyRewards() {
    return this.request<{ processedCount: number; message: string }>('/campaign/process-rewards', {
      method: 'POST',
    });
  }

  public async exportCampaignParticipants() {
    return this.request<{
      campaign: any;
      stats: any;
      participants: any[];
      exportedAt: string;
    }>('/campaign/export');
  }

  // === Payout Channel Automation ===
  public async getPayoutAutomationConfig() {
    return this.request<{
      config: {
        id: string;
        referenceChannel: string;
        destinationChannel: string;
        destinationChatId?: string | null;
        referenceStatus: string;
        destinationStatus: string;
        automationEnabled: boolean;
        publishingMode: 'AUTOMATIC' | 'MANUAL_APPROVAL';
        autoReflectReference?: boolean;
        activeTemplateId: string | null;
        lastSyncAt: string | null;
        lastPublishedAt: string | null;
        lastPublishedTxHash: string | null;
        lastPublishedAmount: number | null;
        failedAttemptsCount: number;
        totalPublishedCount: number;
      };
      counts: {
        pendingCount: number;
        publishedCount: number;
        failedCount: number;
        totalTemplates: number;
      };
    }>('/payout-automation/config');
  }

  public async updatePayoutAutomationConfig(data: {
    referenceChannel?: string;
    destinationChannel?: string;
    destinationChatId?: string | null;
    automationEnabled?: boolean;
    publishingMode?: 'AUTOMATIC' | 'MANUAL_APPROVAL';
    autoReflectReference?: boolean;
    activeTemplateId?: string | null;
  }) {
    return this.request<{ config: any; message: string }>('/payout-automation/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async verifyReferenceChannel(channel?: string) {
    return this.request<{
      success: boolean;
      channelId?: string;
      channelTitle?: string;
      username?: string;
      canPostMessages: boolean;
      isAdministrator: boolean;
      error?: string;
    }>('/payout-automation/verify-reference', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  }

  public async verifyDestinationChannel(channel?: string, chatId?: string) {
    return this.request<{
      success: boolean;
      channelId?: string;
      channelTitle?: string;
      username?: string;
      memberCount?: number;
      canPostMessages: boolean;
      isAdministrator: boolean;
      isInviteLink?: boolean;
      error?: string;
    }>('/payout-automation/verify-destination', {
      method: 'POST',
      body: JSON.stringify({ channel, chatId }),
    });
  }

  public async detectBotChannels() {
    return this.request<{
      channels: Array<{ id: string; title: string; type: string }>;
    }>('/payout-automation/detect-channels');
  }

  public async syncAndReflectReferencePayout(sampleText?: string) {
    return this.request<{
      reflected: boolean;
      announcement?: any;
      published?: boolean;
      message: string;
    }>('/payout-automation/sync-reflect', {
      method: 'POST',
      body: JSON.stringify({ sampleText }),
    });
  }

  public async getPayoutTemplates() {
    return this.request<{
      templates: Array<{
        id: string;
        name: string;
        description: string | null;
        heading: string;
        successMessage: string;
        footer: string;
        emojis: string;
        currencyDisplay: string;
        showUsd: boolean;
        showPoops: boolean;
        showExplorerLink: boolean;
        maskUserAddress: boolean;
        rawTemplate: string | null;
        isDefault: boolean;
        createdAt: string;
      }>;
    }>('/payout-automation/templates');
  }

  public async createPayoutTemplate(data: any) {
    return this.request<{ template: any; message: string }>('/payout-automation/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updatePayoutTemplate(id: string, data: any) {
    return this.request<{ template: any; message: string }>(`/payout-automation/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deletePayoutTemplate(id: string) {
    return this.request<{ message: string }>(`/payout-automation/templates/${id}`, {
      method: 'DELETE',
    });
  }

  public async analyzeReferenceMessage(rawMessage: string) {
    return this.request<{
      detectedHeading: string;
      detectedSuccessIndicator: string;
      detectedCurrency: string;
      detectedAmount?: string;
      detectedUsd?: string;
      detectedTxHash?: string;
      detectedExplorerDomain?: string;
      detectedEmojis: string[];
      recommendedTemplate: any;
    }>('/payout-automation/analyze', {
      method: 'POST',
      body: JSON.stringify({ rawMessage }),
    });
  }

  public async previewPayoutMessage(data: any) {
    return this.request<{ message: string; explorerUrl: string }>('/payout-automation/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getPayoutAnnouncements(params: { page?: number; limit?: number; status?: string }) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', params.page.toString());
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.status) q.set('status', params.status);
    return this.request<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      announcements: Array<{
        id: string;
        withdrawalId: string;
        userId: string;
        network: string;
        currency: string;
        amountCrypto: number;
        amountUsdt: number;
        amountPoops: string;
        walletAddress: string;
        txHash: string;
        explorerUrl: string | null;
        recipientMasked: string;
        renderedMessage: string;
        telegramMessageId: string | null;
        telegramChatId: string | null;
        status: string;
        failureReason: string | null;
        publishedAt: string | null;
        publishedBy: string | null;
        createdAt: string;
        templateName: string;
        withdrawal?: any;
      }>;
    }>(`/payout-automation/announcements?${q.toString()}`);
  }

  public async publishPayoutAnnouncement(id: string) {
    return this.request<{ message: string; messageId?: number }>(`/payout-automation/announcements/${id}/publish`, {
      method: 'POST',
    });
  }

  public async editPayoutAnnouncement(id: string, renderedMessage: string) {
    return this.request<{ announcement: any; message: string }>(`/payout-automation/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ renderedMessage }),
    });
  }

  public async rejectPayoutAnnouncement(id: string, reason?: string) {
    return this.request<{ announcement: any; message: string }>(`/payout-automation/announcements/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public async testSendPayoutAnnouncement() {
    return this.request<{ message: string; messageId?: number }>('/payout-automation/test-send', {
      method: 'POST',
    });
  }

  // === TON Config ===
  public async getTonConfig() {
    return this.request<{
      id: string;
      tonReceivingAddress: string;
      requiredConfirmations: number;
      depositExpiryMinutes: number;
      minDepositTon: number;
      maxDepositTon: number;
      monitoringEnabled: boolean;
      tonConnectManifestUrl: string;
    }>('/ton-config');
  }

  public async updateTonConfig(data: {
    tonReceivingAddress?: string;
    requiredConfirmations?: number;
    depositExpiryMinutes?: number;
    minDepositTon?: number;
    maxDepositTon?: number;
    monitoringEnabled?: boolean;
    tonConnectManifestUrl?: string;
  }) {
    return this.request<{ message: string }>('/ton-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async getTonDeposits(params: { limit?: number; network?: string } = {}) {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.network) q.set('network', params.network);
    return this.request<{
      total?: number;
      deposits: DepositItem[];
    }>(`/deposits?${q.toString()}`);
  }

  public async getPayoutAutomationAnalytics() {
    return this.request<{
      stats: {
        totalAnnouncements: number;
        publishedAnnouncements: number;
        pendingAnnouncements: number;
        failedAnnouncements: number;
        rejectedAnnouncements: number;
        failedAttemptsCount: number;
        totalPublishedCount: number;
        lastPublishedAt: string | null;
        lastPublishedAmount: number | null;
        lastPublishedTxHash: string | null;
        automationEnabled: boolean;
        publishingMode: string;
      };
      logs: Array<{
        id: string;
        eventType: string;
        status: string;
        message: string;
        details: any;
        adminId: string | null;
        createdAt: string;
      }>;
    }>('/payout-automation/analytics');
  }

  // === Telegram Broadcast & Wake-Up Center ===
  public async getBroadcastOverview() {
    return this.request<{
      botConfigured: boolean;
      templates: Array<{
        id: string;
        name: string;
        category: 'wake-up' | 'engagement' | 'quests' | 'growth' | 'announcement';
        badge: string;
        defaultAudience: 'all_active' | 'inactive_24h' | 'inactive_72h' | 'inactive_7d' | 'low_balance';
        ctaText: string;
        includeSecondaryButtons: boolean;
        message: string;
      }>;
      audienceCounts: Record<'all_active' | 'inactive_24h' | 'inactive_72h' | 'inactive_7d' | 'low_balance', number>;
      activeJob: any | null;
      recentJobs: any[];
      history: Array<{
        id: string;
        jobId?: string;
        action: string;
        adminName: string;
        adminEmail: string;
        createdAt: string;
        audience?: string;
        templateId?: string;
        totalTargets?: number;
        sentCount?: number;
        failedCount?: number;
        blockedCount?: number;
        status?: string;
        messagePreview?: string;
      }>;
    }>('/broadcast/overview');
  }

  public async sendBroadcastTest(payload: {
    targetIdentifier: string;
    message: string;
    includeMiniAppButton: boolean;
    ctaText?: string;
    includeSecondaryButtons: boolean;
  }) {
    return this.request<{ message: string; chatId: string }>('/broadcast/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async sendBroadcast(payload: {
    audience: 'all_active' | 'inactive_24h' | 'inactive_72h' | 'inactive_7d' | 'low_balance';
    message: string;
    templateId?: string | null;
    includeMiniAppButton: boolean;
    ctaText?: string;
    includeSecondaryButtons: boolean;
  }) {
    return this.request<{ job: any }>('/broadcast/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getBroadcastJobStatus(jobId: string) {
    return this.request<{ job: any }>(`/broadcast/jobs/${jobId}`);
  }

  public async cancelBroadcastJob(jobId: string) {
    return this.request<{ job: any; message: string }>(`/broadcast/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }
}

export const adminApi = new AdminApiClient();

