import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SafeChartContainer } from "../charts/SafeChartContainer";

export const ScoreTrend = ({ trendData }: { trendData: any[] }) => {
  const hasData = Array.isArray(trendData) && trendData.length > 0;
  
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-[#0B1220] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-black text-white">Score Trend</h3>
        <button className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">
          Last 8 Evaluations
        </button>
      </div>

      <SafeChartContainer height={256} empty={!hasData} emptyMessage="No trend data available.">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="scoreTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00B8A9" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#0057FF" stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="date"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#020617",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "16px",
                color: "#fff",
              }}
              formatter={(value: any) => [`${value}%`, "Score"]}
            />

            <Area
              type="monotone"
              dataKey="score"
              stroke="#00B8A9"
              strokeWidth={3}
              fill="url(#scoreTrendGradient)"
              dot={{
                r: 4,
                fill: "#22C55E",
                stroke: "#FFFFFF",
                strokeWidth: 2,
              }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </SafeChartContainer>
    </section>
  );
};
