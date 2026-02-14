import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import type { WatchlistItem } from '../api/types.js';

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formSymbol, setFormSymbol] = useState('');
  const [formIsMock, setFormIsMock] = useState(true);
  const [formScheduleEnabled, setFormScheduleEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWatchlist();
  }, []);

  async function loadWatchlist() {
    try {
      setLoading(true);
      const data = await api.getWatchlistItems();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formSymbol.trim()) return;

    try {
      setSubmitting(true);
      await api.createWatchlistItem({
        symbol: formSymbol.toUpperCase(),
        isMock: formIsMock,
        scheduleEnabled: formScheduleEnabled,
      });
      setFormSymbol('');
      setShowForm(false);
      await loadWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: number, field: 'isActive' | 'isMock' | 'scheduleEnabled', value: boolean) {
    try {
      await api.updateWatchlistItem(id, { [field]: value });
      await loadWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  }

  async function handleDelete(id: number, symbol: string) {
    if (!confirm(`Delete ${symbol} from watchlist?`)) return;

    try {
      await api.deleteWatchlistItem(id);
      await loadWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading watchlist...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Watchlist</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage stocks to monitor
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Stock'}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Symbol</label>
              <input
                type="text"
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AAPL, SPY, TSLA..."
                maxLength={10}
                required
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={formIsMock}
                  onChange={(e) => setFormIsMock(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Mock execution</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={formScheduleEnabled}
                  onChange={(e) => setFormScheduleEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Auto-schedule daily</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add to Watchlist'}
            </button>
          </form>
        </div>
      )}

      {/* Watchlist Table */}
      {items.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <p className="text-slate-400">No stocks in watchlist</p>
          <p className="text-slate-500 text-sm mt-2">Click "Add Stock" to get started</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Symbol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Active</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Scheduled</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-750">
                  <td className="px-4 py-3 font-medium text-slate-100">{item.symbol}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(item.id, 'isActive', !item.isActive)}
                      className={`px-2 py-1 rounded text-xs ${
                        item.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-600 text-slate-400'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(item.id, 'isMock', !item.isMock)}
                      className={`px-2 py-1 rounded text-xs ${
                        item.isMock
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}
                    >
                      {item.isMock ? 'Mock' : 'Live'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(item.id, 'scheduleEnabled', !item.scheduleEnabled)}
                      className={`px-2 py-1 rounded text-xs ${
                        item.scheduleEnabled
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-slate-600 text-slate-400'
                      }`}
                    >
                      {item.scheduleEnabled ? 'Scheduled' : 'Manual'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(item.id, item.symbol)}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
