import type {
  OverviewResponse,
  SessionsListResponse,
  SessionDetailResponse,
  SessionNarrative,
  DailyStatsResponse,
  SymbolsResponse,
  ConfigPreset,
  CreateConfigPresetRequest,
  UpdateConfigPresetRequest,
  BacktestJob,
  SubmitBacktestJobRequest,
  WatchlistItem,
  CreateWatchlistItemRequest,
  UpdateWatchlistItemRequest,
  SessionSummary,
  StockSummary,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:3847';

async function fetchAPI<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  async getOverview(params: {
    from?: string;
    to?: string;
    symbol?: string;
  }): Promise<OverviewResponse> {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.symbol) query.set('symbol', params.symbol);
    return fetchAPI(`/api/overview?${query}`);
  },

  async getSessions(params: {
    from?: string;
    to?: string;
    symbol?: string;
    page?: number;
    limit?: number;
  }): Promise<SessionsListResponse> {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.symbol) query.set('symbol', params.symbol);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return fetchAPI(`/api/sessions?${query}`);
  },

  async getSessionDetail(sessionId: number): Promise<SessionDetailResponse> {
    return fetchAPI(`/api/sessions/${sessionId}`);
  },

  async getSessionNarrative(sessionId: number): Promise<SessionNarrative> {
    return fetchAPI(`/api/sessions/${sessionId}/narrative`);
  },

  async getDailyStats(params: {
    from?: string;
    to?: string;
    symbol?: string;
  }): Promise<DailyStatsResponse> {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.symbol) query.set('symbol', params.symbol);
    return fetchAPI(`/api/daily-stats?${query}`);
  },

  async getSymbols(): Promise<SymbolsResponse> {
    return fetchAPI('/api/symbols');
  },

  async deleteAllBacktestSessions(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/maintenance/backtest-sessions`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Config Presets
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getConfigPresets(): Promise<ConfigPreset[]> {
    return fetchAPI('/api/config-presets');
  },

  async getConfigPreset(id: number): Promise<ConfigPreset> {
    return fetchAPI(`/api/config-presets/${id}`);
  },

  async createConfigPreset(data: CreateConfigPresetRequest): Promise<ConfigPreset> {
    const response = await fetch(`${API_BASE}/api/config-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  async updateConfigPreset(
    id: number,
    data: UpdateConfigPresetRequest,
  ): Promise<ConfigPreset> {
    const response = await fetch(`${API_BASE}/api/config-presets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  async deleteConfigPreset(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/config-presets/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
  },

  async setDefaultConfigPreset(id: number): Promise<ConfigPreset> {
    const response = await fetch(`${API_BASE}/api/config-presets/${id}/default`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Backtest Jobs API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async submitBacktestJob(data: SubmitBacktestJobRequest): Promise<{ jobId: string }> {
    const response = await fetch(`${API_BASE}/api/backtest-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  async getBacktestJob(id: string): Promise<BacktestJob> {
    return fetchAPI(`/api/backtest-jobs/${id}`);
  },

  async listBacktestJobs(status?: string): Promise<BacktestJob[]> {
    const query = status ? `?status=${status}` : '';
    return fetchAPI(`/api/backtest-jobs${query}`);
  },

  async cancelBacktestJob(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/backtest-jobs/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Watchlist API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getWatchlistItems(): Promise<WatchlistItem[]> {
    return fetchAPI('/api/watchlist');
  },

  async createWatchlistItem(data: CreateWatchlistItemRequest): Promise<WatchlistItem> {
    const response = await fetch(`${API_BASE}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  async updateWatchlistItem(
    id: number,
    data: UpdateWatchlistItemRequest,
  ): Promise<WatchlistItem> {
    const response = await fetch(`${API_BASE}/api/watchlist/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  async deleteWatchlistItem(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/watchlist/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Summary API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async getTopSessions(limit: number, include: string): Promise<SessionSummary[]> {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    query.set('include', include);
    return fetchAPI(`/api/summary/top-sessions?${query}`);
  },

  async getSessionsByStock(include: string): Promise<StockSummary[]> {
    const query = new URLSearchParams();
    query.set('include', include);
    return fetchAPI(`/api/summary/by-stock?${query}`);
  },
};
