import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Download, Printer, Filter, ChevronDown, ChevronUp, Eye, CheckCircle2, FileText, Upload, ChevronLeft, ChevronRight, Check, MoreVertical, X, Pencil, Plus } from 'lucide-react';
import { useFirestoreUsers } from '../../hooks/useFirestoreUsers';
import { normalizeScoreCategory, normalizeScoreSubject, getResolvedDetailedScore, getScoreFieldName } from '../../utils/scoreFieldResolver';
import { getScoreLabel, getScoreColor } from '../DashboardShared';
import { calculateAggregatedAreaRating } from '../../lib/scoreCalculations';
import { ScoreRecord } from '../../utils/scoreParser';
import { RevieweeData } from '../../types';
import { CompactEditableScoreCell } from '../CompactEditableScoreCell';
import { firestoreDb } from '../../utils/firebaseClient';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getCanonicalFullName } from '../../utils/nameNormalization';
import { getSubjectsByArea, MajorAreaCode } from '../../config/criminologyCurriculum';
import { DailyEvaluationRevieweeMatrix, DailyEvalRevieweeRow } from '../score-management/DailyEvaluationRevieweeMatrix';

import { isValidUserRecord } from '../../services/userIdentityResolver';

type ScoreManagementDashboardProps = {
  onViewDetails?: (user: RevieweeData) => void;
  onOpenUploadModal?: () => void;
  onOpenSyncModal?: (section?: any, tab?: any) => void;
  currentUser?: RevieweeData | null;
};

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
  ],
  "CDI": [
    { code: "CDI 1", title: "Fundamentals of Criminal Investigation and Intelligence" },
    { code: "CDI 2", title: "Special Crime Investigation 1 with Legal Medicine" },
    { code: "CDI 3", title: "Special Crime Investigation 2 with Simulation on Interview and Interrogation" },
    { code: "CDI 4", title: "Traffic Management and Accident Investigation with Driving" },
    { code: "CDI 5", title: "Technical English 1 (Investigative Report Writing and Presentation)" },
    { code: "CDI 6", title: "Fire Protection and Arson Investigation" },
    { code: "CDI 7", title: "Vice and Drug Education and Control" },
    { code: "CDI 8", title: "Technical English 2 (Legal Forms)" },
    { code: "CDI 9", title: "Introduction to Cybercrime and Environmental Laws and Protection" },
  ],
  "FS": [
    { code: "FS 1", title: "Forensic Photography" },
    { code: "FS 2", title: "Personal Identification Techniques" },
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
    { code: "CRIM 6", title: "Dispute Resolution and Crisis/Incident Management" },
    { code: "CRIM 7", title: "Criminological Research 1 and 2" },
  ],
  "CA": [
    { code: "CA 1", title: "Institutional Corrections" },
    { code: "CA 2", title: "Non-Institutional Corrections" },
    { code: "CA 3", title: "Therapeutic Modalities" },
  ]
};

export function ScoreManagementDashboard({ onViewDetails, onOpenUploadModal, onOpenSyncModal, currentUser }: ScoreManagementDashboardProps) {
  const { allUsers, loading } = useFirestoreUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Daily Evaluation');
  const [selectedDate, setSelectedDate] = useState('All Dates');
  const [selectedSchool, setSelectedSchool] = useState('All Schools');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [selectedMajorArea, setSelectedMajorArea] = useState('CLJ');
  const [sortBy, setSortBy] = useState('score_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showMajorAreaDropdown, setShowMajorAreaDropdown] = useState(false);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showSortByDropdown, setShowSortByDropdown] = useState(false);
  const itemsPerPage = 15;
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const isDailyEvalCategory = normalizeScoreCategory(selectedCategory) === 'dailyevaluation';

  const [editingScoreCell, setEditingScoreCell] = useState<{
    user: any;
    subject: string;
    category: string;
    currentScore: number | null;
    possiblePoints: number;
  } | null>(null);
  const [newScoreInput, setNewScoreInput] = useState('');
  const [newTotalInput, setNewTotalInput] = useState('100');
  const [savingScore, setSavingScore] = useState(false);

  const handleEditScoreClick = (data: {
    reviewee: any;
    category: string;
    subject: string;
    currentScore: number | null;
    possiblePoints?: number;
  }) => {
    setEditingScoreCell({
      user: data.reviewee,
      subject: data.subject,
      category: data.category,
      currentScore: data.currentScore,
      possiblePoints: data.possiblePoints || 100
    });
    setNewScoreInput(data.currentScore !== null ? String(data.currentScore) : '');
    setNewTotalInput(String(data.possiblePoints || 100));
  };

  const handleSaveScore = async () => {
    if (!editingScoreCell) return;
    setSavingScore(true);
    try {
      const { user, subject, category } = editingScoreCell;
      const userDocId = user.doc_id || user.uid || user.id;
      if (!userDocId) throw new Error("User ID not found");

      const scoreNum = Number(newScoreInput);
      const totalNum = Number(newTotalInput) || 100;
      if (isNaN(scoreNum)) {
        alert("Please enter a valid numeric score.");
        setSavingScore(false);
        return;
      }

      const fieldName = getScoreFieldName(category, subject);

      if (!firestoreDb) throw new Error("Firestore client db not initialized");
      const userRef = doc(firestoreDb, 'users', userDocId);
      await updateDoc(userRef, {
        [fieldName]: scoreNum,
        [`${fieldName}_total`]: totalNum,
        last_score_update: serverTimestamp(),
        updated_at: new Date().toISOString()
      });

      setEditingScoreCell(null);
    } catch (err: any) {
      console.error("Error saving score:", err);
      alert("Failed to save score: " + (err.message || err));
    } finally {
      setSavingScore(false);
    }
  };

  // Filter valid reviewees
  const allReviewees = useMemo(() => {
    return allUsers.filter((u: RevieweeData) => {
      const uAny = u as any;
      const status = String(uAny.accountStatus || uAny.status || '').toLowerCase();
      
      // Exclude deleted or merged accounts
      if (status === 'merged' || status === 'deleted' || uAny.isDeleted || uAny.deleted || uAny.is_deleted) {
        return false;
      }
      
      // Exclude invalid records
      if (!isValidUserRecord(u)) {
        return false;
      }

      return u.role === 'Reviewee';
    });
  }, [allUsers]);

  // Aggregate options for filters
  const { categories, dates, schools, branches } = useMemo(() => {
    const cats = new Set<string>();
    const dts = new Set<string>();
    const schs = new Set<string>();
    const brs = new Set<string>();

    cats.add('Diagnostic');
    cats.add('Pretest');
    cats.add('Posttest');
    cats.add('Quiz');
    cats.add('Daily Evaluation');
    cats.add('Removal');
    cats.add('Preboard');

    allReviewees.forEach((u: RevieweeData) => {
      const uAny = u as any;
      if (u.school_name || uAny.schoolName) schs.add(u.school_name || uAny.schoolName || '');
      if (uAny.branch) brs.add(uAny.branch);
      
      const records = Object.values(u.assessmentRecords || {}) as ScoreRecord[];
      records.forEach((r: ScoreRecord) => {
        if (r.category) cats.add(r.category);
        if (r.date) dts.add(r.date);
      });
    });

    return {
      categories: Array.from(cats).sort(),
      dates: Array.from(dts).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()),
      schools: Array.from(schs).filter(Boolean).sort(),
      branches: Array.from(brs).filter(Boolean).sort()
    };
  }, [allReviewees]);

  const subjects = [
    { key: "CLJ", label: "CLJ" },
    { key: "LEA", label: "LEA" },
    { key: "CDI", label: "CDI" },
    { key: "FS", label: "FS" },
    { key: "CRIM", label: "CRIM" },
    { key: "CA", label: "CA" }
  ];

  const displayedSubjects = useMemo(() => {
    if (normalizeScoreCategory(selectedCategory) !== 'daily evaluation') {
      return subjects;
    }
    if (selectedMajorArea === 'All Areas') return subjects;
    const subSubjects = SUBJECTS_BY_AREA[selectedMajorArea];
    if (subSubjects) {
      return subSubjects.map(s => ({ key: s.code, label: s.code, fullTitle: s.title }));
    }
    return subjects.filter(s => s.label === selectedMajorArea);
  }, [selectedCategory, selectedMajorArea]);

  // Apply filters and sorting
  const processedReviewees = useMemo(() => {
    const filtered = allReviewees.filter((u: RevieweeData) => {
      const uAny = u as any;
      const matchesSearch = !searchQuery || 
        `${u.first_name || ''} ${u.middle_name ? u.middle_name + ' ' : ''}${u.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(u.id_number || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSchool = selectedSchool === 'All Schools' || (u.school_name || uAny.schoolName) === selectedSchool;
      const matchesBranch = selectedBranch === 'All Branches' || uAny.branch === selectedBranch;

      return matchesSearch && matchesSchool && matchesBranch;
    });

    const withScores = filtered.map((user: RevieweeData) => {
      const records = Object.values(user.assessmentRecords || {}) as ScoreRecord[];
      const catRecords = records.filter((r: ScoreRecord) => 
        normalizeScoreCategory(r.category || '') === normalizeScoreCategory(selectedCategory) &&
        (selectedDate === 'All Dates' || r.date === selectedDate)
      );

      let totalEarned = 0;
      let totalPossible = 0;

      const subjScores = displayedSubjects.map(s => {
        const detailed = getResolvedDetailedScore(user, selectedCategory, s.label);
        const possible = detailed.possiblePoints > 0 ? detailed.possiblePoints : 100;

        if (detailed.earnedScore !== null) {
          totalEarned += detailed.earnedScore;
          totalPossible += possible;
          return { score: detailed.earnedScore, total: possible };
        }

        const subjKey = normalizeScoreSubject(s.label);
        const subjRecords = catRecords.filter((r: ScoreRecord) => normalizeScoreSubject(r.area || '') === subjKey);
        
        if (subjRecords.length > 0) {
          let areaEarned = 0;
          let areaPossible = 0;
          subjRecords.forEach(r => {
            areaEarned += Number(r.score) || 0;
            areaPossible += Number(r.totalItems) || possible;
          });
          
          totalEarned += areaEarned;
          totalPossible += areaPossible;
          return { score: areaEarned, total: areaPossible };
        }

        totalPossible += possible;
        return { score: null, total: possible };
      });

      const rating = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
      const hasScores = displayedSubjects.length > 0;

      return {
        user,
        subjScores,
        totalEarned,
        totalPossible,
        rating,
        hasScores
      };
    });

    return withScores.sort((a, b) => {
      if (sortBy === 'score_desc') return b.rating - a.rating;
      if (sortBy === 'score_asc') return a.rating - b.rating;
      
      const nameA = `${a.user.last_name || ''} ${a.user.first_name || ''} ${a.user.middle_name || ''}`.trim().toLowerCase();
      const nameB = `${b.user.last_name || ''} ${b.user.first_name || ''} ${b.user.middle_name || ''}`.trim().toLowerCase();
      
      if (sortBy === 'name_asc') return nameA.localeCompare(nameB);
      if (sortBy === 'name_desc') return nameB.localeCompare(nameA);
      
      return 0;
    });
  }, [allReviewees, searchQuery, selectedSchool, selectedBranch, selectedCategory, selectedDate, displayedSubjects, sortBy]);

  // Pagination
  const totalPages = Math.ceil(processedReviewees.length / itemsPerPage);
  const paginatedReviewees = processedReviewees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const dailyEvalMatrixRows: DailyEvalRevieweeRow[] = useMemo(() => {
    if (!isDailyEvalCategory) return [];

    const areaSubjects = getSubjectsByArea(selectedMajorArea === 'All Areas' ? 'CLJ' : selectedMajorArea);

    return paginatedReviewees.map((row: any) => {
      const user = row.user;
      const subjectScores: Record<string, { earned: number | null; possible: number | null }> = {};

      areaSubjects.forEach((s) => {
        const detailed = getResolvedDetailedScore(user, selectedCategory, s.subjectCode);
        subjectScores[s.subjectCode] = {
          earned: detailed.earnedScore !== null ? detailed.earnedScore : null,
          possible: detailed.possiblePoints > 0 ? detailed.possiblePoints : 100,
        };
      });

      return {
        user,
        subjectScores,
        isPublished: true,
      };
    });
  }, [isDailyEvalCategory, selectedMajorArea, paginatedReviewees, selectedCategory]);

  const handleToggleSelectAllUsers = () => {
    const currentIds = paginatedReviewees.map((r: any) => r.user.id || r.user.uid || '').filter(Boolean);
    if (selectedUserIds.length === currentIds.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(currentIds);
    }
  };

  const handleToggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleExportCSV = () => {
    if (processedReviewees.length === 0) return;
    const headers = ['ID Number', 'Name', ...displayedSubjects.map(s => s.label), 'Combined', 'Rating', 'Status'];
    const rows = processedReviewees.map((row: any) => {
      const { user, subjScores, totalEarned, totalPossible, rating, hasScores } = row;
      const name = getCanonicalFullName(user).displayName;
      const id = user.id_number || user.seqId || user.seq_id || user.idNumber || user.revieweeId || user.id || '';
      const scores = subjScores.map((s: any) => s !== null ? s : '-');
      const combined = hasScores ? `${totalEarned}/${totalPossible}` : '-';
      const rat = hasScores ? `${rating.toFixed(2)}%` : '-';
      const status = hasScores ? (subjScores.every((s: any) => s !== null) ? 'Completed' : 'In Progress') : 'Not Started';
      return [id, name, ...scores, combined, rat, status];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map((e: any[]) => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `score_management_${selectedCategory.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableHeaders = ['#', 'ID Number', 'Name', ...displayedSubjects.map(s => `${s.label}`), 'Combined', 'Rating', 'Status'];
    
    const tableRowsHtml = processedReviewees.map((row: any, idx: number) => {
      const { user, subjScores, totalEarned, totalPossible, rating, hasScores } = row;
      const name = getCanonicalFullName(user).displayName;
      const idNum = user.id_number || user.seqId || user.seq_id || user.idNumber || user.revieweeId || user.id || '-';
      const scoreCells = subjScores.map((s: any) => {
        if (s !== null && s.score !== null) {
          const pct = s.total > 0 ? ((s.score / s.total) * 100).toFixed(1) : '0.0';
          return `${s.score}/${s.total}<br/><small style="color: #0d9488; font-weight: bold;">${pct}%</small>`;
        }
        const total = s?.total || 100;
        return `___/${total}<br/><small style="color: #94a3b8; font-weight: bold;">0.0%</small>`;
      });
      const combinedStr = `${totalEarned}/${totalPossible}`;
      const ratStr = `${rating.toFixed(2)}%`;
      const allDone = subjScores.every((s: any) => s !== null && s.score !== null);
      const someDone = subjScores.some((s: any) => s !== null && s.score !== null);
      const statusStr = allDone ? 'Completed' : (someDone ? 'In Progress' : 'Not Started');

      return `
        <tr>
          <td style="text-align: center; vertical-align: middle;">${idx + 1}</td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #2563eb;">${idNum}</td>
          <td style="text-align: left; vertical-align: middle; font-weight: bold; text-transform: uppercase;">${name}</td>
          ${scoreCells.map((sc: string) => `<td style="text-align: center; vertical-align: middle;">${sc}</td>`).join('')}
          <td style="text-align: center; vertical-align: middle; font-weight: bold; background-color: #f8fafc;">${combinedStr}</td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #9333ea;">${ratStr}</td>
          <td style="text-align: center; vertical-align: middle; font-size: 8px;">${statusStr}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Score Management Report - ${selectedCategory}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { width: 50px; height: 50px; margin: 0 auto 6px auto; display: block; }
            h1 { font-size: 16px; font-weight: bold; margin: 0; text-transform: uppercase; }
            p { font-size: 11px; color: #64748b; margin: 2px 0; }
            .meta { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 12px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 9px; }
            th { background-color: #f1f5f9; text-transform: uppercase; font-weight: bold; text-align: center; vertical-align: middle; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${window.location.origin}/logo.svg" class="logo" alt="Logo" />
            <h1>SAMARITAN REVIEW CENTER</h1>
            <p>Score Management Report - ${selectedCategory}</p>
          </div>
          <div class="meta">
            <div>Date: ${selectedDate} | Area: ${selectedMajorArea}</div>
            <div>School: ${selectedSchool} | Branch: ${selectedBranch}</div>
            <div>Total Reviewees: ${processedReviewees.length}</div>
          </div>
          <table>
            <thead>
              <tr>
                ${tableHeaders.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] overflow-y-auto bg-white pb-12">
      <div className="p-4 sm:p-6 pb-4 shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Score Management</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 uppercase tracking-wider">{selectedCategory}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-colors shadow-sm ${showFilters ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <Filter size={14} />
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>
            <button 
              onClick={() => {
                if (onOpenUploadModal) onOpenUploadModal();
                else if (onOpenSyncModal) onOpenSyncModal('main', 'import_scores');
              }}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
            >
              <Upload size={14} />
              <span className="hidden xs:inline">Upload</span> (CSV)
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end mb-4">
            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full flex items-center justify-between text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 transition-all text-left cursor-pointer"
              >
                <span className="truncate">{selectedCategory}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${showCategoryDropdown ? 'rotate-180 text-teal-600' : ''}`} />
              </button>

              <AnimatePresence>
                {showCategoryDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowCategoryDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
                    >
                      {categories.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(c);
                            setShowCategoryDropdown(false);
                          }}
                          className={`w-full text-left p-2.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            selectedCategory === c ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{c}</span>
                          {selectedCategory === c && <Check size={14} className="text-teal-600 shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            {/* Evaluation Date */}
            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Evaluation Date</label>
              <button
                type="button"
                onClick={() => {
                  setShowDateDropdown(!showDateDropdown);
                  setShowCategoryDropdown(false);
                  setShowMajorAreaDropdown(false);
                  setShowSchoolDropdown(false);
                  setShowBranchDropdown(false);
                  setShowSortByDropdown(false);
                }}
                className="w-full flex items-center justify-between text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 transition-all text-left cursor-pointer"
              >
                <span className="truncate">{selectedDate}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${showDateDropdown ? 'rotate-180 text-teal-600' : ''}`} />
              </button>

              <AnimatePresence>
                {showDateDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowDateDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
                    >
                      {['All Dates', ...dates].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setSelectedDate(d);
                            setShowDateDropdown(false);
                          }}
                          className={`w-full text-left p-2.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            selectedDate === d ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{d}</span>
                          {selectedDate === d && <Check size={14} className="text-teal-600 shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Major Area */}
            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Major Area</label>
              <button
                type="button"
                onClick={() => {
                  setShowMajorAreaDropdown(!showMajorAreaDropdown);
                  setShowCategoryDropdown(false);
                  setShowDateDropdown(false);
                  setShowSchoolDropdown(false);
                  setShowBranchDropdown(false);
                  setShowSortByDropdown(false);
                }}
                className="w-full flex items-center justify-between text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 transition-all text-left cursor-pointer"
              >
                <span className="truncate">{selectedMajorArea}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${showMajorAreaDropdown ? 'rotate-180 text-teal-600' : ''}`} />
              </button>

              <AnimatePresence>
                {showMajorAreaDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowMajorAreaDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
                    >
                      {['All Areas', ...subjects.map(s => s.label)].map(area => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => {
                            setSelectedMajorArea(area);
                            setShowMajorAreaDropdown(false);
                          }}
                          className={`w-full text-left p-2.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            selectedMajorArea === area ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{area}</span>
                          {selectedMajorArea === area && <Check size={14} className="text-teal-600 shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* School */}
            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">School</label>
              <button
                type="button"
                onClick={() => {
                  setShowSchoolDropdown(!showSchoolDropdown);
                  setShowCategoryDropdown(false);
                  setShowDateDropdown(false);
                  setShowMajorAreaDropdown(false);
                  setShowBranchDropdown(false);
                  setShowSortByDropdown(false);
                }}
                className="w-full flex items-center justify-between text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 transition-all text-left cursor-pointer"
              >
                <span className="truncate">{selectedSchool}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${showSchoolDropdown ? 'rotate-180 text-teal-600' : ''}`} />
              </button>

              <AnimatePresence>
                {showSchoolDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowSchoolDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
                    >
                      {['All Schools', ...schools].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSelectedSchool(s);
                            setShowSchoolDropdown(false);
                          }}
                          className={`w-full text-left p-2.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            selectedSchool === s ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{s}</span>
                          {selectedSchool === s && <Check size={14} className="text-teal-600 shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Branch */}
            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Branch</label>
              <button
                type="button"
                onClick={() => {
                  setShowBranchDropdown(!showBranchDropdown);
                  setShowCategoryDropdown(false);
                  setShowDateDropdown(false);
                  setShowMajorAreaDropdown(false);
                  setShowSchoolDropdown(false);
                  setShowSortByDropdown(false);
                }}
                className="w-full flex items-center justify-between text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 transition-all text-left cursor-pointer"
              >
                <span className="truncate">{selectedBranch}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${showBranchDropdown ? 'rotate-180 text-teal-600' : ''}`} />
              </button>

              <AnimatePresence>
                {showBranchDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowBranchDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
                    >
                      {['All Branches', ...branches].map(b => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setSelectedBranch(b);
                            setShowBranchDropdown(false);
                          }}
                          className={`w-full text-left p-2.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            selectedBranch === b ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{b}</span>
                          {selectedBranch === b && <Check size={14} className="text-teal-600 shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Name or ID..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Sort By */}
            <div className="lg:col-span-1 sm:col-span-2 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sort By</label>
              <button
                type="button"
                onClick={() => {
                  setShowSortByDropdown(!showSortByDropdown);
                  setShowCategoryDropdown(false);
                  setShowDateDropdown(false);
                  setShowMajorAreaDropdown(false);
                  setShowSchoolDropdown(false);
                  setShowBranchDropdown(false);
                }}
                className="w-full flex items-center justify-between text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 transition-all text-left cursor-pointer"
              >
                <span className="truncate">
                  {
                    [
                      { value: 'score_desc', label: 'Rating (High to Low)' },
                      { value: 'score_asc', label: 'Rating (Low to High)' },
                      { value: 'name_asc', label: 'Name (A-Z)' },
                      { value: 'name_desc', label: 'Name (Z-A)' }
                    ].find(o => o.value === sortBy)?.label || sortBy
                  }
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${showSortByDropdown ? 'rotate-180 text-teal-600' : ''}`} />
              </button>

              <AnimatePresence>
                {showSortByDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowSortByDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
                    >
                      {[
                        { value: 'score_desc', label: 'Rating (High to Low)' },
                        { value: 'score_asc', label: 'Rating (Low to High)' },
                        { value: 'name_asc', label: 'Name (A-Z)' },
                        { value: 'name_desc', label: 'Name (Z-A)' }
                      ].map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => {
                            setSortBy(o.value);
                            setShowSortByDropdown(false);
                          }}
                          className={`w-full text-left p-2.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            sortBy === o.value ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{o.label}</span>
                          {sortBy === o.value && <Check size={14} className="text-teal-600 shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Legend */}
        {showFilters && !isDailyEvalCategory && (
          selectedMajorArea !== 'All Areas' && SUBJECTS_BY_AREA[selectedMajorArea] ? (
            <div className="mt-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-1 h-3 bg-teal-600 rounded-full"></span>
                {selectedMajorArea} SUBJECT LEGEND
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2">
                {SUBJECTS_BY_AREA[selectedMajorArea].map(s => (
                  <div key={s.code} className="text-[10px] text-slate-500 flex gap-2">
                    <span className="font-bold text-teal-700 whitespace-nowrap">{s.code}</span>
                    <span className="truncate" title={s.title}>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 px-2">
              <div className="text-[10px] text-slate-500"><span className="font-bold text-slate-700">CLJ:</span> Criminal Law and Jurisprudence</div>
              <div className="text-[10px] text-slate-500"><span className="font-bold text-slate-700">LEA:</span> Law Enforcement Administration</div>
              <div className="text-[10px] text-slate-500"><span className="font-bold text-slate-700">CDI:</span> Crime Detection and Investigation</div>
              <div className="text-[10px] text-slate-500"><span className="font-bold text-slate-700">FS:</span> Forensic Science</div>
              <div className="text-[10px] text-slate-500"><span className="font-bold text-slate-700">CRIM:</span> Criminology</div>
              <div className="text-[10px] text-slate-500"><span className="font-bold text-slate-700">CA:</span> Correctional Administration</div>
            </div>
          )
        )}
      </div>

      <div className="flex-1 px-4 sm:px-6 pb-6 overflow-x-auto">
        {isDailyEvalCategory ? (
          <DailyEvaluationRevieweeMatrix
            areaCode={selectedMajorArea === 'All Areas' ? 'CLJ' : selectedMajorArea}
            evaluationDate={selectedDate}
            revieweeRows={dailyEvalMatrixRows}
            selectedUserIds={selectedUserIds}
            onToggleSelectAll={handleToggleSelectAllUsers}
            onToggleSelectUser={handleToggleSelectUser}
            onViewDetails={onViewDetails}
            onUpdateScore={(user, subjCode, earned, possible) => {
              handleEditScoreClick({
                reviewee: user,
                category: selectedCategory,
                subject: subjCode,
                currentScore: earned,
                possiblePoints: possible,
              });
            }}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-teal-50 border-b border-slate-200">
                    <th className="px-4 py-3 font-bold text-teal-900 whitespace-nowrap text-center">
                      <input type="checkbox" className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
                      <span className="ml-2">Select</span>
                    </th>
                    <th className="px-4 py-3 font-bold text-teal-900 whitespace-nowrap">ID Number</th>
                    <th className="px-4 py-3 font-bold text-teal-900 w-full min-w-[200px]">Reviewee</th>
                    {displayedSubjects.map(s => (
                      <th key={s.key} className="px-3 py-3 font-bold text-teal-900 text-center whitespace-nowrap">{s.label}</th>
                    ))}
                    <th className="px-4 py-3 font-bold text-teal-900 text-center whitespace-nowrap">Combined</th>
                    <th className="px-4 py-3 font-bold text-teal-900 text-center whitespace-nowrap">Rating</th>
                    <th className="px-4 py-3 font-bold text-teal-900 text-center whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-bold text-teal-900 text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReviewees.map((row: any) => {
                    const { user, subjScores, totalEarned, totalPossible, rating, hasScores } = row;
                    const scoreColorClass = getScoreColor(rating);
                    return (
                      <tr key={user.uid || user.doc_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-slate-100/50">
                          <input type="checkbox" className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-blue-600">{user.id_number || user.seqId || user.seq_id || user.idNumber || user.revieweeId || user.id || '-'}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {getCanonicalFullName(user).displayName}
                        </td>
                        {subjScores.map((s: any, i: number) => {
                          const subjObj = displayedSubjects[i];
                          return (
                            <td key={i} className="px-3 py-3 text-center border-l border-slate-100/50">
                              <CompactEditableScoreCell
                                reviewee={user}
                                category={selectedCategory}
                                subject={subjObj?.label || 'CLJ'}
                                isAreaActivated={true}
                                canEditScores={true}
                                onEdit={handleEditScoreClick}
                              />
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center border-l border-slate-100 font-bold bg-slate-50/50 text-slate-700">
                          {hasScores ? `${totalEarned}/${totalPossible}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-black bg-slate-50/50">
                          {hasScores ? (
                            <span className={scoreColorClass}>{rating.toFixed(2)}%</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {subjScores.every((s: any) => s !== null && s.score !== null) ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Completed
                            </span>
                          ) : subjScores.some((s: any) => s !== null && s.score !== null) ? (
                            <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Not Started
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => onViewDetails && onViewDetails(user)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-md transition-colors"
                            >
                              <Eye size={14} />
                              View Details
                            </button>
                            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {processedReviewees.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                        No reviewees found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-auto px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, processedReviewees.length)} of {processedReviewees.length} reviewees
                </span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex items-center px-3 text-xs font-bold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </div>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Score Modal */}
      {editingScoreCell && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-900">Edit Score</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getCanonicalFullName(editingScoreCell.user).displayName} • {editingScoreCell.subject} ({editingScoreCell.category})
                </p>
              </div>
              <button 
                onClick={() => setEditingScoreCell(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Score Earned</label>
                <input 
                  type="number"
                  value={newScoreInput}
                  onChange={e => setNewScoreInput(e.target.value)}
                  placeholder="e.g. 85"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Total Items / Possible Points</label>
                <input 
                  type="number"
                  value={newTotalInput}
                  onChange={e => setNewTotalInput(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingScoreCell(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScore}
                disabled={savingScore}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {savingScore && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Save Score
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
