import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Info, MoreVertical, Eye, Pencil, ChevronDown, CheckCircle2 } from 'lucide-react';
import { CurriculumSubject, getSubjectsByArea, MajorAreaCode } from '../../config/criminologyCurriculum';
import { calculateDailyEvaluationAggregate } from '../../lib/dailyEvaluationCalculations';
import { RevieweeData } from '../../types';
import { CompactEditableScoreCell } from '../CompactEditableScoreCell';

import { getCanonicalFullName } from '../../utils/nameNormalization';

export type DailyEvalRevieweeRow = {
  user: RevieweeData;
  subjectScores: Record<string, { earned: number | null; possible: number | null }>;
  isPublished?: boolean;
};

export function DailyEvaluationRevieweeMatrix({
  areaCode,
  evaluationDate,
  revieweeRows,
  selectedUserIds,
  onToggleSelectAll,
  onToggleSelectUser,
  onViewDetails,
  onUpdateScore,
  sortField,
  sortDirection,
  onSort,
}: {
  areaCode: MajorAreaCode | string;
  evaluationDate: string;
  revieweeRows: DailyEvalRevieweeRow[];
  selectedUserIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectUser: (userId: string) => void;
  onViewDetails?: (user: RevieweeData) => void;
  onUpdateScore?: (user: RevieweeData, subjectCode: string, earned: number | null, possible: number) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  const subjects = getSubjectsByArea(areaCode);

  const getFormattedName = (user: RevieweeData) => {
    const last = (user.last_name || '').trim();
    const first = (user.first_name || '').trim();
    const middle = (user.middle_name || '').trim();
    const middleInitial = middle ? `${middle.charAt(0)}.` : '';
    return `${last}, ${first} ${middleInitial}`.trim().replace(/\s+/g, ' ');
  };

  const allSelected = revieweeRows.length > 0 && selectedUserIds.length === revieweeRows.length;

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return (
        <span className="text-slate-300 group-hover:text-slate-400 ml-1 inline-flex shrink-0">
          <ChevronDown size={14} className="opacity-40" />
        </span>
      );
    }
    return (
      <span className="text-teal-600 bg-teal-50 p-0.5 rounded ml-1 inline-flex shrink-0">
        {sortDirection === 'desc' ? (
          <ChevronDown size={14} className="rotate-180" />
        ) : (
          <ChevronDown size={14} />
        )}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Table Container */}
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm relative">
        <table className="w-full text-xs text-left text-slate-700 border-collapse">
          <thead className="text-[10px] text-slate-500 uppercase font-black bg-slate-100/90 border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 w-10 text-center sticky left-0 bg-slate-100 z-30">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
              </th>
              <th className="px-3 py-3 sticky left-10 bg-slate-100 z-30 min-w-[110px] border-r border-slate-200">
                <button
                  type="button"
                  onClick={() => onSort('id')}
                  title="Sort by ID Number"
                  className="flex items-center gap-1.5 hover:text-teal-700 transition-colors group cursor-pointer w-full text-left"
                >
                  ID Number
                  {renderSortIcon('id')}
                </button>
              </th>
              <th className="px-3 py-3 sticky left-[150px] bg-slate-100 z-30 min-w-[180px] border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                <button 
                  type="button" 
                  onClick={() => onSort('name')}
                  title="Sort by Reviewee Name"
                  className="flex items-center gap-1.5 hover:text-teal-700 transition-colors group cursor-pointer w-full text-left"
                >
                  Reviewee
                  {renderSortIcon('name')}
                </button>
              </th>

              {/* Dynamic Subject Headers */}
              {subjects.map((s) => (
                <th
                  key={s.id}
                  className="px-3 py-3 text-center min-w-[115px] border-r border-slate-200 relative group"
                >
                  <button
                    type="button"
                    onClick={() => onSort(s.subjectCode)}
                    onMouseEnter={() => setActiveTooltip(s.id)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onFocus={() => setActiveTooltip(s.id)}
                    onBlur={() => setActiveTooltip(null)}
                    title={`Sort by ${s.subjectCode} - ${s.subjectName}`}
                    className="flex flex-col items-center justify-center gap-0.5 mx-auto hover:text-teal-700 transition-colors cursor-pointer w-full"
                  >
                    <span className="font-black text-teal-800 text-xs flex items-center justify-center gap-1">
                      {s.subjectCode} {renderSortIcon(s.subjectCode)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium normal-case truncate max-w-[95px]">
                      {s.subjectName}
                    </span>
                  </button>

                  {/* Tooltip on Hover / Focus */}
                  {activeTooltip === s.id && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 w-56 p-2.5 bg-slate-900 text-white rounded-xl shadow-xl text-[11px] font-medium leading-tight pointer-events-none normal-case text-left"
                    >
                      <div className="font-bold text-teal-400 mb-0.5">{s.subjectCode}</div>
                      <div>{s.subjectName}</div>
                    </motion.div>
                  )}
                </th>
              ))}

              <th className="px-3 py-3 text-center min-w-[100px] bg-slate-200/60 font-black text-slate-800 border-r border-slate-200">
                <button
                  type="button"
                  onClick={() => onSort('combined')}
                  title="Sort by Combined Score"
                  className="flex items-center justify-center gap-1 mx-auto hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Combined
                  {renderSortIcon('combined')}
                </button>
              </th>
              <th className="px-3 py-3 text-center min-w-[90px] bg-teal-100/60 text-teal-900 font-black border-r border-slate-200">
                <button
                  type="button"
                  onClick={() => onSort('rating')}
                  title="Sort by Rating"
                  className="flex items-center justify-center gap-1 mx-auto hover:text-teal-900 transition-colors cursor-pointer"
                >
                  Rating
                  {renderSortIcon('rating')}
                </button>
              </th>
              <th className="px-3 py-3 text-center min-w-[90px] border-r border-slate-200">
                <button
                  type="button"
                  onClick={() => onSort('status')}
                  title="Sort by Status"
                  className="flex items-center justify-center gap-1 mx-auto hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Status
                  {renderSortIcon('status')}
                </button>
              </th>
              <th className="px-3 py-3 text-center w-12 sticky right-0 bg-slate-100 z-30">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {revieweeRows.length === 0 ? (
              <tr>
                <td colSpan={subjects.length + 7} className="px-6 py-12 text-center text-slate-400 text-xs font-semibold">
                  No reviewees found for the selected filter criteria.
                </td>
              </tr>
            ) : (
              revieweeRows.map(({ user, subjectScores, isPublished }, idx) => {
                const userAny = user as any;
                const userId = userAny.id || user.uid || userAny.doc_id || '';
                const isSelected = selectedUserIds.includes(userId);

                // Build scores list for aggregate calculation
                const scoreEntries = subjects.map((s) => {
                  const entry = subjectScores[s.subjectCode] || subjectScores[s.id];
                  return {
                    earned: entry?.earned ?? null,
                    possible: entry?.possible ?? 100,
                  };
                });

                const aggregate = calculateDailyEvaluationAggregate(scoreEntries);

                return (
                  <tr
                    key={userId ? `${userId}_${idx}` : `row_${idx}`}
                    className={`hover:bg-slate-50/90 transition-colors ${
                      isSelected ? 'bg-teal-50/40' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center sticky left-0 bg-white z-20">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectUser(userId)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </td>

                    {/* ID Number */}
                    <td className="px-3 py-3 sticky left-10 bg-white z-20 font-bold text-slate-600 border-r border-slate-100 text-xs font-mono">
                      {user.id_number || userAny.seqId || userAny.seq_id || userAny.idNumber || userAny.student_id || userAny.revieweeId || userAny.id || user.uid || '—'}
                    </td>

                    {/* Reviewee Name */}
                    <td className="px-3 py-3 sticky left-[150px] bg-white z-20 font-bold text-slate-900 border-r border-slate-100 shadow-[2px_0_4px_rgba(0,0,0,0.04)] truncate max-w-[200px]">
                      {getFormattedName(user) || user.name || 'Unnamed Reviewee'}
                    </td>

                    {/* Subject Cells */}
                    {subjects.map((s) => {
                      const entry = subjectScores[s.subjectCode] || subjectScores[s.id];
                      const earned = entry?.earned ?? null;
                      const possible = earned !== null ? (entry?.possible && entry.possible > 0 ? entry.possible : 100) : 0;

                      return (
                        <td key={s.id} className="px-2 py-2 text-center border-r border-slate-100 min-w-[100px]">
                          {onUpdateScore ? (
                            <CompactEditableScoreCell
                              reviewee={user}
                              category="Daily Evaluation"
                              subject={s.subjectCode}
                              isAreaActivated={true}
                              canEditScores={true}
                              onEdit={(data) => {
                                onUpdateScore(user, s.subjectCode, data.currentScore, data.possiblePoints || possible || 100);
                              }}
                            />
                          ) : earned !== null ? (
                            <span className="font-bold text-slate-800">
                              {earned}/{possible}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">___/0</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Combined Score */}
                    <td className="px-3 py-3 text-center font-bold text-slate-800 bg-slate-50/80 border-r border-slate-100 whitespace-nowrap">
                      {aggregate.combinedFormatted}
                    </td>

                    {/* Rating Percentage */}
                    <td className="px-3 py-3 text-center font-black text-teal-700 bg-teal-50/50 border-r border-slate-100 whitespace-nowrap">
                      {aggregate.ratingFormatted}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 text-center border-r border-slate-100 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isPublished
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isPublished ? (
                          <>
                            <CheckCircle2 size={10} /> Published
                          </>
                        ) : (
                          'Draft'
                        )}
                      </span>
                    </td>

                    {/* Action Menu */}
                    <td className="px-2 py-3 text-center sticky right-0 bg-white z-20 relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuUserId(activeMenuUserId === userId ? null : userId)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <MoreVertical size={15} />
                      </button>

                      {activeMenuUserId === userId && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setActiveMenuUserId(null)} />
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-slate-100 text-left">
                            {onViewDetails && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  onViewDetails(user);
                                }}
                                className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Eye size={13} className="text-teal-600" /> View Profile
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
