"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { GlassCard } from '../ui/glass-card';

const defaultData = [
  { name: 'GPT-4o', value: 400, color: '#6366F1' },
  { name: 'Claude 3.5 Sonnet', value: 300, color: '#10B981' },
  { name: 'GPT-4o-mini', value: 300, color: '#8B5CF6' },
  { name: 'Claude Haiku', value: 200, color: '#38BDF8' },
];

export function ModelDistribution({ data = defaultData }: { data?: any[] }) {
  return (
    <GlassCard delay={0.6} className="col-span-full lg:col-span-1">
      <h3 className="text-lg font-medium text-[#F9FAFB] mb-6">Model Distribution</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px' }}
              itemStyle={{ fontSize: '14px', color: '#F9FAFB' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
