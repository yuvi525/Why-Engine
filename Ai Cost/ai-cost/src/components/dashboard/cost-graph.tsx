"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/glass-card';

const defaultData = [
  { date: '01/01', cost: 120, savings: 30 },
  { date: '01/02', cost: 132, savings: 45 },
  { date: '01/03', cost: 101, savings: 60 },
  { date: '01/04', cost: 142, savings: 40 },
  { date: '01/05', cost: 90, savings: 75 },
  { date: '01/06', cost: 150, savings: 50 },
  { date: '01/07', cost: 160, savings: 80 },
];

export function CostGraph({ data = defaultData }: { data?: any[] }) {
  return (
    <GlassCard delay={0.5} className="col-span-full lg:col-span-2">
      <h3 className="text-lg font-medium text-[#F9FAFB] mb-6">Cost vs Savings</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px' }}
              itemStyle={{ fontSize: '14px' }}
            />
            <Area type="monotone" dataKey="cost" stroke="#F43F5E" fillOpacity={1} fill="url(#colorCost)" name="Spend" />
            <Area type="monotone" dataKey="savings" stroke="#10B981" fillOpacity={1} fill="url(#colorSavings)" name="Savings" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
