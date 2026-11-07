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

  public async updateBiscuit(id: string, payload: Partial<BiscuitItem>) {
    return this.request<BiscuitItem>(`/biscuits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
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
      withdrawals: WithdrawalItem[];
    }>(`/withdrawals?${q.toString()}`);
  }

  public async approveWithdrawal(id: string) {
    return this.request<{ id: string; status: string }>(`/withdrawals/${id}/approve`, {
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
      deposits: DepositItem[];
    }>(`/deposits?${q.toString()}`);
  }

  public async confirmDeposit(id: string, txHash: string) {
    return this.request<{ message: string }>(`/deposits/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ txHash }),
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
}

export const adminApi = new AdminApiClient();
