import React from "react";
import { ArrowRight, Award } from "lucide-react";
import { getPerformanceLevel, getPerformanceColorClasses } from "../../utils/gradeCalculation";

interface AreaPerformanceCardProps {
  areaCode: string;
  areaTitle: string;
  percentage: number;
  revieweeCount: number;
  onClick: () => void;
}

export function AreaPerformanceCard({
  areaCode,
  areaTitle,
  percentage,
  revieweeCount,
  onClick,
}: AreaPerformanceCardProps) {
  const performance = getPerformanceLevel(percentage);
  const styles = getPerformanceColorClasses(percentage);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md h-full"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {areaCode}
          </p>
          <h4 className="mt-1 font-bold text-slate-900 truncate" title={areaTitle}>
            {areaTitle}
          </h4>
        </div>
        <div className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${styles.badge}`}>
          {performance.label}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {percentage.toFixed(1)}%
          </p>
          <p className="text-[10px] font-semibold text-slate-500">
            {revieweeCount} Reviewees
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2 text-slate-400 group-hover:text-[#007C89] group-hover:bg-teal-50 transition-colors">
          <ArrowRight size={16} />
        </div>
      </div>
    </button>
  );
}
