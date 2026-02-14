import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import type { SessionSummary, StockSummary } from '../api/types.js';

export default function SummaryPage() {
  const [topSessions, setTopSessions] = useState<SessionSummary[]>([]);
  const [stockStats, setStockStats] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [include, setInclude] = useState<'backtest' | 'live' | 'both'>('both');
  const [limit, setLimit] = useState<number>(50);

  useEffect(() => {
    loadData();
  }, [include, limit]);

  async function loadData() {
    try {
      setLoading(true);
      const [sessions, stocks] = await Promise.all([
        api.getTopSessions(limit, include),
        api.getSessionsByStock(include),
      ]);
      setTopSessions(sessions);
      setStockStats(stocks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading summary...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Summary</h1>
          <p className="text-sm text-slate-400 mt-1">
            Leaderboards and aggregate statistics
          </p>
        </div>

        {/* Filter toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setInclude('backtest')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              include === 'backtest'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Backtest
          </button>
          <button
            onClick={() => setInclude('live')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              include === 'live'
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setInclude('both')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              include === 'both'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Both
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Top N Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-100">Top Sessions</h2>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-1 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>Top 10</option>
            <option value={25}>Top 25</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
          </select>
        </div>

        {topSessions.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <p className="text-slate-400">No sessions found with current filters</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Zone (R-S)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total R</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Trades</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {topSessions.map((session, index) => (
                  <tr key={session.sessionId} className="hover:bg-slate-750">
                    <td className="px-4 py-3 text-slate-300 font-medium">#{index + 1}</td>
                    <td className="px-4 py-3 text-slate-300">{session.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-100">{session.symbol}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {session.zoneResistance && session.zoneSupport
                        ? `$${session.zoneResistance.toFixed(2)} - $${session.zoneSupport.toFixed(2)}`
                        : 'N/A'}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      session.totalR >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {session.totalR >= 0 ? '+' : ''}{session.totalR.toFixed(2)}R
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{session.tradeCount}</td>
                    <td className="px-4 py-3 text-center">
                      {session.result ? (
                        <span className={`px-2 py-1 rounded text-xs ${
                          session.result.startsWith('WIN')
                            ? 'bg-green-500/20 text-green-400'
                            : session.result === 'LOSS'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-slate-600 text-slate-300'
                        }`}>
                          {session.result}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By Stock */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100">By Stock</h2>

        {stockStats.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <p className="text-slate-400">No stock data found with current filters</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Sessions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Trades</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Win Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total R</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Avg R</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {stockStats.map((stock) => (
                  <tr key={stock.symbol} className="hover:bg-slate-750">
                    <td className="px-4 py-3 font-medium text-slate-100">{stock.symbol}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{stock.sessionCount}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{stock.tradeCount}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {stock.tradeCount > 0 ? `${stock.winRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      stock.totalR >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stock.totalR >= 0 ? '+' : ''}{stock.totalR.toFixed(2)}R
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      stock.avgR >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stock.avgR >= 0 ? '+' : ''}{stock.avgR.toFixed(2)}R
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
