"use client";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import type { StorageSeries } from "@/lib/types";

export default function StorageChart({ data }: { data: StorageSeries[] }) {
  const formatted = data.map(d => ({
    ...d,
    date: d.date.slice(0, 7),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={formatted} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8892a4" }} tickLine={false} />
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
          formatter={(v: number) => [`${v.toFixed(1)}%`]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />
        <Area
          type="monotone" dataKey="storage_pct_full" name="Storage %"
          stroke="#3b82f6" fill="#3b82f620" strokeWidth={2}
        />
        <Line
          type="monotone" dataKey="five_year_avg_pct" name="5yr Avg %"
          stroke="#8892a4" strokeDasharray="5 3" strokeWidth={1.5} dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
