import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import type { BacktestJob } from '../../api/types.js';

interface JobStatusCardProps {
  jobId: string;
  onComplete?: (job: BacktestJob) => void;
}

export function JobStatusCard({ jobId, onComplete }: JobStatusCardProps) {
  const [job, setJob] = useState<BacktestJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;

    async function pollJobStatus() {
      try {
        const data = await api.getBacktestJob(jobId);
        if (!mounted) return;

        setJob(data);
        setLoading(false);
        setError(null);

        // Stop polling if job is terminal state
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          if (interval) clearInterval(interval);
          if (data.status === 'COMPLETED' && onComplete) {
            onComplete(data);
          }
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch job status');
        setLoading(false);
      }
    }

    // Initial fetch
    pollJobStatus();

    // Poll every 2 seconds while job is running
    interval = setInterval(pollJobStatus, 2000);

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [jobId, onComplete]);

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <p className="text-slate-400">Loading job status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">
          Backtest Job - {job.symbol}
        </h3>
        <StatusBadge status={job.status} />
      </div>

      {/* Date Range */}
      <div className="text-sm text-slate-400 mb-4">
        {job.fromDate} to {job.toDate}
      </div>

      {/* Progress Bar */}
      {(job.status === 'PENDING' || job.status === 'RUNNING') && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Progress</span>
            <span>
              {job.progress.current} / {job.progress.total} days ({job.progress.percent}%)
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${job.progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Result Summary */}
      {job.status === 'COMPLETED' && job.result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <MetricCard label="Total R" value={job.result.totalR.toFixed(2)} />
          <MetricCard label="Win Rate" value={`${job.result.winRate.toFixed(1)}%`} />
          <MetricCard label="Total Trades" value={job.result.totalTrades.toString()} />
          <MetricCard label="Sessions" value={job.result.sessionsCompleted.toString()} />
        </div>
      )}

      {/* Error Message */}
      {job.status === 'FAILED' && job.error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
          <p className="text-sm text-red-400">{job.error}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    RUNNING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
    FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium border ${
        colors[status as keyof typeof colors] || 'bg-slate-700 text-slate-300'
      }`}
    >
      {status}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}
