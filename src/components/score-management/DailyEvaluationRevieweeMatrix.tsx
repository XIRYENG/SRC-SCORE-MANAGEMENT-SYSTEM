import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Info, MoreVertical, Eye, Pencil, ChevronDown, CheckCircle2, X, RefreshCw, FileText, Settings2 } from 'lucide-react';
import { CurriculumSubject, getSubjectsByArea, MajorAreaCode, MAJOR_AREAS } from '../../config/criminologyCurriculum';
import { calculateDailyEvaluationAggregate } from '../../lib/dailyEvaluationCalculations';
import { RevieweeData } from '../../types';

function normalizeDateString(dateStr: any): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (e) {}
  return trimmed;
}

function normalizeIndividualSubjectCode(subj: string): string {
  return String(subj || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function normalizeScoreCategory(category: string): string {
  return String(category || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export type DailyEvalRevieweeRow = {
  user: RevieweeData;
  subjectScores: Record<string, { earned: number | null; possible: number | null }>;
  isPublished?: boolean;
};

type ColumnDef = {
  id: string;
  eventExists: boolean;
  subject: CurriculumSubject;
  event?: any;
  evaluationDate?: string;
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
  scoreEvents = [],
  scoreFolderId = 'main',
  showArchived = false,
  hiddenSubjectIds: propHiddenSubjectIds,
  setHiddenSubjectIds: propSetHiddenSubjectIds,
  onEditColumnDate,
  onEditTotalItems,
  onPublishColumn,
  onHideColumn,
  onArchiveColumn,
  onUnarchiveColumn,
  onDeleteColumn,
  onAddScoreToExisting,
  onAddFirstScoreForSubject,
}: {
  areaCode: MajorAreaCode | string;
  evaluationDate: string;
  revieweeRows: DailyEvalRevieweeRow[];
  selectedUserIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectUser: (userId: string) => void;
  onViewDetails?: (user: RevieweeData) => void;
  onUpdateScore?: (user: RevieweeData, subjectCode: string, earned: number | null, possible: number, eventObj?: any) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  scoreEvents?: any[];
  scoreFolderId?: string;
  showArchived?: boolean;
  hiddenSubjectIds?: Set<string>;
  setHiddenSubjectIds?: (val: Set<string>) => void;
  onEditColumnDate?: (evt: any) => void;
  onEditTotalItems?: (evt: any) => void;
  onPublishColumn?: (evt: any) => void;
  onHideColumn?: (evt: any) => void;
  onArchiveColumn?: (evt: any) => void;
  onUnarchiveColumn?: (evt: any) => void;
  onDeleteColumn?: (evt: any) => void;
  onAddScoreToExisting?: (user: RevieweeData, evt: any) => void;
  onAddFirstScoreForSubject?: (subjectCode: string) => void;
}) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [activeHeaderMenuId, setActiveHeaderMenuId] = useState<string | null>(null);
  const [internalHiddenSubjectIds, setInternalHiddenSubjectIds] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const hiddenSubjectIds = propHiddenSubjectIds || internalHiddenSubjectIds;
  const setHiddenSubjectIds = propSetHiddenSubjectIds || setInternalHiddenSubjectIds;

  // Get active Major Area title
  const majorAreaFullName = useMemo(() => {
    return MAJOR_AREAS.find(a => a.code === areaCode)?.title || 'Major Area';
  }, [areaCode]);

  // Get curriculum subjects for selected Major Area
  const subjects = useMemo(() => {
    return getSubjectsByArea(areaCode);
  }, [areaCode]);

  // Generate 3-level spreadsheet column definitions
  const { flatColumns, subjectColumnsMap, totalSubjectColumns, visibleSubjects } = useMemo(() => {
    const flat: ColumnDef[] = [];
    const mapping: Record<string, ColumnDef[]> = {};
    const visibleSubjs = subjects.filter(s => !hiddenSubjectIds.has(s.id));

    // Filter relevant score events for Daily Evaluation
    const dailyEvents = scoreEvents.filter(evt => {
      const isSameFolder = (evt.scoreFolderId || 'main') === (scoreFolderId || 'main');
      const isSameCat = normalizeScoreCategory(evt.category || '') === 'dailyevaluation';
      const isSameArea = String(evt.majorAreaId || '').toLowerCase().trim() === String(areaCode).toLowerCase().trim();
      
      // If showArchived is true, show ONLY archived columns. If false, show ONLY active columns.
      const archivedStatus = evt.isArchived === true;
      const matchesArchiveFilter = showArchived ? archivedStatus : !archivedStatus;
      
      return isSameFolder && isSameCat && isSameArea && matchesArchiveFilter;
    });

    visibleSubjs.forEach(subj => {
      // Find all evaluation events for this subject
      const subjEvents = dailyEvents.filter(evt => {
        const evtSubjId = normalizeIndividualSubjectCode(evt.subjectId || evt.subjectName || '');
        const targetSubjId = normalizeIndividualSubjectCode(subj.subjectCode);
        return evtSubjId === targetSubjId;
      }).sort((a, b) => {
        return new Date(a.evaluationDate).getTime() - new Date(b.evaluationDate).getTime();
      });

      // Filter by evaluationDate if the user selected a specific date (not 'All Dates')
      const filteredEvents = evaluationDate === 'All Dates'
        ? subjEvents
        : subjEvents.filter(evt => normalizeDateString(evt.evaluationDate) === normalizeDateString(evaluationDate));

      if (filteredEvents.length === 0) {
        // Render a single placeholder column displaying a dash
        const placeholderCol: ColumnDef = {
          id: `${subj.id}_none`,
          eventExists: false,
          subject: subj
        };
        flat.push(placeholderCol);
        mapping[subj.id] = [placeholderCol];
      } else {
        const cols = filteredEvents.map(evt => ({
          id: evt.id,
          eventExists: true,
          subject: subj,
          event: evt,
          evaluationDate: normalizeDateString(evt.evaluationDate)
        }));
        flat.push(...cols);
        mapping[subj.id] = cols;
      }
    });

    return {
      flatColumns: flat,
      subjectColumnsMap: mapping,
      totalSubjectColumns: flat.length,
      visibleSubjects: visibleSubjs
    };
  }, [subjects, scoreEvents, scoreFolderId, areaCode, evaluationDate, hiddenSubjectIds]);

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
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm relative max-h-[70vh]">
        <table className="w-full text-xs text-left text-slate-700 border-collapse">
          <thead className="text-[10px] text-slate-500 uppercase font-black bg-slate-100/90 border-b border-slate-200">
            {/* LEVEL 1 HEADER */}
            <tr className="bg-slate-100 border-b border-slate-200">
              <th rowSpan={3} className="px-3 py-3 w-10 text-center sticky left-0 bg-slate-100 z-30 border-r border-slate-200">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
              </th>
              <th rowSpan={3} className="px-3 py-3 sticky left-10 bg-slate-100 z-30 min-w-[110px] border-r border-slate-200">
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
              <th rowSpan={3} className="px-3 py-3 sticky left-[150px] bg-slate-100 z-30 min-w-[180px] border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
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

              {/* Major Area Spanning All Subject Columns */}
              <th colSpan={totalSubjectColumns} className={`px-3 py-2.5 text-center bg-teal-50 border-r border-b border-slate-200 text-teal-900 font-extrabold text-sm tracking-wide relative ${showColumnSelector ? 'z-50' : 'z-10'}`}>
                <div className="flex items-center justify-center gap-3">
                  <span>{majorAreaFullName} ({areaCode})</span>
                  
                  {/* Column Visibility Selector */}
                  <div className="relative inline-block text-left">
                    <button
                      type="button"
                      onClick={() => setShowColumnSelector(!showColumnSelector)}
                      className={`p-1 rounded-md transition-all border ${
                        showColumnSelector 
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm' 
                          : 'bg-white border-teal-200 text-teal-600 hover:bg-teal-50'
                      }`}
                      title="Show/Hide Columns"
                    >
                      <Settings2 size={14} />
                    </button>

                    {showColumnSelector && (
                      <AnimatePresence>
                        <div className="fixed inset-0 z-40" onClick={() => setShowColumnSelector(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-left"
                        >
                          <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Subject Visibility</span>
                            <button 
                              onClick={() => setHiddenSubjectIds(new Set())}
                              className="text-[9px] font-black text-teal-600 hover:text-teal-700 uppercase"
                            >
                              Reset All
                            </button>
                          </div>
                          <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                            {subjects.map(s => {
                              const isVisible = !hiddenSubjectIds.has(s.id);
                              return (
                                <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={() => {
                                      const next = new Set(hiddenSubjectIds);
                                      if (isVisible) next.add(s.id);
                                      else next.delete(s.id);
                                      setHiddenSubjectIds(next);
                                    }}
                                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-800">{s.subjectCode}</span>
                                    <span className="text-[9px] text-slate-400 truncate w-44">{s.subjectName}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </th>

              <th rowSpan={3} className="px-3 py-3 text-center min-w-[100px] bg-slate-200/60 font-black text-slate-800 border-r border-slate-200 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => onSort('combined')}
                  title="Sort by Combined Score"
                  className="flex items-center justify-center gap-1 mx-auto hover:text-slate-700 transition-colors cursor-pointer font-bold"
                >
                  Combined
                  {renderSortIcon('combined')}
                </button>
              </th>
              <th rowSpan={3} className="px-3 py-3 text-center min-w-[90px] bg-teal-100/60 text-teal-900 font-black border-r border-slate-200 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => onSort('rating')}
                  title="Sort by Rating"
                  className="flex items-center justify-center gap-1 mx-auto hover:text-teal-900 transition-colors cursor-pointer font-bold"
                >
                  Rating
                  {renderSortIcon('rating')}
                </button>
              </th>
              <th rowSpan={3} className="px-3 py-3 text-center min-w-[90px] border-r border-slate-200 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => onSort('status')}
                  title="Sort by Status"
                  className="flex items-center justify-center gap-1 mx-auto hover:text-slate-700 transition-colors cursor-pointer font-bold"
                >
                  Status
                  {renderSortIcon('status')}
                </button>
              </th>
              <th rowSpan={3} className="px-3 py-3 text-center w-12 sticky right-0 bg-slate-100 z-30 border-b border-slate-200">
                Action
              </th>
            </tr>

            {/* LEVEL 2 HEADER: Curriculum Subjects */}
            <tr className="bg-slate-50 border-b border-slate-200">
              {visibleSubjects.map(s => {
                const cols = subjectColumnsMap[s.id] || [];
                return (
                  <th
                    key={s.id}
                    colSpan={cols.length}
                    className="px-2 py-2 text-center border-r border-slate-200 font-extrabold text-slate-700 text-[10px] bg-slate-50 relative group"
                  >
                    <div 
                      onMouseEnter={() => setActiveTooltip(s.id)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onFocus={() => setActiveTooltip(s.id)}
                      onBlur={() => setActiveTooltip(null)}
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-slate-950 font-black">{s.subjectCode}</span>
                      <span className="text-[8px] text-slate-400 font-medium normal-case truncate max-w-[110px]">
                        {s.subjectName}
                      </span>
                    </div>

                    {/* Tooltip */}
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
                );
              })}
            </tr>

            {/* LEVEL 3 HEADER: Evaluation Dates or Dash placeholder */}
            <tr className="bg-slate-100/80 border-b border-slate-200">
              {flatColumns.map(col => {
                if (!col.eventExists) {
                  return (
                    <th key={col.id} className="px-2 py-1.5 text-center text-slate-400 font-bold text-[10px] border-r border-slate-200 min-w-[90px] bg-slate-100">
                      <button
                        type="button"
                        onClick={() => onAddFirstScoreForSubject && onAddFirstScoreForSubject(col.subject.subjectCode)}
                        className="text-slate-400 hover:text-teal-600 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer inline-flex items-center gap-0.5 font-bold"
                        title="Click to create an evaluation for this subject"
                      >
                        —
                      </button>
                    </th>
                  );
                } else {
                  const evt = col.event;
                  const isPublished = evt.publicationStatus === 'published';
                  return (
                    <th key={col.id} className={`px-2 py-1 text-center text-slate-800 font-bold border-r border-slate-200 min-w-[110px] bg-slate-50 relative group ${sortField === evt.id ? 'bg-teal-50' : ''}`}>
                      <div className="flex items-center justify-center gap-1 mx-auto">
                        <button
                          type="button"
                          onClick={() => onSort(evt.id)}
                          className="hover:text-teal-700 transition-colors font-extrabold flex items-center gap-0.5 text-[10px] cursor-pointer"
                          title={`Sort by evaluation on ${col.evaluationDate}`}
                        >
                          {col.evaluationDate}
                          {renderSortIcon(evt.id)}
                        </button>
                        
                        {/* Compact actions dropdown */}
                        <div className="relative inline-block text-left ml-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveHeaderMenuId(activeHeaderMenuId === evt.id ? null : evt.id);
                            }}
                            className={`p-1 rounded-md transition-all cursor-pointer border ${
                              activeHeaderMenuId === evt.id 
                                ? 'bg-teal-600 text-white border-teal-600 shadow-sm' 
                                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                            title="Column Options"
                          >
                            <MoreVertical size={12} strokeWidth={2.5} />
                          </button>
                          
                          {activeHeaderMenuId === evt.id && (
                            <AnimatePresence>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveHeaderMenuId(null)} />
                              <motion.div 
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 text-left normal-case font-semibold"
                              >
                                <div className="px-3 py-1.5 text-[9px] text-slate-400 uppercase tracking-wider font-extrabold bg-slate-50">
                                  Column Actions
                                </div>
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveHeaderMenuId(null);
                                      onEditColumnDate && onEditColumnDate(evt);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-bold"
                                  >
                                    <Pencil size={12} className="text-blue-500" /> Edit Date
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveHeaderMenuId(null);
                                      onEditTotalItems && onEditTotalItems(evt);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-bold"
                                  >
                                    <Info size={12} className="text-indigo-500" /> Edit Total Items
                                  </button>
                                </div>
                                <div className="py-1">
                                  {isPublished ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveHeaderMenuId(null);
                                        onHideColumn && onHideColumn(evt);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-bold"
                                    >
                                      <X size={12} className="text-amber-500" /> Hide scores
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveHeaderMenuId(null);
                                        onPublishColumn && onPublishColumn(evt);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-bold"
                                    >
                                      <Check size={12} className="text-emerald-500" /> Publish scores
                                    </button>
                                  )}
                                  {showArchived ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveHeaderMenuId(null);
                                        onUnarchiveColumn && onUnarchiveColumn(evt);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer font-bold transition-colors"
                                    >
                                      <RefreshCw size={12} className="text-emerald-500" /> Unarchive column
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveHeaderMenuId(null);
                                        onArchiveColumn && onArchiveColumn(evt);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-bold"
                                    >
                                      <span className="text-[11px]">📦</span> Archive column
                                    </button>
                                  )}
                                </div>
                                <div className="py-1 bg-rose-50/50">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveHeaderMenuId(null);
                                      onDeleteColumn && onDeleteColumn(evt);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-100 flex items-center gap-2 cursor-pointer font-bold"
                                  >
                                    <span className="text-[11px]">🗑️</span> Delete Column
                                  </button>
                                </div>
                              </motion.div>
                            </AnimatePresence>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-[8px] font-bold text-slate-400 mt-0.5">
                        Items: {evt.totalItems || 100} • <span className={isPublished ? "text-emerald-600" : "text-amber-600"}>{evt.publicationStatus}</span>
                      </div>
                    </th>
                  );
                }
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {revieweeRows.length === 0 ? (
              <tr>
                <td colSpan={totalSubjectColumns + 7} className="px-6 py-12 text-center text-slate-400 text-xs font-semibold">
                  No reviewees found for the selected filter criteria.
                </td>
              </tr>
            ) : (
              revieweeRows.map(({ user }, idx) => {
                const userAny = user as any;
                const userId = userAny.id || user.uid || userAny.doc_id || '';
                const isSelected = selectedUserIds.includes(userId);

                // Calculate Daily Evaluation aggregate strictly over the displayed active columns
                const activeEventScores = flatColumns
                  .filter(col => col.eventExists)
                  .map(col => {
                    const evt = col.event;
                    const record = user.assessmentRecords?.[evt.id] as any;
                    const earned = record?.score ?? record?.earnedPoints ?? null;
                    const possible = record?.totalScore ?? record?.possiblePoints ?? evt.totalItems ?? 100;
                    return { earned, possible };
                  });

                const aggregate = calculateDailyEvaluationAggregate(activeEventScores);

                return (
                  <tr
                    key={userId ? `${userId}_${idx}` : `row_${idx}`}
                    className={`hover:bg-slate-50/90 transition-colors ${
                      isSelected ? 'bg-teal-50/40' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center sticky left-0 bg-white z-20 border-r border-slate-100">
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
                    {flatColumns.map(col => {
                      if (!col.eventExists) {
                        return (
                          <td key={col.id} className="px-2 py-2 text-center border-r border-slate-100 text-slate-300 font-normal min-w-[90px]">
                            —
                          </td>
                        );
                      } else {
                        const evt = col.event;
                        const record = user.assessmentRecords?.[evt.id] as any;
                        const earned = record?.score ?? record?.earnedPoints ?? null;
                        const possible = record?.totalScore ?? record?.possiblePoints ?? evt.totalItems ?? 100;

                        if (earned !== null) {
                          return (
                            <td key={col.id} className="px-2 py-2 text-center border-r border-slate-100 min-w-[110px]">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateScore && onUpdateScore(user, col.subject.subjectCode, earned, possible, evt);
                                }}
                                className="font-extrabold text-slate-800 hover:text-teal-600 hover:bg-slate-100 px-2 py-1 rounded transition-colors cursor-pointer w-full text-center"
                              >
                                {earned}/{possible}
                              </button>
                            </td>
                          );
                        } else {
                          return (
                            <td key={col.id} className="px-2 py-2 text-center border-r border-slate-100 min-w-[110px]">
                              <button
                                type="button"
                                onClick={() => {
                                  onAddScoreToExisting && onAddScoreToExisting(user, evt);
                                }}
                                className="font-bold text-slate-300 hover:text-teal-600 hover:bg-slate-100 px-2 py-1 rounded transition-colors cursor-pointer w-full text-center"
                              >
                                __/{possible}
                              </button>
                            </td>
                          );
                        }
                      }
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
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          aggregate.validCount === flatColumns.filter(c => c.eventExists).length && flatColumns.filter(c => c.eventExists).length > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : aggregate.validCount > 0
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {aggregate.validCount === flatColumns.filter(c => c.eventExists).length && flatColumns.filter(c => c.eventExists).length > 0 ? (
                          <>
                            <CheckCircle2 size={10} /> Completed
                          </>
                        ) : aggregate.validCount > 0 ? (
                          'In Progress'
                        ) : (
                          'Not Started'
                        )}
                      </span>
                    </td>

                    {/* Action Menu */}
                    <td className="px-2 py-3 text-center sticky right-0 bg-white z-20 border-l border-slate-100 group-hover:bg-slate-50/50">
                      <button
                        type="button"
                        onClick={() => setActiveMenuUserId(activeMenuUserId === userId ? null : userId)}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          activeMenuUserId === userId 
                            ? 'bg-teal-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <MoreVertical size={15} />
                      </button>

                      {activeMenuUserId === userId && (
                        <AnimatePresence>
                          <div className="fixed inset-0 z-30" onClick={() => setActiveMenuUserId(null)} />
                          <motion.div 
                            initial={{ opacity: 0, x: 10, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-full mr-2 top-0 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-slate-100 text-left py-1"
                          >
                            <div className="px-3 py-2 bg-slate-50/50">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reviewee Actions</p>
                              <p className="text-xs font-bold text-slate-700 truncate">{getFormattedName(user)}</p>
                            </div>
                            {onViewDetails && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  onViewDetails(user);
                                }}
                                className="w-full px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Eye size={13} /> View Full Profile
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setActiveMenuUserId(null)}
                              className="w-full px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <FileText size={13} /> Performance Report
                            </button>
                          </motion.div>
                        </AnimatePresence>
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
