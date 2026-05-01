"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import type { PriceObservation } from "@/lib/types";

export default function PriceChart({ data }: { data: PriceObservation[] }) {
  // Pivot by date
  const byDate: Record<string, Record<string, number>> = {};
  for (const p of data) {
    const d = p.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = { date: d as unknown as number };
    byDate[d][p.price_type] = p.price_value;
  }
  const formatted = Object.values(byDate).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8892a4" }} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#8892a4" }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: "#1a1f2e", border: "1px solid #2e3347", borderRadius: 6 }}
          labelStyle={{ color: "#e2e8f0", fontSize: 11 }}
          formatter={(v: number) => [v.toFixed(2)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Line type="monotone" dataKey="ttf_spot" name="TTF (EUR/MWh)" stroke="#3b82f6" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="jkm_spot" name="JKM (USD/MMBtu)" stroke="#f59e0b" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="henry_hub" name="Henry Hub (USD/MMBtu)" stroke="#22c55e" dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  );
}
