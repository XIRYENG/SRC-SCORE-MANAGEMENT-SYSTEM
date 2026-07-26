import React from 'react';
import { X } from 'lucide-react';
import { BoardSubjectAreaScoreTable } from './BoardSubjectAreaScoreTable';
import { DailyEvaluationSubjectTable } from './DailyEvaluationSubjectTable';
import { ScoreSummaryMetrics } from './ScoreSummaryMetrics';
import { normalizeScoreCategory } from '../../utils/scoreFieldResolver';

export type ScoreMatrixCell = {
  earned: number;
  total: number;
};

export type ScoreMatrixRow = {
  area: string;
  cellsByDateId: Record<string, ScoreMatrixCell>;
  aggregate: {
    totalEarned: number;
    totalPossible: number;
    rating: number | null;
    completedCount: number;
    missingCount: number;
  };
};

export function BoardSubjectAreaScoresModal({
  isOpen,
  onClose,
  area,
  rows,
  dates,
  selectedCategory,
  onCategoryChange,
  categories,
  onAreaChange,
  scoresBySubjectAndDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  area: string;
  rows: ScoreMatrixRow[];
  dates: { id: string; date: string; label: string }[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  categories: string[];
  onAreaChange?: (area: string) => void;
  scoresBySubjectAndDate?: Record<string, Record<string, { earned: number | null; possible: number | null }>>;
}) {
  if (!isOpen) return null;

  const isDailyEval = normalizeScoreCategory(selectedCategory) === 'dailyevaluation';
  const highlightedRow = rows.find(r => r.area === area);
  const overallRating = highlightedRow?.aggregate.rating || 0;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-black text-slate-900">{area} Scores – Board Subject Area Scores</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <ScoreSummaryMetrics metrics={[
            { label: 'Selected Category', value: selectedCategory },
            { label: 'Examination Dates', value: dates.length.toString() },
            { label: 'Completed Scores', value: `${highlightedRow?.aggregate.completedCount || 0} of ${dates.length}` },
            { label: 'Overall Category Rating', value: `${overallRating.toFixed(2)}%` },
          ]} />
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${selectedCategory === cat ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {isDailyEval ? (
            <DailyEvaluationSubjectTable
              areaCode={area}
              dates={dates}
              scoresBySubjectAndDate={scoresBySubjectAndDate || {}}
            />
          ) : (
            <BoardSubjectAreaScoreTable 
              rows={rows} 
              dates={dates} 
              selectedCategory={selectedCategory}
              onRowClick={onAreaChange || (() => {})}
              highlightedArea={area}
            />
          )}
        </div>
      </div>
    </div>
  );
}
