import React, { useState, useMemo } from "react";
import { 
  X, 
  Award, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Printer, 
  Users, 
  Building2, 
  Layers, 
  AlertTriangle 
} from "lucide-react";
import {
  getPerformanceLevel,
  getPerformanceColorClasses,
  GradeWeights,
  WeightedCategoryResult,
} from "../../utils/gradeCalculation";
import { 
  calculateMajorAreaContributionBreakdown, 
  MajorAreaContributionBreakdown 
} from "../../utils/schoolContributionCalculator";

type AreaPerformanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  areaCode: string;
  areaTitle: string;
  revieweeLabel?: string;
  breakdown?: WeightedCategoryResult[];
  totalPercentage?: number;
  totalEarned?: number;
  totalPossible?: number;
  reviewees?: Record<string, any>[];
  gradeWeights?: GradeWeights;
};

export function AreaPerformanceModal({
  isOpen,
  onClose,
  areaCode,
  areaTitle,
  revieweeLabel,
  breakdown: legacyBreakdown,
  totalPercentage: legacyTotalPercentage = 0,
  totalEarned: legacyTotalEarned = 0,
  totalPossible: legacyTotalPossible = 0,
  reviewees = [],
  gradeWeights,
}: AreaPerformanceModalProps) {
  const [aggregationMethod, setAggregationMethod] = useState<'Reviewee-Weighted Average' | 'Equal School Average'>('Reviewee-Weighted Average');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  // If this is a personal reviewee breakdown modal (revieweeLabel is present and no reviewees array for aggregation)
  const isPersonalView = Boolean(revieweeLabel && (!reviewees || reviewees.length === 0));

  // Compute full school-level contribution breakdown if reviewees & gradeWeights are provided
  const contributionBreakdown: MajorAreaContributionBreakdown | null = useMemo(() => {
    if (isPersonalView || !gradeWeights) return null;
    return calculateMajorAreaContributionBreakdown(
      reviewees,
      areaCode,
      areaTitle,
      gradeWeights,
      aggregationMethod
    );
  }, [reviewees, areaCode, areaTitle, gradeWeights, aggregationMethod, isPersonalView]);

  const effectiveTotalPercentage = contributionBreakdown 
    ? contributionBreakdown.majorAreaRating 
    : legacyTotalPercentage;

  const performance = getPerformanceLevel(effectiveTotalPercentage);
  const styles = getPerformanceColorClasses(effectiveTotalPercentage);

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev.catId }));
  };

  const handleExportCSV = () => {
    if (!contributionBreakdown) return;
    let csv = "Major Area,Category,Category Weight,Category Rating,School Name,Reviewees,Earned,Possible,School Rating,School Share,Category Contribution,Major Area Contribution\n";
    
    for (const cat of contributionBreakdown.categories) {
      for (const s of cat.schools) {
        csv += `"${contributionBreakdown.majorAreaName} (${contributionBreakdown.majorAreaId})","${cat.categoryName}","${cat.categoryWeight.toFixed(2)}%","${cat.categoryRating.toFixed(2)}%","${s.schoolName}",${s.revieweeCount},${s.earned},${s.possible},"${s.schoolRating.toFixed(2)}%","${s.schoolShare.toFixed(2)}%","${s.categoryContribution.toFixed(2)}%","${s.majorAreaContribution.toFixed(2)}%"\n`;
      }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${contributionBreakdown.majorAreaId}_School_Contribution_Breakdown.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-all duration-200">
      <div 
        className="
          flex flex-col 
          w-full max-w-[1200px] 
          max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-48px)] 
          bg-white dark:bg-slate-900 
          border border-slate-200 dark:border-slate-800 
          rounded-2xl shadow-2xl 
          overflow-hidden 
          animate-in fade-in zoom-in duration-200 text-left
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="area-performance-title"
      >
        {/* Header */}
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#007C89] dark:bg-teal-950/40 dark:text-teal-400">
                School Contribution Breakdown
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                Aggregation: <strong className="text-slate-800 dark:text-slate-200">{aggregationMethod}</strong>
              </span>
            </div>
            <h3 id="area-performance-title" className="text-xl sm:text-2xl font-black uppercase text-slate-900 dark:text-white mt-1 leading-tight">
              {areaTitle} ({areaCode}) Major Area Breakdown
            </h3>
            {revieweeLabel ? (
              <p className="text-xs font-bold text-slate-500 mt-1 dark:text-slate-400">
                Reviewee: <strong className="text-slate-800 dark:text-slate-200">{revieweeLabel}</strong>
              </p>
            ) : (
              <p className="text-xs font-medium text-slate-500 mt-0.5 dark:text-slate-400">
                School-level contribution analysis across all enrolled reviewees and score categories.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isPersonalView && contributionBreakdown && (
              <>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 cursor-pointer transition-all shadow-xs"
                  title="Export Breakdown CSV"
                >
                  <Download size={14} /> Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 cursor-pointer transition-all shadow-xs"
                  title="Print Report"
                >
                  <Printer size={14} /> Print
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          {isPersonalView ? (
            /* Personal Reviewee View */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 space-y-4">
                <div className="flex flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-950 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-slate-900 dark:bg-slate-800 p-3 text-white">
                      <Award size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Weighted Score</p>
                      <p className="text-2xl font-black text-slate-900 dark:text-white">{legacyTotalPercentage.toFixed(2)}%</p>
                      <p className="text-xs font-bold text-slate-500 mt-0.5">{legacyTotalEarned} / {legacyTotalPossible}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black ${styles.badge}`}>
                    {performance.label}
                  </span>
                </div>
              </div>
              <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Category</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(legacyBreakdown || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="px-4 py-3 text-xs font-bold text-slate-900 dark:text-white">{item.label}</td>
                        <td className="px-4 py-3 text-right text-xs font-black text-slate-700 dark:text-slate-300">{item.score.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : contributionBreakdown ? (
            /* Admin & Staff Aggregate School Contribution Breakdown */
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Overall Rating</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{contributionBreakdown.majorAreaRating.toFixed(2)}%</p>
                  <span className={`inline-block mt-2 rounded-full px-2 py-0.5 text-[9px] font-black ${styles.badge}`}>
                    {performance.label}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Included Categories</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{contributionBreakdown.categories.length}</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-2">Active evaluation types</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Included Schools</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{contributionBreakdown.schoolCount}</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-2">Normalized school branches</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Included Reviewees</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{contributionBreakdown.revieweeCount}</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-2">Enrolled & evaluated</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950 shadow-xs col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Weight Total</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{contributionBreakdown.categoryWeightTotal.toFixed(2)}%</p>
                  <p className={`text-[10px] font-bold mt-2 ${Math.abs(contributionBreakdown.categoryWeightTotal - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {Math.abs(contributionBreakdown.categoryWeightTotal - 100) < 0.01 ? '✓ Valid Total (100%)' : '⚠ Must total 100%'}
                  </p>
                </div>
              </div>

              {/* Aggregation Selector & Weight Warning */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Aggregation Method:</span>
                  <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-1">
                    <button
                      onClick={() => setAggregationMethod('Reviewee-Weighted Average')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${aggregationMethod === 'Reviewee-Weighted Average' ? 'bg-slate-900 text-white dark:bg-teal-600 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                      Reviewee-Weighted Average (Recommended)
                    </button>
                    <button
                      onClick={() => setAggregationMethod('Equal School Average')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${aggregationMethod === 'Equal School Average' ? 'bg-slate-900 text-white dark:bg-teal-600 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                      Equal School Average
                    </button>
                  </div>
                </div>

                {Math.abs(contributionBreakdown.categoryWeightTotal - 100) >= 0.01 && (
                  <div className="flex items-center gap-2 text-amber-800 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-3 py-1.5 rounded-xl text-xs font-bold">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Category weights must total 100.00%. Current Total: {contributionBreakdown.categoryWeightTotal.toFixed(2)}%</span>
                  </div>
                )}
              </div>

              {/* Main Category Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Category Contributions & School Breakdown
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Click &quot;View Schools&quot; on any category to inspect individual school ratings, shares, and contributions.
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3.5">Category</th>
                          <th className="px-3 py-3.5 text-center">Weight</th>
                          <th className="px-3 py-3.5 text-right">Category Rating</th>
                          <th className="px-4 py-3.5">School Breakdown Summary</th>
                          <th className="px-4 py-3.5 text-right">Weighted Contribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {contributionBreakdown.categories.map((cat) => {
                          const isExpanded = !!expandedCategories[cat.categoryId];
                          const hasSchools = cat.schools.length > 0;

                          return (
                            <React.Fragment key={cat.categoryId}>
                              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => toggleCategoryExpand(cat.categoryId)}
                                      disabled={!hasSchools}
                                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase transition-colors cursor-pointer ${hasSchools ? 'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-300' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                    >
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      {isExpanded ? 'Hide' : 'View'} {cat.schools.length} Schools
                                    </button>
                                    <span>{cat.categoryName}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center font-black text-slate-700 dark:text-slate-300">
                                  {cat.categoryWeight.toFixed(2)}%
                                </td>
                                <td className="px-3 py-3 text-right font-black text-slate-900 dark:text-white">
                                  {cat.categoryRating.toFixed(2)}%
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                  {hasSchools ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {cat.schools.map(s => (
                                        <span key={s.schoolId} className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                                          {s.schoolId}: <strong className="text-teal-700 dark:text-teal-400">{s.majorAreaContribution.toFixed(2)}%</strong>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">No score data</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-[#007C89] dark:text-teal-400 text-sm">
                                  {cat.weightedContribution.toFixed(2)}%
                                </td>
                              </tr>

                              {/* Expanded School Details Table Row */}
                              {isExpanded && hasSchools && (
                                tr({
                                  colSpan: 5,
                                  className: "bg-slate-50/80 dark:bg-slate-900/60 p-4 border-y border-slate-200 dark:border-slate-800"
                                })
                              )}
                              {isExpanded && hasSchools && (
                                <tr className="bg-slate-50/90 dark:bg-slate-900/80">
                                  <td colSpan={5} className="p-4 sm:p-5">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-xs">
                                      <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                                          School Breakdown for {cat.categoryName} (Weight: {cat.categoryWeight.toFixed(2)}%, Category Rating: {cat.categoryRating.toFixed(2)}%)
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-500">
                                          Total Earned: {cat.categoryEarned} / Possible: {cat.categoryPossible}
                                        </span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-[11px]">
                                          <thead className="bg-slate-50/60 dark:bg-slate-900/50 font-black text-slate-500 uppercase">
                                            <tr>
                                              <th className="px-3 py-2.5">School</th>
                                              <th className="px-3 py-2.5 text-center">Reviewees</th>
                                              <th className="px-3 py-2.5 text-center">Earned</th>
                                              <th className="px-3 py-2.5 text-center">Possible</th>
                                              <th className="px-3 py-2.5 text-right">School Rating</th>
                                              <th className="px-3 py-2.5 text-right">Category Share</th>
                                              <th className="px-3 py-2.5 text-right">Cat. Contribution</th>
                                              <th className="px-3 py-2.5 text-right">Major Area Contribution</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {cat.schools.map(s => (
                                              <tr key={s.schoolId} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                                                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                                                  {s.schoolName}
                                                </td>
                                                <td className="px-3 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">
                                                  {s.revieweeCount}
                                                </td>
                                                <td className="px-3 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">
                                                  {s.earned}
                                                </td>
                                                <td className="px-3 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">
                                                  {s.possible}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-black text-slate-800 dark:text-slate-200">
                                                  {s.schoolRating.toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-400">
                                                  {s.schoolShare.toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                                                  {s.categoryContribution.toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-black text-[#007C89] dark:text-teal-400">
                                                  {s.majorAreaContribution.toFixed(2)}%
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      {/* Total Row */}
                      <tfoot className="bg-slate-100 dark:bg-slate-900 font-black text-slate-900 dark:text-white">
                        <tr>
                          <td className="px-4 py-3.5 uppercase">TOTAL</td>
                          <td className="px-3 py-3.5 text-center">{contributionBreakdown.categoryWeightTotal.toFixed(2)}%</td>
                          <td className="px-3 py-3.5 text-right">—</td>
                          <td className="px-4 py-3.5">—</td>
                          <td className="px-4 py-3.5 text-right text-base text-[#007C89] dark:text-teal-400">
                            {contributionBreakdown.majorAreaRating.toFixed(2)}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* School Contribution Summary Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    School Total Contribution Summary
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Combined final weighted contributions across all categories for each school.
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">School</th>
                          {contributionBreakdown.categories.map(c => (
                            <th key={c.categoryId} className="px-3 py-3 text-right">{c.categoryName}</th>
                          ))}
                          <th className="px-4 py-3 text-right">Total Contribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {contributionBreakdown.schoolSummary.map(school => (
                          <tr key={school.schoolId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                              {school.schoolId}
                            </td>
                            {contributionBreakdown.categories.map(c => {
                              const val = school.categoryContributions[c.categoryId] || 0;
                              return (
                                <td key={c.categoryId} className="px-3 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                  {val.toFixed(2)}%
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-right font-black text-[#007C89] dark:text-teal-400 text-sm">
                              {school.totalContribution.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 dark:bg-slate-900 font-black text-slate-900 dark:text-white">
                        <tr>
                          <td className="px-4 py-3 uppercase">TOTAL</td>
                          {contributionBreakdown.categories.map(c => {
                            const catTotal = c.schools.reduce((sum, s) => sum + s.majorAreaContribution, 0);
                            return (
                              <td key={c.categoryId} className="px-3 py-3 text-right">
                                {catTotal.toFixed(2)}%
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right text-base text-[#007C89] dark:text-teal-400">
                            {contributionBreakdown.majorAreaRating.toFixed(2)}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm font-bold">No valid score data is available for this Major Area.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info size={14} className="shrink-0 text-teal-600" />
            <span>Calculation formula: School Rating × Share × Category Weight = Major Area Contribution.</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 cursor-pointer transition-all shadow-xs"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}

function tr(props: any) {
  return null;
}
