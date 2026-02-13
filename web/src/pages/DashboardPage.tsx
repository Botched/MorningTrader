import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import type { OverviewStats, EquityCurvePoint } from '../api/types.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { RValueBadge } from '../components/common/RValueBadge.js';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOverview({});
      setStats(data.stats);
      setEquityCurve(data.equityCurve);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Overview of trading performance</p>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Overview of trading performance</p>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
          <p className="text-red-400">{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const winLossData = [
    { name: 'Wins', value: stats.wins, color: '#10b981' },
    { name: 'Losses', value: stats.losses, color: '#ef4444' },
    { name: 'Breakeven', value: stats.breakevens, color: '#f59e0b' },
    { name: 'Timeouts', value: stats.timeouts, color: '#64748b' },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Overview of trading performance</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Win Rate"
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          color={(stats.winRate * 100) >= 50 ? 'green' : 'red'}
        />
        <MetricCard
          label="Profit Factor"
          value={
            stats.profitFactor === Infinity || stats.totalTrades === 0
              ? 'N/A'
              : stats.profitFactor.toFixed(2)
          }
          color="blue"
        />
        <MetricCard
          label="Average R"
          value={<RValueBadge r={stats.avgR} />}
          color="slate"
        />
        <MetricCard
          label="Total R"
          value={<RValueBadge r={stats.totalR} />}
          color="slate"
        />
        <MetricCard
          label="Total Trades"
          value={stats.totalTrades}
          color="slate"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equity Curve */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Equity Curve</h2>
          {equityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Cumulative R', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '0.5rem',
                    color: '#f1f5f9',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative_r"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Cumulative R"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              No equity data available
            </div>
          )}
        </div>

        {/* Win/Loss Distribution */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Win/Loss Distribution</h2>
          {winLossData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '0.5rem',
                    color: '#f1f5f9',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              No trade results available
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Performance Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Total Sessions</p>
            <p className="text-xl font-semibold text-slate-100 mt-1">{stats.totalSessions}</p>
          </div>
          <div>
            <p className="text-slate-400">Sessions with Trades</p>
            <p className="text-xl font-semibold text-slate-100 mt-1">{stats.sessionsWithTrades}</p>
          </div>
          <div>
            <p className="text-slate-400">Max Favorable R</p>
            <p className="text-xl font-semibold text-green-400 mt-1">+{stats.maxFavorableR.toFixed(2)}R</p>
          </div>
          <div>
            <p className="text-slate-400">Max Adverse R</p>
            <p className="text-xl font-semibold text-red-400 mt-1">{stats.maxAdverseR.toFixed(2)}R</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  color: 'green' | 'red' | 'blue' | 'slate';
}

function MetricCard({ label, value, color }: MetricCardProps) {
  const colorClasses = {
    green: 'border-green-800 bg-green-900/10',
    red: 'border-red-800 bg-red-900/10',
    blue: 'border-blue-800 bg-blue-900/10',
    slate: 'border-slate-700 bg-slate-800',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-slate-100 mt-2">{value}</p>
    </div>
  );
}
