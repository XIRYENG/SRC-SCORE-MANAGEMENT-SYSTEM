import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { SafeChartContainer } from './charts/SafeChartContainer';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  CloudUpload,
  BarChart as BarChartIcon,
  Search,
  ChevronDown,
  Calendar,
  Filter,
  Check,
  AlertTriangle,
  UserCheck,
  UserX,
  HelpCircle,
  Copy
} from 'lucide-react';
import { EmptyState } from './sync-modal-tabs/EmptyState';
import { getUserRole, isReviewee } from '../utils/roleUtils';
import { isValidRevieweeRecord } from '../services/userIdentityResolver';
import { getCanonicalFullName, normalizeNameForComparison } from '../utils/nameNormalization';
import {
  processCsvRows,
  validateCsvHeaders,
  CsvParsedRow,
  ProcessCsvResult,
  RowStatus,
  MatchMethod
} from '../lib/scoreMatcher';

export type PreviewStatusFilter =
  | 'ALL'
  | 'READY'
  | 'UNMATCHED'
  | 'DUPLICATES'
  | 'WITHOUT_SCORE'
  | 'INVALID'
  | 'EXISTING_SCORE';

const isUnmatchedRow = (row: any) => {
  return row.status === 'ID_NOT_FOUND' || row.status === 'ID_NOT_FOUND_NAME_MATCH';
};

const isDuplicateRow = (row: any) => {
  return row.status === 'DUPLICATE_CSV_ID' || 
         row.status === 'DUPLICATE_DATABASE_ID' || 
         row.status === 'DUPLICATE_TARGET' ||
         row.status === 'DUPLICATE_NAME' ||
         row.status === 'DUPLICATE_MATCH' ||
         row.status === 'MULTIPLE_MATCHES' ||
         row.status === 'ID_NAME_CONFLICT' ||
         row.status === 'AMBIGUOUS_NAME';
};

const INVALID_STATUSES = new Set(['INVALID_SCORE', 'INVALID_ID', 'INVALID_NAME']);

interface SummaryCardProps {
  label: string;
  count: number;
  filter: PreviewStatusFilter;
  activeFilter: PreviewStatusFilter;
  onSelect: (filter: PreviewStatusFilter) => void;
  tone: 'slate' | 'emerald' | 'rose' | 'amber' | 'violet' | 'yellow' | 'blue';
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
    }
  };

  const currentTone = toneClasses[tone] || toneClasses.slate;

  return (
    <button
      type="button"
      onClick={() => onSelect(filter)}
      className={`text-left border rounded-2xl p-3 transition-all duration-200 cursor-pointer hover:shadow-md ${
        isActive ? currentTone.active : `${currentTone.bg} hover:bg-opacity-80`
      }`}
    >
      <p className={`text-[10px] font-black uppercase tracking-wider ${currentTone.text}`}>{label}</p>
      <p className="text-2xl font-black mt-1 leading-none">{count}</p>
    </button>
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
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-violet-500"
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
                  <tr key={r.id || r.uid || idx} className="hover:bg-slate-50 transition-colors">
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

interface ScoreUploaderProps {
  allUsers: any[];
  fetchAllUsers: () => void;
  currentUser?: any;
  backgroundTasks: any[];
  setBackgroundTasks: React.Dispatch<React.SetStateAction<any[]>>;
}

type UploadStatus = 'idle' | 'working' | 'success' | 'error';
type PreviewTab = 'all' | 'ready' | 'conflicts' | 'unmatched' | 'existing';

export const ScoreUploader: React.FC<ScoreUploaderProps> = ({
  allUsers,
  fetchAllUsers,
  currentUser,
  backgroundTasks,
  setBackgroundTasks
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadStage, setUploadStage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');

  // Modals & Steps
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configModalStep, setConfigModalStep] = useState<'settings' | 'preview'>('settings');
  const [headerError, setHeaderError] = useState<{ message: string; missing: string[] } | null>(null);

  // Import Settings
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [rawCsvData, setRawCsvData] = useState<any[]>([]);
  const [rawCsvHeaders, setRawCsvHeaders] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('CLJ');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastSelectedCategory');
      if (saved) {
        const allCats = ['Preboard', 'Pretest', 'Posttest', 'Quiz', 'Evaluation', 'Removal', 'Diagnostic'];
        const found = allCats.find(c => c.toLowerCase().replace(/\s+/g, '') === saved.toLowerCase().replace(/\s+/g, ''));
        if (found) return found;
        return saved;
      }
    }
    return 'Diagnostic';
  });

  useEffect(() => {
    if (selectedCategory) {
      localStorage.setItem('lastSelectedCategory', selectedCategory);
    }
  }, [selectedCategory]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [existingScorePolicy, setExistingScorePolicy] = useState<'replace' | 'skip' | 'keep_highest'>('replace');

  // UI Dropdowns
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Analysis Result
  const [processResult, setProcessResult] = useState<ProcessCsvResult | null>(null);
  const [rowsState, setRowsState] = useState<CsvParsedRow[]>([]);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('all');
  const [previewSearch, setPreviewSearch] = useState('');

  // Manual Matching Modal State
  const [manualMatchRowIdx, setManualMatchRowIdx] = useState<number | null>(null);
  const [manualUserSearch, setManualUserSearch] = useState('');

  // Import Diagnostic Report
  const [importReport, setImportReport] = useState<{
    unmatchedEntries: any[];
    missingUsers: any[];
    chartData?: any[];
  } | null>(null);

  // New states for interactive Preview and Reviewees Without Score
  const [previewStatusFilter, setPreviewStatusFilter] = useState<PreviewStatusFilter>('ALL');
  const [withoutScoreSearch, setWithoutScoreSearch] = useState('');
  const [assigningReviewee, setAssigningReviewee] = useState<any | null>(null);

  const [filterSchoolPreview, setFilterSchoolPreview] = useState<string>('ALL');
  const [filterBranchPreview, setFilterBranchPreview] = useState<string>('ALL');
  const [filterBatchPreview, setFilterBatchPreview] = useState<string>('ALL');

  // Eligible reviewees based on active database filters
  const eligibleReviewees = useMemo(() => {
    return allUsers.filter(u => {
      if (!isValidRevieweeRecord(u)) return false;
      // Role is Reviewee
      if (!isReviewee(u) && getUserRole(u) !== 'Reviewee') return false;
      const roleStr = String(u.role || '').toLowerCase();
      if (roleStr === 'admin' || roleStr === 'staff') return false;

      // Not deleted, archived, disabled, inactive
      if (u.isDeleted || u.deleted || u.is_deleted) return false;
      if (u.is_archived || u.archived || u.archiveStatus === 'passed' || u.status === 'archived') return false;
      
      const accStatus = String(u.accountStatus || u.status || '').toLowerCase();
      if (accStatus === 'disabled' || accStatus === 'inactive' || accStatus === 'deleted' || accStatus === 'archived') return false;

      // School filter
      if (filterSchoolPreview && filterSchoolPreview !== 'ALL') {
        const uSchool = String(u.school_name || u.schoolName || '').trim().toLowerCase();
        if (uSchool !== filterSchoolPreview.toLowerCase()) return false;
      }

      // Branch filter
      if (filterBranchPreview && filterBranchPreview !== 'ALL') {
        const uBranch = String(u.review_branch || u.reviewBranch || u.branch || '').trim().toLowerCase();
        if (uBranch !== filterBranchPreview.toLowerCase()) return false;
      }

      // Batch/Class filter
      if (filterBatchPreview && filterBatchPreview !== 'ALL') {
        const uBatch = String(u.batch || u.class_name || u.className || u.class || '').trim().toLowerCase();
        if (uBatch !== filterBatchPreview.toLowerCase()) return false;
      }

      return true;
    });
  }, [allUsers, filterSchoolPreview, filterBranchPreview, filterBatchPreview]);

  // Unique options for dynamic dropdowns
  const uniqueSchools = useMemo(() => {
    const schools = allUsers
      .filter(u => getUserRole(u) === "Reviewee" || isReviewee(u))
      .map(u => String(u.school_name || u.schoolName || '').trim())
      .filter(Boolean);
    return Array.from(new Set(schools)).sort();
  }, [allUsers]);

  const uniqueBranches = useMemo(() => {
    const branches = allUsers
      .filter(u => getUserRole(u) === "Reviewee" || isReviewee(u))
      .map(u => String(u.review_branch || u.reviewBranch || u.branch || '').trim())
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

  const matchingSummary = useMemo(() => {
    const uniqueImportRows = Array.from(
      new Map<any, CsvParsedRow>(
        rowsState.map(row => [
          row.importRowId || row.rowNum,
          row,
        ]),
      ).values(),
    );

    const matchedRevieweeKeys = new Set(
      uniqueImportRows
        .map(row =>
          row.matchedRevieweeDocumentId ||
          row.matchedRevieweeUid ||
          row.matchedRevieweeId ||
          row.matchedUserId ||
          (row.matchedUser?.doc_id || row.matchedUser?.id || row.matchedUser?.uid) ||
          null,
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    );

    const revieweesWithoutScore =
      eligibleReviewees.filter(reviewee => {
        const revieweeKey =
          reviewee.documentId ||
          reviewee.uid ||
          reviewee.id ||
          reviewee.doc_id;

        return (
          Boolean(revieweeKey) &&
          !matchedRevieweeKeys.has(
            revieweeKey,
          )
        );
      });

    return {
      total:
        uniqueImportRows.length,

      ready:
        uniqueImportRows.filter(
          row => row.status === "READY",
        ).length,

      unmatched:
        uniqueImportRows.filter(
          isUnmatchedRow,
        ).length,

      duplicates:
        uniqueImportRows.filter(
          isDuplicateRow,
        ).length,

      withoutScore:
        revieweesWithoutScore.length,

      invalid:
        uniqueImportRows.filter(row =>
          INVALID_STATUSES.has(
            row.status,
          ),
        ).length,

      existingScores:
        uniqueImportRows.filter(
          row =>
            row.status ===
            "EXISTING_SCORE",
        ).length,

      revieweesWithoutScore,
    };
  }, [rowsState, eligibleReviewees]);

  const showUploadPanel = uploadStatus !== 'idle';

  const resetUploadPanelLater = () => {
    setTimeout(() => {
      setUploadStatus('idle');
      setUploadStage('');
      setUploadProgress(0);
      setUploadMessage('');
    }, 8000);
  };

  const setProgress = (stage: string, progress: number, message = '') => {
    setUploadStage(stage);
    setUploadProgress(progress);
    if (message) setUploadMessage(message);
  };

  // --- Step 1: Select CSV File & Validate Headers ---
  const handleImportScores = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setHeaderError(null);
    setPendingFile(file);
    setIsImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsImporting(false);
        const headers = results.meta.fields || [];
        const validation = validateCsvHeaders(headers);

        if (!validation.isValid) {
          setHeaderError({
            message: `Invalid CSV format. Missing required column: ${validation.missingColumns.join(', ')}`,
            missing: validation.missingColumns
          });
          setPendingFile(null);
          e.target.value = '';
          return;
        }

        setRawCsvData(results.data || []);
        setRawCsvHeaders(headers);
        setConfigModalStep('settings');
        setProcessResult(null);
        setRowsState([]);
        setShowConfigModal(true);
        e.target.value = '';
      },
      error: (err) => {
        setIsImporting(false);
        setHeaderError({
          message: `CSV Parsing error: ${err.message}`,
          missing: []
        });
        setPendingFile(null);
        e.target.value = '';
      }
    });
  };

  // --- Step 2: Analyze CSV Rows and Match Accounts ---
  const handleAnalyzeCSV = () => {
    if (!rawCsvData.length) return;

    const result = processCsvRows(
      rawCsvData,
      rawCsvHeaders,
      allUsers,
      selectedSubject,
      selectedCategory,
      selectedDate
    );

    if (!result.headerValidation.isValid) {
      setHeaderError({
        message: `Invalid CSV format. Missing required column: ${result.headerValidation.missingColumns.join(', ')}`,
        missing: result.headerValidation.missingColumns
      });
      setShowConfigModal(false);
      return;
    }

    const enrichedRows = result.processedRows.map(r => ({
      ...r,
      matchedRevieweeDocumentId: r.matchedUser?.doc_id || r.matchedUser?.id || r.matchedUserId || null,
      matchedRevieweeUid: r.matchedUser?.uid || null,
      matchedRevieweeId: r.matchedUserId || r.matchedUser?.id || null,
    }));
    setProcessResult(result);
    setRowsState(enrichedRows);
    setConfigModalStep('preview');
  };

  // --- Step 3: Handle Manual Match Override ---
  const handleApplyManualMatch = (rowIdx: number, user: any) => {
    setRowsState(prev => {
      const fieldMatch = selectedSubject.trim().toUpperCase();
      const categoryMatch = selectedCategory.trim().toLowerCase().replace(/\s+/g, '');
      const normalizedDateKey = selectedDate.replace(/\//g, '-');
      const normalizedCategoryKey = categoryMatch.toLowerCase().replace(/[^a-z0-9]/g, '');
      const scoreField = categoryMatch === 'preboard' 
        ? `preboard_${fieldMatch.toLowerCase()}` 
        : (categoryMatch === 'pretest' || categoryMatch === 'diagnostic' ? `diag_${fieldMatch.toLowerCase()}` : `score_${fieldMatch.toLowerCase()}_${categoryMatch}`);

      const userDocId = user?.doc_id || user?.uid || 'unmatched';
      const scoreRecordKey = `${userDocId}_${normalizedCategoryKey}_${normalizedDateKey}`;

      const existingInFlat = user[scoreField] !== undefined && user[scoreField] !== null && String(user[scoreField]).trim() !== '';
      const existingByDate = user.scoresByDate && user.scoresByDate[scoreRecordKey];
      const hasExistingScore = Boolean(existingInFlat || existingByDate);

      return prev.map(r => {
        if (r.rowNum !== rowIdx) return r;

        const isDuplicateTarget = prev.some(other => 
          other.rowNum !== rowIdx && 
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

        const updateData: any = {
          [scoreField]: String(r.earnedPoints || 0),
          category: categoryMatch,
          subject: fieldMatch,
          [`date_${fieldMatch.toLowerCase()}_${normalizedCategoryKey}`]: selectedDate,
          [`scoresByDate.${scoreRecordKey}`]: {
            category: categoryMatch,
            categoryKey: normalizedCategoryKey,
            score: Number(r.earnedPoints || 0),
            rawScore: Number(r.earnedPoints || 0),
            earnedPoints: Number(r.earnedPoints || 0),
            possiblePoints: Number(r.possiblePoints || 100),
            percentage: r.percentage !== null ? r.percentage : Number(r.earnedPoints || 0),
            date: normalizedDateKey,
            source: 'uploaded_manual',
            remarks: 'Uploaded via CSV (Manually Matched)',
            updatedAt: new Date().toISOString()
          },
          [`latestScores.${normalizedCategoryKey}`]: {
            category: categoryMatch,
            categoryKey: normalizedCategoryKey,
            score: Number(r.earnedPoints || 0),
            earnedPoints: Number(r.earnedPoints || 0),
            possiblePoints: Number(r.possiblePoints || 100),
            percentage: r.percentage !== null ? r.percentage : Number(r.earnedPoints || 0),
            date: normalizedDateKey
          },
          latestScoreUploadAt: new Date().toISOString()
        };

        return {
          ...r,
          matchedUser: user,
          matchedUserId: userDocId,
          matchedUserName: `${user.last_name || user.lastName || ''}, ${user.first_name || user.firstName || ''}`.trim() || user.email || 'Reviewee',
          matchedRevieweeDocumentId: user.doc_id || user.id || userDocId || null,
          matchedRevieweeUid: user.uid || null,
          matchedRevieweeId: userDocId || user.id || null,
          matchMethod: 'MANUAL_SELECTION' as MatchMethod,
          status,
          remarks,
          manuallyMatchedBy: currentUser?.uid || currentUser?.doc_id || 'Admin',
          manuallyMatchedAt: new Date().toISOString(),
          originalCsvStudentId: r.csvStudentId,
          originalCsvStudentName: r.csvFullName,
          updateData
        };
      });
    });

    setManualMatchRowIdx(null);
    setManualUserSearch('');
  };

  // --- Step 4: Perform Batched Upload ---
  const handleSaveParsedScores = async () => {
    if (!rowsState.length) return;

    // Filter rows to upload based on status and existing score policy
    const rowsToUpload = rowsState.filter(r => {
      if (r.status === 'READY') return true;
      if (r.status === 'EXISTING_SCORE') {
        if (existingScorePolicy === 'skip') return false;
        if (existingScorePolicy === 'replace') return true;
        if (existingScorePolicy === 'keep_highest') {
          // Check if new score is higher than existing
          const existingScore = Number(r.matchedUser?.[`preboard_${selectedSubject.toLowerCase()}`] || 0);
          return (r.earnedPoints || 0) > existingScore;
        }
      }
      return false;
    });

    const skippedCount = rowsState.length - rowsToUpload.length;

    if (rowsToUpload.length === 0) {
      setUploadStatus('error');
      setProgress('No Scores Selected', 100, 'No rows are ready or approved for upload.');
      resetUploadPanelLater();
      return;
    }

    const taskId = Date.now().toString();
    const newTask = {
      id: taskId,
      name: `Score Upload: ${selectedSubject} (${selectedCategory})`,
      progress: 50,
      status: 'working',
      message: 'Uploading scores to database...',
      startTime: new Date()
    };
    setBackgroundTasks(prev => [...prev, newTask]);

    const updateTask = (updates: any) => {
      setBackgroundTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    setUploadStatus('working');
    setProgress('Saving Scores', 60, `Uploading ${rowsToUpload.length} scores to database...`);
    setShowConfigModal(false);

    try {
      const formattedUpdates = rowsToUpload.map(u => ({
        doc_id: u.matchedUserId || u.matchedUser?.doc_id || u.matchedUser?.uid,
        data: u.updateData
      })).filter(u => u.doc_id && typeof u.doc_id === 'string' && u.doc_id !== 'unmatched' && u.data);

      const res = await fetch('/api/batch-update-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: formattedUpdates,
          adminName: currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name}` : 'Admin',
          adminRole: currentUser?.role || 'admin'
        })
      });

      if (res.ok) {
        updateTask({ progress: 100, status: 'completed', message: 'Upload successful' });

        const updatedDocIds = new Set(rowsToUpload.map(up => up.matchedUserId));
        const missingUsers = allUsers.filter(u => {
          const role = String(u.role || '').toLowerCase();
          return role !== 'admin' && role !== 'staff' && !u.is_archived && !updatedDocIds.has(u.doc_id);
        });

        const unmatchedEntries = rowsState.filter(r => !rowsToUpload.some(u => u.rowNum === r.rowNum)).map(r => ({
          id: r.csvStudentId,
          name: r.csvFullName,
          rawScore: r.rawEarnedPoints,
          category: selectedCategory,
          subject: selectedSubject,
          possibleMatches: r.possibleMatches,
          updateData: r.updateData
        }));

        // Calculate score distribution chart data
        const parsedScores = rowsToUpload.map(u => Number(u.earnedPoints || 0));
        const minScore = parsedScores.length > 0 ? Math.min(...parsedScores) : 0;
        const maxScore = parsedScores.length > 0 ? Math.max(...parsedScores) : 0;
        const range = Math.max(1, maxScore - minScore);
        const binSize = Math.max(1, Math.ceil(range / 5));

        const bins = Array.from({ length: 5 }, (_, i) => ({
          name: `${Math.floor(minScore + i * binSize)}-${Math.floor(minScore + (i + 1) * binSize - 1)}`,
          count: 0,
          min: minScore + i * binSize,
          max: minScore + (i + 1) * binSize - 1
        }));

        if (bins.length === 5) {
          bins[4].name = `${Math.floor(bins[4].min)}+`;
          bins[4].max = Infinity;
        }

        for (const score of parsedScores) {
          for (const bin of bins) {
            if (score >= bin.min && score <= bin.max) {
              bin.count++;
              break;
            }
          }
        }

        const chartData = bins.filter(b => b.count > 0 || (b.name !== '0-0' && b.name !== '0+'));

        setImportReport({ unmatchedEntries, missingUsers, chartData });
        await fetchAllUsers();

        setUploadStatus('success');
        const finalMsg = `${rowsToUpload.length} scores uploaded successfully. ${skippedCount} rows were skipped and require review.`;
        setProgress('Upload Complete', 100, finalMsg);
        resetUploadPanelLater();
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadStatus('error');
        setProgress('Upload Failed', 100, errData.error || 'Server rejected the score update.');
        updateTask({ progress: 100, status: 'failed', message: errData.error || 'Upload failed' });
        resetUploadPanelLater();
      }
    } catch (apiErr) {
      console.error(apiErr);
      setUploadStatus('error');
      setProgress('Upload Failed', 100, 'Error communicating with server while updating scores.');
      updateTask({ progress: 100, status: 'failed', message: 'Network error' });
      resetUploadPanelLater();
    } finally {
      setPendingFile(null);
    }
  };

  // Helper for status badges
  const renderStatusBadge = (status: RowStatus, matchMethod: MatchMethod) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            {matchMethod === 'ID_EXACT_NAME_VERIFIED' && 'Verified ID & Name'}
            {matchMethod === 'ID_EXACT_NAME_PARTIAL' && 'Verified ID (Partial Name)'}
            {matchMethod === 'NAME_EXACT_UNIQUE' && 'Name Fallback'}
            {matchMethod === 'MANUAL_SELECTION' && 'Manually Matched'}
            {matchMethod === 'NONE' && 'Ready'}
          </span>
        );
      case 'ID_NAME_CONFLICT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={12} className="text-rose-600" />
            ID & Name Conflict
          </span>
        );
      case 'ID_NOT_FOUND_NAME_MATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={12} className="text-amber-600" />
            ID Not Found (Name Candidate)
          </span>
        );
      case 'AMBIGUOUS_NAME':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <HelpCircle size={12} className="text-orange-600" />
            Ambiguous Name
          </span>
        );
      case 'ID_NOT_FOUND':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <UserX size={12} className="text-slate-500" />
            ID & Name Not Found
          </span>
        );
      case 'INVALID_SCORE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle size={12} className="text-rose-700" />
            Invalid Score
          </span>
        );
      case 'DUPLICATE_CSV_ID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Copy size={12} className="text-purple-600" />
            Duplicate CSV ID
          </span>
        );
      case 'DUPLICATE_DATABASE_ID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Copy size={12} className="text-purple-600" />
            Duplicate Database ID
          </span>
        );
      case 'EXISTING_SCORE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
            <AlertTriangle size={12} className="text-yellow-600" />
            Existing Score
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  // Filtered rows for preview table
  const filteredPreviewRows = rowsState.filter(row => {
    if (previewTab === 'ready' && row.status !== 'READY') return false;
    if (previewTab === 'conflicts' && row.status !== 'ID_NAME_CONFLICT' && row.status !== 'AMBIGUOUS_NAME') return false;
    if (previewTab === 'unmatched' && row.status !== 'ID_NOT_FOUND' && row.status !== 'ID_NOT_FOUND_NAME_MATCH') return false;
    if (previewTab === 'existing' && row.status !== 'EXISTING_SCORE') return false;

    if (!previewSearch) return true;
    const q = previewSearch.toLowerCase();
    const nameMatch = row.csvFullName.toLowerCase().includes(q) || (row.matchedUserName || '').toLowerCase().includes(q);
    const idMatch = (row.csvStudentId || '').toLowerCase().includes(q) || (row.matchedUserId || '').toLowerCase().includes(q);
    return nameMatch || idMatch;
  });

  return (
    <>
      <div className="relative inline-block">
        <input
          type="file"
          accept=".csv"
          onChange={handleImportScores}
          className="hidden"
          id="score-upload"
        />

        <label
          htmlFor="score-upload"
          className="
            group cursor-pointer inline-flex items-center gap-2
            rounded-xl border border-blue-200 bg-blue-600
            px-4 py-2.5 text-xs font-black text-white
            shadow-lg shadow-blue-600/20 transition-all
            hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-600/30
            active:translate-y-0
          "
        >
          <CloudUpload size={15} className="group-hover:scale-110 transition-transform" />
          Import ZipGrade CSV
        </label>
      </div>

      {/* Header Validation Error Modal */}
      {headerError && (
        <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-rose-100">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">Invalid CSV Columns</h4>
                <p className="text-sm text-slate-600 mt-1">{headerError.message}</p>
                
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-700">Required Headers:</p>
                  <ul className="text-xs text-slate-500 list-disc list-inside mt-1 space-y-0.5">
                    <li>Student First Name</li>
                    <li>Student Last Name</li>
                    <li>Student ID</li>
                    <li>Earned Points</li>
                    <li>Possible Points</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setHeaderError(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Floating Toast Panel */}
      {showUploadPanel && (
        <div className="fixed top-5 right-5 z-[99999] w-[340px] max-w-[calc(100vw-2rem)]">
          <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur-xl overflow-hidden">
            <div className="p-4 flex items-start gap-3">
              <div
                className={`
                  mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center shrink-0
                  ${uploadStatus === 'working' ? 'bg-blue-50 text-blue-600' : ''}
                  ${uploadStatus === 'success' ? 'bg-emerald-50 text-emerald-600' : ''}
                  ${uploadStatus === 'error' ? 'bg-rose-50 text-rose-600' : ''}
                `}
              >
                {uploadStatus === 'working' && <Loader2 className="h-5 w-5 animate-spin" />}
                {uploadStatus === 'success' && <CheckCircle2 className="h-5 w-5" />}
                {uploadStatus === 'error' && <AlertCircle className="h-5 w-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{uploadStage}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{uploadMessage}</p>
                  </div>

                  {uploadStatus !== 'working' && (
                    <button
                      onClick={() => setUploadStatus('idle')}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`
                      h-full rounded-full transition-all duration-500
                      ${uploadStatus === 'working' ? 'bg-blue-600' : ''}
                      ${uploadStatus === 'success' ? 'bg-emerald-600' : ''}
                      ${uploadStatus === 'error' ? 'bg-rose-600' : ''}
                    `}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>{uploadStatus === 'working' ? 'Processing' : uploadStatus}</span>
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Configuration & Preview Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-slate-900/50 overflow-y-auto">
          <div className={`bg-white rounded-3xl p-5 sm:p-8 w-full shadow-2xl relative border border-slate-100 my-auto ${configModalStep === 'preview' ? 'max-w-6xl max-h-[92vh] flex flex-col' : 'max-w-md'}`}>
            <button
              onClick={() => {
                setShowConfigModal(false);
                setPendingFile(null);
              }}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-500 cursor-pointer z-10"
            >
              <X size={20} />
            </button>

            {configModalStep === 'settings' ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Configure Score Import</h3>
                    <p className="text-xs text-slate-500 truncate max-w-[240px]">File: {pendingFile?.name}</p>
                  </div>
                </div>

                <div className="space-y-4 my-6">
                  {/* Subject Matter Dropdown */}
                  <div className="relative">
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">
                      Subject Matter
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSubjectDropdown(!showSubjectDropdown);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full flex items-center justify-between text-sm p-3 border border-slate-200 rounded-xl focus:border-blue-500 hover:border-slate-300 outline-none bg-white font-bold text-slate-700 shadow-sm transition-all text-left cursor-pointer"
                    >
                      <span className="truncate">
                        {[
                          { value: 'CLJ', label: 'Criminal Law and Jurisprudence (CLJ)' },
                          { value: 'LEA', label: 'Law Enforcement Administration (LEA)' },
                          { value: 'FS', label: 'Forensic Science (FS)' },
                          { value: 'CDI', label: 'Crime Detection and Investigation (CDI)' },
                          { value: 'CRIM', label: 'Criminology (CRIM)' },
                          { value: 'CA', label: 'Correctional Administration (CA)' }
                        ].find(s => s.value === selectedSubject)?.label || selectedSubject}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform duration-200 shrink-0 ${showSubjectDropdown ? 'rotate-180 text-blue-500' : ''}`}
                      />
                    </button>

                    <AnimatePresence>
                      {showSubjectDropdown && (
                        <>
                          <div className="fixed inset-0 z-[10002]" onClick={() => setShowSubjectDropdown(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl z-[10003] overflow-hidden divide-y divide-slate-50 max-h-60 overflow-y-auto"
                          >
                            {[
                              { value: 'CLJ', label: 'Criminal Law and Jurisprudence (CLJ)' },
                              { value: 'LEA', label: 'Law Enforcement Administration (LEA)' },
                              { value: 'FS', label: 'Forensic Science (FS)' },
                              { value: 'CDI', label: 'Crime Detection and Investigation (CDI)' },
                              { value: 'CRIM', label: 'Criminology (CRIM)' },
                              { value: 'CA', label: 'Correctional Administration (CA)' }
                            ].map((subj) => (
                              <button
                                key={subj.value}
                                type="button"
                                onClick={() => {
                                  setSelectedSubject(subj.value);
                                  setShowSubjectDropdown(false);
                                }}
                                className={`w-full text-left p-3 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                  selectedSubject === subj.value 
                                    ? 'bg-blue-50 text-blue-600' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span>{subj.label}</span>
                                {selectedSubject === subj.value && (
                                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-2" />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Exam Category Dropdown */}
                  <div className="relative">
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">
                      Exam Category
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryDropdown(!showCategoryDropdown);
                        setShowSubjectDropdown(false);
                      }}
                      className="w-full flex items-center justify-between text-sm p-3 border border-slate-200 rounded-xl focus:border-blue-500 hover:border-slate-300 outline-none bg-white font-bold text-slate-700 shadow-sm transition-all text-left cursor-pointer"
                    >
                      <span className="truncate">{selectedCategory}</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform duration-200 shrink-0 ${showCategoryDropdown ? 'rotate-180 text-blue-500' : ''}`}
                      />
                    </button>

                    <AnimatePresence>
                      {showCategoryDropdown && (
                        <>
                          <div className="fixed inset-0 z-[10002]" onClick={() => setShowCategoryDropdown(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl z-[10003] overflow-hidden divide-y divide-slate-50 max-h-60 overflow-y-auto"
                          >
                            {['Preboard', 'Pretest', 'Posttest', 'Quiz', 'Evaluation', 'Removal', 'Diagnostic'].map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setSelectedCategory(cat);
                                  setShowCategoryDropdown(false);
                                }}
                                className={`w-full text-left p-3 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                  selectedCategory === cat 
                                    ? 'bg-blue-50 text-blue-600' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span>{cat}</span>
                                {selectedCategory === cat && (
                                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-2" />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Exam Date Selector */}
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">
                      Exam Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(ev) => setSelectedDate(ev.target.value)}
                        className="w-full text-sm p-3 pl-10 border border-slate-200 rounded-xl focus:border-blue-500 hover:border-slate-300 outline-none bg-white font-bold text-slate-700 shadow-sm transition-all"
                      />
                      <Calendar 
                        size={16} 
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowConfigModal(false);
                      setPendingFile(null);
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAnalyzeCSV}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-colors uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-blue-500/25 cursor-pointer"
                  >
                    Analyze CSV
                  </button>
                </div>
              </div>
            ) : (
              // STEP 2: PREVIEW & MATCH VERIFICATION TABLE
              <div className="flex flex-col h-full min-h-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900">Score Import Matching Preview</h3>
                      <span className="bg-blue-100 text-blue-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                        {selectedSubject} — {selectedCategory}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review matched reviewees, score validations, and conflicts before importing.
                    </p>
                  </div>

                  {processResult && processResult.summary.existingScoreCount > 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-xl border border-amber-200">
                      <span className="text-xs font-bold text-amber-800 shrink-0">Existing Scores:</span>
                      <select
                        value={existingScorePolicy}
                        onChange={(e) => setExistingScorePolicy(e.target.value as any)}
                        className="text-xs font-bold p-1.5 border border-amber-300 rounded-lg bg-white text-slate-800 outline-none"
                      >
                        <option value="replace">Overwrite Existing Scores</option>
                        <option value="skip">Skip Existing Scores</option>
                        <option value="keep_highest">Keep Highest Score Only</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Summary Metrics Banner */}
                {processResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 my-4">
                    <SummaryCard
                      label="All CSV Rows"
                      count={matchingSummary.total}
                      filter="ALL"
                      activeFilter={previewStatusFilter}
                      onSelect={setPreviewStatusFilter}
                      tone="blue"
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
                      label="Duplicates"
                      count={matchingSummary.duplicates}
                      filter="DUPLICATES"
                      activeFilter={previewStatusFilter}
                      onSelect={setPreviewStatusFilter}
                      tone="rose"
                    />
                    <SummaryCard
                      label="Reviewees Without Score"
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
                      tone="slate"
                    />
                    <SummaryCard
                      label="Existing Scores"
                      count={matchingSummary.existingScores}
                      filter="EXISTING_SCORE"
                      activeFilter={previewStatusFilter}
                      onSelect={setPreviewStatusFilter}
                      tone="yellow"
                    />
                  </div>
                )}

                {/* Active Tab View */}
                {previewStatusFilter === 'WITHOUT_SCORE' ? (
                  <div className="flex-1 overflow-y-auto flex flex-col min-h-0 space-y-4">
                    {/* Database Eligibility Filters */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Database Eligibility Filters:</span>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-600 font-bold">School:</span>
                        <select
                          value={filterSchoolPreview}
                          onChange={(e) => setFilterSchoolPreview(e.target.value)}
                          className="text-xs font-bold p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="ALL">All Schools</option>
                          {uniqueSchools.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-600 font-bold">Branch:</span>
                        <select
                          value={filterBranchPreview}
                          onChange={(e) => setFilterBranchPreview(e.target.value)}
                          className="text-xs font-bold p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="ALL">All Branches</option>
                          {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-600 font-bold">Batch / Class:</span>
                        <select
                          value={filterBatchPreview}
                          onChange={(e) => setFilterBatchPreview(e.target.value)}
                          className="text-xs font-bold p-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="ALL">All Batches</option>
                          {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>

                    <RevieweesWithoutScoreList
                      reviewees={matchingSummary.revieweesWithoutScore}
                      searchTerm={withoutScoreSearch}
                      onSearchChange={setWithoutScoreSearch}
                      onAssignClick={setAssigningReviewee}
                      onShowAll={() => setPreviewStatusFilter('ALL')}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Search Field for CSV Rows list */}
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Filtered Import Rows: {filteredPreviewRows.length} rows
                      </p>
                      
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search row name or ID..."
                          value={previewSearch}
                          onChange={(e) => setPreviewSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Main Table */}
                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl custom-scrollbar bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-600 uppercase text-[10px] sticky top-0 z-10">
                          <tr>
                            <th className="p-3 w-12 text-center">Row</th>
                            <th className="p-3">CSV Student ID</th>
                            <th className="p-3">CSV Student Name</th>
                            <th className="p-3">Earned / Possible</th>
                            <th className="p-3">Matched Reviewee</th>
                            <th className="p-3">Match Status</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPreviewRows.map((row) => (
                            <tr key={row.rowNum} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 text-center font-mono font-bold text-slate-400">{row.rowNum}</td>
                              <td className="p-3 font-mono font-bold text-slate-800">
                                {row.csvStudentId ? (
                                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{row.csvStudentId}</span>
                                ) : (
                                  <span className="italic text-slate-400">Missing</span>
                                )}
                              </td>
                              <td className="p-3 font-bold text-slate-900">{row.csvFullName}</td>
                              <td className="p-3">
                                <span className="font-mono font-bold text-slate-800">
                                  {row.rawEarnedPoints} / {row.rawPossiblePoints}
                                </span>
                                {row.percentage !== null && (
                                  <span className="ml-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {row.percentage}%
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {row.matchedUser ? (
                                  <div>
                                    <p className="font-bold text-slate-900">{row.matchedUserName}</p>
                                    <p className="text-[10px] font-mono text-slate-400">
                                      ID: {row.matchedUser.seq_id || row.matchedUser.id_number || row.matchedUser.student_id || row.matchedUserId}
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
                                  onClick={() => {
                                    setManualMatchRowIdx(row.rowNum);
                                    setManualUserSearch(row.csvFullName);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg font-bold text-[10px] uppercase transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Search size={11} />
                                  {row.matchedUser ? 'Change Match' : 'Manual Match'}
                                </button>
                              </td>
                            </tr>
                          ))}

                          {filteredPreviewRows.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-8">
                                <EmptyState
                                  icon={Search}
                                  title="No rows found"
                                  description="No score rows match the selected filter or search query."
                                />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="flex justify-between items-center pt-4 mt-3 border-t border-slate-200">
                  <button
                    onClick={() => setConfigModalStep('settings')}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Go Back
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">
                      {rowsState.filter(r => r.status === 'READY' || (r.status === 'EXISTING_SCORE' && existingScorePolicy !== 'skip')).length} rows ready to save
                    </span>
                    <button
                      onClick={handleSaveParsedScores}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                    >
                      <CheckCircle2 size={16} />
                      Confirm & Save Scores
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANUAL MATCH SELECTOR MODAL */}
      {manualMatchRowIdx !== null && (
        <div className="fixed inset-0 z-[10004] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h4 className="text-base font-black text-slate-900">Manual Reviewee Search</h4>
                <p className="text-xs text-slate-500">
                  Assign a reviewee account for Row #{manualMatchRowIdx} ({rowsState.find(r => r.rowNum === manualMatchRowIdx)?.csvFullName})
                </p>
              </div>
              <button
                onClick={() => setManualMatchRowIdx(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, ID Number, or branch..."
                value={manualUserSearch}
                onChange={(e) => setManualUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl custom-scrollbar">
              {allUsers
                .filter(u => {
                  const role = String(u.role || '').toLowerCase();
                  if (role === 'admin' || role === 'staff') return false;
                  if (u.is_archived || u.isDeleted || u.deleted) return false;

                  if (!manualUserSearch) return true;
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
                  <div
                    key={user.doc_id || user.uid ? `${user.doc_id || user.uid}_${idx}` : `u_${idx}`}
                    className="p-3 hover:bg-blue-50/50 flex items-center justify-between transition-colors cursor-pointer"
                    onClick={() => handleApplyManualMatch(manualMatchRowIdx, user)}
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900">
                        {canonical.displayName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        ID: {user.seq_id || user.id_number || user.student_id || 'N/A'} • {user.school_name || user.review_branch || 'CKCM'}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end mt-3">
              <button
                onClick={() => setManualMatchRowIdx(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST-IMPORT DIAGNOSTICS & UNMATCHED REPORT MODAL */}
      {importReport && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-900/40">
          <div className="bg-white rounded-3xl p-6 sm:p-8 overflow-y-auto max-h-[90vh] w-full max-w-5xl shadow-2xl relative border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Import Summary & Diagnostics</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Scores uploaded successfully to reviewee accounts.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setImportReport(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Distribution Chart */}
            {importReport.chartData && importReport.chartData.length > 0 && (
              <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <h5 className="font-black text-blue-800 mb-3 text-xs uppercase flex items-center gap-1.5">
                  <BarChartIcon className="w-4 h-4" />
                  Score Distribution Graph
                </h5>
                <SafeChartContainer height={176} empty={!importReport.chartData || importReport.chartData.length === 0} emptyMessage="No distribution data available.">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                    <BarChart data={importReport.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: '#e2e8f0', opacity: 0.4 }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SafeChartContainer>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setImportReport(null)}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-lg cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign CSV Row Modal */}
      {assigningReviewee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10100] animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Assign Score Row to Reviewee</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target: <strong className="text-violet-700">{assigningReviewee.first_name || assigningReviewee.firstName || ''} {assigningReviewee.last_name || assigningReviewee.lastName || ''}</strong>
                </p>
              </div>
              <button
                onClick={() => setAssigningReviewee(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 custom-scrollbar">
              {(() => {
                const assignableRows = rowsState.filter(row => {
                  return isUnmatchedRow(row) || isDuplicateRow(row) || !row.matchedUserId;
                });

                if (assignableRows.length === 0) {
                  return (
                    <p className="text-xs text-center text-slate-400 py-6">
                      No score record found in the uploaded CSV.
                    </p>
                  );
                }

                return (
                  <>
                    <p className="text-xs text-slate-600 font-medium">
                      Select an unmatched or duplicate CSV row to assign to this reviewee:
                    </p>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                      {assignableRows.map(row => (
                        <button
                          key={row.rowNum}
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to assign Row #${row.rowNum} (${row.csvFullName}) with score ${row.rawEarnedPoints}/${row.rawPossiblePoints} to ${assigningReviewee.first_name || assigningReviewee.firstName || ''} ${assigningReviewee.last_name || assigningReviewee.lastName || ''}?`)) {
                              handleApplyManualMatch(row.rowNum, assigningReviewee);
                              setAssigningReviewee(null);
                            }
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex justify-between items-center cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-black text-slate-800">Row #{row.rowNum}: {row.csvFullName || 'Unknown'}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                              CSV ID: {row.csvStudentId || 'N/A'} • Status: {row.status}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                              {row.rawEarnedPoints} / {row.rawPossiblePoints}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 gap-2">
              <button
                onClick={() => setAssigningReviewee(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-black text-slate-600 rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export { ScoreImporter } from './ScoreImporter';
