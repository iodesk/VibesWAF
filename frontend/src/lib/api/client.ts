import type {
  App,
  AppCreateRequest,
  AppUpdateRequest,
  Rule,
  RuleCreateRequest,
  RuleUpdateRequest,
  ValidateExpressionResponse,
  BotPattern,
  BotPatternRequest,
  BotConfig,
  BotIPRange,
  BotIPRangeRequest,
  ProtocolAnomalyConfig,
  WAFConfig,
  ScoringConfig,
  LogEntry,
  LogQueryParams,
  ErrorResponse,
  SuccessResponse,
  HealthResponse,
  RateLimitResponse,
  RateLimitUpdateRequest,
  IPAccessRule,
  IPAccessRuleCreateRequest,
  IPAccessRuleUpdateRequest,
  TrafficAnalyticsParams,
  TrafficAnalyticsResponse,
  Certificate,
  CertificateLog,
  ThreatIPResponse,
  WAFRuleIntelResponse,
  ThreatSummaryResponse,
  CustomRuleIntelResponse,
  IPReputationEntry,
  IPReputationEntryRequest,
  IPReputationConfig,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response: ErrorResponse
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Single source of truth for the API base URL.
// Empty string = same-origin (production embedded mode).
// Set VITE_API_BASE_URL in .env for development.
export const apiBase: string = import.meta.env.VITE_API_BASE_URL ?? '';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = apiBase) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error: ErrorResponse = await response.json().catch(() => ({
          error: response.statusText,
          message: `HTTP ${response.status}`,
        }));
        throw new ApiError(error.message || error.error, response.status, error);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        { error: 'NetworkError', message: 'Failed to connect to API' }
      );
    }
  }

  health = {
    check: (): Promise<HealthResponse> => {
      return this.request<HealthResponse>('/health');
    },
  };

  apps = {
    list: (): Promise<App[]> => {
      return this.request<App[]>('/api/v1/apps');
    },

    get: (id: string): Promise<App> => {
      return this.request<App>(`/api/v1/apps/${id}`);
    },

    create: (data: AppCreateRequest): Promise<App> => {
      return this.request<App>('/api/v1/apps', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: (id: string, data: AppUpdateRequest): Promise<App> => {
      return this.request<App>(`/api/v1/apps/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: (id: string): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/apps/${id}`, {
        method: 'DELETE',
      });
    },

    toggleUnderAttackMode: (id: string, enabled: boolean): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/apps/${id}/under-attack`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
    },

    listIPAccessRules: (appId: string): Promise<{ rules: IPAccessRule[] }> => {
      return this.request<{ rules: IPAccessRule[] }>(`/api/v1/apps/${appId}/ip-access-rules`);
    },

    createIPAccessRule: (appId: string, data: IPAccessRuleCreateRequest): Promise<IPAccessRule> => {
      return this.request<IPAccessRule>(`/api/v1/apps/${appId}/ip-access-rules`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateIPAccessRule: (appId: string, id: number, data: IPAccessRuleUpdateRequest): Promise<IPAccessRule> => {
      return this.request<IPAccessRule>(`/api/v1/apps/${appId}/ip-access-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deleteIPAccessRule: (appId: string, id: number): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/apps/${appId}/ip-access-rules/${id}`, {
        method: 'DELETE',
      });
    },

    listRules: (appId: string): Promise<Rule[]> => {
      return this.request<Rule[]>(`/api/v1/apps/${appId}/rules`);
    },

    createRule: (appId: string, data: RuleCreateRequest): Promise<Rule> => {
      return this.request<Rule>(`/api/v1/apps/${appId}/rules`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateRule: (appId: string, id: number, data: RuleUpdateRequest): Promise<Rule> => {
      return this.request<Rule>(`/api/v1/apps/${appId}/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deleteRule: (appId: string, id: number): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/apps/${appId}/rules/${id}`, {
        method: 'DELETE',
      });
    },

    reorderRules: (appId: string, ruleIDs: number[]): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/apps/${appId}/rules/reorder`, {
        method: 'POST',
        body: JSON.stringify({ rule_ids: ruleIDs }),
      });
    },
  };

  rules = {
    list: (): Promise<Rule[]> => {
      return this.request<Rule[]>('/api/v1/rules');
    },

    get: (id: number): Promise<Rule> => {
      return this.request<Rule>(`/api/v1/rules/${id}`);
    },

    create: (data: RuleCreateRequest): Promise<Rule> => {
      return this.request<Rule>('/api/v1/rules', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: (id: number, data: RuleUpdateRequest): Promise<Rule> => {
      return this.request<Rule>(`/api/v1/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: (id: number): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/rules/${id}`, {
        method: 'DELETE',
      });
    },

    validate: (expression: string): Promise<ValidateExpressionResponse> => {
      return this.request<ValidateExpressionResponse>('/api/v1/rules/validate', {
        method: 'POST',
        body: JSON.stringify({ expression }),
      });
    },

    reorder: (ruleIDs: number[]): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>('/api/v1/rules/reorder', {
        method: 'POST',
        body: JSON.stringify({ rule_ids: ruleIDs }),
      });
    },
  };

  botPatterns = {
    list: (): Promise<BotPattern[]> => {
      return this.request<BotPattern[]>('/api/v1/bot-patterns');
    },

    create: (data: BotPatternRequest): Promise<BotPattern> => {
      return this.request<BotPattern>('/api/v1/bot-patterns', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: (id: number, data: BotPatternRequest): Promise<BotPattern> => {
      return this.request<BotPattern>(`/api/v1/bot-patterns/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: (id: number): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/bot-patterns/${id}`, {
        method: 'DELETE',
      });
    },

    bulkDelete: (ids: number[]): Promise<{ success: boolean; deleted: number; message: string }> => {
      return this.request<{ success: boolean; deleted: number; message: string }>('/api/v1/bot-patterns/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    },
  };

  botIPRanges = {
    list: (): Promise<BotIPRange[]> => {
      return this.request<BotIPRange[]>('/api/v1/bot-ip-ranges');
    },

    create: (data: BotIPRangeRequest): Promise<BotIPRange> => {
      return this.request<BotIPRange>('/api/v1/bot-ip-ranges', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: (id: number, data: BotIPRangeRequest): Promise<BotIPRange> => {
      return this.request<BotIPRange>(`/api/v1/bot-ip-ranges/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: (id: number): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/bot-ip-ranges/${id}`, {
        method: 'DELETE',
      });
    },

    sync: (id: number): Promise<BotIPRange> => {
      return this.request<BotIPRange>(`/api/v1/bot-ip-ranges/${id}/sync`, {
        method: 'POST',
      });
    },
  };

  ipReputation = {
    list: (): Promise<IPReputationEntry[]> => {
      return this.request<IPReputationEntry[]>('/api/v1/ip-reputation');
    },

    create: (data: IPReputationEntryRequest): Promise<IPReputationEntry> => {
      return this.request<IPReputationEntry>('/api/v1/ip-reputation', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: (id: number, data: IPReputationEntryRequest): Promise<IPReputationEntry> => {
      return this.request<IPReputationEntry>(`/api/v1/ip-reputation/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: (id: number): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/ip-reputation/${id}`, {
        method: 'DELETE',
      });
    },

    bulkDelete: (ids: number[]): Promise<{ success: boolean; deleted: number; message: string }> => {
      return this.request<{ success: boolean; deleted: number; message: string }>('/api/v1/ip-reputation/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    },

    bulkUpdateScore: (ids: number[], score: number): Promise<{ success: boolean; updated: number; message: string }> => {
      return this.request<{ success: boolean; updated: number; message: string }>('/api/v1/ip-reputation/bulk-update-score', {
        method: 'POST',
        body: JSON.stringify({ ids, score }),
      });
    },

    getConfig: (): Promise<IPReputationConfig> => {
      return this.request<IPReputationConfig>('/api/v1/ip-reputation/config');
    },

    updateConfig: (data: IPReputationConfig): Promise<IPReputationConfig> => {
      return this.request<IPReputationConfig>('/api/v1/ip-reputation/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    syncSpamhaus: (): Promise<{ success: boolean; total_ips: number; total_asns: number; message: string }> => {
      return this.request<{ success: boolean; total_ips: number; total_asns: number; message: string }>('/api/v1/ip-reputation/sync-spamhaus', {
        method: 'POST',
      });
    },
  };

  settings = {
    getBotConfig: (): Promise<BotConfig> => {
      return this.request<BotConfig>('/api/v1/settings/bot');
    },

    updateBotConfig: (data: BotConfig): Promise<BotConfig> => {
      return this.request<BotConfig>('/api/v1/settings/bot', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    getWAFConfig: (): Promise<WAFConfig> => {
      return this.request<WAFConfig>('/api/v1/settings/waf');
    },

    updateWAFConfig: (data: WAFConfig): Promise<WAFConfig> => {
      return this.request<WAFConfig>('/api/v1/settings/waf', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    getScoringConfig: (): Promise<ScoringConfig> => {
      return this.request<ScoringConfig>('/api/v1/settings/scoring');
    },

    updateScoringConfig: (data: ScoringConfig): Promise<ScoringConfig> => {
      return this.request<ScoringConfig>('/api/v1/settings/scoring', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    getProtocolAnomalyConfig: (): Promise<ProtocolAnomalyConfig> => {
      return this.request<ProtocolAnomalyConfig>('/api/v1/settings/protocol-anomaly');
    },

    updateProtocolAnomalyConfig: (data: ProtocolAnomalyConfig): Promise<ProtocolAnomalyConfig> => {
      return this.request<ProtocolAnomalyConfig>('/api/v1/settings/protocol-anomaly', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
  };

  logs = {
    query: (params?: LogQueryParams): Promise<{ data: LogEntry[]; total: number }> => {
      const searchParams = new URLSearchParams();

      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.offset) searchParams.append('offset', params.offset.toString());
      if (params?.action) searchParams.append('action', params.action);
      if (params?.app_id) searchParams.append('app_id', params.app_id);
      if (params?.q) searchParams.append('q', params.q);
      if (params?.days) searchParams.append('days', params.days.toString());
      if (params?.reason_like) searchParams.append('reason_like', params.reason_like);
      if (params?.trace_like) searchParams.append('trace_like', params.trace_like);

      const query = searchParams.toString();
      const endpoint = query ? `/api/v1/logs?${query}` : '/api/v1/logs';

      return this.request<{ data: LogEntry[]; total: number }>(endpoint);
    },
  };

  rateLimit = {
    get: (): Promise<RateLimitResponse> => {
      return this.request<RateLimitResponse>('/api/v1/rate-limit');
    },

    update: (data: RateLimitUpdateRequest): Promise<RateLimitResponse> => {
      return this.request<RateLimitResponse>('/api/v1/rate-limit', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    getStats: (): Promise<{ basic: number; attack: number; error: number }> => {
      return this.request<{ basic: number; attack: number; error: number }>('/api/v1/rate-limit/stats');
    },
  };

  analytics = {
    getTrafficAnalytics: (params: TrafficAnalyticsParams): Promise<TrafficAnalyticsResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.append('range', params.range);
      if (params.app_id) searchParams.append('app_id', params.app_id);

      return this.request<TrafficAnalyticsResponse>(
        `/api/v1/analytics/traffic?${searchParams.toString()}`
      );
    },

    getTopThreats: (range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string): Promise<{ category: string; count: number }[]> => {
      const q = appId ? `?range=${range}&app_id=${encodeURIComponent(appId)}` : `?range=${range}`
      return this.request<{ category: string; count: number }[]>(`/api/v1/analytics/threats${q}`);
    },

    getInsights: (range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string): Promise<any> => {
      const q = appId ? `?range=${range}&app_id=${encodeURIComponent(appId)}` : `?range=${range}`
      return this.request<any>(`/api/v1/analytics/insights${q}`);
    },

    getChallengeStats: (range: '1d' | '7d' | '30d'): Promise<{ total: number; solved: number; failed: number; issued: number; rate: number }> => {
      return this.request<{ total: number; solved: number; failed: number; issued: number; rate: number }>(
        `/api/v1/analytics/challenge-stats?range=${range}`
      );
    },

    getTopBlockedBots: (range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d' = '7d'): Promise<{ ua: string; count: number }[]> => {
      return this.request<{ ua: string; count: number }[]>(`/api/v1/analytics/top-blocked-bots?range=${range}`);
    },

    getWAFStats: (range: '1d' | '7d' | '30d'): Promise<{ blocked: number; challenged: number }> => {
      return this.request<{ blocked: number; challenged: number }>(
        `/api/v1/analytics/waf-stats?range=${range}`
      );
    },

    getThreatIPs: (range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string): Promise<ThreatIPResponse> => {
      const q = appId ? `?range=${range}&app_id=${encodeURIComponent(appId)}` : `?range=${range}`
      return this.request<ThreatIPResponse>(`/api/v1/analytics/threat-intel/ips${q}`);
    },

    getWAFRuleIntel: (range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string): Promise<WAFRuleIntelResponse> => {
      const q = appId ? `?range=${range}&app_id=${encodeURIComponent(appId)}` : `?range=${range}`
      return this.request<WAFRuleIntelResponse>(`/api/v1/analytics/threat-intel/waf-rules${q}`);
    },

    getThreatSummary: (range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string): Promise<ThreatSummaryResponse> => {
      const q = appId ? `?range=${range}&app_id=${encodeURIComponent(appId)}` : `?range=${range}`
      return this.request<ThreatSummaryResponse>(`/api/v1/analytics/threat-intel/summary${q}`);
    },

    getCustomRuleIntel: (range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string): Promise<CustomRuleIntelResponse> => {
      const q = appId ? `?range=${range}&app_id=${encodeURIComponent(appId)}` : `?range=${range}`
      return this.request<CustomRuleIntelResponse>(`/api/v1/analytics/threat-intel/custom-rules${q}`);
    },
  };

  certificates = {
    list: (appId?: string): Promise<Certificate[]> => {
      const endpoint = appId 
        ? `/api/v1/certificates?app_id=${appId}`
        : '/api/v1/certificates';
      return this.request<Certificate[]>(endpoint);
    },

    get: (domain: string): Promise<Certificate> => {
      return this.request<Certificate>(`/api/v1/certificates/${domain}`);
    },

    issue: (domain: string, appId?: string): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>('/api/v1/certificates', {
        method: 'POST',
        body: JSON.stringify({ domain, app_id: appId ?? '' }),
      });
    },

    renew: (domain: string): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/certificates/${domain}/renew`, {
        method: 'POST',
      });
    },

    validate: (domain: string): Promise<Certificate> => {
      return this.request<Certificate>(`/api/v1/certificates/${domain}/validate`, {
        method: 'POST',
      });
    },

    toggleAutoRenew: (domain: string, enabled: boolean): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/certificates/${domain}/auto-renew`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
    },

    getLogs: (domain: string, limit: number = 50): Promise<CertificateLog[]> => {
      return this.request<CertificateLog[]>(
        `/api/v1/certificates/${domain}/logs?limit=${limit}`
      );
    },

    syncFromFilesystem: (): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>('/api/v1/certificates/sync', {
        method: 'POST',
      });
    },

    delete: (domain: string): Promise<SuccessResponse> => {
      return this.request<SuccessResponse>(`/api/v1/certificates/${domain}`, {
        method: 'DELETE',
      });
    },

    bulkDelete: (domains: string[]): Promise<{ success: boolean; message: string; deleted: number }> => {
      return this.request<{ success: boolean; message: string; deleted: number }>(
        '/api/v1/certificates/bulk-delete',
        {
          method: 'POST',
          body: JSON.stringify({ domains }),
        }
      );
    },
  };
}

export const wafApi = new ApiClient();
