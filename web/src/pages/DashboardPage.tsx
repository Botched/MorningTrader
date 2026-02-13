import { LoadingSpinner } from '../components/common/LoadingSpinner';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Overview of trading performance</p>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <LoadingSpinner />
        <p className="text-slate-400 mt-4">Dashboard page under construction</p>
        <p className="text-xs text-slate-500 mt-2">
          Will display metrics cards, equity curve, win/loss charts, and daily R chart
        </p>
      </div>
    </div>
  );
}
