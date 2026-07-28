import React from "react";
import { getScoreLabel } from "./DashboardShared";

export type BoardAreaCardData = {
  key: string;
  area: string;
  title: string;
  percent: number;
  count: number;
  onClick: () => void;
};

const AREA_CONFIGS: Record<string, { fullName: string; color: string }> = {
  CLJ: { fullName: "Criminal Law and Jurisprudence", color: "#22C55E" },
  LEA: { fullName: "Law Enforcement Administration", color: "#3B82F6" },
  CDI: { fullName: "Crime Detection and Investigation", color: "#00B8A9" },
  FS: { fullName: "Forensic Science", color: "#6366F1" },
  CRIM: { fullName: "Criminology", color: "#10B981" },
  CA: { fullName: "Correctional Administration", color: "#06B6D4" },
  "COR-AD": { fullName: "Correctional Administration", color: "#06B6D4" },
};

export function BoardSubjectAreasSection({
  areas,
  onViewAll,
}: {
  areas: BoardAreaCardData[];
  onViewAll?: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Board Subject Areas
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Click any area to view full category breakdown
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs font-black text-teal-700 hover:text-teal-800 dark:text-teal-400 transition-colors"
            >
              View All Areas
            </button>
          )}
          <span className="rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
            6 Board Areas
          </span>
        </div>
      </div>

      <div className="flex flex-nowrap gap-4 overflow-x-auto pb-3 lg:grid lg:grid-cols-6 lg:overflow-visible scrollbar-thin">
        {areas.map((item) => {
          const displayCode = item.area === "COR-AD" ? "CA" : item.area;
          const config = AREA_CONFIGS[displayCode] || {
            fullName: item.title,
            color: "#00B8A9",
          };
          const safePercentage = Number.isFinite(Number(item.percent))
            ? Math.min(100, Math.max(0, Number(item.percent)))
            : 0;

          const radius = 54;
          const circumference = 2 * Math.PI * radius;
          const offset =
            circumference - (safePercentage / 100) * circumference;

          const statusText = getScoreLabel(safePercentage);
          const statusColorClass =
            safePercentage >= 90
              ? "text-emerald-600"
              : safePercentage >= 85
              ? "text-blue-600"
              : safePercentage >= 75
              ? "text-amber-500"
              : "text-red-500";

          const evalCountLabel =
            item.count === 1 ? "1 evaluation" : `${item.count} evaluations`;

          return (
            <div
              key={item.key || displayCode}
              onClick={item.onClick}
              className="group relative flex min-h-[500px] min-w-[220px] flex-1 flex-col items-center overflow-hidden rounded-[30px] border border-slate-200 bg-white px-5 py-7 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer dark:bg-slate-900 dark:border-slate-800"
            >
              {/* Background Watermark Acronym */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-6 select-none text-6xl font-black italic tracking-tighter text-slate-900/[0.045] dark:text-white/[0.045]"
              >
                {displayCode}
              </span>

              {/* Visible Acronym */}
              <p className="relative z-10 text-sm font-bold tracking-[0.28em] text-teal-700 dark:text-teal-400">
                {displayCode}
              </p>

              {/* Full Title */}
              <h3 className="relative z-10 mt-2 min-h-[58px] text-base font-bold uppercase leading-tight text-slate-900 dark:text-white">
                {config.fullName}
              </h3>

              {/* Circular Progress */}
              <div className="relative mt-6 h-44 w-44 shrink-0">
                <svg
                  viewBox="0 0 128 128"
                  className="h-full w-full -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    strokeWidth="11"
                    className="stroke-slate-100 dark:stroke-slate-800"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    stroke={config.color}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-black text-slate-950 dark:text-white">
                    {safePercentage.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Status */}
              <p className={`mt-5 min-h-[56px] text-xl font-bold leading-tight ${statusColorClass}`}>
                {statusText}
              </p>

              {/* Evaluation Count */}
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 font-semibold">
                {evalCountLabel}
              </p>

              {/* View Breakdown */}
              <button
                type="button"
                className="mt-auto pt-5 text-sm font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300 transition-colors"
              >
                View Breakdown →
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
