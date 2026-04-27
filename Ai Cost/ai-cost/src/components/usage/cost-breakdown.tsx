"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/glass-card';

export function CostBreakdown({ data }: { data: any[] }) {
  // Group data by model
  const grouped = data.reduce((acc, curr) => {
    if (!acc[curr.model]) {
      acc[curr.model] = { model: curr.model, cost: 0, savings: 0 };
    }
    acc[curr.model].cost += Number(curr.cost_usd || 0);
    // In a real app we'd join with savings_records, for demo we mock savings as 20% of cost
    acc[curr.model].savings += Number(curr.cost_usd || 0) * 0.2; 
    return acc;
  }, {});

  const chartData = Object.values(grouped);

  return (
    <GlassCard className="lg:col-span-1">
      <h3 className="text-lg font-medium text-[#F9FAFB] mb-6">Cost by Model</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis dataKey="model" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px' }}
              itemStyle={{ fontSize: '14px' }}
              cursor={{ fill: '#1F2937', opacity: 0.4 }}
            />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
            <Bar dataKey="cost" name="Actual Cost" fill="#6366F1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="savings" name="Savings" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
