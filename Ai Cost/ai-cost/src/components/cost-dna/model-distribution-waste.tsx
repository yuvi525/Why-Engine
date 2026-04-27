"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/glass-card';

export function ModelDistributionWaste({ data }: { data: any[] }) {
  // Expected data: [{ model: "gpt-4o", reqPercent: 80, costPercent: 95 }]
  const chartData = data?.length ? data : [
    { model: 'GPT-4o', reqPercent: 45, costPercent: 85 },
    { model: 'Claude 3.5', reqPercent: 30, costPercent: 12 },
    { model: 'GPT-4o-mini', reqPercent: 25, costPercent: 3 }
  ];

  return (
    <GlassCard className="h-full">
      <h3 className="text-lg font-medium text-[#F9FAFB] mb-6">Model Inefficiency</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={true} vertical={false} />
            <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="model" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', borderRadius: '8px' }}
              itemStyle={{ fontSize: '14px' }}
              cursor={{ fill: '#1F2937', opacity: 0.4 }}
            />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
            <Bar dataKey="reqPercent" name="% of Requests" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={12} />
            <Bar dataKey="costPercent" name="% of Cost" fill="#F43F5E" radius={[0, 4, 4, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-[#9CA3AF] mt-4 text-center">
        If a model's cost % heavily outweighs its request %, it is a prime candidate for Autopilot downgrading.
      </p>
    </GlassCard>
  );
}
