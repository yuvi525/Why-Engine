'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard',  path: '/',         icon: '📊' },
    { label: 'Live Demo',  path: '/demo',      icon: '🚀' },
    { label: 'Decisions',  path: '/decisions', icon: '⚡' },
    { label: 'Usage',      path: '/usage',     icon: '📈' },
    { label: 'Settings',   path: '/settings',  icon: '⚙️' },
  ];

  return (
    <div className="fixed top-0 left-0 h-screen w-[220px] bg-[#0A0A0F] border-r border-gray-800 flex flex-col z-50">
      <div className="p-6">
        <h1 className="text-2xl font-mono font-bold text-[#00D9FF] tracking-wider">VELA</h1>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-900/20 border-l-2 border-[#00D9FF] text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <span>{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center justify-between px-2 py-2 bg-gray-900/50 rounded-lg">
          <span className="text-xs font-medium text-gray-400">Demo Mode</span>
          <button className="w-8 h-4 bg-[#00D9FF] rounded-full relative">
            <div className="absolute right-1 top-0.5 w-3 h-3 bg-white rounded-full"></div>
          </button>
        </div>
      </div>
    </div>
  );
}
