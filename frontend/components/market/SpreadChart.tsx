"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import type { SpreadData } from "@/lib/types";

export default function SpreadChart({ data }: { data: SpreadData[] }) {
  const filtered = data
    .filter(d => d.ttf_minus_jkm_eur_mwh !== undefined)
    .map(d => ({ date: d.date.slice(0, 10), spread: d.ttf_minus_jkm_eur_mwh! }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={filtered} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8892a4" }} tickLine={false} />
        <YAxis
          tickFormatter={v => `${v.toFixed(0)}`}
          tick={{ fontSize: 10, fill: "#8892a4" }}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={0} stroke="#6b7280" />
        <Tooltip
          contentStyle={{ background: "#1a1f2e", border: "1px solid #2e3347", borderRadius: 6 }}
          labelStyle={{ color: "#e2e8f0", fontSize: 11 }}
          formatter={(v: number) => [`${v.toFixed(1)} EUR/MWh`, "TTF - JKM"]}
        />
        <Bar dataKey="spread" name="TTF - JKM" maxBarSize={8}>
          {filtered.map((entry, i) => (
            <Cell key={i} fill={entry.spread >= 0 ? "#3b82f6" : "#f59e0b"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
