import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SafeChartContainer } from "./charts/SafeChartContainer";
import { Star } from "lucide-react";

export const getScoreLabel = (percent: number) => {
  if (percent >= 90) return "Excellent";
  if (percent >= 85) return "Very Good";
  if (percent >= 75) return "Good";
  return "Needs Improvement";
};

export const getScoreColor = (percent: number) => {
  if (percent >= 90) return "text-[#16A34A]";
  if (percent >= 85) return "text-[#0057FF]";
  if (percent >= 75) return "text-[#F97316]";
  return "text-[#EF4444]";
};

export function CircularProgress({
  value,
  size = 86,
  stroke = 9,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const radius = size / 2;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = Math.min(Math.max(value || 0, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const gradientId = `srcProgress-${String(progress).replace(".", "-")}`;

  const formatPercentage = (val: number): string => {
    if (val >= 100) return "100%";
    const formatted = val.toFixed(2);
    if (formatted === "100.00") return "100%";
    return `${formatted}%`;
  };

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg height={size} width={size} className="-rotate-90">
        <circle
          stroke="#E2E8F0"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />

        <circle
          stroke={`url(#${gradientId})`}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />

        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0057FF" />
            <stop offset="55%" stopColor="#00B8A9" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute text-center">
        <p className="text-sm font-black text-slate-900">{formatPercentage(progress)}</p>
      </div>
    </div>
  );
}

export function AreaProgressCard({
  area,
  title,
  percent,
  count,
}: {
  key?: string | number;
  area: string;
  title: string;
  percent: number;
  count: string | number;
}) {
  const safePercent = Number(percent || 0);
  const displayArea = area === "COR-AD" ? "CA" : area;

  const watermarkSize = displayArea.length >= 5 ? "text-4xl" : "text-5xl";

  return (
    <div className="group relative min-w-[150px] overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center opacity-[0.07] transition-transform duration-500 group-hover:scale-105">
        <h1 className={`max-w-full select-none text-center font-black italic tracking-tight text-slate-900 ${watermarkSize}`}>
          {displayArea}
        </h1>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <p className="text-sm font-black tracking-tight text-slate-900">
          {displayArea}
        </p>

        <div className="mt-4">
          <CircularProgress value={safePercent} />
        </div>

        <p className={`mt-4 text-xs font-black ${getScoreColor(safePercent)}`}>
          {getScoreLabel(safePercent)}
        </p>

        <p className="mt-1 text-[10px] font-bold text-slate-400">
          {count}
        </p>
      </div>
    </div>
  );
}

export function ScoreTrend({
  trendData,
  title = "Score Trend",
}: {
  trendData: { date: string; score: number }[];
  title?: string;
}) {
  const data =
    trendData && trendData.length > 0
      ? trendData
      : [
          { date: "Mar 25", score: 76 },
          { date: "Apr 1", score: 78 },
          { date: "Apr 8", score: 81 },
          { date: "Apr 15", score: 83 },
          { date: "Apr 22", score: 85 },
          { date: "Apr 29", score: 87 },
          { date: "May 6", score: 89 },
          { date: "May 18", score: 90 },
        ];

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-black text-slate-900">{title}</h3>
        <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
          Last 8 Evaluations
        </button>
      </div>

      <SafeChartContainer height={256} empty={!data || data.length === 0} emptyMessage="No score trend data available.">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="scoreTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00B8A9" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#0057FF" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />

            <XAxis
              dataKey="date"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />

            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                color: "#0F172A",
              }}
              formatter={(value: any) => [`${value}%`, "Score"]}
            />

            <Area
              type="monotone"
              dataKey="score"
              stroke="#007C89"
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

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-teal-50/50 p-3">
        <Star size={14} className="text-[#007C89]" />
        <p className="text-[10px] font-bold text-slate-600">
          Consistency today, mastery tomorrow. <span className="text-[#007C89]">Keep pushing!</span>
        </p>
      </div>
    </section>
  );
}

export function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-600">{title}</p>
          <h3 className="mt-2 text-3xl font-black text-[#0057FF]">
            {value}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#007C89]/10 text-[#007C89]">
          {icon}
        </div>
      </div>
    </div>
  );
}
