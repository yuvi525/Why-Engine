"use client";

import { useState } from "react";
import { GlassCard } from "../ui/glass-card";
import { motion } from "framer-motion";

export function UsageTable({ data }: { data: any[] }) {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>(null);

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: 'asc'|'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const columns = [
    { key: 'created_at', label: 'Date' },
    { key: 'model', label: 'Model' },
    { key: 'requests', label: 'Requests' },
    { key: 'total_tokens', label: 'Tokens' },
    { key: 'cost_usd', label: 'Cost ($)' },
  ];

  return (
    <GlassCard className="col-span-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-[#D1D5DB]">
          <thead className="text-xs text-[#9CA3AF] uppercase bg-[#1F2937]/30">
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.key} 
                  className="px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortConfig?.key === col.key && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <motion.tr 
                key={row.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border-b border-[#1F2937]/50 hover:bg-[#1F2937]/50 transition-colors"
              >
                <td className="px-4 py-3">{new Date(row.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">{row.model}</td>
                <td className="px-4 py-3">{row.requests || 1}</td>
                <td className="px-4 py-3">{row.total_tokens?.toLocaleString() || 0}</td>
                <td className="px-4 py-3 font-medium">${Number(row.cost_usd || 0).toFixed(4)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
