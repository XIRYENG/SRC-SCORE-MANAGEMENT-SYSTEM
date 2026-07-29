import React, { useState, useMemo } from 'react';
import { RevieweeData, ScoreFolder } from '../../types';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { isRevieweeInFolderScope } from '../../utils/folderScope';
import { MyScoresBoardSubjectAreas } from './MyScoresBoardSubjectAreas';
import { DailyEvaluationSubjectTable, RevieweeDateCol } from './DailyEvaluationSubjectTable';
import { calculateAggregatedAreaRating } from '../../lib/scoreCalculations';
import { normalizeScoreCategory, normalizeScoreSubject } from '../../utils/scoreFieldResolver';
import { ScoreRecord } from '../../utils/scoreParser';
import { getSubjectsByArea, MajorAreaCode, MAJOR_AREAS } from '../../config/criminologyCurriculum';
import { motion, AnimatePresence } from 'motion/react';

export function MyScoresPage({ revieweeData, scores }: { revieweeData: RevieweeData; scores: ScoreRecord[] }) {
  const { folders } = useScoreFolders();
  const publishedFolders = useMemo(() => {
    return folders.filter(f => 
      f.publicationStatus === 'published' && 
      !f.isArchived && 
      isRevieweeInFolderScope(revieweeData, f)
    );
  }, [folders, revieweeData]);
  const [selectedFolder, setSelectedFolder] = useState<ScoreFolder | null>(publishedFolders[0] || null);
  const [selectedArea, setSelectedArea] = useState<string>('CLJ');
  const [selectedCategory, setSelectedCategory] = useState<string>('Daily Evaluation');

  // Filter scores based on the selected folder
  const filteredScores = useMemo(() => {
    if (!selectedFolder) return [];
    return scores.filter(s => (s as any).scoreFolderId === selectedFolder.id);
  }, [scores, selectedFolder]);

  const categories = useMemo(() => {
    const rawCategories = Array.from(new Set(filteredScores.map(r => r.category || 'Evaluation')));
    const defaults = ['Daily Evaluation', 'Diagnostic', 'Pretest', 'Posttest', 'Quiz', 'Removal', 'Preboard'];
    const merged = Array.from(new Set([...defaults, ...rawCategories]));
    return merged;
  }, [filteredScores]);

  const isDailyEvaluation = normalizeScoreCategory(selectedCategory) === 'dailyevaluation';

  // 1. Data computation for Daily Evaluation
  const dailyEvalData = useMemo(() => {
    if (!isDailyEvaluation) return null;

    const normArea = (selectedArea || 'CLJ').toUpperCase() as MajorAreaCode;
    const catRecords = filteredScores.filter(r => normalizeScoreCategory(r.category || '') === 'dailyevaluation');

    // Also look at revieweeData.assessmentRecords & scoresByDate
    const assessmentRecords = Object.values(revieweeData?.assessmentRecords || {})
      .filter((r: any) => r && r.publicationStatus !== 'hidden');
    const scoresByDateEntries = Object.values((revieweeData as any)?.scoresByDate || {});

    // Collect dates
    const dateSet = new Set<string>();
    catRecords.forEach(r => { if (r.date) dateSet.add(r.date); });
    assessmentRecords.forEach((r: any) => {
      if (normalizeScoreCategory(r.category || '') === 'dailyevaluation' && r.date) {
        dateSet.add(r.date);
      }
    });
    scoresByDateEntries.forEach((e: any) => {
      if (normalizeScoreCategory(e.category || e.categoryKey || '') === 'dailyevaluation' && e.date) {
        dateSet.add(e.date);
      }
    });

    const uniqueDates = Array.from(dateSet).sort();

    const formatDate = (d: string) => {
      if (!d) return '—';
      try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return d;
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return d;
      }
    };

    const dateCols: RevieweeDateCol[] = uniqueDates.map((d, i) => ({
      id: `d_${d}_${i}`,
      date: d,
      label: formatDate(d),
    }));

    // Build subject scores matrix
    const subjects = getSubjectsByArea(normArea);
    const scoresBySubjectAndDate: Record<string, Record<string, { earned: number | null; possible: number | null }>> = {};

    subjects.forEach((subj) => {
      scoresBySubjectAndDate[subj.subjectCode] = {};

      dateCols.forEach((d) => {
        // Find matching score record
        let earned: number | null = null;
        let possible: number | null = null;

        // Check scoresByDate
        const sbdMatch = scoresByDateEntries.find((e: any) => {
          const catMatches = normalizeScoreCategory(e.category || e.categoryKey || '') === 'dailyevaluation';
          const dateMatches = e.date === d.date;
          const subjMatches = String(e.subject || '').toUpperCase().includes(subj.subjectCode.toUpperCase()) ||
                              String(e.subjectCode || '').toUpperCase() === subj.subjectCode.toUpperCase();
          return catMatches && dateMatches && subjMatches;
        }) as any;

        if (sbdMatch) {
          earned = sbdMatch.earnedPoints ?? sbdMatch.rawScore ?? sbdMatch.score ?? null;
          possible = sbdMatch.possiblePoints ?? sbdMatch.totalItems ?? 100;
        } else {
          // Check assessmentRecords
          const arMatch = assessmentRecords.find((r: any) => {
            const catMatches = normalizeScoreCategory(r.category || '') === 'dailyevaluation';
            const dateMatches = r.date === d.date;
            const subjMatches = String(r.subject || r.area || '').toUpperCase().includes(subj.subjectCode.toUpperCase());
            return catMatches && dateMatches && subjMatches;
          }) as any;

          if (arMatch) {
            earned = Number(arMatch.score ?? arMatch.earned);
            possible = Number(arMatch.totalScore ?? arMatch.totalItems) || 100;
          } else {
            // Check parsed scores
            const scoreMatch = catRecords.find(r => {
              const dateMatches = r.date === d.date;
              const subjMatches = normalizeScoreSubject(r.area || '') === normalizeScoreSubject(normArea);
              return dateMatches && subjMatches;
            });

            if (scoreMatch) {
              earned = Number(scoreMatch.score);
              possible = Number(scoreMatch.totalItems || 100);
            }
          }
        }

        scoresBySubjectAndDate[subj.subjectCode][d.id] = {
          earned: earned !== null && !isNaN(Number(earned)) ? Number(earned) : null,
          possible: possible !== null && !isNaN(Number(possible)) ? Number(possible) : 100,
        };
      });
    });

    return {
      dateCols,
      scoresBySubjectAndDate,
    };
  }, [isDailyEvaluation, selectedArea, scores, revieweeData]);

  // 2. Data computation for other categories
  const standardCategoryData = useMemo(() => {
    if (isDailyEvaluation) return null;

    const subjects = MAJOR_AREAS.map(a => ({ key: a.code, label: a.code, title: a.title }));
    const categoryKey = normalizeScoreCategory(selectedCategory);
    const categoryRecords = filteredScores.filter(r => normalizeScoreCategory(r.category || 'Evaluation') === categoryKey);

    const uniqueDates = Array.from(new Set(categoryRecords.map(r => r.date || 'Unknown Date'))).sort();

    const formatDate = (d: string) => {
      if (d === 'Unknown Date' || !d) return d;
      try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return d;
        return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      } catch {
        return d;
      }
    };

    const dates = uniqueDates.map((d, i) => ({ id: `d${i}`, date: d, label: formatDate(d) }));

    const computedAreaScores = subjects.map(subj => {
      const subjKey = normalizeScoreSubject(subj.label);
      const areaRecords = categoryRecords.filter(r => normalizeScoreSubject(r.area || '') === subjKey);

      const calcScores = areaRecords.map(r => ({
        earned: Number(r.score),
        totalItems: Number(r.totalItems || 100),
        published: true
      }));
      const result = calculateAggregatedAreaRating(calcScores);
      return {
        area: subj.label,
        title: subj.title,
        percent: result.rating,
      };
    });

    const tableRows = subjects.map(subj => {
      const subjKey = normalizeScoreSubject(subj.label);
      const areaRecords = categoryRecords.filter(r => normalizeScoreSubject(r.area || '') === subjKey);

      const cellsByDateId: Record<string, any> = {};
      dates.forEach((dateCol) => {
        const record = areaRecords.find(r => (r.date || 'Unknown Date') === dateCol.date);
        if (record) {
          cellsByDateId[dateCol.id] = { earned: Number(record.score), total: Number(record.totalItems || 100) };
        }
      });

      const calcScores = areaRecords.map(r => ({
        earned: Number(r.score),
        totalItems: Number(r.totalItems || 100),
        published: true
      }));

      const aggregate = calculateAggregatedAreaRating(calcScores);
      return {
        area: subj.label,
        cellsByDateId,
        aggregate: { ...aggregate, missingCount: 0 }
      };
    });

    return { areaScores: computedAreaScores, tableRows, dates };
  }, [isDailyEvaluation, selectedCategory, scores]);

  // Overall Board Subject Areas computation for top cards
  const boardSubjectAreaScores = useMemo(() => {
    return MAJOR_AREAS.map((ma) => {
      const subjKey = normalizeScoreSubject(ma.code);
      const catKey = normalizeScoreCategory(selectedCategory);
      const matchingRecords = filteredScores.filter(
        r => normalizeScoreSubject(r.area || '') === subjKey && normalizeScoreCategory(r.category || '') === catKey
      );

      const calcScores = matchingRecords.map(r => ({
        earned: Number(r.score),
        totalItems: Number(r.totalItems || 100),
        published: true
      }));
      const result = calculateAggregatedAreaRating(calcScores);

      return {
        area: ma.code,
        title: ma.title,
        percent: result.rating,
      };
    });
  }, [scores, selectedCategory]);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">My Scores</h1>
        <p className="text-sm text-slate-600">
          View your scores by board subject area, examination category, and evaluation dates.
        </p>
        {selectedFolder && (
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Currently Viewing:</span>
            <div className="text-sm font-black text-teal-700 bg-teal-50 px-3 py-1 rounded-full inline-block ml-2 border border-teal-100">
              {selectedFolder.name}
            </div>
          </div>
        )}
      </div>

      {/* Published Folder Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {publishedFolders.map(folder => (
          <button
            key={folder.id}
            onClick={() => setSelectedFolder(folder)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedFolder?.id === folder.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {folder.name}
          </button>
        ))}
      </div>

      <motion.div
        key={selectedFolder?.id || 'none'}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {/* Privacy Notice */}
        <div className="bg-slate-100 rounded-2xl p-4 text-center mt-4">
          <p className="text-xs font-semibold text-slate-500">
            “Only your Published scores from active score folders are visible to you.”
          </p>
        </div>

        {/* Board Subject Areas Selection */}
        <MyScoresBoardSubjectAreas
          areas={boardSubjectAreaScores}
          selectedArea={selectedArea}
          onAreaClick={(area) => setSelectedArea(area)}
        />

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Category Toolbar */}
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="text-xs font-bold text-slate-500">
              Selected Major Area: <span className="text-teal-700 font-black">{selectedArea}</span>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-6">
            {isDailyEvaluation && dailyEvalData ? (
              <DailyEvaluationSubjectTable
                areaCode={selectedArea as MajorAreaCode}
                dates={dailyEvalData.dateCols}
                scoresBySubjectAndDate={dailyEvalData.scoresBySubjectAndDate}
              />
            ) : standardCategoryData ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="text-[10px] text-slate-300 uppercase font-black bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th rowSpan={2} className="px-4 py-3 sticky left-0 bg-slate-900 z-20 shadow-[1px_0_0_0_rgba(255,255,255,0.1)]">
                        Area
                      </th>
                      <th colSpan={Math.max(1, standardCategoryData.dates.length)} className="px-4 py-3 text-center border-b border-slate-800">
                        {selectedCategory}
                      </th>
                      <th rowSpan={2} className="px-4 py-3 text-center bg-slate-800 shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
                        Combined
                      </th>
                      <th rowSpan={2} className="px-4 py-3 text-center bg-slate-800 shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
                        Rating
                      </th>
                    </tr>
                    <tr>
                      {standardCategoryData.dates.length > 0 ? (
                        standardCategoryData.dates.map((d) => (
                          <th key={d.id} className="px-4 py-2 border-r border-slate-800 whitespace-nowrap text-center bg-slate-800/50">
                            {d.label}
                          </th>
                        ))
                      ) : (
                        <th className="px-4 py-2 border-r border-slate-800 whitespace-nowrap text-center bg-slate-800/50">
                          No Dates Available
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {standardCategoryData.tableRows.map((row) => {
                      const isSelected = selectedArea === row.area;
                      return (
                        <tr
                          key={row.area}
                          onClick={() => setSelectedArea(row.area)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-teal-50/50 hover:bg-teal-50/80' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td
                            className={`px-4 py-3 font-black sticky left-0 z-10 border-r border-slate-100 ${
                              isSelected ? 'bg-teal-50 text-teal-900' : 'bg-white text-slate-900'
                            }`}
                          >
                            {row.area}
                          </td>
                          {standardCategoryData.dates.length > 0 ? (
                            standardCategoryData.dates.map((date) => {
                              const cell = row.cellsByDateId[date.id];
                              return (
                                <td key={date.id} className="px-4 py-3 border-r border-slate-100 text-center font-medium">
                                  {cell ? `${cell.earned}/${cell.total}` : <span className="text-slate-300">—</span>}
                                </td>
                              );
                            })
                          ) : (
                            <td className="px-4 py-3 border-r border-slate-100 text-center text-slate-300">—</td>
                          )}
                          <td
                            className={`px-4 py-3 font-bold text-center border-l border-slate-100 ${
                              isSelected ? 'bg-teal-50/30' : 'bg-slate-50'
                            }`}
                          >
                            {row.aggregate.totalEarned}/{row.aggregate.totalPossible}
                          </td>
                          <td
                            className={`px-4 py-3 font-black text-center ${
                              isSelected ? 'bg-teal-50/50 text-teal-700' : 'bg-slate-50 text-teal-600'
                            }`}
                          >
                            {row.aggregate.rating !== null ? `${row.aggregate.rating.toFixed(2)}%` : '0.00%'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
