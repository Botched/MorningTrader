import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import type { ConfigPreset, BacktestJob } from '../api/types.js';
import { JobStatusCard } from '../components/backtest/JobStatusCard.js';

export default function BacktestPage() {
  const [symbol, setSymbol] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [presetId, setPresetId] = useState<number | undefined>();
  const [presets, setPresets] = useState<ConfigPreset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<BacktestJob[]>([]);

  useEffect(() => {
    loadPresets();
    loadRecentJobs();
  }, []);

  async function loadPresets() {
    try {
      const data = await api.getConfigPresets();
      setPresets(data);
      // Select default preset if available
      const defaultPreset = data.find((p) => p.isDefault);
      if (defaultPreset) {
        setPresetId(defaultPreset.id);
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }

  async function loadRecentJobs() {
    try {
      const jobs = await api.listBacktestJobs();
      setRecentJobs(jobs.slice(0, 5)); // Show last 5 jobs
    } catch (err) {
      console.error('Failed to load recent jobs:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!symbol || !fromDate || !toDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const { jobId } = await api.submitBacktestJob({
        symbol: symbol.toUpperCase(),
        fromDate,
        toDate,
        presetId,
      });
      setCurrentJobId(jobId);
      // Clear form
      setSymbol('');
      setFromDate('');
      setToDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit backtest');
    } finally {
      setSubmitting(false);
    }
  }

  function handleJobComplete(_job: BacktestJob) {
    // Refresh recent jobs list
    loadRecentJobs();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Run Backtest</h1>
        <p className="text-sm text-slate-400 mt-1">
          Execute async backtests across date ranges
        </p>
      </div>

      {/* Form Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Symbol Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Symbol *
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="AAPL, SPY, TSLA..."
              required
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                From Date *
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                To Date *
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Preset Dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Config Preset
            </label>
            <select
              value={presetId || ''}
              onChange={(e) =>
                setPresetId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Default</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} {preset.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Run Backtest'}
          </button>
        </form>
      </div>

      {/* Current Job Status */}
      {currentJobId && (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Current Job</h2>
          <JobStatusCard jobId={currentJobId} onComplete={handleJobComplete} />
        </div>
      )}

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Recent Jobs</h2>
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-slate-100">
                    {job.symbol} ({job.fromDate} to {job.toDate})
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    {job.status} -{' '}
                    {job.result
                      ? `${job.result.totalR.toFixed(2)}R (${job.result.winRate.toFixed(1)}% WR)`
                      : job.error || 'In progress'}
                  </div>
                </div>
                <button
                  onClick={() => setCurrentJobId(job.id)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm transition-colors"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
