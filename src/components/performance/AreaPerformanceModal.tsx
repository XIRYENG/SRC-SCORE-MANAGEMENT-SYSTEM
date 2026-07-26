import React from "react";
import { X, Award, Info } from "lucide-react";
import {
  getPerformanceLevel,
  getPerformanceColorClasses,
  WeightedCategoryResult,
} from "../../utils/gradeCalculation";

type AreaPerformanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  areaCode: string;
  areaTitle: string;
  revieweeLabel?: string;
  breakdown: WeightedCategoryResult[];
  totalPercentage: number;
  totalEarned: number;
  totalPossible: number;
};

export function AreaPerformanceModal({
  isOpen,
  onClose,
  areaCode,
  areaTitle,
  revieweeLabel,
  breakdown,
  totalPercentage,
  totalEarned,
  totalPossible,
}: AreaPerformanceModalProps) {
  if (!isOpen) return null;

  const performance = getPerformanceLevel(totalPercentage);
  const styles = getPerformanceColorClasses(totalPercentage);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-200">
      <div 
        className="
          flex flex-col 
          w-full max-w-[960px] 
          max-h-[calc(100dvh-32px)] 
          bg-white dark:bg-slate-900 
          border border-slate-200 dark:border-slate-800 
          rounded-2xl shadow-xl 
          overflow-hidden 
          animate-in fade-in zoom-in duration-200 text-left
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="area-performance-title"
      >
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Performance Breakdown
            </span>
            <h3 id="area-performance-title" className="text-lg font-black uppercase text-slate-900 dark:text-white mt-1 leading-none">
              {areaTitle} ({areaCode})
            </h3>
            {revieweeLabel && (
              <p className="text-xs font-bold text-slate-500 mt-1 dark:text-slate-400">
                Reviewee: <strong className="text-slate-800 dark:text-slate-200">{revieweeLabel}</strong>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden landscape:grid-cols-[minmax(260px,0.85fr)_minmax(420px,1.6fr)]">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Main KPI Card */}
              <div className="flex flex-row items-center justify-between gap-4 rounded-xl border border-slate-150 dark:border-slate-800 p-5 bg-white dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-900 dark:bg-slate-800 p-2.5 text-white">
                    <Award size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Weighted Score
                    </p>
                    <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
                      {totalPercentage.toFixed(2)}%
                    </p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {totalEarned} / {totalPossible}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-black ${styles.badge}`}>
                    {performance.label}
                  </span>
                </div>
              </div>

              {/* Info Banner */}
              <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-300">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p className="text-[10px] font-semibold leading-relaxed">
                  <strong>Calculation:</strong> Rating = (Total Earned / Total Possible) * 100
                </p>
              </div>
            </div>

            {/* Right Column: Breakdown Table */}
            <div className="min-h-0 overflow-auto rounded-2xl border border-slate-150 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-150 dark:divide-slate-800">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Category</th>
                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Rating</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
                  {breakdown.map((item) => (
                    <tr key={item.category} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-slate-900 dark:text-white">{item.label}</td>
                      <td className="px-4 py-3 text-right text-xs font-black text-slate-700 dark:text-slate-300">{item.score.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 cursor-pointer transition-all"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
