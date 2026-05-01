"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import type { FlowTrend } from "@/lib/types";

export default function FlowTrendChart({ data }: { data: FlowTrend[] }) {
  const formatted = data.map(d => ({
    ...d,
    period: d.period.slice(0, 7),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="eu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="as" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" />
        <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#8892a4" }} tickLine={false} />
        <YAxis
          tickFormatter={v => `${v}%`}
          tick={{ fontSize: 10, fill: "#8892a4" }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{ background: "#1a1f2e", border: "1px solid #2e3347", borderRadius: 6 }}
          labelStyle={{ color: "#e2e8f0", fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
          formatter={(v: number) => [`${v.toFixed(1)}%`]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area
          type="monotone" dataKey="europe_pct" name="Europe %"
          stroke="#3b82f6" fill="url(#eu)" strokeWidth={2}
        />
        <Area
          type="monotone" dataKey="asia_pct" name="Asia %"
          stroke="#f59e0b" fill="url(#as)" strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
