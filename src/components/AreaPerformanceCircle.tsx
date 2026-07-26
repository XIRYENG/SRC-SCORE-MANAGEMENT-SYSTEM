import React from "react";
import {
  getPerformanceLevel,
  getPerformanceColorClasses,
} from "../utils/gradeCalculation";

type AreaPerformanceCircleProps = {
  key?: React.Key;
  subject: string;
  percentage: number;
  revieweeCount?: number;
  subtitle?: string;
  onClick?: () => void;
  isSelected?: boolean;
};

export function AreaPerformanceCircle({
  subject,
  percentage,
  revieweeCount,
  subtitle,
  onClick,
  isSelected,
}: AreaPerformanceCircleProps) {
  const safePercentage = Math.min(
    100,
    Math.max(0, percentage),
  );

  const performance =
    getPerformanceLevel(
      safePercentage,
    );

  const styles =
    getPerformanceColorClasses(safePercentage);

  const radius = 38;
  const circumference =
    2 * Math.PI * radius;

  const offset =
    circumference -
    (safePercentage / 100) *
      circumference;

  const formatPercentage = (val: number): string => {
    if (val >= 100) return "100%";
    const formatted = val.toFixed(2);
    if (formatted === "100.00") return "100%";
    return `${formatted}%`;
  };

  const displaySubject = subject === "CORAD" ? "CA" : subject;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-[195px] w-full flex-col items-center justify-center rounded-2xl border bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 overflow-hidden ${
        isSelected ? "border-teal-500 ring-1 ring-teal-500 dark:border-teal-400" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 bg-teal-500 text-white rounded-full p-1 z-20">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      {/* Area Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] select-none">
        <span className="text-4xl font-black text-slate-900 uppercase tracking-widest">
          {displaySubject}
        </span>
      </div>
      
      <h3 className="relative z-10 text-sm font-black uppercase text-slate-900 dark:text-white">
        {subject}
      </h3>

      <div className="relative mt-3 h-24 w-24">
        <svg
          viewBox="0 0 100 100"
          className="-rotate-90 w-full h-full"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="9"
            className="dark:stroke-slate-800"
          />

          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={styles.stroke}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={
              circumference
            }
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-base font-black tracking-tight ${styles.text}`}
          >
            {formatPercentage(safePercentage)}
          </span>
        </div>
      </div>

      <span
        className={`mt-3 rounded-full px-3 py-1 text-xs font-black ${styles.badge}`}
      >
        {performance.label}
      </span>

      {subtitle ? (
        <p className="mt-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {subtitle}
        </p>
      ) : (
        typeof revieweeCount === "number" && (
          <p className="mt-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {revieweeCount}{" "}
            {revieweeCount === 1 ? "reviewee" : "reviewees"}{" "}
            included
          </p>
        )
      )}
    </button>
  );
}
