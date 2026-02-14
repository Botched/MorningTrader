import { Link, useLocation } from 'react-router-dom';

export function Sidebar() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/sessions', label: 'Sessions', icon: '📋' },
    { path: '/config', label: 'Config Presets', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold text-blue-400">MorningTrader</h1>
        <p className="text-xs text-slate-400">First Candle Strategy</p>
      </div>
      <nav className="p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`
              block px-4 py-2 rounded-md transition-colors
              ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }
            `}
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
