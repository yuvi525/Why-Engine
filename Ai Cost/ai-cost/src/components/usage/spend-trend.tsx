"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/glass-card';

export function SpendTrend({ data, dailyBudget = 100 }: { data: any[], dailyBudget?: number }) {
  // Aggregate daily spend
  const daily = data.reduce((acc, curr) => {
    const d = new Date(curr.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!acc[d]) acc[d] = 0;
    acc[d] += Number(curr.cost_usd || 0);
    return acc;
  }, {});

  const chartData = Object.keys(daily).map(date => ({
    date,
    spend: daily[date]
  })).reverse();

  return (
    <GlassCard className="lg:col-span-2">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-[#F9FAFB]">Daily Spend Trend</h3>
        <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
          <span className="w-3 h-3 rounded-full bg-[#F59E0B]"></span>
          Budget (${dailyBudget}/day)
        </div>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px' }}
              itemStyle={{ fontSize: '14px', color: '#F9FAFB' }}
            />
            <ReferenceLine y={dailyBudget} stroke="#F59E0B" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey="spend" 
              stroke="#6366F1" 
              strokeWidth={3}
              dot={{ fill: '#111827', stroke: '#6366F1', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#6366F1' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
