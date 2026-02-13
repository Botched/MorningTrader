export function RValueBadge({ r }: { r: number | null }) {
  if (r === null || r === undefined) return <span className="text-slate-500">N/A</span>;

  const isPositive = r >= 0;
  const colorClass = isPositive
    ? 'text-green-400'
    : 'text-red-400';

  return (
    <span className={`font-mono font-semibold ${colorClass}`}>
      {isPositive ? '+' : ''}{r.toFixed(2)}R
    </span>
  );
}
