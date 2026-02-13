export function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <span className="text-slate-500">No Trade</span>;

  const getColorClass = (r: string) => {
    switch (r) {
      case 'WIN_2R':
      case 'WIN_3R':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'LOSS':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'BREAKEVEN_STOP':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'SESSION_TIMEOUT':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getLabel = (r: string) => {
    switch (r) {
      case 'WIN_2R':
        return 'Win (2R)';
      case 'WIN_3R':
        return 'Win (3R)';
      case 'LOSS':
        return 'Loss';
      case 'BREAKEVEN_STOP':
        return 'Breakeven';
      case 'SESSION_TIMEOUT':
        return 'Timeout';
      default:
        return r;
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getColorClass(result)}`}
    >
      {getLabel(result)}
    </span>
  );
}
