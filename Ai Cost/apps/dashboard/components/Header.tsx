'use client';
import { useEffect, useState } from 'react';

export default function Header() {
  const [savedToday, setSavedToday] = useState('0.00');

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:3001';
        const res = await fetch(`${url}/api/usage`);
        const data = await res.json();
        setSavedToday(data.totalSavings?.toFixed(2) || '0.00');
      } catch (err) {
        console.error(err);
      }
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-[#0A0A0F] sticky top-0 z-40">
      <h2 className="text-lg font-medium">Overview</h2>
      
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-gray-400">Saved today:</span>
          <span className="text-[#00FF88] font-mono font-medium">${savedToday}</span>
        </div>

        <div className="h-4 w-px bg-gray-800"></div>

        <div className="flex items-center space-x-4 text-xs font-medium">
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-[#00FF88]"></div>
            <span className="text-gray-300">AWS Bedrock</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-[#00FF88]"></div>
            <span className="text-gray-300">Google Vertex</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-[#FF4444]"></div>
            <span className="text-gray-300">OpenAI</span>
          </div>
        </div>
      </div>
    </header>
  );
}
