import React, { useState, useRef, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  UserX,
  Copy,
  Search,
  ChevronDown,
  Calendar,
  Loader2,
  X,
  UserCheck,
  RefreshCw,
  Info,
  Check,
  Sliders,
  Database
} from 'lucide-react';
import {
  processCsvRows,
  validateCsvHeaders,
  CsvParsedRow,
  ProcessCsvResult,
  RowStatus,
  MatchMethod
} from '../lib/scoreMatcher';
import { updateDoc, doc, serverTimestamp, collection, setDoc, writeBatch, getDocs } from 'firebase/firestore';
import { getScoreFieldName, normalizeScoreCategory } from '../utils/scoreFieldResolver';
import { getCanonicalFullName, normalizeNameForComparison } from '../utils/nameNormalization';
import { firestoreDb } from '../utils/firebaseClient';
import { AnimatedDatePicker } from './ui/animated-date-picker';

type PreviewStatusFilter = 'ALL' | 'READY' | 'UNMATCHED' | 'CONFLICTS' | 'DUPLICATES' | 'WITHOUT_SCORE' | 'INVALID' | 'EXISTING_SCORE';

const isUnmatchedRow = (row: CsvParsedRow) =>
  row.status === 'ID_NOT_FOUND' || row.status === 'ID_NOT_FOUND_NAME_MATCH';

const isConflictRow = (row: CsvParsedRow) =>
  row.status === 'ID_NAME_CONFLICT' ||
  row.status === 'AMBIGUOUS_NAME';

const isDuplicateRow = (row: CsvParsedRow) =>
  row.status === 'DUPLICATE_CSV_ID' ||
  row.status === 'DUPLICATE_DATABASE_ID' ||
  (row.status as string) === 'DUPLICATE_TARGET';

const INVALID_STATUSES = new Set<RowStatus>([
  'INVALID_ID',
  'INVALID_NAME',
  'INVALID_SCORE'
]);

export interface ScoreImporterProps {
  allUsers: any[];
  fetchAllUsers: () => void;
  currentUser?: any;
  backgroundTasks: any[];
  setBackgroundTasks: React.Dispatch<React.SetStateAction<any[]>>;
  scoreFolderId?: string;
}

type PreviewTab = 'all' | 'ready' | 'conflicts' | 'unmatched' | 'existing';

interface SummaryCardProps {
  label: string;
  count: number;
  filter: PreviewStatusFilter;
  activeFilter: PreviewStatusFilter;
  onSelect: (filter: PreviewStatusFilter) => void;
  tone: 'slate' | 'emerald' | 'rose' | 'amber' | 'violet' | 'yellow' | 'blue' | 'orange';
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  count,
  filter,
  activeFilter,
  onSelect,
  tone
}) => {
  const isActive = activeFilter === filter;
  
  const toneClasses = {
    slate: {
      bg: 'bg-slate-50 border-slate-200 text-slate-800',
      active: 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 text-slate-900',
      text: 'text-slate-500',
      count: 'text-slate-800'
    },
    emerald: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      active: 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400/20 text-emerald-900',
      text: 'text-emerald-700',
      count: 'text-emerald-800'
    },
    rose: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      active: 'bg-rose-100 border-rose-400 ring-2 ring-rose-400/20 text-rose-900',
      text: 'text-rose-700',
      count: 'text-rose-800'
    },
    amber: {
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      active: 'bg-amber-100 border-amber-400 ring-2 ring-amber-400/20 text-amber-900',
      text: 'text-amber-700',
      count: 'text-amber-800'
    },
    violet: {
      bg: 'bg-violet-50 border-violet-200 text-violet-800',
      active: 'bg-violet-100 border-violet-400 ring-2 ring-violet-400/20 text-violet-900',
      text: 'text-violet-700',
      count: 'text-violet-800'
    },
    yellow: {
      bg: 'bg-yellow-50 border-yellow-200 text-yellow-850',
      active: 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400/20 text-yellow-900',
      text: 'text-yellow-800',
      count: 'text-yellow-850'
    },
    blue: {
      bg: 'bg-blue-50 border-blue-200 text-blue-800',
      active: 'bg-blue-100 border-blue-400 ring-2 ring-blue-400/20 text-blue-900',
      text: 'text-blue-700',
      count: 'text-blue-800'
    },
    orange: {
      bg: 'bg-orange-50 border-orange-200 text-orange-800',
      active: 'bg-orange-100 border-orange-400 ring-2 ring-orange-400/20 text-orange-900',
      text: 'text-orange-700',
      count: 'text-orange-800'
    }
  };

  const currentTone = toneClasses[tone] || toneClasses.slate;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        onSelect(filter);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(filter);
        }
      }}
      className={`text-left border rounded-2xl p-3 transition-all duration-200 cursor-pointer hover:shadow-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
        isActive ? currentTone.active : `${currentTone.bg} hover:bg-opacity-80`
      }`}
    >
      <p className={`text-[10px] font-black uppercase tracking-wider ${currentTone.text}`}>{label}</p>
      <p className="text-2xl font-black mt-1 leading-none">{count}</p>
    </div>
  );
};

interface RevieweesWithoutScoreListProps {
  reviewees: any[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAssignClick: (reviewee: any) => void;
  onShowAll: () => void;
}

const RevieweesWithoutScoreList: React.FC<RevieweesWithoutScoreListProps> = ({
  reviewees,
  searchTerm,
  onSearchChange,
  onAssignClick,
  onShowAll
}) => {
  const filtered = reviewees.filter(r => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const fullName = `${r.last_name || r.lastName || ''}, ${r.first_name || r.firstName || ''} ${r.middle_name || r.middleName || ''}`.toLowerCase();
    const idNum = String(r.seq_id || r.id_number || r.student_id || '').toLowerCase();
    const email = String(r.email || '').toLowerCase();
    return fullName.includes(q) || idNum.includes(q) || email.includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h4 className="text-base font-black text-violet-950">Registered Reviewees Without an Uploaded Score</h4>
          <p className="text-xs text-violet-700 mt-0.5 font-medium">
            These eligible reviewees were not matched to any score in the current CSV import.
          </p>
        </div>
        <button
          type="button"
          onClick={onShowAll}
          className="self-start sm:self-auto px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider shadow-md shadow-violet-600/10 cursor-pointer"
        >
          Show All CSV Rows
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
          Showing Reviewees Without Score: {filtered.length} {filtered.length === 1 ? 'reviewee' : 'reviewees'}
        </p>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, ID Number, or email..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-violet-500 font-bold"
          />
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-600 uppercase text-[10px]">
              <tr>
                <th className="p-3">Full Name</th>
                <th className="p-3">ID Number</th>
                <th className="p-3">Email</th>
                <th className="p-3">School / Branch</th>
                <th className="p-3">Batch / Class</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r, idx) => {
                const fullName = `${r.last_name || r.lastName || ''}, ${r.first_name || r.firstName || ''} ${r.middle_name || r.middleName || ''}`.trim() || 'N/A';
                const idNum = r.seq_id || r.id_number || r.student_id || 'N/A';
                const schoolAndBranch = [r.school_name || r.schoolName, r.review_branch || r.reviewBranch || r.branch].filter(Boolean).join(' / ') || 'N/A';
                const batchClass = r.batch || r.class_name || r.className || r.class || 'N/A';
                const status = r.accountStatus || r.status || 'Active';

                return (
                  <tr key={r.doc_id || r.id || r.uid ? `${r.doc_id || r.id || r.uid}_${idx}` : `row_${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{fullName}</td>
                    <td className="p-3 font-mono font-bold text-slate-800">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{idNum}</span>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{r.email || 'N/A'}</td>
                    <td className="p-3 text-slate-600 font-medium">{schoolAndBranch}</td>
                    <td className="p-3 text-slate-600 font-medium">{batchClass}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">
                        {status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => onAssignClick(r)}
                        className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg font-bold text-[10px] uppercase transition-colors cursor-pointer inline-flex items-center gap-1 border border-violet-200"
                      >
                        Assign CSV Row
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No reviewees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const ScoreImporter: React.FC<ScoreImporterProps> = ({
  allUsers,
  fetchAllUsers,
  currentUser,
  backgroundTasks,
  setBackgroundTasks,
  scoreFolderId
}) => {
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raw CSV parsed data
  const [rawCsvData, setRawCsvData] = useState<any[]>([]);
  const [rawCsvHeaders, setRawCsvHeaders] = useState<string[]>([]);
  const [headerError, setHeaderError] = useState<{ message: string; missing: string[] } | null>(null);

  // Settings state
  const [selectedSubject, setSelectedSubject] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastSelectedSubject') || 'CLJ';
    }
    return 'CLJ';
  });

  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastSelectedCategory') || 'Preboard';
    }
    return 'Preboard';
  });

  useEffect(() => {
    localStorage.setItem('lastSelectedSubject', selectedSubject);
  }, [selectedSubject]);

  useEffect(() => {
    localStorage.setItem('lastSelectedCategory', selectedCategory);
  }, [selectedCategory]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [existingScorePolicy, setExistingScorePolicy] = useState<'replace' | 'skip' | 'keep_highest'>('replace');

  // UI Dropdowns
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Processing & Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessCsvResult | null>(null);
  const [rowsState, setRowsState] = useState<CsvParsedRow[]>([]);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('all');
  const [previewSearch, setPreviewSearch] = useState('');

  // Manual Matching Modal State
  const [manualMatchRowIdx, setManualMatchRowIdx] = useState<number | null>(null);
  const [manualUserSearch, setManualUserSearch] = useState('');

  // Commit / Upload execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitStage, setSubmitStage] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // Dynamic Filtering / Search states for the preview list
  const [previewStatusFilter, setPreviewStatusFilter] = useState<PreviewStatusFilter>('ALL');
  const [withoutScoreSearch, setWithoutScoreSearch] = useState('');
  const [filterSchoolPreview, setFilterSchoolPreview] = useState('ALL');
  const [filterBranchPreview, setFilterBranchPreview] = useState('ALL');
  const [filterBatchPreview, setFilterBatchPreview] = useState('ALL');
  const [assigningReviewee, setAssigningReviewee] = useState<any | null>(null);
  const [assignModalFilter, setAssignModalFilter] = useState<'ALL' | 'UNMATCHED' | 'CONFLICTS' | 'DUPLICATES'>('ALL');

  // Helper roles/matching checks
  const getUserRole = (u: any): string => {
    return String(u.role || u.user_role || u.userRole || '').trim();
  };

  const isReviewee = (u: any): boolean => {
    const role = getUserRole(u).toLowerCase();
    return role === 'reviewee' || role === 'student' || (!role && u.id_number);
  };

  // Memoized lists for Database Eligibility filter dropdowns
  const uniqueSchools = useMemo(() => {
    const schools = allUsers
      .filter(u => getUserRole(u) === "Reviewee" || isReviewee(u))
      .map(u => String(u.school_name || u.schoolName || u.school || '').trim())
      .filter(Boolean);
    return Array.from(new Set(schools)).sort();
  }, [allUsers]);

  const uniqueBranches = useMemo(() => {
    const branches = allUsers
      .filter(u => getUserRole(u) === "Reviewee" || isReviewee(u))
      .map(u => String(u.review_branch || u.branch || u.reviewBranch || '').trim())
      .filter(Boolean);
    return Array.from(new Set(branches)).sort();
  }, [allUsers]);

  const uniqueBatches = useMemo(() => {
    const batches = allUsers
      .filter(u => getUserRole(u) === "Reviewee" || isReviewee(u))
      .map(u => String(u.batch || u.class_name || u.className || u.class || '').trim())
      .filter(Boolean);
    return Array.from(new Set(batches)).sort();
  }, [allUsers]);

  // Memoized unique list of all active reviewees for the manual match modal
  const uniqueAllReviewees = useMemo(() => {
    const unique = new Map<string, any>();
    allUsers.forEach(u => {
      // Basic filtering: skip admins/staff and deleted/archived accounts
      const role = String(u.role || u.user_role || u.userRole || u.Role || '').trim().toLowerCase();
      if (role === 'admin' || role === 'staff') return;
      if (u.is_archived || u.isDeleted || u.deleted || u.is_deleted) return;
      
      // Ensure we have a valid reviewee (usually has an ID number or specific role)
      if (role !== 'reviewee' && role !== 'student' && !u.id_number && !u.seq_id) return;

      const key = u.uid || u.doc_id || u.id;
      if (key && !unique.has(key)) {
        unique.set(key, u);
      }
    });
    return Array.from(unique.values());
  }, [allUsers]);

  // Eligible Registered Reviewees filtered context for the "Reviewees Without Score" list
  const eligibleReviewees = useMemo(() => {
    return uniqueAllReviewees.filter(u => {
      // School filter
      if (filterSchoolPreview !== 'ALL') {
        const uSchool = String(u.school_name || u.schoolName || u.school || '').trim().toUpperCase();
        if (uSchool !== filterSchoolPreview.trim().toUpperCase()) return false;
      }
      // Branch filter
      if (filterBranchPreview !== 'ALL') {
        const uBranch = String(u.review_branch || u.branch || u.reviewBranch || '').trim().toUpperCase();
        if (uBranch !== filterBranchPreview.trim().toUpperCase()) return false;
      }
      // Batch/Class filter
      if (filterBatchPreview !== 'ALL') {
        const uBatch = String(u.batch || u.class_name || u.className || u.class || '').trim().toUpperCase();
        if (uBatch !== filterBatchPreview.trim().toUpperCase()) return false;
      }

      return true;
    });
  }, [uniqueAllReviewees, filterSchoolPreview, filterBranchPreview, filterBatchPreview]);

  // Dynamic Matching Summary Selector
  const matchingSummary = useMemo(() => {
    const uniqueImportRows = Array.from(
      new Map<any, CsvParsedRow>(
        rowsState.map(row => [
          row.importRowId || row.rowNum,
          row
        ])
      ).values()
    );

    const matchedRevieweeKeys = new Set(
      uniqueImportRows
        .map(row =>
          row.matchedRevieweeDocumentId ||
          row.matchedRevieweeUid ||
          row.matchedRevieweeId ||
          row.matchedUserId ||
          (row.matchedUser?.doc_id || row.matchedUser?.id || row.matchedUser?.uid) ||
          null
        )
        .filter((value): value is string => Boolean(value))
    );

    const revieweesWithoutScore = eligibleReviewees.filter(reviewee => {
      const revieweeKey = reviewee.documentId || reviewee.uid || reviewee.id || reviewee.doc_id;
      return Boolean(revieweeKey) && !matchedRevieweeKeys.has(revieweeKey);
    });

    return {
      total: uniqueImportRows.length,
      ready: uniqueImportRows.filter(row => row.status === 'READY').length,
      unmatched: uniqueImportRows.filter(isUnmatchedRow).length,
      conflicts: uniqueImportRows.filter(isConflictRow).length,
      duplicates: uniqueImportRows.filter(isDuplicateRow).length,
      withoutScore: revieweesWithoutScore.length,
      invalid: uniqueImportRows.filter(row => INVALID_STATUSES.has(row.status)).length,
      existingScores: uniqueImportRows.filter(row => row.status === 'EXISTING_SCORE').length,
      revieweesWithoutScore
    };
  }, [rowsState, eligibleReviewees]);

  // Helper for background task tracking
  const createBackgroundTask = (name: string) => {
    const taskId = `task_${Date.now()}`;
    const newTask = {
      id: taskId,
      name,
      status: 'running',
      progress: 0,
      message: 'Starting import...',
      timestamp: new Date().toLocaleTimeString()
    };
    setBackgroundTasks(prev => [newTask, ...prev]);
    return taskId;
  };

  const updateBackgroundTask = (taskId: string, update: { progress?: number; status?: 'running' | 'completed' | 'failed'; message?: string }) => {
    setBackgroundTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...update } : t));
  };

  // Handle File Selection or Drop
  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setHeaderError({
        message: 'Please upload a valid CSV file (.csv extension).',
        missing: []
      });
      return;
    }

    setHeaderError(null);
    setFile(selectedFile);
    setProcessResult(null);
    setRowsState([]);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const data = results.data as any[];
        const headers = results.meta.fields || [];

        setRawCsvData(data);
        setRawCsvHeaders(headers);

        const headerVal = validateCsvHeaders(headers);
        if (!headerVal.isValid) {
          setHeaderError({
            message: `Missing required CSV headers: ${headerVal.missingColumns.join(', ')}`,
            missing: headerVal.missingColumns
          });
        } else {
          // Auto analyze
          runCsvAnalysis(data, headers, selectedSubject, selectedCategory, selectedDate);
        }
      },
      error: (error) => {
        setHeaderError({
          message: `CSV Parse Error: ${error.message}`,
          missing: []
        });
      }
    });
  };

  const runCsvAnalysis = (
    csvData: any[],
    headers: string[],
    subj: string,
    cat: string,
    dateStr: string
  ) => {
    setIsAnalyzing(true);
    setTimeout(() => {
      try {
        const result = processCsvRows(csvData, headers, allUsers, subj, cat, dateStr);
        const enrichedRows = result.processedRows.map(r => ({
          ...r,
          matchedRevieweeDocumentId: r.matchedUser?.doc_id || r.matchedUser?.id || r.matchedUserId || null,
          matchedRevieweeUid: r.matchedUser?.uid || null,
          matchedRevieweeId: r.matchedUserId || r.matchedUser?.id || null,
        }));
        setProcessResult(result);
        setRowsState(enrichedRows);
      } catch (err: any) {
        setHeaderError({
          message: `Error analyzing CSV: ${err.message || 'Unknown error'}`,
          missing: []
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, 150);
  };

  // Re-run analysis when subject, category, or date changes
  const handleSettingsChange = (subj: string, cat: string, dateStr: string) => {
    setSelectedSubject(subj);
    setSelectedCategory(cat);
    setSelectedDate(dateStr);
    if (rawCsvData.length > 0 && rawCsvHeaders.length > 0) {
      runCsvAnalysis(rawCsvData, rawCsvHeaders, subj, cat, dateStr);
    }
  };

  // Manual Matching
  const handleAssignManualUser = (user: any, overrideRowIdx?: number | null) => {
    const activeRowIdx = overrideRowIdx !== undefined && overrideRowIdx !== null ? overrideRowIdx : manualMatchRowIdx;
    if (activeRowIdx === null) return;

    setRowsState(prevRows => {
      const fieldMatch = selectedSubject.trim().toUpperCase();
      const categoryMatch = selectedCategory.trim().toLowerCase().replace(/\s+/g, '');
      const normalizedDateKey = selectedDate.replace(/\//g, '-');
      const normalizedCategoryKey = categoryMatch.toLowerCase().replace(/[^a-z0-9]/g, '');
      let scoreField = '';
      if (categoryMatch === 'preboard') {
        scoreField = `preboard_${fieldMatch.toLowerCase()}`;
      } else if (categoryMatch === 'pretest' || categoryMatch === 'diagnostic') {
        scoreField = `diag_${fieldMatch.toLowerCase()}`;
      } else if (categoryMatch === 'posttest' || categoryMatch === 'post') {
        scoreField = `post_${fieldMatch.toLowerCase()}`;
      } else {
        scoreField = `score_${fieldMatch.toLowerCase()}_${categoryMatch}`;
      }

      const userDocId = user.doc_id || user.uid || '';
      const scoreRecordKey = `${userDocId}_${normalizedCategoryKey}_${normalizedDateKey}`;

      const existingInFlat = user[scoreField] !== undefined && user[scoreField] !== null && String(user[scoreField]).trim() !== '';
      const existingByDate = user.scoresByDate && user.scoresByDate[scoreRecordKey];
      const hasExistingScore = Boolean(existingInFlat || existingByDate);

      return prevRows.map(targetRow => {
        if (targetRow.rowNum !== activeRowIdx) return targetRow;

        const isDuplicateTarget = prevRows.some(other =>
          other.rowNum !== activeRowIdx &&
          (other.matchedUserId === userDocId || (other.matchedUser && (other.matchedUser.doc_id === userDocId || other.matchedUser.uid === userDocId))) &&
          (other.status === 'READY' || other.status === 'EXISTING_SCORE')
        );

        let status: RowStatus = 'READY';
        let remarks = 'Manually matched by administrator.';
        if (isDuplicateTarget) {
          status = 'DUPLICATE_TARGET' as RowStatus;
          remarks = 'This reviewee is already assigned to another CSV row in this import batch.';
        } else if (hasExistingScore) {
          status = 'EXISTING_SCORE' as RowStatus;
          remarks = `Score already exists for this reviewee (${user[scoreField] || existingByDate?.score}).`;
        }

        const updateData = {
          [scoreField]: String(targetRow.earnedPoints || 0),
          category: categoryMatch,
          subject: fieldMatch,
          [`date_${fieldMatch.toLowerCase()}_${normalizedCategoryKey}`]: selectedDate,
          [`scoresByDate.${scoreRecordKey}`]: {
            category: categoryMatch,
            categoryKey: normalizedCategoryKey,
            score: Number(targetRow.earnedPoints || 0),
            rawScore: Number(targetRow.earnedPoints || 0),
            earnedPoints: Number(targetRow.earnedPoints || 0),
            possiblePoints: Number(targetRow.possiblePoints || 100),
            percentage: targetRow.percentage !== null ? targetRow.percentage : Number(targetRow.earnedPoints || 0),
            date: normalizedDateKey,
            source: 'uploaded_manual',
            remarks: 'Uploaded via CSV (Manually Assigned)',
            updatedAt: new Date().toISOString()
          },
          [`latestScores.${normalizedCategoryKey}`]: {
            category: categoryMatch,
            categoryKey: normalizedCategoryKey,
            score: Number(targetRow.earnedPoints || 0),
            date: normalizedDateKey,
            updatedAt: new Date().toISOString()
          },
          latestScoreUploadAt: new Date().toISOString()
        };

        return {
          ...targetRow,
          matchedUser: user,
          matchedUserId: userDocId,
          matchedUserName: `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || user.email || 'User',
          matchedRevieweeDocumentId: user.doc_id || user.id || userDocId || null,
          matchedRevieweeUid: user.uid || null,
          matchedRevieweeId: userDocId || user.id || null,
          matchMethod: 'MANUAL_SELECTION' as MatchMethod,
          status,
          remarks,
          manuallyMatchedBy: currentUser?.uid || currentUser?.doc_id || 'Admin',
          manuallyMatchedAt: new Date().toISOString(),
          originalCsvStudentId: targetRow.csvStudentId,
          originalCsvStudentName: targetRow.csvFullName,
          updateData
        };
      });
    });

    if (overrideRowIdx === undefined || overrideRowIdx === null) {
      setManualMatchRowIdx(null);
      setManualUserSearch('');
    }
  };

  // Render Status Badge Indicator
  const renderStatusBadge = (status: RowStatus, matchMethod: MatchMethod) => {
    const s = String(status);
    
    switch (s) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
            {matchMethod === 'ID_EXACT_NAME_VERIFIED' && 'Verified ID & Name'}
            {matchMethod === 'ID_EXACT_NAME_PARTIAL' && 'Verified ID (Partial Name)'}
            {matchMethod === 'NAME_EXACT_UNIQUE' && 'Name Match'}
            {matchMethod === 'MANUAL_SELECTION' && 'Manually Matched'}
            {matchMethod === 'NONE' && 'Ready'}
          </span>
        );
      case 'ID_NAME_CONFLICT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={12} className="text-rose-600 shrink-0" />
            Conflict: Name Mismatch
          </span>
        );
      case 'ID_NOT_FOUND_NAME_MATCH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={12} className="text-amber-600 shrink-0" />
            Unmatched: Name Match Only
          </span>
        );
      case 'AMBIGUOUS_NAME':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <HelpCircle size={12} className="text-orange-600 shrink-0" />
            Conflict: Ambiguous Name
          </span>
        );
      case 'ID_NOT_FOUND':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <UserX size={12} className="text-slate-500 shrink-0" />
            Unmatched: Not Found
          </span>
        );
      case 'INVALID_SCORE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle size={12} className="text-rose-700 shrink-0" />
            Invalid Score
          </span>
        );
      case 'DUPLICATE_CSV_ID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Copy size={12} className="text-purple-600 shrink-0" />
            Duplicate: CSV ID
          </span>
        );
      case 'DUPLICATE_DATABASE_ID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Copy size={12} className="text-purple-600 shrink-0" />
            Duplicate: Database ID
          </span>
        );
      case 'DUPLICATE_TARGET':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Copy size={12} className="text-purple-600 shrink-0" />
            Duplicate: Target Assigned
          </span>
        );
      case 'EXISTING_SCORE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
            <AlertTriangle size={12} className="text-yellow-600 shrink-0" />
            Existing Score
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{s}</span>;
    }
  };

  // Filter preview rows
  const filteredPreviewRows = useMemo(() => {
    // 1. Initial filter by status
    let filtered = [...rowsState];
    
    if (previewStatusFilter !== 'ALL') {
      filtered = filtered.filter(row => {
        switch (previewStatusFilter) {
          case 'READY': return row.status === 'READY';
          case 'UNMATCHED': return isUnmatchedRow(row);
          case 'CONFLICTS': return isConflictRow(row);
          case 'DUPLICATES': return isDuplicateRow(row);
          case 'INVALID': return INVALID_STATUSES.has(row.status);
          case 'EXISTING_SCORE': return row.status === 'EXISTING_SCORE';
          case 'WITHOUT_SCORE': return false; // Handled separately by component
          default: return true;
        }
      });
    }

    // 2. Filter by search term
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      filtered = filtered.filter(row => {
        const matchName = (row.csvFullName || '').toLowerCase();
        const matchId = (row.csvStudentId || '').toLowerCase();
        const matchedUserName = (row.matchedUserName || '').toLowerCase();
        const matchedUserEmail = (row.matchedUser?.email || '').toLowerCase();
        return matchName.includes(q) || matchId.includes(q) || matchedUserName.includes(q) || matchedUserEmail.includes(q);
      });
    }

    return filtered;
  }, [rowsState, previewStatusFilter, previewSearch]);

  // Commit Scores Handler
  const handleCommitScores = async () => {
    const validRows = rowsState.filter(r => r.status === 'READY' && r.matchedUser);

    if (validRows.length === 0) {
      alert('No ready rows with matched reviewees available to import.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('working');
    setSubmitProgress(5);
    setSubmitStage('Preparing Database Write');
    setSubmitMessage(`Processing ${validRows.length} valid score records...`);

    const taskId = createBackgroundTask(`Importing ${validRows.length} Scores (${selectedSubject})`);

    try {
      if (!firestoreDb) throw new Error("Firestore database is not initialized.");

      // 1. Fetch existing score_events to find or create a column for this imported session
      const eventsSnap = await getDocs(collection(firestoreDb, 'score_events'));
      const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const normCat = normalizeScoreCategory(selectedCategory);
      const normSubj = selectedSubject.toLowerCase();
      const normDate = selectedDate;

      let existingEvent = events.find(evt => {
        const isSameCat = normalizeScoreCategory(evt.category) === normCat;
        const isSameSubj = String(evt.subjectId || evt.subjectName || evt.majorAreaId || '').toLowerCase().trim() === normSubj;
        const isSameDate = evt.evaluationDate === normDate;
        return isSameCat && isSameSubj && isSameDate;
      });

      let eventId = '';
      let totalItems = 100;
      const firstReadyRow = validRows.find(r => r.possiblePoints !== null && r.possiblePoints > 0);
      if (firstReadyRow) {
        totalItems = Number(firstReadyRow.possiblePoints);
      }

      if (existingEvent) {
        eventId = existingEvent.id;
        totalItems = existingEvent.totalItems || totalItems;
      } else {
        const eventRef = doc(collection(firestoreDb, "score_events"));
        eventId = eventRef.id;
        await setDoc(eventRef, {
          scoreFolderId: scoreFolderId || "main",
          category: selectedCategory,
          majorAreaId: selectedSubject.toLowerCase(),
          majorAreaName: selectedSubject,
          subjectId: selectedSubject.toLowerCase(),
          subjectName: selectedSubject,
          evaluationDate: selectedDate,
          totalItems: totalItems,
          publicationStatus: "published",
          createdBy: currentUser?.uid || "admin",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      const subjectKey = selectedSubject.toLowerCase();
      const categoryKey = selectedCategory.toLowerCase().replace(/\s+/g, '');
      let fieldName = '';
      if (categoryKey === 'preboard') {
        fieldName = `preboard_${subjectKey}`;
      } else if (categoryKey === 'pretest' || categoryKey === 'diagnostic') {
        fieldName = `diag_${subjectKey}`;
      } else if (categoryKey === 'posttest' || categoryKey === 'post') {
        fieldName = `post_${subjectKey}`;
      } else {
        fieldName = `score_${subjectKey}_${categoryKey}`;
      }

      let processedCount = 0;
      const batchSize = 25;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const chunk = validRows.slice(i, i + batchSize);

        for (const row of chunk) {
          const user = row.matchedUser;
          const userDocId = user?.doc_id || user?.uid || row.matchedUserId;

          if (!userDocId || typeof userDocId !== 'string' || userDocId === 'unmatched' || !user) continue;

          const score = Number(row.earnedPoints || 0);
          const possible = Number(row.possiblePoints || totalItems || 100);

          const existingRecord = user.assessmentRecords?.[eventId];
          const currentVal = existingRecord?.score !== undefined ? existingRecord.score : user[fieldName];

          if (currentVal !== undefined && currentVal !== null) {
            if (existingScorePolicy === 'skip') {
              continue;
            } else if (existingScorePolicy === 'keep_highest') {
              if (typeof currentVal === 'number' && score <= currentVal) {
                continue;
              }
            }
          }

          const normalizedCategoryKey = normalizeScoreCategory(selectedCategory);
          const scoreRecordKey = `${userDocId}_${normalizedCategoryKey}_${selectedDate}`;

          const updatePayload: any = {
            ...(row.updateData || {}),
            [fieldName]: score,
            [`${fieldName}_total`]: possible,
            [`scoresByDate.${scoreRecordKey}`]: {
              scoreEventId: eventId,
              category: selectedCategory,
              categoryKey: normalizedCategoryKey,
              score: score,
              rawScore: score,
              earnedPoints: score,
              possiblePoints: possible,
              percentage: (score / possible) * 100,
              date: selectedDate,
              scoreFolderId: scoreFolderId || "main",
              source: 'score_import',
              remarks: 'Imported via CSV',
              updatedAt: new Date().toISOString()
            },
            [`assessmentRecords.${eventId}`]: {
              scoreEventId: eventId,
              category: selectedCategory,
              date: selectedDate,
              score: score,
              totalScore: possible,
              subject: selectedSubject,
              subjectCode: selectedSubject.toLowerCase(),
              scoreFolderId: scoreFolderId || "main",
              publicationStatus: "published",
              updatedAt: new Date().toISOString()
            },
            last_score_update: serverTimestamp(),
            updated_at: new Date().toISOString()
          };

          const userRef = doc(firestoreDb, 'users', userDocId);
          await updateDoc(userRef, updatePayload);

          // Record in activity log
          const logRef = doc(collection(firestoreDb, 'activity_logs'));
          await setDoc(logRef, {
            user_id: userDocId,
            user_name: row.matchedUserName,
            action: 'SCORE_IMPORT',
            details: `Imported ${selectedSubject} (${selectedCategory}): ${row.earnedPoints}/${row.possiblePoints} (${row.percentage}%)`,
            performed_by: currentUser?.email || 'Admin',
            timestamp: serverTimestamp(),
            created_at: new Date().toISOString()
          });
        }

        processedCount += chunk.length;
        const pct = Math.min(95, Math.round((processedCount / validRows.length) * 90) + 5);
        setSubmitProgress(pct);
        setSubmitMessage(`Updated ${processedCount} of ${validRows.length} records...`);
        updateBackgroundTask(taskId, { progress: pct, message: `Updated ${processedCount}/${validRows.length}` });
      }

      setSubmitProgress(100);
      setSubmitStatus('success');
      setSubmitStage('Import Complete');
      setSubmitMessage(`Successfully imported ${validRows.length} scores for ${selectedSubject}!`);
      updateBackgroundTask(taskId, { progress: 100, status: 'completed', message: 'Import successful' });

      // Save activation record
      try {
        const importId = "import_" + Date.now();
        const schoolId = String(currentUser?.school_name || "ckcm").toLowerCase().trim() || "default";
        const catNormalized = selectedCategory.toLowerCase().replace(/\s+/g, '');
        const subjNormalized = selectedSubject.toLowerCase();
        
        // Save to score_area_settings flat collection
        const flatDocId = `${schoolId}_${catNormalized}_${subjNormalized}`;
        const flatRef = doc(firestoreDb, "score_area_settings", flatDocId);
        await setDoc(flatRef, {
          schoolId,
          category: catNormalized,
          subject: subjNormalized,
          activated: true,
          activatedAt: serverTimestamp(),
          activatedByUid: currentUser?.uid || "system",
          latestImportId: importId,
          latestImportAt: serverTimestamp()
        }, { merge: true });

        // Save to schools/{schoolId}/score_area_settings/{category_subject}
        const scopedRef = doc(firestoreDb, "schools", schoolId, "score_area_settings", `${catNormalized}_${subjNormalized}`);
        await setDoc(scopedRef, {
          schoolId,
          category: catNormalized,
          subject: subjNormalized,
          activated: true,
          activatedAt: serverTimestamp(),
          activatedByUid: currentUser?.uid || "system",
          latestImportId: importId,
          latestImportAt: serverTimestamp()
        }, { merge: true });

        // Save to score_import_history to satisfy rule #2
        const historyRef = doc(firestoreDb, "score_import_history", importId);
        await setDoc(historyRef, {
          importId,
          schoolId,
          category: catNormalized,
          subject: subjNormalized,
          status: "SUCCESS",
          importedAt: serverTimestamp(),
          importedByUid: currentUser?.uid || "system",
          recordsCount: validRows.length
        });

        console.log("Score area activated successfully:", flatDocId);
      } catch (actErr) {
        console.error("Error saving score activation record:", actErr);
      }

      // Refresh list
      fetchAllUsers();
    } catch (err: any) {
      console.error('Score import error:', err);
      setSubmitStatus('error');
      setSubmitStage('Import Failed');
      setSubmitMessage(err.message || 'An error occurred during database write.');
      updateBackgroundTask(taskId, { progress: 100, status: 'failed', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setRawCsvData([]);
    setRawCsvHeaders([]);
    setProcessResult(null);
    setRowsState([]);
    setHeaderError(null);
    setSubmitStatus('idle');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 sm:p-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 shrink-0">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Import Examination Scores</h2>
                <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Admin Tool
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Upload ZipGrade or standard CSV score sheets. The system automatically cross-references reviewee IDs and names, flags conflicts, and validates score entries prior to importing.
              </p>
            </div>
          </div>

          {file && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-2xl transition-colors uppercase tracking-wider self-start lg:self-center cursor-pointer"
            >
              <RefreshCw size={14} />
              Upload Another File
            </button>
          )}
        </div>

        {/* Expected CSV Header Reference */}
        <div className="mt-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-black text-slate-800 uppercase tracking-wider text-[10px] bg-slate-200/70 px-2 py-0.5 rounded">
            Required Columns:
          </span>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">Student First Name</span>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">Student Last Name</span>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">Student ID</span>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">Earned Points</span>
          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">Possible Points</span>
        </div>
      </div>

      {/* Header Validation Error Notice */}
      {headerError && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 mb-6 flex items-start gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black text-rose-900">CSV Header Validation Failed</h4>
            <p className="text-xs text-rose-700 mt-1">{headerError.message}</p>
            {headerError.missing.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {headerError.missing.map(col => (
                  <span key={col} className="bg-rose-200/80 text-rose-900 font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg">
                    Missing: {col}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setHeaderError(null)}
            className="text-rose-400 hover:text-rose-700 p-1 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* STEP 1: UPLOAD DROPZONE (if no file loaded) */}
      {!file && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80 flex flex-col items-center justify-center min-h-[320px]">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`
              w-full max-w-2xl p-10 rounded-3xl border-2 border-dashed transition-all cursor-pointer text-center
              flex flex-col items-center justify-center gap-4
              ${isDragging 
                ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' 
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/80'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <p className="text-base font-black text-slate-800">
                Drag and drop your score CSV file here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports ZipGrade CSV export format or standard score spreadsheets (.csv)
              </p>
            </div>

            <button
              type="button"
              className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all pointer-events-none"
            >
              Browse Computer
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CONFIGURATION & PREVIEW (when file is loaded) */}
      {file && (
        <div className="space-y-6">
          {/* Controls Bar: Subject, Category, Exam Date, Policy */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Sliders size={14} className="text-blue-600" />
              Import Settings & Subject Target
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Subject Matter Dropdown */}
              <div className="relative">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Subject Matter
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubjectDropdown(!showSubjectDropdown);
                    setShowCategoryDropdown(false);
                  }}
                  className="w-full flex items-center justify-between text-xs p-3 border border-slate-200 rounded-xl hover:border-blue-400 outline-none bg-white font-bold text-slate-800 transition-all text-left cursor-pointer"
                >
                  <span className="truncate">
                    {[
                      { value: 'CLJ', label: 'Criminal Law & Jurisprudence (CLJ)' },
                      { value: 'LEA', label: 'Law Enforcement Admin (LEA)' },
                      { value: 'FS', label: 'Forensic Science (FS)' },
                      { value: 'CDI', label: 'Crime Detection & Invest (CDI)' },
                      { value: 'CRIM', label: 'Criminology (CRIM)' },
                      { value: 'CA', label: 'Correctional Admin (CA)' }
                    ].find(s => s.value === selectedSubject)?.label || selectedSubject}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showSubjectDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showSubjectDropdown && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setShowSubjectDropdown(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto"
                      >
                        {[
                          { value: 'CLJ', label: 'Criminal Law & Jurisprudence (CLJ)' },
                          { value: 'LEA', label: 'Law Enforcement Admin (LEA)' },
                          { value: 'FS', label: 'Forensic Science (FS)' },
                          { value: 'CDI', label: 'Crime Detection & Invest (CDI)' },
                          { value: 'CRIM', label: 'Criminology (CRIM)' },
                          { value: 'CA', label: 'Correctional Admin (CA)' }
                        ].map(subj => (
                          <button
                            key={subj.value}
                            type="button"
                            onClick={() => {
                              handleSettingsChange(subj.value, selectedCategory, selectedDate);
                              setShowSubjectDropdown(false);
                            }}
                            className={`w-full text-left p-2.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                              selectedSubject === subj.value ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{subj.label}</span>
                            {selectedSubject === subj.value && <Check size={14} className="text-blue-600" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Exam Category Dropdown */}
              <div className="relative">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Exam Category
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryDropdown(!showCategoryDropdown);
                    setShowSubjectDropdown(false);
                  }}
                  className="w-full flex items-center justify-between text-xs p-3 border border-slate-200 rounded-xl hover:border-blue-400 outline-none bg-white font-bold text-slate-800 transition-all text-left cursor-pointer"
                >
                  <span>{selectedCategory}</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showCategoryDropdown && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setShowCategoryDropdown(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
                      >
                        {['Preboard', 'Pretest', 'Posttest', 'Quiz', 'Evaluation', 'Removal', 'Diagnostic'].map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              handleSettingsChange(selectedSubject, cat, selectedDate);
                              setShowCategoryDropdown(false);
                            }}
                            className={`w-full text-left p-2.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                              selectedCategory === cat ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{cat}</span>
                            {selectedCategory === cat && <Check size={14} className="text-blue-600" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Exam Date Picker */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Exam Date
                </label>
                <AnimatedDatePicker
                  value={selectedDate}
                  onChange={(val) => handleSettingsChange(selectedSubject, selectedCategory, val)}
                  triggerClassName="border-slate-200 hover:border-blue-400"
                />
              </div>

              {/* Existing Score Policy */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Existing Score Policy
                </label>
                <select
                  value={existingScorePolicy}
                  onChange={(e) => setExistingScorePolicy(e.target.value as any)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl hover:border-blue-400 outline-none bg-white font-bold text-slate-800 transition-all"
                >
                  <option value="replace">Overwrite Existing Scores</option>
                  <option value="skip">Skip Existing Scores</option>
                  <option value="keep_highest">Keep Highest Score Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Visual Metrics Cards */}
          {processResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <SummaryCard
                label="All CSV Rows"
                count={matchingSummary.total}
                filter="ALL"
                activeFilter={previewStatusFilter}
                onSelect={setPreviewStatusFilter}
                tone="slate"
              />
              <SummaryCard
                label="Ready"
                count={matchingSummary.ready}
                filter="READY"
                activeFilter={previewStatusFilter}
                onSelect={setPreviewStatusFilter}
                tone="emerald"
              />
              <SummaryCard
                label="Unmatched"
                count={matchingSummary.unmatched}
                filter="UNMATCHED"
                activeFilter={previewStatusFilter}
                onSelect={setPreviewStatusFilter}
                tone="amber"
              />
              <SummaryCard
                label="Conflicts"
                count={matchingSummary.conflicts}
                filter="CONFLICTS"
                activeFilter={previewStatusFilter}
                onSelect={setPreviewStatusFilter}
                tone="orange"
              />
              <SummaryCard
                label="Duplicates"
                count={matchingSummary.duplicates}
                filter="DUPLICATES"
                activeFilter={previewStatusFilter}
                onSelect={setPreviewStatusFilter}
                tone="rose"
              />
              <SummaryCard
                label={`Reviewee${matchingSummary.withoutScore !== 1 ? 's' : ''} Without Score`}
                count={matchingSummary.withoutScore}
                filter="WITHOUT_SCORE"
                activeFilter={previewStatusFilter}
                onSelect={setPreviewStatusFilter}
                tone="violet"
              />
              <SummaryCard
                label="Invalid"
                count={matchingSummary.invalid}
                filter="INVALID"
                activeFilter={previewStatusFilter}
                onSelect={setPreviewStatusFilter}
                tone="yellow"
              />
              <SummaryCard
                label="Existing Scores"
                count={matchingSummary.existingScores}
                filter="EXISTING_SCORE"
                activeFilter={previewStatusFilter}
                onSelect={setPreviewStatusFilter}
                tone="blue"
              />
            </div>
          )}

          {/* Filter Tabs & Search Controls */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Active Filter:
                </span>
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 uppercase tracking-wide">
                  {previewStatusFilter === 'ALL' && 'All CSV Rows'}
                  {previewStatusFilter === 'READY' && 'Ready to Import'}
                  {previewStatusFilter === 'UNMATCHED' && 'Unmatched Records'}
                  {previewStatusFilter === 'CONFLICTS' && 'Conflicts'}
                  {previewStatusFilter === 'DUPLICATES' && 'Duplicates'}
                  {previewStatusFilter === 'WITHOUT_SCORE' && 'Reviewees Without Score'}
                  {previewStatusFilter === 'INVALID' && 'Invalid CSV Rows'}
                  {previewStatusFilter === 'EXISTING_SCORE' && 'Existing Scores'}
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {previewStatusFilter !== 'WITHOUT_SCORE' && (
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search student or ID..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-bold text-slate-800"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCommitScores}
                  disabled={isSubmitting || matchingSummary.ready === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer shrink-0"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  Confirm & Import ({matchingSummary.ready})
                </button>
              </div>
            </div>

            {/* Submission Progress Indicator */}
            {submitStatus !== 'idle' && (
              <div className="p-4 mb-4 rounded-2xl border bg-slate-50/80 border-slate-200">
                <div className="flex items-center justify-between text-xs font-black mb-2">
                  <span className="text-slate-800 flex items-center gap-2">
                    {submitStatus === 'working' && <Loader2 size={14} className="animate-spin text-blue-600" />}
                    {submitStatus === 'success' && <CheckCircle2 size={14} className="text-emerald-600" />}
                    {submitStatus === 'error' && <AlertCircle size={14} className="text-rose-600" />}
                    {submitStage}
                  </span>
                  <span className="text-slate-500">{submitProgress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      submitStatus === 'success' ? 'bg-emerald-600' : submitStatus === 'error' ? 'bg-rose-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${submitProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-bold">{submitMessage}</p>
              </div>
            )}

            {/* Conditional Render of Table vs. Reviewees Without Score */}
            {previewStatusFilter === 'WITHOUT_SCORE' ? (
              <RevieweesWithoutScoreList
                reviewees={matchingSummary.revieweesWithoutScore}
                searchTerm={withoutScoreSearch}
                onSearchChange={setWithoutScoreSearch}
                onAssignClick={(reviewee) => setAssigningReviewee(reviewee)}
                onShowAll={() => setPreviewStatusFilter('ALL')}
              />
            ) : (
              /* Main Parsed & Matched Rows Table */
              <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/90 border-b border-slate-200 font-black text-slate-600 uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-3 w-12 text-center">Row</th>
                      <th className="p-3">CSV Student ID</th>
                      <th className="p-3">CSV Student Name</th>
                      <th className="p-3">Points Earned</th>
                      <th className="p-3">Matched Reviewee Account</th>
                      <th className="p-3">Match Status & Validation</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isAnalyzing ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                          Analyzing CSV rows and cross-referencing database records...
                        </td>
                      </tr>
                    ) : filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400 italic">
                          No rows match the current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map((row) => (
                        <tr key={row.rowNum} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-center font-mono font-bold text-slate-400">{row.rowNum}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {row.csvStudentId ? (
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{row.csvStudentId}</span>
                            ) : (
                              <span className="italic text-slate-400">Missing</span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-slate-900 uppercase">{row.csvFullName?.toUpperCase()}</td>
                          <td className="p-3">
                            <span className="font-mono font-bold text-slate-900">
                              {row.rawEarnedPoints} / {row.rawPossiblePoints}
                            </span>
                            {row.percentage !== null && (
                              <span className="ml-2 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded">
                                {row.percentage}%
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {row.matchedUser ? (
                              <div>
                                <p className="font-bold text-slate-900 uppercase">{row.matchedUserName?.toUpperCase()}</p>
                                <p className="text-[10px] font-mono text-slate-400">
                                  ID: {row.matchedUser.seq_id || row.matchedUser.id_number || row.matchedUserId}
                                </p>
                              </div>
                            ) : (
                              <span className="italic text-slate-400">No account assigned</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              {renderStatusBadge(row.status, row.matchMethod)}
                              {row.remarks && (
                                <p className="text-[10px] text-slate-500 leading-tight max-w-xs">{row.remarks}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setManualMatchRowIdx(row.rowNum);
                                setManualUserSearch(row.csvLast || row.csvFullName || '');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            >
                              {row.matchedUser ? 'Change Match' : 'Manual Match'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Matching Modal */}
      {manualMatchRowIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Manual Student Assignment</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Row #{manualMatchRowIdx}: Search reviewee database to assign matching account
                </p>
              </div>
              <button
                onClick={() => setManualMatchRowIdx(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search reviewee name, ID number, or email..."
                  value={manualUserSearch}
                  onChange={(e) => setManualUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl max-h-60" style={{ fontFamily: "'Google Sans', 'Plus Jakarta Sans', 'Inter', sans-serif" }}>
              {uniqueAllReviewees
                .filter(u => {
                  if (!manualUserSearch.trim()) return true;
                  const qNorm = normalizeNameForComparison(manualUserSearch);
                  const canonical = getCanonicalFullName(u);
                  const extraSearch = normalizeNameForComparison([
                    u.seq_id, u.seqId,
                    u.id_number, u.idNumber,
                    u.student_id, u.studentId,
                    u.email,
                    u.school_name, u.review_branch, u.branch
                  ].filter(Boolean).join(' '));

                  return canonical.normalizedName.includes(qNorm) || extraSearch.includes(qNorm);
                })
                .slice(0, 30)
                .map((user, idx) => {
                  const canonical = getCanonicalFullName(user);
                  return (
                  <div key={user.doc_id || user.uid ? `${user.doc_id || user.uid}_${idx}` : `u_${idx}`} className="p-3 hover:bg-slate-50 flex items-center justify-between transition-colors">
                    <div>
                      <p className="font-bold text-xs text-slate-900 uppercase">
                        {canonical.displayName.toUpperCase()}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        ID: {user.seq_id || user.id_number || user.student_id || 'N/A'} • {user.school || user.school_name || 'No School'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAssignManualUser(user)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setManualMatchRowIdx(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign CSV Row to Reviewee Modal */}
      {assigningReviewee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Assign CSV Row to Reviewee</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target: <strong className="text-violet-700">{assigningReviewee.first_name || assigningReviewee.firstName || ''} {assigningReviewee.last_name || assigningReviewee.lastName || ''}</strong>
                </p>
              </div>
              <button
                onClick={() => setAssigningReviewee(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Choose a row from the uploaded CSV to assign its score to this reviewee.
              </p>
              
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                {[
                  { id: 'ALL', label: 'All Candidates' },
                  { id: 'UNMATCHED', label: 'Unmatched' },
                  { id: 'CONFLICTS', label: 'Conflicts' },
                  { id: 'DUPLICATES', label: 'Duplicates' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setAssignModalFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      assignModalFilter === f.id 
                        ? 'bg-[#020617] text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
              {rowsState
                .filter(row => {
                  const isProblem = isUnmatchedRow(row) || isConflictRow(row) || isDuplicateRow(row);
                  if (!isProblem) return false;
                  
                  if (assignModalFilter === 'UNMATCHED') return isUnmatchedRow(row);
                  if (assignModalFilter === 'CONFLICTS') return isConflictRow(row);
                  if (assignModalFilter === 'DUPLICATES') return isDuplicateRow(row);
                  return true;
                })
                .map(row => (
                  <div key={row.rowNum} className="p-3 hover:bg-slate-50 flex items-center justify-between transition-colors gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Row #{row.rowNum}
                        </span>
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {row.csvFullName}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        CSV ID: {row.csvStudentId || 'N/A'} • Score: {row.rawEarnedPoints}/{row.rawPossiblePoints}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to assign Row #${row.rowNum} (${row.csvFullName}) with score ${row.rawEarnedPoints}/${row.rawPossiblePoints} to ${assigningReviewee.first_name || assigningReviewee.firstName || ''} ${assigningReviewee.last_name || assigningReviewee.lastName || ''}?`)) {
                          handleAssignManualUser(assigningReviewee, row.rowNum);
                          setAssigningReviewee(null);
                        }
                      }}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Select Match
                    </button>
                  </div>
                ))}

              {rowsState.filter(row => isUnmatchedRow(row) || isConflictRow(row) || isDuplicateRow(row)).length === 0 && (
                <p className="p-8 text-center text-slate-400 italic text-xs">
                  No unmatched or duplicate CSV rows available to assign.
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setAssigningReviewee(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
