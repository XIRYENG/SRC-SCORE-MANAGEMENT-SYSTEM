import React from 'react';
import { CurriculumSubject, getSubjectsByArea, MajorAreaCode } from '../../config/criminologyCurriculum';
import { calculateDailyEvaluationAggregate } from '../../lib/dailyEvaluationCalculations';

export type RevieweeDateCol = {
  id: string;
  date: string;
  label: string;
};

export type RevieweeSubjectScoreMap = Record<string, { earned: number | null; possible: number | null }>;

export function DailyEvaluationSubjectTable({
  areaCode,
  dates,
  scoresBySubjectAndDate,
}: {
  areaCode: MajorAreaCode | string;
  dates: RevieweeDateCol[];
  /**
   * Outer key: subjectCode (e.g. "CLJ 1" or subject id)
   * Inner key: date id or raw date string
   */
  scoresBySubjectAndDate: Record<string, RevieweeSubjectScoreMap>;
}) {
  const subjects = getSubjectsByArea(areaCode);

  // Compute subject row aggregates and overall major area aggregate
  const allScoreEntries: { earned: number | null; possible: number | null }[] = [];

  const subjectRowsData = subjects.map((subj) => {
    const dateMap = scoresBySubjectAndDate[subj.subjectCode] || scoresBySubjectAndDate[subj.id] || {};
    
    const rowScores = dates.map((d) => {
      const entry = dateMap[d.id] || dateMap[d.date];
      return {
        earned: entry?.earned ?? null,
        possible: entry?.possible ?? null,
      };
    });

    rowScores.forEach((s) => allScoreEntries.push(s));

    const aggregate = calculateDailyEvaluationAggregate(rowScores);

    return {
      subj,
      dateMap,
      aggregate,
    };
  });

  const overallAggregate = calculateDailyEvaluationAggregate(allScoreEntries);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-xs text-left text-slate-700">
        <thead className="text-[10px] text-slate-300 uppercase font-black bg-slate-900 border-b border-slate-800">
          <tr>
            <th rowSpan={2} className="px-4 py-3 sticky left-0 bg-slate-900 z-20 min-w-[240px] shadow-[1px_0_0_0_rgba(255,255,255,0.1)]">
              Subject
            </th>
            <th colSpan={Math.max(1, dates.length)} className="px-4 py-3 text-center border-b border-slate-800">
              Evaluation Dates ({areaCode.toUpperCase()})
            </th>
            <th rowSpan={2} className="px-4 py-3 text-center bg-slate-800 z-10 shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
              Combined
            </th>
            <th rowSpan={2} className="px-4 py-3 text-center bg-slate-800 z-10 sticky right-0 shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
              Rating
            </th>
          </tr>
          <tr>
            {dates.length > 0 ? (
              dates.map((d) => (
                <th key={d.id} className="px-4 py-2 border-r border-slate-800 whitespace-nowrap text-center bg-slate-800/50">
                  {d.label}
                </th>
              ))
            ) : (
              <th className="px-4 py-2 border-r border-slate-800 text-center bg-slate-800/50">No Dates Available</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {subjectRowsData.map(({ subj, dateMap, aggregate }) => (
            <tr key={subj.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-semibold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100 min-w-[240px]">
                <span className="font-black text-teal-700 mr-2">{subj.subjectCode}</span>
                <span className="text-slate-700">{subj.subjectName}</span>
              </td>
              {dates.length > 0 ? (
                dates.map((d) => {
                  const entry = dateMap[d.id] || dateMap[d.date];
                  const hasScore = entry && entry.earned !== null && entry.earned !== undefined;
                  const possible = entry?.possible && entry.possible > 0 ? entry.possible : 0;
                  
                  return (
                    <td key={d.id} className="px-4 py-3 border-r border-slate-100 text-center font-medium whitespace-nowrap">
                      {hasScore ? (
                        <span className="text-slate-900 font-bold">
                          {entry.earned}/{entry.possible ?? 100}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-normal">___/0</span>
                      )}
                    </td>
                  );
                })
              ) : (
                <td className="px-4 py-3 border-r border-slate-100 text-center text-slate-300">—</td>
              )}
              <td className="px-4 py-3 font-bold text-center border-l border-slate-100 bg-slate-50/50 text-slate-800 whitespace-nowrap">
                {aggregate.combinedFormatted}
              </td>
              <td className="px-4 py-3 font-black text-center sticky right-0 bg-white z-10 border-l border-slate-100 text-teal-700 whitespace-nowrap">
                {aggregate.ratingFormatted}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-teal-50/70 font-black text-teal-950 text-xs border-t-2 border-teal-200">
          <tr>
            <td className="px-4 py-4 sticky left-0 bg-teal-50 z-10 border-r border-teal-200 uppercase tracking-wider font-black text-teal-900">
              Overall {areaCode.toUpperCase()}
            </td>
            <td colSpan={Math.max(1, dates.length)} className="px-4 py-4 text-right pr-6 uppercase tracking-wider text-slate-600 font-bold">
              Major Area Combined & Rating
            </td>
            <td className="px-4 py-4 text-center border-l border-teal-200 bg-teal-100/60 text-slate-900 font-black whitespace-nowrap">
              {overallAggregate.combinedFormatted}
            </td>
            <td className="px-4 py-4 text-center text-sm text-teal-800 bg-teal-100/80 sticky right-0 z-10 font-black border-l border-teal-200 whitespace-nowrap">
              {overallAggregate.ratingFormatted}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
