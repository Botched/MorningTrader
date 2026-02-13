export function Header() {
  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">Dashboard</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </header>
  );
}
