import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import type { SessionListItem } from '../api/types.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { RValueBadge } from '../components/common/RValueBadge.js';
import { PriceDisplay } from '../components/common/PriceDisplay.js';

export default function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadSessions();
  }, [page, symbolFilter, statusFilter]);

  async function loadSessions() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSessions({
        page,
        limit: 20,
        symbol: symbolFilter || undefined,
      });
      setSessions(data.sessions);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(sessionId: number) {
    navigate(`/sessions/${sessionId}`);
  }

  async function handleDeleteAll() {
    if (!window.confirm(
      'Are you sure you want to delete ALL backtest data?\n\n' +
      'This will permanently delete all backtest sessions, trades, outcomes, signals, and bars.\n\n' +
      'Real trading data will be preserved.\n\n' +
      'This action cannot be undone.'
    )) {
      return;
    }

    try {
      setLoading(true);
      await api.deleteAllBacktestSessions();
      // Reload sessions to show only remaining real trades (if any)
      await loadSessions();
      alert('All backtest data has been deleted successfully. Real trading data was preserved.');
    } catch (err) {
      alert('Failed to delete backtest data: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Trading Sessions</h1>
          <p className="text-sm text-slate-400 mt-1">Browse and filter session history</p>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Trading Sessions</h1>
          <p className="text-sm text-slate-400 mt-1">Browse and filter session history</p>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Trading Sessions</h1>
        <p className="text-sm text-slate-400 mt-1">Browse and filter session history</p>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex gap-4 flex-wrap">
          <div>
            <label htmlFor="symbol-filter" className="block text-sm text-slate-400 mb-1">
              Symbol
            </label>
            <input
              id="symbol-filter"
              type="text"
              value={symbolFilter}
              onChange={(e) => {
                setSymbolFilter(e.target.value);
                setPage(1);
              }}
              placeholder="e.g., AAPL"
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-sm text-slate-400 mb-1">
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="COMPLETE">Complete</option>
              <option value="NO_TRADE">No Trade</option>
              <option value="ERROR">Error</option>
              <option value="INTERRUPTED">Interrupted</option>
            </select>
          </div>
          {(symbolFilter || statusFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSymbolFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}

          <div className="ml-auto flex items-end">
            <button
              onClick={handleDeleteAll}
              disabled={loading || sessions.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded transition-colors"
              title="Delete all backtest data (preserves real trades)"
            >
              Delete All Backtests
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No sessions found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="text-left p-4 text-sm font-semibold text-slate-300">Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-300">Symbol</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-300">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-300">Zone</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-300">Direction</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-300">Result</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-300">Realized R</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      onClick={() => handleRowClick(session.id)}
                      className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <td className="p-4 text-sm text-slate-100">{session.date}</td>
                      <td className="p-4 text-sm font-mono font-semibold text-slate-100">
                        {session.symbol}
                      </td>
                      <td className="p-4 text-sm">
                        <StatusBadge status={session.status} />
                      </td>
                      <td className="p-4 text-sm text-slate-300">
                        {session.zoneResistance !== null && session.zoneSupport !== null ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-500">R:</span>
                              <PriceDisplay price={session.zoneResistance} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-500">S:</span>
                              <PriceDisplay price={session.zoneSupport} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        {session.direction ? (
                          <DirectionBadge direction={session.direction} />
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        {session.result ? (
                          <ResultBadge result={session.result} />
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-right">
                        {session.realizedR !== null ? (
                          <RValueBadge r={session.realizedR} />
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-700 flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-100 rounded text-sm transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-100 rounded text-sm transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorClasses = {
    COMPLETE: 'bg-green-900/20 text-green-400 border-green-800',
    NO_TRADE: 'bg-slate-700/20 text-slate-400 border-slate-600',
    ERROR: 'bg-red-900/20 text-red-400 border-red-800',
    INTERRUPTED: 'bg-yellow-900/20 text-yellow-400 border-yellow-800',
  };

  const colorClass = colorClasses[status as keyof typeof colorClasses] || 'bg-slate-700/20 text-slate-400 border-slate-600';

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs border ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isLong = direction === 'LONG';
  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs border ${
        isLong
          ? 'bg-green-900/20 text-green-400 border-green-800'
          : 'bg-red-900/20 text-red-400 border-red-800'
      }`}
    >
      {direction}
    </span>
  );
}

function ResultBadge({ result }: { result: string }) {
  const colorClasses = {
    WIN_2R: 'bg-green-900/20 text-green-400 border-green-800',
    WIN_3R: 'bg-green-900/20 text-green-400 border-green-800',
    BREAKEVEN_STOP: 'bg-yellow-900/20 text-yellow-400 border-yellow-800',
    LOSS: 'bg-red-900/20 text-red-400 border-red-800',
    SESSION_TIMEOUT: 'bg-slate-700/20 text-slate-400 border-slate-600',
  };

  const colorClass = colorClasses[result as keyof typeof colorClasses] || 'bg-slate-700/20 text-slate-400 border-slate-600';

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs border ${colorClass}`}>
      {result.replace(/_/g, ' ')}
    </span>
  );
}
