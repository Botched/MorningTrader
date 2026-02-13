import { LoadingSpinner } from '../components/common/LoadingSpinner';

export default function SessionDetailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Session Detail</h1>
        <p className="text-sm text-slate-400 mt-1">Detailed view with charts and narrative</p>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <LoadingSpinner />
        <p className="text-slate-400 mt-4">Session detail page under construction</p>
        <p className="text-xs text-slate-500 mt-2">
          Will display candlestick chart, zone overlay, signals, narrative write-up
        </p>
      </div>
    </div>
  );
}
