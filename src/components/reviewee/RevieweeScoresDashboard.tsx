import React, { useMemo, useState } from 'react';
import { FileText, TrendingUp, Award, CheckCircle2, Check, User, Folder } from 'lucide-react';
import { RevieweeData, ScoreFolder } from '../../types';
import { ScoreRecord, parseScores } from '../../utils/scoreParser';
import { normalizeScoreCategory, normalizeScoreSubject } from '../../utils/scoreFieldResolver';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { isRevieweeInFolderScope } from '../../utils/folderScope';

const SUBJECTS_BY_AREA: Record<string, { code: string; title: string }[]> = {
  "CLJ": [
    { code: "CLJ 1", title: "Introduction to Philippine Criminal Justice System" },
    { code: "CLJ 2", title: "Human Rights Education" },
    { code: "CLJ 3", title: "Criminal Law Book 1" },
    { code: "CLJ 4", title: "Criminal Law Book 2" },
    { code: "CLJ 5", title: "Evidence" },
    { code: "CLJ 6", title: "Criminal Procedure" },
    { code: "CLJ 7", title: "Court Testimony" },
  ],
  "LEA": [
    { code: "LEA 1", title: "Law Enforcement Administration (Inter-Agency Approach)" },
    { code: "LEA 2", title: "Comparative Models in Policing" },
    { code: "LEA 3", title: "Introduction to Industrial Security Concepts" },
    { code: "LEA 4", title: "Law Enforcement Operation and Planning with Crime Mapping" },
    { code: "CLFM 1", title: "Character Formation, Nationalism, and Patriotism" },
    { code: "CLFM 2", title: "Leadership, Decision Making, Management, and Administration" },
  ],
  "CDI": [
    { code: "CDI 1", title: "Fundamentals of Criminal Investigation with Intelligence" },
    { code: "CDI 2", title: "Specialized Crime Investigation 1 with Legal Medicine" },
    { code: "CDI 3", title: "Specialized Crime Investigation 2 with Simulation on Interrogation and Interview" },
    { code: "CDI 4", title: "Traffic Management and Accident Investigation with Driving" },
    { code: "CDI 5", title: "Technical English 1 (Investigative Report Writing and Presentation)" },
    { code: "CDI 6", title: "Technical English 2 (Legal Forms)" },
    { code: "CDI 7", title: "Vice and Drug Education and Control" },
    { code: "CDI 8", title: "Organized Crime Investigation" },
    { code: "CDI 9", title: "Introduction to Cybercrime and Environmental Laws and Protection" },
  ],
  "FS": [
    { code: "FS 1", title: "Personal Identification Techniques" },
    { code: "FS 2", title: "Forensic Photography" },
    { code: "FS 3", title: "Forensic Chemistry and Toxicology" },
    { code: "FS 4", title: "Questioned Documents Examination" },
    { code: "FS 5", title: "Lie Detection Techniques" },
    { code: "FS 6", title: "Forensic Ballistics" },
  ],
  "CRIM": [
    { code: "CRIM 1", title: "Introduction to Criminology" },
    { code: "CRIM 2", title: "Theories of Crime Causation" },
    { code: "CRIM 3", title: "Human Behavior and Victimology" },
    { code: "CRIM 4", title: "Professional Conduct and Ethical Standards" },
    { code: "CRIM 5", title: "Juvenile Delinquency and Juvenile Justice System" },
    { code: "CRIM 6", title: "Dispute Resolution and Crises/Incidents Management" },
    { code: "CRIM 7", title: "Criminological Research 1" },
    { code: "CRIM 8", title: "Criminological Research 2" },
  ],
  "CA": [
    { code: "CA 1", title: "Institutional Corrections" },
    { code: "CA 2", title: "Non-Institutional Corrections" },
    { code: "CA 3", title: "Therapeutic Modalities" },
  ]
};

const MAJOR_AREAS = ["CLJ", "LEA", "CDI", "FS", "CRIM", "CA"];
const CATEGORIES = ["Diagnostic", "Pretest", "Posttest", "Quiz", "Daily Evaluation", "Removal", "Preboard"];

function formatFolderType(type: string): string {
  if (!type) return 'N/A';
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getScoreColor(rating: number) {
  if (rating >= 80) return { text: "teal-600", bg: "teal-50", label: "Very Good" };
  if (rating >= 70) return { text: "emerald-600", bg: "emerald-50", label: "Above Average" };
  if (rating >= 60) return { text: "blue-600", bg: "blue-50", label: "Average" };
  if (rating >= 50) return { text: "orange-600", bg: "orange-50", label: "Below Average" };
  return { text: "red-600", bg: "red-50", label: "Needs Improvement" };
}

interface Props {
  currentUser: RevieweeData;
}

export default function RevieweeScoresDashboard({ currentUser }: Props) {
  const { folders } = useScoreFolders();
  const publishedFolders = useMemo(() => {
    return folders.filter(f => 
      f.publicationStatus === 'published' && 
      !f.isArchived && 
      isRevieweeInFolderScope(currentUser, f)
    );
  }, [folders, currentUser]);
  const [selectedFolder, setSelectedFolder] = useState<ScoreFolder | null>(null);
  
  // Set default folder when folders load
  React.useEffect(() => {
    if (publishedFolders.length > 0 && !selectedFolder) {
      setSelectedFolder(publishedFolders[0]);
    }
  }, [publishedFolders, selectedFolder]);

  const [selectedMajorArea, setSelectedMajorArea] = useState("CLJ");
  const [selectedCategory, setSelectedCategory] = useState("Daily Evaluation");

  const records = useMemo(() => parseScores(currentUser), [currentUser]);

  // Filter records by selected folder
  const filteredRecords = useMemo(() => {
    if (!selectedFolder) return [];
    return records.filter(r => r.scoreFolderId === selectedFolder.id);
  }, [records, selectedFolder]);

  // Aggregate Top-Level Metrics
  const totalEarnedOverall = filteredRecords.reduce((acc, r) => acc + (Number(r.score) || 0), 0);
  const totalPossibleOverall = filteredRecords.reduce((acc, r) => acc + (Number(r.totalItems) || 100), 0);
  const overallRating = totalPossibleOverall > 0 ? (totalEarnedOverall / totalPossibleOverall) * 100 : 0;
  
  const completedExams = new Set(filteredRecords.map(r => `${r.date}_${r.category}`)).size;

  // Major Area Stats
  const majorAreaStats = useMemo(() => {
    return MAJOR_AREAS.map(area => {
      const areaRecords = filteredRecords.filter(r => normalizeScoreSubject(r.area).startsWith(normalizeScoreSubject(area)));
      const earned = areaRecords.reduce((acc, r) => acc + (Number(r.score) || 0), 0);
      const possible = areaRecords.reduce((acc, r) => acc + (Number(r.totalItems) || 100), 0);
      const rating = possible > 0 ? (earned / possible) * 100 : 0;
      return { area, rating, hasRecords: possible > 0 };
    });
  }, [filteredRecords]);

  const highestArea = [...majorAreaStats].filter(s => s.hasRecords).sort((a, b) => b.rating - a.rating)[0];

  // Specific Table Data
  const currentCategoryRecords = useMemo(() => {
    return filteredRecords.filter(r => 
      normalizeScoreCategory(r.category) === normalizeScoreCategory(selectedCategory) &&
      normalizeScoreSubject(r.area).startsWith(normalizeScoreSubject(selectedMajorArea))
    );
  }, [filteredRecords, selectedCategory, selectedMajorArea]);

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    currentCategoryRecords.forEach(r => {
      if (r.date) dates.add(r.date);
    });
    return Array.from(dates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [currentCategoryRecords]);

  const subjects = SUBJECTS_BY_AREA[selectedMajorArea] || [];

  const tableData = subjects.map(subj => {
    const subjRecords = currentCategoryRecords.filter(r => {
      const scoreSubj = normalizeScoreSubject(r.area);
      const targetSubj = normalizeScoreSubject(subj.code);
      return scoreSubj === targetSubj;
    });

    let rowEarned = 0;
    let rowPossible = 0;
    const dateScores: Record<string, { earned: number, possible: number }> = {};
    
    uniqueDates.forEach(d => {
      const rec = subjRecords.find(r => r.date === d);
      if (rec) {
        dateScores[d] = { earned: Number(rec.score) || 0, possible: Number(rec.totalItems) || 100 };
        rowEarned += dateScores[d].earned;
        rowPossible += dateScores[d].possible;
      }
    });

    return {
      subject: subj,
      dateScores,
      rowEarned,
      rowPossible,
      rating: rowPossible > 0 ? (rowEarned / rowPossible) * 100 : 0,
      hasRecords: rowPossible > 0
    };
  });

  // Add a special row for Major Area wide scores (e.g. Diagnostic for CLJ)
  const majorAreaWideRecords = useMemo(() => {
    return currentCategoryRecords.filter(r => 
      normalizeScoreSubject(r.area) === normalizeScoreSubject(selectedMajorArea)
    );
  }, [currentCategoryRecords, selectedMajorArea]);

  const majorAreaWideData = useMemo(() => {
    if (majorAreaWideRecords.length === 0) return null;
    
    let rowEarned = 0;
    let rowPossible = 0;
    const dateScores: Record<string, { earned: number, possible: number }> = {};
    
    uniqueDates.forEach(d => {
      const rec = majorAreaWideRecords.find(r => r.date === d);
      if (rec) {
        dateScores[d] = { earned: Number(rec.score) || 0, possible: Number(rec.totalItems) || 100 };
        rowEarned += dateScores[d].earned;
        rowPossible += dateScores[d].possible;
      }
    });

    return {
      subject: { code: selectedMajorArea, title: "Major Area Overall / Diagnostic" },
      dateScores,
      rowEarned,
      rowPossible,
      rating: rowPossible > 0 ? (rowEarned / rowPossible) * 100 : 0,
      hasRecords: rowPossible > 0
    };
  }, [majorAreaWideRecords, uniqueDates, selectedMajorArea]);

  const totalAreaEarned = tableData.reduce((acc, row) => acc + row.rowEarned, 0) + (majorAreaWideData?.rowEarned || 0);
  const totalAreaPossible = tableData.reduce((acc, row) => acc + row.rowPossible, 0) + (majorAreaWideData?.rowPossible || 0);
  const totalAreaRating = totalAreaPossible > 0 ? (totalAreaEarned / totalAreaPossible) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-white overflow-auto">
      <div className="p-6 pb-24 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">My Scores</h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              View your scores by board subject area, examination category, and examination date.
            </p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
            <TrendingUp className="text-slate-400" size={16} />
            <span className="text-xs font-bold text-slate-700">Live Updating</span>
          </div>
        </div>

        {/* Published Folder Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {publishedFolders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolder(folder)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedFolder?.id === folder.id
                  ? 'bg-slate-900 text-white shadow-lg scale-105'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Folder size={14} className={selectedFolder?.id === folder.id ? "text-teal-400" : "text-slate-400"} />
              {formatFolderType(folder.type)}
            </button>
          ))}
          {publishedFolders.length === 0 && (
            <div className="text-xs font-bold text-slate-400 italic py-2">No published folders available</div>
          )}
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Rating</p>
              <p className="text-xl font-black text-slate-900">{overallRating.toFixed(2)}%</p>
              <p className={`text-[10px] font-bold mt-0.5 ${getScoreColor(overallRating).text}`}>{getScoreColor(overallRating).label}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Award size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Highest Area</p>
              <p className="text-xl font-black text-slate-900">{highestArea?.area || 'N/A'}</p>
              {highestArea && (
                <p className={`text-[10px] font-bold mt-0.5 ${getScoreColor(highestArea.rating).text}`}>{highestArea.rating.toFixed(2)}%</p>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Examinations</p>
              <p className="text-xl font-black text-slate-900">{completedExams}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Recorded Sessions</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <User size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reviewee ID</p>
              <p className="text-base font-black text-slate-900 truncate">{currentUser.id_number || 'No ID'}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">{currentUser.first_name} {currentUser.last_name}</p>
            </div>
          </div>
        </div>

        {/* Board Major Area Grid */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 mb-1">Board Major Area</h2>
          <p className="text-xs font-medium text-slate-500 mb-4">Select a major area to view scores by examination category.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {majorAreaStats.map(stat => {
              const isSelected = selectedMajorArea === stat.area;
              const colorInfo = getScoreColor(stat.rating);
              
              return (
                <button
                  key={stat.area}
                  onClick={() => setSelectedMajorArea(stat.area)}
                  className={`relative p-4 rounded-xl border text-left transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50/10 shadow-md ring-1 ring-blue-500' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {stat.area}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">{stat.area}</h3>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{stat.hasRecords ? `${stat.rating.toFixed(2)}%` : '0.00%'}</p>
                      <p className={`text-[9px] font-bold mt-0.5 ${stat.hasRecords ? colorInfo.text : 'text-slate-400'}`}>
                        {stat.hasRecords ? colorInfo.label : 'No Data'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table Section */}
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
            <h2 className="text-lg font-black text-slate-800">
              Selected Major Area: <span className="text-blue-600">{selectedMajorArea}</span>
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-2">Selected Category:</span>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selectedCategory === cat
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr>
                    <th rowSpan={2} className="px-4 py-3 bg-[#111827] text-white font-bold w-12 text-center border-r border-slate-700/50">#</th>
                    <th rowSpan={2} className="px-4 py-3 bg-[#111827] text-white font-bold min-w-[300px] border-r border-slate-700/50">Subject</th>
                    <th colSpan={Math.max(uniqueDates.length, 1)} className="px-4 py-2 bg-[#1f2937] text-white text-center font-bold border-b border-slate-700/50 border-r border-slate-700/50">
                      {selectedCategory} Scores
                    </th>
                    <th rowSpan={2} className="px-4 py-3 bg-[#111827] text-white font-bold text-center w-32 border-r border-slate-700/50">
                      Combined<br/><span className="text-[10px] font-normal text-slate-400">Total</span>
                    </th>
                    <th rowSpan={2} className="px-4 py-3 bg-[#111827] text-white font-bold text-center w-24">
                      Rating<br/><span className="text-[10px] font-normal text-slate-400">(Percentage)</span>
                    </th>
                  </tr>
                  <tr>
                    {uniqueDates.length === 0 ? (
                      <th className="px-4 py-2 bg-[#111827] text-slate-400 text-center text-[10px] font-semibold border-r border-slate-700/50">No Dates Available</th>
                    ) : (
                      uniqueDates.map(date => (
                        <th key={date} className="px-4 py-2 bg-[#111827] text-white text-center text-[10px] font-bold border-r border-slate-700/50">
                          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableData.map((row, idx) => (
                    <tr key={row.subject.code} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-500 font-medium border-r border-slate-100">{idx + 1}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium border-r border-slate-100">
                        <span className="font-bold mr-1">{row.subject.code}</span> {row.subject.title}
                      </td>
                      {uniqueDates.length === 0 ? (
                        <td className="px-4 py-3 text-center text-slate-300 border-r border-slate-100">-</td>
                      ) : (
                        uniqueDates.map(date => {
                          const val = row.dateScores[date];
                          return (
                            <td key={date} className="px-4 py-3 text-center border-r border-slate-100">
                              {val ? (
                                <span className="font-bold text-slate-700">{val.earned}/{val.possible}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })
                      )}
                      <td className="px-4 py-3 text-center border-r border-slate-100 font-bold bg-slate-50/50 text-slate-800">
                        {row.hasRecords ? `${row.rowEarned}/${row.rowPossible}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-black bg-slate-50/50">
                        {row.hasRecords ? (
                          <span className={getScoreColor(row.rating).text.replace('text-', 'text-')}>{row.rating.toFixed(2)}%</span>
                        ) : (
                          <span className="text-slate-400 font-bold">0.00%</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {majorAreaWideData && (
                    <tr className="bg-blue-50/30 hover:bg-blue-50/50 transition-colors border-t-2 border-slate-200">
                      <td className="px-4 py-3 text-center text-blue-600 font-black border-r border-blue-100">★</td>
                      <td className="px-4 py-3 text-blue-900 font-black border-r border-blue-100">
                        {majorAreaWideData.subject.title}
                      </td>
                      {uniqueDates.length === 0 ? (
                        <td className="px-4 py-3 text-center text-slate-300 border-r border-slate-100">-</td>
                      ) : (
                        uniqueDates.map(date => {
                          const val = majorAreaWideData.dateScores[date];
                          return (
                            <td key={date} className="px-4 py-3 text-center border-r border-blue-100 bg-blue-50/20">
                              {val ? (
                                <span className="font-black text-blue-700">{val.earned}/{val.possible}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })
                      )}
                      <td className="px-4 py-3 text-center border-r border-blue-100 font-black bg-blue-100/50 text-blue-900">
                        {majorAreaWideData.hasRecords ? `${majorAreaWideData.rowEarned}/${majorAreaWideData.rowPossible}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-black bg-blue-100/50">
                        {majorAreaWideData.hasRecords ? (
                          <span className="text-blue-700">{majorAreaWideData.rating.toFixed(2)}%</span>
                        ) : (
                          <span className="text-slate-400 font-bold">0.00%</span>
                        )}
                      </td>
                    </tr>
                  )}
                  
                  {tableData.length === 0 && (
                    <tr>
                      <td colSpan={5 + Math.max(uniqueDates.length, 1)} className="px-4 py-8 text-center text-slate-500 font-medium">
                        No subjects defined for {selectedMajorArea}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Area Footer */}
            <div className="bg-emerald-50 border-t border-emerald-100 p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-sm font-black text-emerald-950">Overall {selectedMajorArea}:</span>
                <span className="text-base font-black text-emerald-800">{totalAreaEarned}/{totalAreaPossible} • {totalAreaRating.toFixed(2)}%</span>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider ml-2">{getScoreColor(totalAreaRating).label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
