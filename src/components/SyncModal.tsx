import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import Papa from 'papaparse';
import { fetchWithFirebaseAuth } from '../utils/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, X, RefreshCw, AlertCircle, AlertTriangle, CheckCircle2, Edit, Search, Check, Lock, Clock, ChevronUp, ChevronDown, Printer, Download, FileText, Upload, Users, MoreVertical, Trash2, CloudUpload, ChevronLeft, HelpCircle, Shield, LayoutDashboard, BarChart3, UploadCloud, Archive, LineChart, ShieldCheck, Settings } from 'lucide-react';
import { AnimatedSelect, type AnimatedSelectOption } from './ui/animated-select';
import { UnmatchedRecordsModal } from './UnmatchedRecordsModal';
import { Toast } from './Toast';
import { LeaderboardDashboard } from './LeaderboardDashboard';
import { ScoreUploader } from './ScoreUploader';
import { ScoreImporter } from './ScoreImporter';
import { ActivityLogTab } from './sync-modal-tabs/ActivityLogTab';
import { EmptyState } from './sync-modal-tabs/EmptyState';
import { Skeleton, SkeletonTableRows } from './Skeleton';
import { collection, getDocs, updateDoc, doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { firestoreDb, initFirebaseClient, clientDeleteUser } from '../utils/firebaseClient';

import type { RevieweeData } from '../types';
import { normalizeRole, isAdmin, isStaff, isAdminLike, getUserRole, hasScoreEditPermission } from '../utils/roleUtils';
import { getCanonicalFullName } from '../utils/nameNormalization';
import { resolveCanonicalUserIdentity, isValidScoreManagementUser, isValidRevieweeRecord, formatFormalName } from '../services/userIdentityResolver';
import { getResolvedScore, isScoreAreaActivated, getScoreFieldName, ScoreAreaActivation, getResolvedDetailedScore } from '../utils/scoreFieldResolver';
import { DEFAULT_GRADE_WEIGHTS, GradeWeights } from '../utils/gradeCalculation';
import { calculateRevieweeArea } from '../utils/calculateRevieweeArea';
import { CompactEditableScoreCell } from './CompactEditableScoreCell';
import { getRevieweeCategoryRating, calculateCategoryRating, getCategoryScores, getCategoryDetailedScores, calculateAreaContribution, DEFAULT_SUBJECT_WEIGHTS, SUBJECT_KEYS, SubjectKey } from '../utils/categoryRating';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (filters: { year: string; schools?: string[]; dateFrom?: string; dateTo?: string, isAutoSync?: boolean }) => Promise<void>;
  loading: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  syncProgress?: number;
  syncError?: string | null;
  currentUser?: RevieweeData | null;
  backgroundTasks: any[];
  setBackgroundTasks: React.Dispatch<React.SetStateAction<any[]>>;
  initialTab?: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity';
  initialSection?: 'main' | 'search' | 'duplicates' | 'mapping';
  embeddedMode?: boolean;
  onSubTabChange?: (tab: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity') => void;
  onSectionChange?: (section: 'main' | 'search' | 'duplicates' | 'mapping') => void;
}

function getCategoryShortName(cat: string): string {
  const map: Record<string, string> = {
    'Preboard': 'Preboard',
    'Pretest': 'Pretest',
    'Posttest': 'Posttest',
    'Quiz': 'Quiz',
    'Daily Evaluation': 'Evaluation',
    'DailyEvaluation': 'Evaluation',
    'Evaluation': 'Evaluation',
    'Removal': 'Removal',
    'Diagnostic': 'Diagnostic'
  };
  return map[cat] || cat;
}

function highlightMatch(text: string, query: string) {
  if (!query || !text) return text;
  const parts = String(text).split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return parts.map((part, idx) => 
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={idx} className="bg-yellow-200 text-slate-900 px-0.5 rounded font-bold">{part}</mark>
    ) : (
      part
    )
  );
}

function getRatingTextColorClass(rating: number): string {
  if (rating >= 60) return "text-purple-600 font-bold";
  if (rating >= 55) return "text-blue-600 font-bold";
  if (rating >= 50) return "text-emerald-600 font-bold";
  return "text-rose-600 font-bold";
}

const SubjectColumnHeader = ({
  subj,
  allUsers,
  getSubjectDetails,
  handleDeleteScores,
  isDeletingScores,
  selectedCategories,
  sortColumn,
  sortDirection,
  onSort,
}: {
  key?: string | number;
  subj: { id: string; label: string; weight: string };
  allUsers: any[];
  getSubjectDetails: (user: any, subjectId: string) => { score: number | null; date: string | null };
  handleDeleteScores: (category: string, subjectId: string) => void;
  isDeletingScores: boolean;
  selectedCategories: string[];
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  let subjDate = "";
  for (const user of allUsers) {
     const date = getSubjectDetails(user, subj.id).date;
     if (date) { subjDate = date; break; }
  }

  const isSorted = sortColumn === subj.id;

  return (
    <th 
      className={`px-1 py-1.5 text-center font-bold tracking-wider relative w-[95px] min-w-[95px] group cursor-pointer hover:bg-slate-200 transition-colors select-none ${
        isSorted ? 'bg-teal-100/70 text-teal-950 font-black border-b-2 border-teal-600' : ''
      }`} 
      ref={dropdownRef}
      onClick={onSort}
      title={`Click to sort by ${subj.label} (${sortDirection === 'asc' && isSorted ? 'Lowest to Highest' : 'Highest to Lowest'})`}
    >
      <div className="flex flex-col items-center justify-center uppercase leading-tight text-[10px]">
        <div className="flex items-center justify-center gap-0.5">
          <span className="text-[10px] font-black">{subj.label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? (
              <ChevronUp size={12} className="text-teal-700 font-extrabold stroke-[3]" />
            ) : (
              <ChevronDown size={12} className="text-teal-700 font-extrabold stroke-[3]" />
            )
          ) : null}
        </div>
        <span className="text-[10px] opacity-70">({subj.weight})</span>
        {subjDate && (
           <span className="text-[10px] font-normal opacity-60 rounded px-1 text-slate-600 block w-max mt-0.5">{
              (() => {
                const parts = subjDate.split('-');
                if (parts.length === 3) return `${parts[1]}-${parts[2]}-${parts[0]}`;
                return subjDate;
              })()
           }</span>
        )}
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className="absolute right-0 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-300 text-slate-400 focus:outline-none focus:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Subject options"
      >
        <MoreVertical className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }} className="absolute top-full right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-[100] min-w-[140px] text-left">
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                handleDeleteScores(selectedCategories[0] || 'preboard', subj.id);
              }} 
              disabled={isDeletingScores}
              className={`w-full px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5 transition-colors border-b border-slate-100 cursor-pointer ${
                isDeletingScores ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {isDeletingScores ? (
                <>
                  <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={12} className="pointer-events-none" /> Delete Scores
                </>
              )}
            </button>
            <button onClick={(e) => { 
                e.stopPropagation();
                alert("This action would publish the scores and notify the student."); 
                setIsOpen(false); 
            }} className="w-full px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 transition-colors">
              <CloudUpload size={12} /> Publish Scores
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </th>
  );
};



export const SyncModal: React.FC<SyncModalProps> = ({ 
  isOpen, 
  onClose, 
  onSync, 
  loading, 
  syncStatus, 
  syncProgress,
  syncError,
  currentUser,
  backgroundTasks,
  setBackgroundTasks,
  initialTab = 'details',
  initialSection = 'main',
  embeddedMode = false,
  onSubTabChange,
  onSectionChange
}) => {
  const [showImportCard, setShowImportCard] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [uploadedRecords, setUploadedRecords] = useState(0);
  const [updatedRecords, setUpdatedRecords] = useState(0);
  const [failedRecords, setFailedRecords] = useState(0);

  const finishUploadSuccess = (updated: number, failed: number) => {
    setProgressPercent(100);
    setUploadedRecords(updated + failed);
    setUpdatedRecords(updated);
    setFailedRecords(failed);
    setProgressStatus("Scores uploaded successfully and ready for sync.");
  };

  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'parsing' | 'uploading' | 'done' | 'error'>('parsing');
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [importReport, setImportReport] = useState<{ unmatchedEntries: any[], missingUsers: any[] } | null>(null);
  const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const savedCats = localStorage.getItem('lastSelectedCategories');
      if (savedCats) {
        try {
          const parsed = JSON.parse(savedCats);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (e) {
          // Ignore parse error
        }
      }
      const savedSingle = localStorage.getItem('lastSelectedCategory');
      if (savedSingle) {
        const allCats = ['Preboard', 'Pretest', 'Posttest', 'Quiz', 'Daily Evaluation', 'Removal', 'Diagnostic'];
        const found = allCats.find(c => c.toLowerCase().replace(/\s+/g, '') === savedSingle.toLowerCase().replace(/\s+/g, ''));
        if (found) return [found];
        return [savedSingle];
      }
    }
    return ['Diagnostic'];
  });

  useEffect(() => {
    if (selectedCategories && selectedCategories.length > 0) {
      localStorage.setItem('lastSelectedCategory', selectedCategories[0]);
      localStorage.setItem('lastSelectedCategories', JSON.stringify(selectedCategories));
    }
  }, [selectedCategories]);
  const [importDate, setImportDate] = useState('');

  // Grade weight settings, activation settings and import history states
  const [gradeWeights, setGradeWeights] = useState<GradeWeights>(DEFAULT_GRADE_WEIGHTS);
  const [activatedAreas, setActivatedAreas] = useState<any[]>([]);
  const [importHistory, setImportHistory] = useState<any[]>([]);

  // Manual Score Edit Modal States
  const [showManualEditModal, setShowManualEditModal] = useState(false);
  const [editingScoreData, setEditingScoreData] = useState<{
    reviewee: any;
    category: string;
    subject: string;
    currentScore: number | null;
  } | null>(null);
  const [manualScoreInput, setManualScoreInput] = useState<string>('');
  const [manualScoreReason, setManualScoreReason] = useState<string>('');
  const [savingManualScore, setSavingManualScore] = useState(false);

  useEffect(() => {
    if (!firestoreDb) return;
    const unsubWeights = onSnapshot(doc(firestoreDb, "system_settings", "grade_calculation"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.weights) {
          setGradeWeights(d.weights);
        }
      }
    }, (err) => console.error("Error loading grade weights:", err));

    const unsubAreas = onSnapshot(collection(firestoreDb, "score_area_settings"), (snap) => {
      const areas: any[] = [];
      snap.forEach(d => {
        areas.push({ id: d.id, ...d.data() });
      });
      setActivatedAreas(areas);
    }, (err) => console.error("Error loading score area settings:", err));

    const unsubHistory = onSnapshot(collection(firestoreDb, "score_import_history"), (snap) => {
      const hist: any[] = [];
      snap.forEach(d => {
        hist.push({ id: d.id, ...d.data() });
      });
      setImportHistory(hist);
    }, (err) => console.error("Error loading score import history:", err));

    return () => {
      unsubWeights();
      unsubAreas();
      unsubHistory();
    };
  }, []);
   const normalizeName = (name: string) =>
     name
       .toLowerCase()
       .replace(/[^a-z0-9]/g, "")
       .trim();

   const getPossibleMatches = (csvName: string) => {
       const normalizedCSV = normalizeName(csvName);
       if (!normalizedCSV) return [];
       return allUsers.filter(u => {
           const first = normalizeName(u.first_name || '');
           const last = normalizeName(u.last_name || '');
           const full = normalizeName(`${u.first_name || ''} ${u.last_name || ''}`);
           const reverse = normalizeName(`${u.last_name || ''} ${u.first_name || ''}`);
           return (
               normalizedCSV === first ||
               normalizedCSV === last ||
               normalizedCSV === full ||
               normalizedCSV === reverse ||
               full.includes(normalizedCSV) ||
               reverse.includes(normalizedCSV)
           );
       }).slice(0, 5);
   };

  const [importFile, setImportFile] = useState<File | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [cheatingThreshold, setCheatingThreshold] = useState(5);

  const [year, setYear] = useState(() => new Date().getFullYear().toString());
  const [adminResetCategory, setAdminResetCategory] = useState<string>('All');
  const [adminResetConfirmation, setAdminResetConfirmation] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteData, setDeleteData] = useState<{ category: string, subject: string } | null>(null);
  const [showAdminResetDropdown, setShowAdminResetDropdown] = useState(false);
  const [showAutoSyncConfirm, setShowAutoSyncConfirm] = useState(false);
  const adminCategories = [
    { id: 'All', label: 'All Categories' },
    { id: 'Diagnostic', label: 'Diagnostic' },
    { id: 'Pretest', label: 'Pretest' },
    { id: 'Preboard', label: 'Preboard' },
    { id: 'Posttest', label: 'Posttest' },
    { id: 'FinalCoaching', label: 'Final Coaching' }
  ];
  const [dateFrom, setDateFrom] = useState(() => {
    return localStorage.getItem('lastManualSyncFrom') || '';
  });
  const [dateTo, setDateTo] = useState(() => {
    return localStorage.getItem('lastManualSyncTo') || '';
  });
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [allSchools, setAllSchools] = useState<string[]>([]);
  const [showMappingState, setShowMappingState] = useState(() => initialSection === 'mapping');
  const [showDuplicatesState, setShowDuplicatesState] = useState(() => initialSection === 'duplicates');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [abbreviations, setAbbreviations] = useState<Record<string, string>>({});
  const [officialNames, setOfficialNames] = useState<string[]>([]);
  const [officialName, setOfficialName] = useState('');
  const [officialAbbr, setOfficialAbbr] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [showOfficialSuggestions, setShowOfficialSuggestions] = useState(false);
  const [showAliasSuggestions, setShowAliasSuggestions] = useState(false);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [showYearSuggestions, setShowYearSuggestions] = useState(false);
  
  // NEW: Search Users logic
  const [showUsersListState, setShowUsersListState] = useState(() => initialSection === 'search');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  const [sortColumn, setSortColumn] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [filterSchool, setFilterSchool] = useState<string>('ALL');
  const [showFilterSchoolDropdown, setShowFilterSchoolDropdown] = useState(false);
  const [filterSchoolSearch, setFilterSchoolSearch] = useState('');
  const [excludedUserIds, setExcludedUserIds] = useState<Set<string>>(new Set());

  // Editing state for correcting/correcting user details in Search Database
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [passConfirmUser, setPassConfirmUser] = useState<any | null>(null);
  const [unarchiveConfirmUser, setUnarchiveConfirmUser] = useState<any | null>(null);
  const [isPassingReviewee, setIsPassingReviewee] = useState(false);

  const [manualScoreUser, setManualScoreUser] = useState<any | null>(null);
  const [manualScoreCategory, setManualScoreCategory] = useState('');
  const [manualScoreDate, setManualScoreDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualScoreValue, setManualScoreValue] = useState<string>('');
  const [manualScoreRemarks, setManualScoreRemarks] = useState('');
  const [isSavingManualScore, setIsSavingManualScore] = useState(false);

  const [editMiddleName, setEditMiddleName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editSeqId, setEditSeqId] = useState('');
  
  // Score edit states
  const [editScoreCLJ, setEditScoreCLJ] = useState('');
  const [editScoreLEA, setEditScoreLEA] = useState('');
  const [editScoreFS, setEditScoreFS] = useState('');
  const [editScoreCDI, setEditScoreCDI] = useState('');
  const [editScoreCRIM, setEditScoreCRIM] = useState('');
  const [editScoreCA, setEditScoreCA] = useState('');
  const [editRole, setEditRole] = useState('');
  
  const [updatingUser, setUpdatingUser] = useState(false);
  
  // New tab state
  const [activeTabState, setActiveTabRaw] = useState<'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity'>(initialTab || 'details');
  const [targetTabState, setTargetTabState] = useState<'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity'>(initialTab || 'details');

  const showMapping = embeddedMode ? (initialSection === 'mapping') : showMappingState;
  const showDuplicates = embeddedMode ? (initialSection === 'duplicates') : showDuplicatesState;
  const showUsersList = embeddedMode ? (initialSection === 'search') : showUsersListState;
  const activeTab = embeddedMode ? (initialTab || 'details') : activeTabState;
  const targetTab = embeddedMode ? (initialTab || 'details') : targetTabState;

  const shouldShowRegisteredAtColumn = activeTab === "details" || activeTab === "archived";
  
  const setShowMapping = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(showMapping) : val;
    if (embeddedMode) {
      if (nextVal) onSectionChange?.('mapping');
      else onSectionChange?.('main');
    } else {
      setShowMappingState(nextVal);
    }
  };

  const setShowDuplicates = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(showDuplicates) : val;
    if (embeddedMode) {
      if (nextVal) onSectionChange?.('duplicates');
      else onSectionChange?.('main');
    } else {
      setShowDuplicatesState(nextVal);
    }
  };

  const setShowUsersList = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(showUsersList) : val;
    if (embeddedMode) {
      if (nextVal) onSectionChange?.('search');
      else onSectionChange?.('main');
    } else {
      setShowUsersListState(nextVal);
    }
  };

  useEffect(() => {
    if (embeddedMode) return;
    setActiveTabRaw(initialTab || 'details');
    setTargetTabState(initialTab || 'details');
  }, [initialTab, embeddedMode]);

  useEffect(() => {
    if (!isOpen || embeddedMode) return;

    setShowUsersListState(false);
    setShowDuplicatesState(false);
    setShowMappingState(false);

    if (initialSection === 'search') {
      setShowUsersListState(true);
    } else if (initialSection === 'duplicates') {
      setShowDuplicatesState(true);
    } else if (initialSection === 'mapping') {
      setShowMappingState(true);
    }
  }, [isOpen, initialSection, embeddedMode]);

  const [isPending, startTransition] = useTransition();

  const isTabLoading = isPending;

  const handleTabChange = (tab: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity') => {
    if (tab === activeTab) return;
    if (embeddedMode) {
      onSubTabChange?.(tab);
    } else {
      setTargetTabState(tab);
      
      startTransition(() => {
        setActiveTabRaw(tab);
      });

      const slugMap = {
        details: 'details',
        scores: 'scores',
        import_scores: 'import-scores',
        archived: 'archived',
        leaderboard: 'leaderboard',
        activity: 'activity-log',
      };

      window.history.pushState({}, '', `/syncsettings/search-database/${slugMap[tab]}`);
    }
  };
  
  // Use activeTab for read, handleTabChange for write
  const activeTabAlias = activeTab;
  const setActiveTab = handleTabChange;
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activityLogsError, setActivityLogsError] = useState<string | null>(null);
  const [isDeletingScores, setIsDeletingScores] = useState(false);

  const deleteScoreColumn = async (category: string, subject: string) => {
    const res = await fetch('/api/delete-score-column', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subject })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete score column');
    
    const catLower = category.toLowerCase();
    let fieldPrefix = "score_";

    if (catLower === "diagnostic") fieldPrefix = "diag_";
    if (catLower === "preboard") fieldPrefix = "preboard_";
    if (catLower === "posttest") fieldPrefix = "post_";
    if (catLower === "finalcoaching") fieldPrefix = "final_";

    const fieldName = `${fieldPrefix}${subject.toLowerCase()}` as keyof RevieweeData;

    setAllUsers(prev =>
      prev.map(user => {
        const updated: any = { ...user };
        updated[fieldName] = "";
        updated[`score_${subject.toLowerCase()}_${catLower}`] = "";
        updated[`date_${subject.toLowerCase()}_${catLower}`] = "";
        if (catLower === "pretest" || catLower === "preboard") {
          updated[`score_${subject.toLowerCase()}`] = "";
          updated[`date_${subject.toLowerCase()}`] = "";
        }
        return updated;
      })
    );

    return data.updatedCount;
  };

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
  };

  const handleAdminReset = async () => {
    if (adminResetConfirmation !== "DELETE") {
      showToast("Type DELETE to confirm.", "error");
      return;
    }

    if (isResetting) return;

    setIsResetting(true);

    const start = Date.now();

    try {
      const res = await fetch('/api/administrative-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: adminResetCategory, year, confirmation: adminResetConfirmation })
      });
      if (!res.ok) throw new Error('Reset failed');

      const categoryLower = adminResetCategory.toLowerCase();
      
      setAllUsers(prevUsers =>
        prevUsers.map(user => {
          const updated = { ...user };
          
          if (categoryLower === "all" || categoryLower === "diagnostic") {
            updated.diag_clj = "";
            updated.diag_lea = "";
            updated.diag_fs = "";
            updated.diag_cdi = "";
            updated.diag_crim = "";
            updated.diag_ca = "";
            updated.score_clj_diagnostic = "";
            updated.score_lea_diagnostic = "";
            updated.score_fs_diagnostic = "";
            updated.score_cdi_diagnostic = "";
            updated.score_crim_diagnostic = "";
            updated.score_ca_diagnostic = "";
            updated.date_clj_diagnostic = "";
            updated.date_lea_diagnostic = "";
            updated.date_fs_diagnostic = "";
            updated.date_cdi_diagnostic = "";
            updated.date_crim_diagnostic = "";
            updated.date_ca_diagnostic = "";
          }

          if (categoryLower === "all" || categoryLower === "pretest") {
            updated.score_clj = "";
            updated.score_lea = "";
            updated.score_fs = "";
            updated.score_cdi = "";
            updated.score_crim = "";
            updated.score_ca = "";
            updated.date_clj = "";
            updated.date_lea = "";
            updated.date_fs = "";
            updated.date_cdi = "";
            updated.date_crim = "";
            updated.date_ca = "";
            updated.score_clj_pretest = "";
            updated.score_lea_pretest = "";
            updated.score_fs_pretest = "";
            updated.score_cdi_pretest = "";
            updated.score_crim_pretest = "";
            updated.score_ca_pretest = "";
            updated.date_clj_pretest = "";
            updated.date_lea_pretest = "";
            updated.date_fs_pretest = "";
            updated.date_cdi_pretest = "";
            updated.date_crim_pretest = "";
            updated.date_ca_pretest = "";
          }

          if (categoryLower === "all" || categoryLower === "preboard") {
            updated.preboard_clj = "";
            updated.preboard_lea = "";
            updated.preboard_fs = "";
            updated.preboard_cdi = "";
            updated.preboard_crim = "";
            updated.preboard_ca = "";
            updated.score_clj = "";
            updated.score_lea = "";
            updated.score_fs = "";
            updated.score_cdi = "";
            updated.score_crim = "";
            updated.score_ca = "";
            updated.date_clj = "";
            updated.date_lea = "";
            updated.date_fs = "";
            updated.date_cdi = "";
            updated.date_crim = "";
            updated.date_ca = "";
            updated.score_clj_preboard = "";
            updated.score_lea_preboard = "";
            updated.score_fs_preboard = "";
            updated.score_cdi_preboard = "";
            updated.score_crim_preboard = "";
            updated.score_ca_preboard = "";
            updated.date_clj_preboard = "";
            updated.date_lea_preboard = "";
            updated.date_fs_preboard = "";
            updated.date_cdi_preboard = "";
            updated.date_crim_preboard = "";
            updated.date_ca_preboard = "";
          }

          if (categoryLower === "all" || categoryLower === "posttest") {
            updated.post_clj = "";
            updated.post_lea = "";
            updated.post_fs = "";
            updated.post_cdi = "";
            updated.post_crim = "";
            updated.post_ca = "";
            updated.score_clj_posttest = "";
            updated.score_lea_posttest = "";
            updated.score_fs_posttest = "";
            updated.score_cdi_posttest = "";
            updated.score_crim_posttest = "";
            updated.score_ca_posttest = "";
            updated.date_clj_posttest = "";
            updated.date_lea_posttest = "";
            updated.date_fs_posttest = "";
            updated.date_cdi_posttest = "";
            updated.date_crim_posttest = "";
            updated.date_ca_posttest = "";
          }

          if (categoryLower === "all" || categoryLower === "finalcoaching") {
            updated.final_clj = "";
            updated.final_lea = "";
            updated.final_fs = "";
            updated.final_cdi = "";
            updated.final_crim = "";
            updated.final_ca = "";
            updated.score_clj_finalcoaching = "";
            updated.score_lea_finalcoaching = "";
            updated.score_fs_finalcoaching = "";
            updated.score_cdi_finalcoaching = "";
            updated.score_crim_finalcoaching = "";
            updated.score_ca_finalcoaching = "";
            updated.date_clj_finalcoaching = "";
            updated.date_lea_finalcoaching = "";
            updated.date_fs_finalcoaching = "";
            updated.date_cdi_finalcoaching = "";
            updated.date_crim_finalcoaching = "";
            updated.date_ca_finalcoaching = "";
          }

          return updated;
        })
      );

      showToast("Reset completed successfully.", "success");
      setAdminResetConfirmation('');
    } catch (error) {
      console.error(error);
      showToast("Reset failed.", "error");
    } finally {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, 1500 - elapsed);
      await new Promise(r => setTimeout(r, wait));
      setIsResetting(false);
    }
  };

  const handleDeleteScores = (category: string, subject: string) => {
    setDeleteData({ category, subject });
    setShowConfirmDelete(true);
  };

  const executeDelete = async (category: string, subject: string) => {
    console.log('executeDelete called for:', category, subject);
    
    setShowConfirmDelete(false);
    setDeleteData(null);
    setIsDeletingScores(true);

    // force loading UI render
    await new Promise(resolve => setTimeout(resolve, 300));

    const start = Date.now();

    try {
      const updatedCount = await deleteScoreColumn(category, subject);

      showToast(
        `Deleted ${updatedCount} records successfully.`,
        "success"
      );

    } catch (error:any) {

      console.error("Delete error:", error);

      showToast(
        error.message || "Failed to delete scores.",
        "error"
      );

    } finally {

      // keep animation visible
      const elapsed = Date.now() - start;
      const wait = Math.max(0, 1500 - elapsed);

      await new Promise(resolve =>
        setTimeout(resolve, wait)
      );


      setIsDeletingScores(false);
    }
  };
  
  const fetchActivityLogs = async () => {
    setLoadingLogs(true);
    setActivityLogsError(null);
    try {
      if (!firestoreDb) throw new Error("Firestore DB not initialized.");
      const { query, collection, orderBy, limit, getDocs } = await import('firebase/firestore');
      const q = query(
        collection(firestoreDb, "activity_logs"),
        orderBy("timestamp", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(doc => {
        const data = doc.data();
        let timestamp = data.timestamp;
        if (timestamp && typeof timestamp === "object") {
          if (typeof timestamp.toDate === "function") {
            timestamp = timestamp.toDate().toISOString();
          } else if (typeof timestamp.seconds === "number") {
            timestamp = new Date(timestamp.seconds * 1000).toISOString();
          }
        }
        return {
          id: doc.id,
          ...data,
          timestamp: timestamp || new Date().toISOString()
        };
      });
      setActivityLogs(logs);
    } catch (e: any) {
      console.error("fetchActivityLogs error:", e);
      if (e?.message?.includes("failed: missing or insufficient permissions") || e?.code === 'permission-denied') {
         setActivityLogsError("Access denied. Admin privileges required to view activity logs.");
      } else {
         setActivityLogsError(e?.message || "Connection failed");
      }
      setActivityLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activity') {
      if (!currentUser) {
        setActivityLogsError("Authentication required.");
        setActivityLogs([]);
        return;
      }
      fetchActivityLogs();
    }
  }, [activeTab, currentUser]);

  const uniqueSchoolsList = useMemo(() => {
    const schools = allUsers.map(u => String(u.school_name || '').trim()).filter(Boolean);
    return Array.from(new Set(schools)).sort();
  }, [allUsers]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      if (
        ['rating', 'overall_grade', 'clj', 'lea', 'crim', 'cdi', 'fs', 'ca'].includes(column) ||
        column.startsWith('rating_') ||
        column.includes('_')
      ) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const handleNameSortChange = (direction: 'asc' | 'desc') => {
    setSortColumn('name');
    setSortDirection(direction);
  };

  const getSortableName = (u: any) =>
    [
      String(u.last_name || '').trim(),
      String(u.first_name || '').trim(),
      String(u.middle_name || '').trim(),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = allUsers.filter(u => getUserRole(u) === "Reviewee" && isValidRevieweeRecord(u));
    
    if (activeTab === 'archived') {
      filtered = filtered.filter(u => 
        u.is_archived === true || 
        u.archived === true || 
        u.passed === true || 
        u.archiveStatus === "passed" || 
        u.status === "archived"
      );
    } else {
      filtered = filtered.filter(u => 
        u.is_archived !== true && 
        u.archived !== true && 
        u.passed !== true && 
        u.archiveStatus !== "passed" && 
        u.status !== "archived"
      );
    }

    if (activeTab === 'scores') {
      filtered = filtered.filter(u => isValidScoreManagementUser(resolveCanonicalUserIdentity(u)));
    }

    if (filterSchool !== 'ALL') {
      filtered = filtered.filter(u => String(u.school_name || '').trim().toLowerCase() === filterSchool.toLowerCase());
    }

    if (searchUserQuery) {
      const q = searchUserQuery.toLowerCase();
      filtered = filtered.filter(u => {
        const fullName = `${u.last_name || ''}, ${u.first_name || ''} ${u.middle_name || ''}`.trim().toLowerCase();
        return fullName.includes(q) ||
               String(u.seq_id).toLowerCase().includes(q) ||
               String(u.school_name).toLowerCase().includes(q) ||
               `${u.first_name || ''} ${u.middle_name || ''} ${u.last_name || ''}`.trim().toLowerCase().includes(q);
      });
    }

    return [...filtered].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortColumn === 'id') {
        const idA = String(a.seq_id || '').toLowerCase();
        const idB = String(b.seq_id || '').toLowerCase();
        const numA = parseInt(idA);
        const numB = parseInt(idB);
        if (!isNaN(numA) && !isNaN(numB) && idA.length === idB.length) {
            valA = numA;
            valB = numB;
        } else {
            valA = idA;
            valB = idB;
        }
      } else if (sortColumn === 'name') {
        valA = getSortableName(a);
        valB = getSortableName(b);
      } else if (sortColumn === 'school') {
        valA = String(a.school_name || '').toLowerCase();
        valB = String(b.school_name || '').toLowerCase();
      } else if (sortColumn === 'status') {
        valA = a.is_synced ? 1 : 0;
        valB = b.is_synced ? 1 : 0;
      } else if (sortColumn === 'timestamp') {
        valA = a.created_at ? new Date(a.created_at).getTime() : 0;
        valB = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else if (sortColumn === 'overall_grade') {
        valA = selectedCategories.reduce((acc, cat) => {
          const detailed = getCategoryDetailedScores(a, cat);
          const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
          const weight = gradeWeights[cat] ?? 0;
          return acc + (catRating * (weight / 100));
        }, 0);
        valB = selectedCategories.reduce((acc, cat) => {
          const detailed = getCategoryDetailedScores(b, cat);
          const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
          const weight = gradeWeights[cat] ?? 0;
          return acc + (catRating * (weight / 100));
        }, 0);
      } else if (sortColumn.startsWith('rating_')) {
        const cat = sortColumn.replace('rating_', '');
        const detailedA = getCategoryDetailedScores(a, cat);
        const detailedB = getCategoryDetailedScores(b, cat);
        valA = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailedA[s].earnedScore, detailedA[s].possiblePoints, s).weightedContribution, 0);
        valB = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailedB[s].earnedScore, detailedB[s].possiblePoints, s).weightedContribution, 0);
      } else if (sortColumn.includes('_')) {
        const [subjKey, cat] = sortColumn.split('_') as [SubjectKey, string];
        const detailedA = getResolvedDetailedScore(a, cat, subjKey);
        const detailedB = getResolvedDetailedScore(b, cat, subjKey);
        valA = calculateAreaContribution(detailedA.earnedScore, detailedA.possiblePoints, subjKey).weightedContribution;
        valB = calculateAreaContribution(detailedB.earnedScore, detailedB.possiblePoints, subjKey).weightedContribution;
      } else if (['clj', 'lea', 'crim', 'cdi', 'fs', 'ca'].includes(sortColumn)) {
        const currentCat = selectedCategories[0] || 'preboard';
        const subjKey = sortColumn as SubjectKey;
        const detailedA = getResolvedDetailedScore(a, currentCat, subjKey);
        const detailedB = getResolvedDetailedScore(b, currentCat, subjKey);
        valA = calculateAreaContribution(detailedA.earnedScore, detailedA.possiblePoints, subjKey).weightedContribution;
        valB = calculateAreaContribution(detailedB.earnedScore, detailedB.possiblePoints, subjKey).weightedContribution;
      } else if (sortColumn === 'rating') {
        const currentCat = selectedCategories[0] || 'preboard';
        const detailedA = getCategoryDetailedScores(a, currentCat);
        const detailedB = getCategoryDetailedScores(b, currentCat);
        valA = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailedA[s].earnedScore, detailedA[s].possiblePoints, s).weightedContribution, 0);
        valB = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailedB[s].earnedScore, detailedB[s].possiblePoints, s).weightedContribution, 0);
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;

      const nameA = getSortableName(a);
      const nameB = getSortableName(b);
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  }, [allUsers, searchUserQuery, sortColumn, sortDirection, filterSchool, activeTab, selectedCategories, gradeWeights]);

  const usersToExport = useMemo(() => {
    return filteredAndSortedUsers.filter(u => !excludedUserIds.has(String(u.doc_id || u.seq_id)));
  }, [filteredAndSortedUsers, excludedUserIds]);

  const handleExportCSV = () => {
    let headers = ['First Name', 'Middle Name', 'Last Name', 'ID Number', 'School', 'Status'];
    if (activeTab === 'details' || activeTab === 'archived') {
        headers.push('Registered At');
    }
    
    let rows = usersToExport.map(u => {
        const canonical = resolveCanonicalUserIdentity(u);
        const row = [
          `"${canonical.firstName.toUpperCase()}"`,
          `"${canonical.middleName.toUpperCase()}"`,
          `"${canonical.lastName.toUpperCase()}"`,
          `"${canonical.idNumber}"`,
          `"${(mappings[canonical.school] || canonical.school).toUpperCase()}"`,
          u.is_synced ? 'SYNCED' : 'PENDING'
        ];
        if (activeTab === 'details' || activeTab === 'archived') {
            row.push(`"${u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'}"`);
        }
        return row;
    });

    let csvContentStr = '';

    if (activeTab === 'scores') {
      if (selectedCategories.length === 1) {
        const currentCat = selectedCategories[0] || 'preboard';
        const headerLine1 = ['SUBJECT', '', '', '', 'CLJ', '', 'LEA', '', 'CDI', '', 'FS', '', 'CRIMINOLOGY', '', 'COR AD', '', `${currentCat.toUpperCase()} RATING`, ''];
        const headerLine2 = ['NO', 'NAME', 'SCHOOL', 'ID NUMBER', '20%', '', '20%', '', '15%', '', '15%', '', '20%', '', '10%', '', '100%', ''];
        const headerLine3 = ['', '', '', '', '', 'PERCENTAGE', '', 'PERCENTAGE', '', 'PERCENTAGE', '', 'PERCENTAGE', '', 'PERCENTAGE', '', 'PERCENTAGE', '', ''];
        
        rows = usersToExport.map((u, i) => {
          const canonical = resolveCanonicalUserIdentity(u);
          const detailed = getCategoryDetailedScores(u, currentCat);

          const clj = calculateAreaContribution(detailed.clj.earnedScore, detailed.clj.possiblePoints, 'clj');
          const lea = calculateAreaContribution(detailed.lea.earnedScore, detailed.lea.possiblePoints, 'lea');
          const cdi = calculateAreaContribution(detailed.cdi.earnedScore, detailed.cdi.possiblePoints, 'cdi');
          const fs = calculateAreaContribution(detailed.fs.earnedScore, detailed.fs.possiblePoints, 'fs');
          const crim = calculateAreaContribution(detailed.crim.earnedScore, detailed.crim.possiblePoints, 'crim');
          const ca = calculateAreaContribution(detailed.ca.earnedScore, detailed.ca.possiblePoints, 'ca');

          const total = clj.weightedContribution + lea.weightedContribution + cdi.weightedContribution + fs.weightedContribution + crim.weightedContribution + ca.weightedContribution;

          const formatScore = (comp: any) => comp.earnedScore !== null ? `${comp.earnedScore}/${comp.possiblePoints}` : `___/${comp.possiblePoints}`;

          return [
            `${i + 1}`,
            `"${canonical.lastName.toUpperCase()}, ${canonical.firstName.toUpperCase()} ${canonical.middleName.toUpperCase()}"`,
            `"${(mappings[canonical.school] || canonical.school).toUpperCase()}"`,
            `"${canonical.idNumber}"`,
            `"${formatScore(clj)}"`, `"${clj.weightedContribution.toFixed(2)}%"`,
            `"${formatScore(lea)}"`, `"${lea.weightedContribution.toFixed(2)}%"`,
            `"${formatScore(cdi)}"`, `"${cdi.weightedContribution.toFixed(2)}%"`,
            `"${formatScore(fs)}"`, `"${fs.weightedContribution.toFixed(2)}%"`,
            `"${formatScore(crim)}"`, `"${crim.weightedContribution.toFixed(2)}%"`,
            `"${formatScore(ca)}"`, `"${ca.weightedContribution.toFixed(2)}%"`,
            `"${total.toFixed(2)}%"`, `""`
          ];
        });

        csvContentStr = [
          'SAMARITAN REVIEW CENTER',
          `RESULT OF EVALUATION EXAMINATIONS (${currentCat.toUpperCase()})`,
          `Total Registered: ${usersToExport.length}`,
          '',
          headerLine1.join(','),
          headerLine2.join(','),
          headerLine3.join(','),
          ...rows.map(r => r.join(','))
        ].join('\n');
      } else {
        const csvHeaders = ['NO', 'NAME', 'SCHOOL', 'ID NUMBER'];
        SUBJECT_KEYS.forEach(subj => {
          selectedCategories.forEach(cat => {
            csvHeaders.push(`"${subj.toUpperCase()} (${cat})"`);
          });
        });
        selectedCategories.forEach(cat => {
          csvHeaders.push(`"${cat} Rating"`);
        });
        csvHeaders.push('"Overall Grade"');

        rows = usersToExport.map((u, i) => {
          const row = [
            `${i + 1}`,
            `"${(u.last_name || '').toUpperCase()}, ${(u.first_name || '').toUpperCase()} ${u.middle_name ? (u.middle_name).toUpperCase() : ''}"`,
            `"${(mappings[u.school_name || ''] || u.school_name || '').toUpperCase()}"`,
            `"${(u.seq_id || '').replace(/\D/g, '')}"`
          ];

          SUBJECT_KEYS.forEach(subj => {
            selectedCategories.forEach(cat => {
              const detailed = getResolvedDetailedScore(u, cat, subj);
              const comp = calculateAreaContribution(detailed.earnedScore, detailed.possiblePoints, subj);
              const scoreStr = comp.earnedScore !== null ? `${comp.earnedScore}/${comp.possiblePoints}` : `___/${comp.possiblePoints}`;
              row.push(`"${scoreStr} (${comp.weightedContribution.toFixed(2)}%)"`);
            });
          });

          selectedCategories.forEach(cat => {
            const detailed = getCategoryDetailedScores(u, cat);
            const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
            row.push(`"${catRating.toFixed(2)}%"`);
          });

          const overallGrade = selectedCategories.reduce((acc, cat) => {
            const detailed = getCategoryDetailedScores(u, cat);
            const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
            const weight = gradeWeights[cat] ?? 0;
            return acc + (catRating * (weight / 100));
          }, 0);
          row.push(`"${overallGrade.toFixed(2)}%"`);

          return row;
        });

        const sumWeights = selectedCategories.reduce((acc, cat) => acc + (gradeWeights[cat] || 0), 0);

        csvContentStr = [
          'SAMARITAN REVIEW CENTER',
          `RESULT OF EVALUATION EXAMINATIONS (${selectedCategories.join(', ')})`,
          `Total Registered: ${usersToExport.length}`,
          Math.abs(sumWeights - 100) > 0.01 ? `"Note: Selected category weights total ${sumWeights}%. Overall Grade is based on configured weights and is not normalized."` : '',
          csvHeaders.join(','),
          ...rows.map(r => r.join(','))
        ].filter(Boolean).join('\n');
      }
    } else {
      csvContentStr = [
        'SAMARITAN REVIEW CENTER',
        'Reviewee List',
        `Total Registered: ${usersToExport.length}`,
        '',
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');
    }

    const blob = new Blob([csvContentStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', activeTab === 'scores' ? 'evaluation_results.csv' : (activeTab === 'archived' ? 'archived_reviewee_list.csv' : 'reviewee_list.csv'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportReviewees = () => {
    const headers = ['First Name', 'Middle Name', 'Last Name', 'ID Number'];
    const rows = usersToExport.map(u => [
      `"${(u.first_name || '').replace(/"/g, '""')}"`,
      `"${(u.middle_name || '').replace(/"/g, '""')}"`,
      `"${(u.last_name || '').replace(/"/g, '""')}"`,
      `"${(u.seq_id || '').replace(/\D/g, '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reviewees_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportReviewees = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const taskId = Date.now().toString();
    const newTask = {
        id: taskId,
        name: `Import Reviewees: ${file.name}`,
        progress: 10,
        status: 'parsing',
        message: 'Parsing reviewees file...',
        startTime: new Date()
    };
    setBackgroundTasks(prev => [...prev, newTask]);

    const updateTask = (updates: any) => {
        setBackgroundTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const data = results.data;
            try {
                updateTask({ progress: 40, message: "Uploading reviewees..." });
                const res = await fetch('/api/import-reviewees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reviewees: data })
                });
                
                if (!res.ok) throw new Error('Import failed');
                setToastMessage({ text: 'Import successful', type: 'success' });
                updateTask({ progress: 100, status: 'completed', message: 'Import successful' });
                fetchAllUsers(); // Refresh data
            } catch (err: any) {
                setToastMessage({ text: err.message || 'Import failed', type: 'error' });
                updateTask({ progress: 100, status: 'failed', message: err.message || 'Import failed' });
            }
        }
    });
  };

  const normalizeKey = (key: string | undefined | null) =>
    String(key || "")
      .replace(/^\uFEFF/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const getCsvValue = (row: any, aliases: string[]) => {
    const wanted = new Set(aliases.map(normalizeKey));

    for (const [key, value] of Object.entries(row)) {
      if (wanted.has(normalizeKey(key))) {
        return value;
      }
    }
    return "";
  };

  const normalizeStudentId = (value: any) =>
    String(value || "")
      .replace(/^SRC\s*/i, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

  const findStudent = (studentId: string, allUsers: any[]) => {
    const importedId = normalizeStudentId(studentId);

    return allUsers.find((user) => {
      const userId = normalizeStudentId(
        user.seq_id ||
        user.seqId ||
        user.id_number ||
        user.student_id ||
        user.custom_id ||
        ""
      );

      return (
        userId === importedId ||
        userId.endsWith(importedId) ||
        importedId.endsWith(userId)
      );
    });
  };

  const normalizeValue = (value: any) =>
    String(value || "").trim().toUpperCase();

  const getStudentNameFromRow = (row: any) => {
    const firstName = String(row.FirstName || row['First Name'] || "").trim();
    const lastName = String(row.LastName || row['Last Name'] || "").trim();
    return `${firstName} ${lastName}`.trim() || row.Name || "";
  };

  const performImport = async (subject: string, categories: string[], date: string, file: File) => {
    const taskId = Date.now().toString();
    const newTask = {
      id: taskId,
      name: `Import: ${subject} (${categories.join(', ')})`,
      progress: 5,
      status: 'parsing',
      message: 'Parsing CSV file...',
      startTime: new Date()
    };
    
    setBackgroundTasks(prev => [...prev, newTask]);
    
    // setIsImporting(true); // Don't block the whole UI anymore
    setImportStatus('parsing');
    
    setShowProgress(true);
    setProgressPercent(5);
    setProgressStatus(`Importing ${subject}...`);
    setUploadedRecords(0);
    setUpdatedRecords(0);
    setFailedRecords(0);

    const updateTask = (updates: any) => {
      setBackgroundTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    try {
      const fieldMatch = subject.trim().toLowerCase();
      const { default: Papa } = await import('papaparse');
      
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            updateTask({ progress: 30, message: "Matching reviewees..." });
            const data = results.data as any[];

            const updates: any[] = [];
            const unmatchedEntries: any[] = [];
            
            for (const row of data) {
               const studentId = getCsvValue(row, [
                 "Student ID", "StudentID", "Custom ID", "CustomID", "ID Number", "Seq ID", "ZipGradeID", "Zip Grade ID"
               ]);
               const score = getCsvValue(row, ["Score", "Raw Score", "Earned Points", "EarnedPoints", "Points", "Total Score"]);
               let student = findStudent(studentId as string, allUsers);
               
               if (!student) {
                   const studentName = getCsvValue(row, ["Name", "Student", "Student Name", "StudentName"]);
                   if (studentName) {
                       const normalizedName = String(studentName).toLowerCase().replace(/[^a-z0-9]/g, '');
                       student = allUsers.find(u => {
                            const uFirst = (u.first_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            const uLast = (u.last_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            const fullName = uFirst + uLast;
                            const fullNameRev = uLast + uFirst;
                            return normalizedName.length > 3 && (normalizedName.includes(fullName) || normalizedName.includes(fullNameRev) || fullName.includes(normalizedName) || fullNameRev.includes(normalizedName));
                       });
                   }
               }
               
                const scoreValue = String(score).trim();
                const updateData = categories.reduce((acc, cat) => {
                    acc[`score_${fieldMatch}_${cat.toLowerCase()}`] = scoreValue;
                    acc[`date_${fieldMatch}_${cat.toLowerCase()}`] = date || new Date().toISOString();
                    return acc;
                }, {} as Record<string, any>);
                
                updateData[`score_${fieldMatch}`] = scoreValue;
                updateData[`date_${fieldMatch}`] = date || new Date().toISOString();
                updateData.is_synced = false;
                
                for (let i = 1; i <= 100; i++) {
                    if (row[`Stu${i}`] !== undefined) updateData[`Stu${i}`] = String(row[`Stu${i}`]).trim().toUpperCase();
                    if (row[`PriKey${i}`] !== undefined) updateData[`Key${i}`] = String(row[`PriKey${i}`]).trim().toUpperCase();
                }

               if (student && student.doc_id && scoreValue !== "") {
                 updates.push({ doc_id: student.doc_id, data: updateData });
               } else if (studentId || row['Name'] || row['Student']) {
                 const csvName = getCsvValue(row, ["Name", "Student", "Student Name", "StudentName"]) as string;
                 let nameToDisplay = csvName ? (studentId ? `${csvName} (ID: ${studentId})` : csvName) : (studentId ? `Unknown (ID: ${studentId})` : 'Unknown');
                 unmatchedEntries.push({ id: studentId, name: nameToDisplay, updateData, rawScore: scoreValue, possibleMatches: getPossibleMatches((csvName || nameToDisplay) as string) });
               }
            }
            
            if (updates.length > 0) {
                updateTask({ progress: 60, message: "Uploading to server..." });
                const res = await fetch('/api/batch-update-scores', {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    updates,
                    adminName: currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name}` : "Admin",
                    adminRole: currentUser?.role || "admin"
                  })
                });
                if (!res.ok) throw new Error("Failed to update scores");
                const responseData = await res.json();
                setImportReport({ unmatchedEntries, missingUsers: allUsers.filter(u => !u.is_archived && !new Set(updates.map(up => up.doc_id)).has(u.doc_id)) });
                updateTask({ progress: 100, status: 'completed', message: "Import completed successfully." });
                setToastMessage({ text: `Successfully processed imports for: ${subject}`, type: 'success' });
            } else {
                setImportReport({ unmatchedEntries, missingUsers: allUsers.filter(u => !u.is_archived) });
                updateTask({ progress: 100, status: 'completed', message: "No scores updated. Check report." });
            }
            await fetchAllUsers();
          } catch (err) {
            console.error("Error importing scores:", err);
            updateTask({ progress: 100, status: 'failed', message: "Upload failed." });
            setToastMessage({ text: "Error parsing CSV file.", type: 'error' });
          }
        },
        error: () => {
          updateTask({ progress: 100, status: 'failed', message: "CSV parsing failed." });
        }
      });
    } catch (err) {
      console.error("Error setting up import:", err);
      updateTask({ progress: 100, status: 'failed', message: "Initialization failed." });
    }
  };

  const handleImportScores = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const subject = window.prompt("Enter the subject abbreviation for this score import (CLJ, LEA, FS, CDI, CRIM, CA):");
      if (!subject) {
        setIsImporting(false);
        return;
      }

      const fieldMatch = subject.trim().toUpperCase();
      const validFields = ['CLJ', 'LEA', 'FS', 'CDI', 'CRIM', 'CA'];
      if (!validFields.includes(fieldMatch)) {
        alert("Invalid subject abbreviation. Allowed values are: CLJ, LEA, FS, CDI, CRIM, CA");
        return;
      }

      const scoreField = `score_${fieldMatch.toLowerCase()}`;
      
      const results = await new Promise<any>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject
        });
      });
      const updates: any[] = [];
      const unmatchedEntries: any[] = [];
      const data = results.data as any[];
      
      for (const row of data) {
          console.log("Parsing row:", row);
         const studentId = row['StudentID'] || row['CustomID'] || row['ZipGradeID']; 
         const earnedPoints = row['Earned Points'] || row['EarnedPoints'] || row['EarnedPts'];
         console.log("Extracted:", { studentId, earnedPoints });
         
         if (studentId && earnedPoints !== undefined) {
           console.log("Processing studentId:", studentId, "earnedPoints:", earnedPoints);
           // find corresponding user
           const user = allUsers.find(u => {
             if (!u.seq_id) return false;
             const isMatch = String(u.seq_id).replace(/\s/g, '').endsWith(String(studentId).replace(/\s/g, ''));
             if (isMatch) console.log("Match found for ID:", studentId, "User seq:", u.seq_id);
             return isMatch;
           });
           if (user && user.doc_id) {
             const now = new Date();
             const m = now.getMonth() + 1;
             const d = now.getDate();
             const y = now.getFullYear();
             const dateStr = `${m.toString().padStart(2, '0')}/${d.toString().padStart(2, '0')}/${y}`;
             updates.push({ 
               doc_id: user.doc_id, 
               data: { 
                 [scoreField]: String(earnedPoints),
                 [`date_${fieldMatch.toLowerCase()}_pretest`]: dateStr
               } 
             });
           } else {
             unmatchedEntries.push({ id: studentId, name: row['Name'] || 'Unknown', possibleMatches: getPossibleMatches(row['Name'] || 'Unknown') });
           }
         }
      }
      
      if (updates.length === 0 && unmatchedEntries.length === 0) {
        alert("No data found to process.");
        setIsImporting(false);
        return;
      }
      
      let confirmationMsg = `Found ${updates.length} matching students for ${fieldMatch}.`;
      if (unmatchedEntries.length > 0) {
        confirmationMsg += `\n\nWarning: ${unmatchedEntries.length} entries in CSV did not match any registered Student ID!`;
      }
      confirmationMsg += `\nProceed to update scores?`;
      
      if (!window.confirm(confirmationMsg)) {
        setIsImporting(false);
        return;
      }
      
      setUpdatingUser(true);
      
      try {
          if (updates.length > 0) {
              setImportStatus('uploading');
              setImportProgress(0);
              const chunkSize = 50;
              for (let i = 0; i < updates.length; i += chunkSize) {
                 const chunk = updates.slice(i, i + chunkSize);
                 const res = await fetch('/api/batch-update-scores', {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({ 
                     field: scoreField, 
                     updates: chunk,
                     adminName: currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name}` : "Admin",
                     adminRole: currentUser?.role || "admin"
                   })
                 });
                 if (!res.ok) throw new Error("Failed to update scores");
                 setImportProgress(Math.min(100, Math.round(((i + chunk.length) / updates.length) * 100)));
              }
              
              const updatedDocIds = new Set(updates.map(up => up.doc_id));
              const missingUsers = allUsers.filter(u => !u.is_archived && !updatedDocIds.has(u.doc_id));
              setImportReport({ unmatchedEntries, missingUsers });
              await fetchAllUsers();
              setActiveTab('leaderboard');
              setImportStatus('done');
              setToastMessage({ text: `Successfully processed imports for: ${fieldMatch}`, type: 'success' });
          } else {
              setImportReport({ unmatchedEntries, missingUsers: allUsers.filter(u => !u.is_archived) });
              setActiveTab('leaderboard');
              setImportStatus('done');
          }
      } catch (apiErr) {
        // alert("Error communicating with server while updating scores");
        setImportStatus('error');
        setToastMessage({ text: "Error communicating with server while updating scores", type: 'error' });
      }
      setUpdatingUser(false);
      
    } catch (err) {
      console.error("Error importing scores:", err);
      // alert("Error parsing CSV file.");
      setImportStatus('error');
      setToastMessage({ text: "Error parsing CSV file.", type: 'error' });
    } finally {
      // Do not set isImporting(false) here, it's handled in success/error
      // Reset input so the same file could be uploaded again
      e.target.value = "";
    }
  };


function formatExamDates(dateStrings: string[]): string {
  if (!dateStrings || dateStrings.length === 0) return "July 19, 2026";

  const validDates = Array.from(new Set(dateStrings))
    .map(d => {
      const parts = d.split('-');
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      return new Date(d);
    })
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (validDates.length === 0) return "July 19, 2026";

  const fullMonthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const yearMap: Record<number, Record<number, number[]>> = {};

  validDates.forEach(d => {
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    if (!yearMap[y]) yearMap[y] = {};
    if (!yearMap[y][m]) yearMap[y][m] = [];
    if (!yearMap[y][m].includes(day)) yearMap[y][m].push(day);
  });

  const yearParts: string[] = [];

  Object.keys(yearMap).sort((a, b) => Number(a) - Number(b)).forEach(yearStr => {
    const y = Number(yearStr);
    const months = yearMap[y];
    const monthIndices = Object.keys(months).map(Number).sort((a, b) => a - b);

    const monthParts: string[] = [];
    monthIndices.forEach(m => {
      const days = months[m].sort((a, b) => a - b);
      const mName = fullMonthNames[m];
      if (days.length === 1) {
        monthParts.push(`${mName} ${days[0]}`);
      } else if (days.length === 2) {
        monthParts.push(`${mName} ${days[0]} and ${days[1]}`);
      } else {
        const lastDay = days[days.length - 1];
        const initialDays = days.slice(0, days.length - 1).join(', ');
        monthParts.push(`${mName} ${initialDays}, and ${lastDay}`);
      }
    });

    if (monthParts.length === 1) {
      yearParts.push(`${monthParts[0]}, ${y}`);
    } else if (monthParts.length === 2) {
      yearParts.push(`${monthParts[0]} and ${monthParts[1]}, ${y}`);
    } else {
      const lastMonth = monthParts[monthParts.length - 1];
      const initialMonths = monthParts.slice(0, monthParts.length - 1).join(', ');
      yearParts.push(`${initialMonths}, and ${lastMonth}, ${y}`);
    }
  });

  return yearParts.join('; ');
}

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const addPdfContent = (logoDataUrl: string | null) => {
        const doc = new jsPDF(activeTab === 'scores' ? 'landscape' : 'portrait');
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        let tableStartY = 35;

        if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'PNG', centerX - 10, 10, 20, 20); // 20x20 centered logo
          doc.setFontSize(14);
          doc.text('SAMARITAN REVIEW CENTER', centerX, 38, { align: 'center' });
          if (activeTab === 'scores') {
            doc.setFontSize(9);
            
            const datesSet1 = new Set<string>();
            usersToExport.forEach(u => {
              selectedCategories.forEach(cat => {
                SUBJECT_KEYS.forEach(subj => {
                  const d = getSubjectDetails(u, subj).date;
                  if (d && typeof d === 'string') {
                    const clean = d.split('T')[0];
                    if (clean && !isNaN(Date.parse(clean))) datesSet1.add(clean);
                  }
                });
              });
            });
            const examDateFormatted1 = formatExamDates(Array.from(datesSet1));
            doc.text(`RESULT OF EVALUATION EXAMINATIONS HELD ON ${examDateFormatted1.toUpperCase()}`, centerX, 44, { align: 'center' });
            doc.setFontSize(8);
            doc.text('Subject Weights: CLJ 20%, LEA 20%, CRIM 20%, CDI 15%, FS 15%, CA 10%', centerX, 49, { align: 'center' });
          } else {
            doc.setFontSize(11);
            doc.text('Reviewee List', centerX, 44, { align: 'center' });
          }
          tableStartY = 60;
        } else {
          doc.setFontSize(14);
          doc.text('SAMARITAN REVIEW CENTER', centerX, 15, { align: 'center' });
          if (activeTab === 'scores') {
            doc.setFontSize(9);
            
            const datesSet2 = new Set<string>();
            usersToExport.forEach(u => {
              selectedCategories.forEach(cat => {
                SUBJECT_KEYS.forEach(subj => {
                  const d = getSubjectDetails(u, subj).date;
                  if (d && typeof d === 'string') {
                    const clean = d.split('T')[0];
                    if (clean && !isNaN(Date.parse(clean))) datesSet2.add(clean);
                  }
                });
              });
            });
            const examDateFormatted2 = formatExamDates(Array.from(datesSet2));
            doc.text(`RESULT OF EVALUATION EXAMINATIONS HELD ON ${examDateFormatted2.toUpperCase()}`, centerX, 22, { align: 'center' });
            doc.setFontSize(8);
            doc.text('Subject Weights: CLJ 20%, LEA 20%, CRIM 20%, CDI 15%, FS 15%, CA 10%', centerX, 27, { align: 'center' });
          } else {
            doc.setFontSize(11);
            doc.text('Reviewee List', centerX, 22, { align: 'center' });
          }
          tableStartY = 35;
        }

        doc.setFontSize(10);
        doc.text(`Total Registered: ${usersToExport.length}`, 14, tableStartY - 5);

        let tableColumn = ["ID Number", "Name", "School", "Status"];
        if (activeTab === 'details' || activeTab === 'archived') {
            tableColumn.push("Registered At");
        }
        let tableRows = usersToExport.map(u => {
          const row = [
            u.seq_id || '',
            `${(u.last_name || '').toUpperCase()}, ${(u.first_name || '').toUpperCase()} ${u.middle_name ? u.middle_name.toUpperCase() : ''}`,
            (mappings[u.school_name || ''] || u.school_name || '').toUpperCase(),
            u.is_synced ? 'SYNCED' : 'PENDING'
          ];
          if (activeTab === 'details' || activeTab === 'archived') {
              row.push(u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A');
          }
          return row;
        });

        let headArray: any[] = [tableColumn];
        if (activeTab === 'scores') {
          if (selectedCategories.length === 1) {
            const currentCat = selectedCategories[0] || 'preboard';
            headArray = [
              [
                { content: 'SUBJECT', colSpan: 4, styles: { halign: 'center' } },
                { content: 'CLJ', colSpan: 2, styles: { halign: 'center' } },
                { content: 'LEA', colSpan: 2, styles: { halign: 'center' } },
                { content: 'CDI', colSpan: 2, styles: { halign: 'center' } },
                { content: 'FS', colSpan: 2, styles: { halign: 'center' } },
                { content: 'CRIMINOLOGY', colSpan: 2, styles: { halign: 'center' } },
                { content: 'COR AD', colSpan: 2, styles: { halign: 'center' } },
                { content: `${currentCat.toUpperCase()} RATING`, rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
              ],
              [
                { content: 'NO' }, { content: 'NAME' }, { content: 'SCHOOL' }, { content: 'ID NUMBER' },
                { content: '20%', colSpan: 2, styles: { halign: 'center' } },
                { content: '20%', colSpan: 2, styles: { halign: 'center' } },
                { content: '15%', colSpan: 2, styles: { halign: 'center' } },
                { content: '15%', colSpan: 2, styles: { halign: 'center' } },
                { content: '20%', colSpan: 2, styles: { halign: 'center' } },
                { content: '10%', colSpan: 2, styles: { halign: 'center' } }
              ],
              [
                { content: '' }, { content: '' }, { content: '' }, { content: '' },
                { content: '' }, { content: 'PERCENTAGE' },
                { content: '' }, { content: 'PERCENTAGE' },
                { content: '' }, { content: 'PERCENTAGE' },
                { content: '' }, { content: 'PERCENTAGE' },
                { content: '' }, { content: 'PERCENTAGE' },
                { content: '' }, { content: 'PERCENTAGE' },
                { content: '100%' }
              ]
            ];
            
            tableRows = usersToExport.map((u, i) => {
              const detailed = getCategoryDetailedScores(u, currentCat);

              const clj = calculateAreaContribution(detailed.clj.earnedScore, detailed.clj.possiblePoints, 'clj');
              const lea = calculateAreaContribution(detailed.lea.earnedScore, detailed.lea.possiblePoints, 'lea');
              const cdi = calculateAreaContribution(detailed.cdi.earnedScore, detailed.cdi.possiblePoints, 'cdi');
              const fs = calculateAreaContribution(detailed.fs.earnedScore, detailed.fs.possiblePoints, 'fs');
              const crim = calculateAreaContribution(detailed.crim.earnedScore, detailed.crim.possiblePoints, 'crim');
              const ca = calculateAreaContribution(detailed.ca.earnedScore, detailed.ca.possiblePoints, 'ca');

              const total = clj.weightedContribution + lea.weightedContribution + cdi.weightedContribution + fs.weightedContribution + crim.weightedContribution + ca.weightedContribution;

              const formatScore = (comp: any) => comp.earnedScore !== null ? `${comp.earnedScore}/${comp.possiblePoints}` : `___/${comp.possiblePoints}`;

              return [
                String(i + 1),
                `${(u.last_name || '').toUpperCase()}, ${(u.first_name || '').toUpperCase()} ${u.middle_name ? (u.middle_name).toUpperCase() : ''}`,
                (mappings[u.school_name || ''] || u.school_name || '').toUpperCase(),
                u.seq_id || '',
                formatScore(clj), `${clj.weightedContribution.toFixed(2)}%`,
                formatScore(lea), `${lea.weightedContribution.toFixed(2)}%`,
                formatScore(cdi), `${cdi.weightedContribution.toFixed(2)}%`,
                formatScore(fs), `${fs.weightedContribution.toFixed(2)}%`,
                formatScore(crim), `${crim.weightedContribution.toFixed(2)}%`,
                formatScore(ca), `${ca.weightedContribution.toFixed(2)}%`,
                `${total.toFixed(2)}%`
              ];
            });
          } else {
            const row1 = [
              { content: 'NO', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
              { content: 'NAME', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
              { content: 'SCHOOL', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
              { content: 'ID NUMBER', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
              { content: 'CLJ (20%)', colSpan: selectedCategories.length, styles: { halign: 'center' } },
              { content: 'LEA (20%)', colSpan: selectedCategories.length, styles: { halign: 'center' } },
              { content: 'CDI (15%)', colSpan: selectedCategories.length, styles: { halign: 'center' } },
              { content: 'FS (15%)', colSpan: selectedCategories.length, styles: { halign: 'center' } },
              { content: 'CRIM (20%)', colSpan: selectedCategories.length, styles: { halign: 'center' } },
              { content: 'CA (10%)', colSpan: selectedCategories.length, styles: { halign: 'center' } },
              { content: 'RATINGS & OVERALL GRADE', colSpan: selectedCategories.length + 1, styles: { halign: 'center' } }
            ];

            const row2: any[] = [];
            SUBJECT_KEYS.forEach(() => {
              selectedCategories.forEach(cat => {
                row2.push({ content: getCategoryShortName(cat), styles: { halign: 'center' } });
              });
            });
            selectedCategories.forEach(cat => {
              row2.push({ content: `${getCategoryShortName(cat)} Rating`, styles: { halign: 'center' } });
            });
            row2.push({ content: 'Overall Grade', styles: { halign: 'center' } });

            headArray = [row1, row2];

            tableRows = usersToExport.map((u, i) => {
              const row = [
                String(i + 1),
                `${(u.last_name || '').toUpperCase()}, ${(u.first_name || '').toUpperCase()} ${u.middle_name ? (u.middle_name).toUpperCase() : ''}`,
                (mappings[u.school_name || ''] || u.school_name || '').toUpperCase(),
                u.seq_id || ''
              ];

              SUBJECT_KEYS.forEach(subj => {
                selectedCategories.forEach(cat => {
                  const detailed = getResolvedDetailedScore(u, cat, subj);
                  const comp = calculateAreaContribution(detailed.earnedScore, detailed.possiblePoints, subj);
                  const scoreStr = comp.earnedScore !== null ? `${comp.earnedScore}/${comp.possiblePoints}` : `___/${comp.possiblePoints}`;
                  row.push(`${scoreStr} (${comp.weightedContribution.toFixed(2)}%)`);
                });
              });

              selectedCategories.forEach(cat => {
                const detailed = getCategoryDetailedScores(u, cat);
                const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                row.push(`${catRating.toFixed(2)}%`);
              });

              const overallGrade = selectedCategories.reduce((acc, cat) => {
                const detailed = getCategoryDetailedScores(u, cat);
                const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                const weight = gradeWeights[cat] ?? 0;
                return acc + (catRating * (weight / 100));
              }, 0);
              row.push(`${overallGrade.toFixed(2)}%`);

              return row;
            });
          }
        }

        autoTable(doc, {
          head: headArray,
          body: tableRows,
          startY: tableStartY,
          styles: { fontSize: activeTab === 'scores' ? 6 : 8 },
          headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
          columnStyles: activeTab === 'scores' ? {
            0: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' }, 5: { halign: 'center' },
            6: { halign: 'center' }, 7: { halign: 'center' },
            8: { halign: 'center' }, 9: { halign: 'center' },
            10: { halign: 'center' }, 11: { halign: 'center' },
            12: { halign: 'center' }, 13: { halign: 'center' },
            14: { halign: 'center' }, 15: { halign: 'center' },
            16: { halign: 'center' }
          } : {}
        });

        doc.save(activeTab === 'scores' ? 'evaluation_results.pdf' : (activeTab === 'archived' ? 'archived_reviewee_list.pdf' : 'reviewee_list.pdf'));
      };

      const img = new Image();
      img.src = '/logo.svg';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 96;
        canvas.height = img.height || 96;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            const dataUrl = canvas.toDataURL('image/png');
            addPdfContent(dataUrl);
          } catch (e) {
            addPdfContent(null);
          }
        } else {
          addPdfContent(null);
        }
      };
      img.onerror = () => {
        addPdfContent(null);
      };
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const isMultiCat = activeTab === 'scores' && selectedCategories.length >= 2;

      const getPrintRatingStyle = (val: number) => {
        if (val >= 60) return "color: #9333ea; font-weight: bold;";
        if (val >= 55) return "color: #2563eb; font-weight: bold;";
        if (val >= 50) return "color: #16a34a; font-weight: bold;";
        return "color: #dc2626; font-weight: bold;";
      };

      let tableHeaderHtml = '';
      if (activeTab === 'scores') {
        if (selectedCategories.length === 1) {
          tableHeaderHtml = `
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th style="text-align: left; font-size: 12px; padding: 6px 8px;">Name</th>
                <th>School</th>
                <th>CLJ</th><th>LEA</th><th>CDI</th><th>FS</th><th>CRIM</th><th>CA</th><th>Rating</th>
              </tr>
            </thead>
          `;
        } else {
          tableHeaderHtml = `
            <thead>
              <tr>
                <th rowspan="2" style="width: 35px; text-align: center;">#</th>
                <th rowspan="2" style="text-align: left; font-size: 12px; padding: 6px 8px;">Name</th>
                <th rowspan="2">School</th>
                <th colspan="${selectedCategories.length}">CLJ (20%)</th>
                <th colspan="${selectedCategories.length}">LEA (20%)</th>
                <th colspan="${selectedCategories.length}">CDI (15%)</th>
                <th colspan="${selectedCategories.length}">FS (15%)</th>
                <th colspan="${selectedCategories.length}">CRIM (20%)</th>
                <th colspan="${selectedCategories.length}">CA (10%)</th>
                <th colspan="${selectedCategories.length + 1}">RATINGS & OVERALL GRADE</th>
              </tr>
              <tr>
                ${SUBJECT_KEYS.map(() => selectedCategories.map(cat => `<th>${getCategoryShortName(cat)}</th>`).join('')).join('')}
                ${selectedCategories.map(cat => `<th>${getCategoryShortName(cat)} Rating</th>`).join('')}
                <th>Overall Grade</th>
              </tr>
            </thead>
          `;
        }
      } else {
        tableHeaderHtml = `
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th style="text-align: left; font-size: 12px; padding: 6px 8px;">Name</th>
              <th>School</th>
              <th>Status</th>
            </tr>
          </thead>
        `;
      }

      const tableBodyHtml = usersToExport.map((u, idx) => {
        const seqNum = idx + 1;
        const schoolName = (abbreviations[(mappings[u.school_name || ''] || u.school_name || '').toUpperCase()] || (mappings[u.school_name || ''] || u.school_name || '')).toUpperCase();
        const fullName = `${(u.last_name || '').toUpperCase()}, ${(u.first_name || '').toUpperCase()} ${u.middle_name ? (u.middle_name).toUpperCase() : ''}`;

        if (activeTab === 'scores') {
          if (selectedCategories.length === 1) {
            const currentCat = selectedCategories[0] || 'preboard';
            const detailed = getCategoryDetailedScores(u, currentCat);

            const clj = calculateAreaContribution(detailed.clj.earnedScore, detailed.clj.possiblePoints, 'clj');
            const lea = calculateAreaContribution(detailed.lea.earnedScore, detailed.lea.possiblePoints, 'lea');
            const cdi = calculateAreaContribution(detailed.cdi.earnedScore, detailed.cdi.possiblePoints, 'cdi');
            const fs = calculateAreaContribution(detailed.fs.earnedScore, detailed.fs.possiblePoints, 'fs');
            const crim = calculateAreaContribution(detailed.crim.earnedScore, detailed.crim.possiblePoints, 'crim');
            const ca = calculateAreaContribution(detailed.ca.earnedScore, detailed.ca.possiblePoints, 'ca');

            const rating = clj.weightedContribution + lea.weightedContribution + cdi.weightedContribution + fs.weightedContribution + crim.weightedContribution + ca.weightedContribution;
            const ratingStyle = getPrintRatingStyle(rating);

            const formatScoreCell = (comp: any) => comp.earnedScore !== null ? `${comp.earnedScore}/${comp.possiblePoints}<br/><small style="color: #0d9488; font-weight: bold;">${comp.weightedContribution.toFixed(2)}%</small>` : `___/${comp.possiblePoints}<br/><small style="color: #0d9488;">0.00%</small>`;

            return `
              <tr>
                <td style="text-align: center; vertical-align: middle; width: 35px;">${seqNum}</td>
                <td style="${ratingStyle} font-size: 12px; font-weight: bold; text-align: left; vertical-align: middle; padding: 6px 8px;">${fullName}</td>
                <td style="text-align: center; vertical-align: middle;">${schoolName}</td>
                <td style="text-align: center; vertical-align: middle;">${formatScoreCell(clj)}</td>
                <td style="text-align: center; vertical-align: middle;">${formatScoreCell(lea)}</td>
                <td style="text-align: center; vertical-align: middle;">${formatScoreCell(cdi)}</td>
                <td style="text-align: center; vertical-align: middle;">${formatScoreCell(fs)}</td>
                <td style="text-align: center; vertical-align: middle;">${formatScoreCell(crim)}</td>
                <td style="text-align: center; vertical-align: middle;">${formatScoreCell(ca)}</td>
                <td style="${ratingStyle} font-size: 11px; text-align: center; vertical-align: middle;">${rating.toFixed(2)}%</td>
              </tr>
            `;
          } else {
            const overallGrade = selectedCategories.reduce((acc, cat) => {
              const detailed = getCategoryDetailedScores(u, cat);
              const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
              const weight = gradeWeights[cat] ?? 0;
              return acc + (catRating * (weight / 100));
            }, 0);
            const overallStyle = getPrintRatingStyle(overallGrade);

            const cells = [
              `<td style="text-align: center; vertical-align: middle; width: 35px;">${seqNum}</td>`,
              `<td style="${overallStyle} font-size: 12px; font-weight: bold; text-align: left; vertical-align: middle; padding: 6px 8px;">${fullName}</td>`,
              `<td style="text-align: center; vertical-align: middle;">${schoolName}</td>`
            ];

            SUBJECT_KEYS.forEach(subj => {
              selectedCategories.forEach(cat => {
                const detailed = getResolvedDetailedScore(u, cat, subj);
                const comp = calculateAreaContribution(detailed.earnedScore, detailed.possiblePoints, subj);
                const scoreText = comp.earnedScore !== null ? `${comp.earnedScore}/${comp.possiblePoints}` : `___/${comp.possiblePoints}`;
                cells.push(`<td style="text-align: center; vertical-align: middle;">${scoreText}<br/><small style="color: #0d9488; font-weight: bold;">${comp.weightedContribution.toFixed(2)}%</small></td>`);
              });
            });

            selectedCategories.forEach(cat => {
              const detailed = getCategoryDetailedScores(u, cat);
              const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
              cells.push(`<td style="${getPrintRatingStyle(catRating)} font-size: 11px; text-align: center; vertical-align: middle;">${catRating.toFixed(2)}%</td>`);
            });

            cells.push(`<td style="${overallStyle} font-size: 11px; text-align: center; vertical-align: middle;">${overallGrade.toFixed(2)}%</td>`);

            return `<tr>${cells.join('')}</tr>`;
          }
        } else {
          return `
            <tr>
              <td style="text-align: center; vertical-align: middle; width: 35px;">${seqNum}</td>
              <td style="font-size: 12px; font-weight: bold; text-align: left; vertical-align: middle; padding: 6px 8px;">${fullName}</td>
              <td style="text-align: center; vertical-align: middle;">${schoolName}</td>
              <td style="text-align: center; vertical-align: middle;">${u.is_synced ? 'SYNCED' : 'PENDING'}</td>
            </tr>
          `;
        }
      }).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>${activeTab === 'scores' ? 'Evaluation Scores' : 'Reviewee List'}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid black; }
              th, td { border: 1px solid black; padding: 5px; font-size: 9px; }
              th { background-color: #f8fafc; border: 1px solid black; text-transform: uppercase; font-weight: bold; text-align: center; vertical-align: middle; }
              .header-center { text-align: center; margin-bottom: 15px; }
              .header-logo { width: 55px; height: 55px; margin: 0 auto 8px auto; display: block; }
              h1 { margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; }
              .exam-title { font-size: 11px; text-align: center; font-weight: bold; margin-bottom: 8px; }
              .count { font-size: 11px; color: #333; margin-bottom: 12px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header-center">
              <img src="${window.location.origin}/logo.svg" class="header-logo" alt="Logo" />
              <h1>SAMARITAN REVIEW CENTER</h1>
            </div>
            ${activeTab === 'scores' ? (() => {
              const datesSetPrint = new Set<string>();
              usersToExport.forEach(u => {
                selectedCategories.forEach(cat => {
                  SUBJECT_KEYS.forEach(subj => {
                    const d = getSubjectDetails(u, subj).date;
                    if (d && typeof d === 'string') {
                      const clean = d.split('T')[0];
                      if (clean && !isNaN(Date.parse(clean))) datesSetPrint.add(clean);
                    }
                  });
                });
              });
              const examDateFormattedPrint = formatExamDates(Array.from(datesSetPrint));
              return `<div class="exam-title">Result of ${selectedCategories.map(c => getCategoryShortName(c)).join(', ')} Examination held on ${examDateFormattedPrint}</div>`;
            })() : ''}
            <div class="count">Total Registered: ${usersToExport.length}</div>
            <table>
              ${tableHeaderHtml}
              <tbody>
                ${tableBodyHtml}
              </tbody>
            </table>
            <script>
              window.onload = () => {
                setTimeout(() => window.print(), 500); 
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const getSubjectDetails = (u: any, subject: string) => {
    let finalScore: number | null = null;
    let finalDate: string | null = null;

    selectedCategories.forEach(cat => {
      const catKey = cat.toLowerCase();
      let fieldPrefix = "score_";
      
      if (catKey === "diagnostic") fieldPrefix = "diag_";
      if (catKey === "preboard") fieldPrefix = "preboard_";
      if (catKey === "posttest") fieldPrefix = "post_";
      if (catKey === "finalcoaching") fieldPrefix = "final_";

      const fieldName = `${fieldPrefix}${subject}`;

      const val = u[fieldName] || u[`score_${subject}_${catKey}`] || (catKey === 'pretest' ? u[`score_${subject}`] : undefined);
      
      if (val !== undefined && val !== null && val !== '') {
        finalScore = (finalScore || 0) + Number(val);
        if (!finalDate) finalDate = u[`date_${subject}_${catKey}`] || null;
      }
    });

    if (!finalDate) {
      const dateKey = Object.keys(u).find(key => key.startsWith(`date_${subject}_`));
      if (dateKey) finalDate = u[dateKey];
    }

    return { score: finalScore, date: finalDate };
  };

  const handleOpenManualEditModal = (data: {
    reviewee: any;
    category: string;
    subject: string;
    currentScore: number | null;
  }) => {
    setEditingScoreData(data);
    setManualScoreInput(data.currentScore !== null ? String(data.currentScore) : '');
    setManualScoreReason('');
    setShowManualEditModal(true);
  };

  const handleSaveAreaScore = async () => {
    if (!firestoreDb || !editingScoreData || !currentUser) return;
    
    const newScore = Number(manualScoreInput);
    if (isNaN(newScore) || newScore < 0 || newScore > 100) {
      setToastMessage({ text: "Score must be a number between 0 and 100.", type: "error" });
      return;
    }

    const { reviewee, category, subject, currentScore } = editingScoreData;
    const isReplacing = currentScore !== null && currentScore !== undefined;
    const reason = manualScoreReason.trim();

    if (isReplacing && reason.length < 3) {
      setToastMessage({ text: "A reason (at least 3 characters) is required when replacing an existing score.", type: "error" });
      return;
    }

    setSavingManualScore(true);

    try {
      const scoreField = getScoreFieldName(category, subject);
      const documentId = reviewee.doc_id || reviewee.uid || reviewee.id;
      
      const userRef = doc(firestoreDb, "users", documentId);
      
      const currentUserName = `${currentUser.first_name || 'Admin'} ${currentUser.last_name || 'User'}`.trim();
      const revieweeName = `${reviewee.first_name || ''} ${reviewee.last_name || ''}`.trim() || "Reviewee";

      // Prepare latestScores object to keep compatibility
      const existingLatestScores = reviewee.latestScores || {};
      const updatedLatestScores = {
        ...existingLatestScores,
        [scoreField]: newScore,
        [`${category.toLowerCase()}_${subject.toLowerCase()}`]: newScore
      };

      const existingManualFlags = reviewee.manualScores || {};
      const updatedManualFlags = {
        ...existingManualFlags,
        [scoreField]: true,
        [`${category.toLowerCase()}_${subject.toLowerCase()}`]: true
      };

      const updatePayload: any = {
        [scoreField]: newScore,
        last_score_update: serverTimestamp(),
        lastScoreEditedByUid: currentUser.uid,
        lastScoreEditedByName: currentUserName,
        lastScoreEditReason: reason || "Added missing score",
        latestScores: updatedLatestScores,
        manualScores: updatedManualFlags,
        updated_at: new Date().toISOString()
      };

      await updateDoc(userRef, updatePayload);

      // Create an audit record in score_edit_audit
      const auditRef = doc(collection(firestoreDb, "score_edit_audit"));
      await setDoc(auditRef, {
        revieweeId: documentId,
        revieweeName,
        category: category.toLowerCase(),
        subject: subject.toLowerCase(),
        previousScore: isReplacing ? currentScore : null,
        newScore,
        editedAt: serverTimestamp(),
        editedByUid: currentUser.uid,
        editedByName: currentUserName,
        reason: reason || "Added missing score"
      });

      // Also log inside activity_logs
      const logRef = doc(collection(firestoreDb, "activity_logs"));
      await setDoc(logRef, {
        user_id: documentId,
        user_name: revieweeName,
        action: 'SCORE_MANUAL_EDIT',
        details: `Manually updated ${subject.toUpperCase()} ${category}: ${isReplacing ? currentScore : 'None'} -> ${newScore}. Reason: ${reason || "Added missing score"}`,
        performed_by: currentUser.email || currentUserName,
        timestamp: serverTimestamp(),
        created_at: new Date().toISOString()
      });

      setToastMessage({ text: `Successfully updated score to ${newScore} for ${revieweeName}.`, type: "success" });
      
      // Close modal and reset states
      setShowManualEditModal(false);
      setEditingScoreData(null);
      setManualScoreInput('');
      setManualScoreReason('');
      
      // Refresh user lists in real-time
      fetchAllUsers();
    } catch (err: any) {
      console.error("Error saving manual score:", err);
      setToastMessage({ text: err.message || "Failed to save score.", type: "error" });
    } finally {
      setSavingManualScore(false);
    }
  };

  const renderScoreCell = (u: any, subject: string, categoryOverride?: string) => {
    if (!u) return null;
    const targetCategory = categoryOverride || selectedCategories[0] || 'preboard';
    const isAreaActivated = isScoreAreaActivated({
      category: targetCategory,
      subject,
      activatedAreas,
      importHistory,
      reviewees: allUsers
    });
    
    const canEdit = hasScoreEditPermission(currentUser);
    
    return (
      <CompactEditableScoreCell
        reviewee={u}
        category={targetCategory}
        subject={subject as any}
        isAreaActivated={isAreaActivated}
        canEditScores={canEdit}
        onEdit={handleOpenManualEditModal}
      />
    );
  };

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const { db } = await initFirebaseClient();
      if (!db) {
        throw new Error("Client Firestore DB is not initialized.");
      }

      const q = collection(db, "users");
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(d => ({
        doc_id: d.id,
        ...d.data()
      }));
      
      const parsedUsers = (Array.isArray(data) ? data : []).map((u: any) => ({ 
        ...u, 
        is_archived: !!u.is_archived,
        is_excluded: !!u.is_excluded
      }));
      setAllUsers(parsedUsers);
      
      const excludedIds = new Set<string>();
      parsedUsers.forEach((u: any) => {
        if (u.is_excluded) {
          excludedIds.add(String(u.doc_id || u.seq_id));
        }
      });
      setExcludedUserIds(excludedIds);
    } catch(e) {
      console.error(e);
      setAllUsers([]);
      setExcludedUserIds(new Set());
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSyncSingleUser = async (user: any) => {
    const taskId = `sync-${user.doc_id}-${Date.now()}`;
    const newTask = {
      id: taskId,
      name: `Syncing: ${user.first_name} ${user.last_name}`,
      progress: 10,
      status: 'working',
      message: 'Connecting to server...',
      startTime: new Date(),
      userId: user.doc_id // Keep track of which user this task is for
    };
    
    setBackgroundTasks(prev => [...prev, newTask]);
    setSyncingUserId(user.doc_id);
    
    const updateTask = (updates: any) => {
      setBackgroundTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    try {
      updateTask({ progress: 40, message: 'Syncing with Google Sheets...' });
      const res = await fetch('/api/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: user.doc_id })
      });
      
      if (!res.ok) {
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch (pE) {}
        throw new Error(errorData.error || 'Sync failed');
      }
      
      updateTask({ progress: 100, status: 'completed', message: 'Sync successful' });
      // Update local state instead of full refetch for snappiness
      setAllUsers(prev => prev.map(u => u.doc_id === user.doc_id ? { ...u, is_synced: true } : u));
      
      // Auto-remove completed single sync task after a delay
      setTimeout(() => {
        setBackgroundTasks(prev => prev.filter(t => t.id !== taskId));
      }, 3000);

    } catch(e: any) {
      console.error(e);
      updateTask({ progress: 100, status: 'failed', message: e.message || 'Sync failed' });
      setToastMessage({ text: `Failed to sync user: ${e.message}`, type: 'error' });
    } finally {
      setSyncingUserId(null);
    }
  };

  const handleToggleExclusionSingle = async (userId: string, isExcluded: boolean) => {
    try {
      const res = await fetch('/api/batch-toggle-exclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId], is_excluded: isExcluded })
      });
      if (!res.ok) throw new Error('Failed to toggle exclusion');
      setExcludedUserIds(prev => {
        const next = new Set(prev);
        if (isExcluded) next.add(userId);
        else next.delete(userId);
        return next;
      });
    } catch(e) {
      console.error(e);
      setToastMessage({ text: 'Failed to save selection', type: 'error' });
    }
  };

  const handleToggleExclusionBatch = async (userIds: string[], isExcluded: boolean) => {
    try {
      const res = await fetch('/api/batch-toggle-exclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, is_excluded: isExcluded })
      });
      if (!res.ok) throw new Error('Failed to batch toggle exclusion');
      setExcludedUserIds(prev => {
        const next = new Set(prev);
        userIds.forEach(id => {
          if (isExcluded) next.add(id);
          else next.delete(id);
        });
        return next;
      });
    } catch(e) {
      console.error(e);
      setToastMessage({ text: 'Failed to save selections', type: 'error' });
    }
  };

  const handleToggleArchiveUser = (user: any) => {
    triggerHaptic();
    if (user.is_archived || user.archived || user.archiveStatus === 'passed') {
      setUnarchiveConfirmUser(user);
    } else {
      confirmToggleArchiveUser(user, true);
    }
  };

  const confirmToggleArchiveUser = async (user: any, isArchived: boolean) => {
    try {
      const res = await fetch('/api/toggle-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          doc_id: user.doc_id, 
          is_archived: isArchived,
          adminName: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : "System",
          adminRole: (currentUser as any)?.role || "admin",
          adminUid: currentUser?.uid || "",
          adminEmail: currentUser?.email || "",
        })
      });
      if (res.ok) {
        await fetchAllUsers();
        setToastMessage({ text: isArchived ? "Reviewee moved to Archive." : "Reviewee restored from Archive.", type: "success" });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update archive status');
      }
    } catch(e: any) {
      console.error(e);
      setToastMessage({ text: `Error: ${e.message || 'Unknown error'}`, type: 'error' });
    }
  };

  const confirmUnarchiveReviewee = async () => {
    if (!unarchiveConfirmUser) return;
    await confirmToggleArchiveUser(unarchiveConfirmUser, false);
    setUnarchiveConfirmUser(null);
  };

  const handleUpdateUserDetails = async (user: any) => {
    if ((isStaff(currentUser) || getUserRole(currentUser) === 'Staff') && (user.role === 'Admin' || user.role === 'Staff' || isAdmin(user))) {
      alert("Staff users are not authorized to edit Admin or Staff accounts.");
      return;
    }
    if (!editFirstName.trim() || !editLastName.trim() || !editSchoolName.trim() || !editSeqId.trim()) {
      alert("First Name, Last Name, School Name, and ID Number are required.");
      return;
    }
    setUpdatingUser(true);
    try {
      const res = await fetch("/api/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: user.doc_id,
          first_name: editFirstName,
          firstName: editFirstName,
          middle_name: editMiddleName,
          middleName: editMiddleName,
          last_name: editLastName,
          lastName: editLastName,
          school_name: editSchoolName,
          schoolName: editSchoolName,
          seq_id: editSeqId,
          seqId: editSeqId,
          id_number: editSeqId,
          idNumber: editSeqId,
          srcId: editSeqId,
          score_clj: editScoreCLJ,
          score_lea: editScoreLEA,
          score_fs: editScoreFS,
          score_cdi: editScoreCDI,
          score_crim: editScoreCRIM,
          score_ca: editScoreCA,
          role: editRole,
          adminName: currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name}` : "Admin",
          adminRole: currentUser?.role || "admin"
        })
      });
      if (!res.ok) {
        let errData: any = {};
        try {
          errData = await res.json();
        } catch(e) {}
        throw new Error(errData.error || "Failed to update user details");
      }
      
      // Successfully updated!
      await fetchAllUsers();
      
      setEditingUserId(null);
    } catch (e: any) {
      console.error(e);
      alert(`Failed to update user: ${e.message || "Unknown error"}`);
    } finally {
      setUpdatingUser(false);
    }
  };

  const getRevieweeKey = (u: any) =>
    String(u?.doc_id || u?.seq_id || u?.id || "");

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(35);
      }
    } catch {}
  };

  const handlePassReviewee = (u: any) => {
    triggerHaptic();
    setPassConfirmUser(u);
  };

  const confirmPassReviewee = async () => {
    if (!passConfirmUser) return;

    const userId = getRevieweeKey(passConfirmUser);

    if (!userId) {
      setToastMessage({
        text: "Pass failed: missing reviewee ID.",
        type: "error",
      });
      return;
    }

    setIsPassingReviewee(true);
    setSyncingUserId(userId);

    try {
      const res = await fetch("/api/toggle-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: passConfirmUser.doc_id,
          is_archived: true,
          passed: true,
          archiveStatus: "passed",
          adminName: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : "System",
          adminRole: (currentUser as any)?.role || "admin",
          adminUid: currentUser?.uid || "",
          adminEmail: currentUser?.email || "",
        }),
      });

      if (!res.ok) {
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch {}
        throw new Error(errorData.error || "Failed to move reviewee to archive");
      }

      const archivedUser = {
        ...passConfirmUser,
        is_archived: true,
        archived: true,
        passed: true,
        archiveStatus: "passed",
        passedAt: new Date().toISOString(),
        archivedAt: new Date().toISOString(),
      };

      setAllUsers((prev) =>
        prev.map((u) =>
          getRevieweeKey(u) === userId ? archivedUser : u
        )
      );

      setPassConfirmUser(null);

      const revieweeName =
        `${passConfirmUser?.last_name || ""}, ${passConfirmUser?.first_name || ""}`.trim() ||
        "Reviewee";

      setToastMessage({
        text: `${revieweeName} moved to Archived.`,
        type: "success",
      });
    } catch (err: any) {
      console.error("Failed to pass/archive reviewee:", err);
      setToastMessage({
        text: `Failed to archive: ${err.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsPassingReviewee(false);
      setSyncingUserId(null);
    }
  };

  const handleOpenManualScoreModal = (u: any) => {
    if ((isStaff(currentUser) || getUserRole(currentUser) === 'Staff') && (isAdmin(u) || u.role === 'Admin' || u.role === 'Staff')) {
      alert("Staff users can only edit Reviewee accounts.");
      return;
    }
    triggerHaptic();
    setManualScoreUser(u);
    setManualScoreValue('');
    setManualScoreRemarks('');
    // Default to first selected category if available, else empty
    setManualScoreCategory(selectedCategories[0] || '');
    setManualScoreDate(new Date().toISOString().slice(0, 10));
  };

  const handleSaveManualScore = async () => {
    if (!manualScoreUser) return;
    if (!manualScoreCategory || !manualScoreDate || manualScoreValue === '') {
      setToastMessage({ text: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    setIsSavingManualScore(true);
    try {
      const res = await fetch("/api/manual-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: manualScoreUser.doc_id,
          category: manualScoreCategory,
          evaluation_date: manualScoreDate,
          score: manualScoreValue,
          remarks: manualScoreRemarks,
          adminUid: currentUser?.uid || '',
          adminName: currentUser?.displayName || currentUser?.name || currentUser?.email || 'Admin',
          adminEmail: currentUser?.email || '',
          adminRole: (currentUser as any)?.role || 'admin',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save manual score");
      }

      await fetchAllUsers();
      setManualScoreUser(null);
      setToastMessage({
        type: "success",
        text: "Manual score saved and activity log recorded.",
      });
    } catch (err: any) {
      console.error("Failed to save manual score:", err);
      setToastMessage({
        text: `Error: ${err.message || "Unknown error"}`,
        type: "error",
      });
    } finally {
      setIsSavingManualScore(false);
    }
  };

  const getRowActionLabel = (u: any) => {
    if (activeTab === "scores") {
      return syncingUserId === u.doc_id ? "PASSING" : "PASS";
    }

    if (activeTab === "archived" || u.is_archived) {
      return "UNARCHIVE";
    }

    return syncingUserId === u.doc_id ? "SYNCING" : "SYNC";
  };

  const handleRowActionClick = async (u: any) => {
    triggerHaptic();
    if (activeTab === "scores") {
      return handlePassReviewee(u);
    }

    if (activeTab === "archived" || u.is_archived) {
      return handleToggleArchiveUser(u);
    }

    return handleSyncSingleUser(u);
  };

  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  const [searchOfficial, setSearchOfficial] = useState('');
  const [searchNewOfficial, setSearchNewOfficial] = useState('');
  const [searchAlias, setSearchAlias] = useState('');
  const [mappingSuccess, setMappingSuccess] = useState(false);
  
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupResult, setDedupResult] = useState<{
    success: boolean;
    deletedCount: number;
    reassignedCount: number;
    remainingCount: number;
    message: string;
  } | null>(null);

  const [showDuplicatesInfo, setShowDuplicatesInfo] = useState(false);
  const [duplicateIds, setDuplicateIds] = useState<any[][]>([]);
  const [similarNames, setSimilarNames] = useState<any[][]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [selectionsToKeep, setSelectionsToKeep] = useState<Record<string, string[]>>({});
  const [resolvingDuplicates, setResolvingDuplicates] = useState(false);
  const [resolveMessage, setResolveMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const [standardizationPreview, setStandardizationPreview] = useState<any[] | null>(null);
  const [loadingStandardization, setLoadingStandardization] = useState(false);
  const [standardizationMsg, setStandardizationMsg] = useState<string | null>(null);

  const handlePreviewStandardization = async () => {
    setLoadingStandardization(true);
    setStandardizationMsg(null);
    try {
      const res = await fetch('/api/preview-name-standardization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminName: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : "Admin",
          adminRole: currentUser?.role || "admin"
        })
      });
      const data = await res.json();
      if (data.proposedUpdates) {
        setStandardizationPreview(data.proposedUpdates);
        if (data.proposedUpdates.length === 0) {
          setStandardizationMsg("All records currently have properly separated First Name and Last Name fields!");
        }
      } else {
        setStandardizationMsg(`Error: ${data.error || 'Failed to analyze name fields'}`);
      }
    } catch (err: any) {
      console.error("Standardization preview error:", err);
      setStandardizationMsg(`Error: ${err.message || 'Failed to analyze name fields'}`);
    } finally {
      setLoadingStandardization(false);
    }
  };

  const handleCommitStandardization = async () => {
    if (!standardizationPreview || standardizationPreview.length === 0) return;
    setLoadingStandardization(true);
    setStandardizationMsg(null);
    try {
      const updates = standardizationPreview.map(item => ({
        doc_id: item.doc_id,
        first_name: item.proposedFields.first_name,
        middle_name: item.proposedFields.middle_name,
        last_name: item.proposedFields.last_name
      }));
      const res = await fetch('/api/commit-name-standardization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates,
          adminName: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : "Admin",
          adminRole: currentUser?.role || "admin"
        })
      });
      const data = await res.json();
      if (data.success) {
        setStandardizationMsg(data.message);
        setStandardizationPreview(null);
        fetchAllUsers();
        fetchDuplicates();
      } else {
        setStandardizationMsg(`Error: ${data.error || 'Failed to commit changes'}`);
      }
    } catch (err: any) {
      console.error("Commit standardization error:", err);
      setStandardizationMsg(`Error: ${err.message || 'Failed to commit changes'}`);
    } finally {
      setLoadingStandardization(false);
    }
  };

  const [manualSyncTargets, setManualSyncTargets] = useState<Record<number, string>>({});
  const [isManualSyncing, setIsManualSyncing] = useState<Record<number, boolean>>({});

  const handleManualSync = async (entryIdx: number, entry: any) => {
    const targetUserId = manualSyncTargets[entryIdx];
    if (!targetUserId) {
        setToastMessage({ text: 'Please select a user to sync to.', type: 'error' });
        return;
    }
    
    if (!entry.updateData) {
        setToastMessage({ text: 'Missing score details for this entry. Could not manually sync.', type: 'error' });
        return;
    }

    setIsManualSyncing(prev => ({ ...prev, [entryIdx]: true }));
    try {
        const res = await fetch('/api/batch-update-scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              updates: [{ doc_id: targetUserId, data: entry.updateData }],
              adminName: currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name}` : "Admin",
              adminRole: currentUser?.role || "admin"
            })
        });
        
        if (!res.ok) throw new Error('Failed to update manually');
        
        // Remove mapped entry and missing user from importReport
        setImportReport(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                unmatchedEntries: prev.unmatchedEntries.filter((_, i) => i !== entryIdx),
                missingUsers: prev.missingUsers.filter(u => u.doc_id !== targetUserId)
            };
        });
        setToastMessage({ text: 'Successfully synced score!', type: 'success' });
        await fetchAllUsers(); // Refresh scores list
    } catch (e) {
        console.error(e);
        setToastMessage({ text: 'Error syncing this score manually.', type: 'error' });
    } finally {
        setIsManualSyncing(prev => ({ ...prev, [entryIdx]: false }));
    }
  };

  const fetchDuplicates = async () => {
    setCheckingDuplicates(true);
    setSelectionsToKeep({});
    setResolveMessage(null);
    setConfirmResolve(false);
    try {
      const response = await fetch('/api/find-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser?.seqId || "Admin",
          adminName: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : "Admin",
          adminRole: currentUser?.role || "",
          password: "",
          year: ""
        })
      });
      const data = await response.json();
      const dupIds = data.duplicateIds || [];
      const simNames = data.similarNames || [];
      
      setDuplicateIds(dupIds);
      setSimilarNames(simNames);

      // Role weight helper (Admin = 3, Staff = 2, Reviewee = 1)
      const getRoleWeight = (record: any): number => {
        const r = String(record?.role || record?.userRole || record?.accountType || '').toLowerCase().replace(/[\s\-_]/g, '');
        if (r === 'admin' || r === 'superadmin' || r === 'owner') return 3;
        if (r === 'staff' || r === 'coadmin' || r === 'instructor' || r === 'encoder') return 2;
        return 1;
      };

      const initialKeeps: Record<string, string[]> = {};

      dupIds.forEach((group: any[], idx: number) => {
        if (group.length > 0) {
          const sorted = [...group].sort((a, b) => {
            const rwA = getRoleWeight(a);
            const rwB = getRoleWeight(b);
            if (rwB !== rwA) return rwB - rwA;
            const scoresA = Array.isArray(a.scores) ? a.scores.length : 0;
            const scoresB = Array.isArray(b.scores) ? b.scores.length : 0;
            if (scoresB !== scoresA) return scoresB - scoresA;
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          });
          initialKeeps[`id_${idx}`] = [sorted[0].doc_id];
        }
      });

      simNames.forEach((group: any[], idx: number) => {
        if (group.length > 0) {
          const sorted = [...group].sort((a, b) => {
            const rwA = getRoleWeight(a);
            const rwB = getRoleWeight(b);
            if (rwB !== rwA) return rwB - rwA;
            const scoresA = Array.isArray(a.scores) ? a.scores.length : 0;
            const scoresB = Array.isArray(b.scores) ? b.scores.length : 0;
            if (scoresB !== scoresA) return scoresB - scoresA;
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          });
          initialKeeps[`name_${idx}`] = [sorted[0].doc_id];
        }
      });

      setSelectionsToKeep(initialKeeps);
      setShowDuplicatesInfo(true);
    } catch (e) {
      console.error(e);
      setResolveMessage({ type: 'error', text: 'Failed to check duplicates' });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const [confirmResolve, setConfirmResolve] = useState(false);

  const handleResolveDuplicates = async () => {
    setResolvingDuplicates(true);
    setResolveMessage(null);
    try {
      const resolutions: { keepDocId: string; mergeFromDocIds: string[] }[] = [];
      const recordsToDelete: string[] = [];

      // Process ID duplicates
      duplicateIds.forEach((group, idx) => {
        const keepIds = selectionsToKeep[`id_${idx}`] || [];
        if (keepIds.length > 0) {
          const keepDocId = keepIds[0];
          const mergeFromDocIds: string[] = [];
          group.forEach(r => {
            if (r.doc_id !== keepDocId) {
              if (!recordsToDelete.includes(r.doc_id)) recordsToDelete.push(r.doc_id);
              mergeFromDocIds.push(r.doc_id);
            }
          });
          if (mergeFromDocIds.length > 0) {
            resolutions.push({ keepDocId, mergeFromDocIds });
          }
        }
      });

      // Process Name duplicates
      similarNames.forEach((group, idx) => {
        const keepIds = selectionsToKeep[`name_${idx}`] || [];
        if (keepIds.length > 0) {
          const keepDocId = keepIds[0];
          const mergeFromDocIds: string[] = [];
          group.forEach(r => {
            if (r.doc_id !== keepDocId) {
              if (!recordsToDelete.includes(r.doc_id)) recordsToDelete.push(r.doc_id);
              mergeFromDocIds.push(r.doc_id);
            }
          });
          if (mergeFromDocIds.length > 0) {
            resolutions.push({ keepDocId, mergeFromDocIds });
          }
        }
      });

      if (recordsToDelete.length === 0) {
        setResolveMessage({ type: 'error', text: 'Please select at least one record to keep in any group before proceeding.' });
        setResolvingDuplicates(false);
        return;
      }

      if (!confirmResolve) {
        setConfirmResolve(true);
        setResolvingDuplicates(false);
        return;
      }

      const response = await fetch('/api/resolve-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser?.seqId || "Admin",
          adminName: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : "Admin",
          adminRole: currentUser?.role || "",
          password: "",
          recordsToDelete,
          resolutions
        })
      });

      if (!response.ok) throw new Error("Failed to delete duplicates");

      setResolveMessage({ type: 'success', text: `Successfully resolved duplicates and merged scores.` });
      await fetchDuplicates(); // Refresh
    } catch (e) {
      console.error(e);
      setResolveMessage({ type: 'error', text: 'Error resolving duplicates' });
    } finally {
      setResolvingDuplicates(false);
    }
  };

  const [repairingUsers, setRepairingUsers] = useState(false);
  const [repairResult, setRepairResult] = useState<any>(null);

  const [restoringScores, setRestoringScores] = useState(false);
  const [restoreScoresResult, setRestoreScoresResult] = useState<any>(null);

  const handleRestoreMergedScores = async () => {
    if (restoringScores) return;
    setRestoringScores(true);
    setRestoreScoresResult(null);
    try {
      const response = await fetch('/api/restore-merged-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser?.seqId || "Admin",
          adminName: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : "Admin",
          adminRole: currentUser?.role || ""
        })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setRestoreScoresResult(data);
      fetchAllUsers();
    } catch (e: any) {
      setRestoreScoresResult({ error: e.message });
    } finally {
      setRestoringScores(false);
    }
  };

  const handleRepairUsers = async () => {
    if (repairingUsers) return;
    setRepairingUsers(true);
    setRepairResult(null);
    try {
      const response = await fetch('/api/repair-missing-user-profiles', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setRepairResult(data);
      fetchAllUsers();
    } catch (e: any) {
      setRepairResult({ error: e.message });
    } finally {
      setRepairingUsers(false);
    }
  };

  const handleFixAllDuplicates = async () => {
    if (dedupLoading) return;
    setDedupLoading(true);
    setDedupResult(null);

    try {
      const response = await fetch('/api/fix-all-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser?.seqId || "Admin",
          adminName: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : "Admin",
          adminRole: currentUser?.role || "",
          password: ""
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resolve duplicates');
      }

      setDedupResult({
        success: true,
        deletedCount: data.deletedCount || 0,
        reassignedCount: data.reassignedCount || 0,
        remainingCount: data.remainingCount || 0,
        message: data.message || 'Deduplication completed successfully'
      });
    } catch (err: any) {
      console.error("Deduplication error:", err);
      alert(err.message || "Failed to resolve duplicates");
    } finally {
      setDedupLoading(false);
    }
  };
  
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    return localStorage.getItem('autoSyncEnabled') === 'true';
  });
  const [autoSyncInterval, setAutoSyncInterval] = useState(() => {
    return parseInt(localStorage.getItem('autoSyncInterval') || '5', 10);
  });

  useEffect(() => {
    localStorage.setItem('autoSyncEnabled', String(autoSyncEnabled));
  }, [autoSyncEnabled]);

  useEffect(() => {
    localStorage.setItem('autoSyncInterval', String(autoSyncInterval));
  }, [autoSyncInterval]);

  useEffect(() => {
    let intervalId: any;
    if (autoSyncEnabled && !loading) {
      intervalId = setInterval(() => {
         onSync({ year, schools: selectedSchools.length > 0 ? selectedSchools : undefined, isAutoSync: true });
      }, autoSyncInterval * 60 * 1000);
    }
    return () => clearInterval(intervalId);
  }, [autoSyncEnabled, autoSyncInterval, year, selectedSchools, loading, onSync]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (showUsersList) setShowUsersList(false);
        else if (showDuplicates) setShowDuplicates(false);
        else if (showMapping) setShowMapping(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showUsersList, showDuplicates, showMapping, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchAllUsers();
      Promise.all([
        fetch('/api/schools').then(r => r.json()).catch(() => ({ schools: [] })),
        fetch('/api/school-mappings').then(r => r.json()).catch(() => ({ mappings: {}, officialNames: [] })),
        fetch('/api/sync-status').then(r => r.json()).catch(() => ({ lastSyncDate: '' }))
      ]).then(([schoolsData, mappingsData, syncStatusData]) => {
        const safeMappings = mappingsData?.mappings || {};
        const offNames = Array.isArray(mappingsData?.officialNames) ? mappingsData.officialNames : [];
        const safeSchools = Array.isArray(schoolsData?.schools) ? schoolsData.schools : [];
        
        setMappings(safeMappings);
        setAbbreviations(mappingsData?.abbreviations || {});
        setOfficialNames(offNames);
        setAllSchools(Array.from(new Set([...safeSchools, ...offNames])));
        if (syncStatusData?.lastSyncDate) {
          setLastSyncDate(syncStatusData.lastSyncDate);
        }
        if (syncStatusData.lastSyncDateFrom) {
          setDateFrom(syncStatusData.lastSyncDateFrom);
          localStorage.setItem('lastManualSyncFrom', syncStatusData.lastSyncDateFrom);
        }
        if (syncStatusData.lastSyncDateTo) {
          setDateTo(syncStatusData.lastSyncDateTo);
          localStorage.setItem('lastManualSyncTo', syncStatusData.lastSyncDateTo);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  const addAlias = (alias: string) => {
    if (alias && !aliases.includes(alias)) {
      setAliases([...aliases, alias]);
      setNewAlias('');
      setShowAliasSuggestions(false);
    }
  };

  const removeAlias = (alias: string) => {
    setAliases(aliases.filter(a => a !== alias));
  };

  const saveMapping = async () => {
    if (!officialName) return;
    
    const upperOfficial = officialName.trim().toUpperCase();
    const newMappings = { ...mappings };
    const newAbbreviations = { ...abbreviations };
    newAbbreviations[upperOfficial] = officialAbbr.trim().toUpperCase();
    aliases.forEach(alias => {
        newMappings[alias.trim().toUpperCase()] = upperOfficial;
    });

    const updatedOfficial = Array.from(new Set([
      ...officialNames.map(o => o.trim().toUpperCase()), 
      upperOfficial
    ]));

    await fetch('/api/school-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings: newMappings, officialNames: updatedOfficial, abbreviations: newAbbreviations })
    });
    setMappings(newMappings);
    setAbbreviations(newAbbreviations);
    setOfficialNames(updatedOfficial);
    setAliases([]);
    setNewAlias('');
    setOfficialName('');
    setOfficialAbbr('');
    setSearchOfficial('');
    setSearchNewOfficial('');
    setSearchAlias('');
    setMappingSuccess(true);
    setTimeout(() => {
      setMappingSuccess(false);
    }, 3000);
  };

  return (
    <>
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <AnimatePresence>
        {isDeletingScores && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center print-hidden"
          >
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-500 animate-gradient-x" />
              
              <div className="w-16 h-16 mx-auto mb-6 bg-red-50 rounded-2xl flex items-center justify-center relative">
                <div className="absolute inset-0 bg-red-100 rounded-2xl animate-ping opacity-20"></div>
                <Trash2 className="w-8 h-8 text-red-500 animate-pulse relative z-10" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 mb-2">Deleting Scores</h3>
              <p className="text-slate-500 text-sm mb-6">
                Please wait while scores are being permanently removed. This action cannot be undone...
              </p>

              <div className="flex items-center justify-center gap-2 text-red-600 font-medium text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing deletion...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProgress && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-6 right-6 z-[100000] bg-slate-900 border-l-[3px] border-emerald-500 p-5 w-80 text-white shadow-2xl rounded-none"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider">Upload Progress</h3>

              {(progressPercent === 100 || progressStatus.toLowerCase().includes("failed")) && (
                <button
                  onClick={() => setShowProgress(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="w-full bg-slate-800 h-1.5 mb-3 overflow-hidden">
              <motion.div
                className="bg-emerald-500 h-1.5"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              ></motion.div>
            </div>

            <p className="text-xs mb-3 font-medium text-slate-300">{progressStatus}</p>

            <div className="text-[11px] space-y-1.5 text-slate-400 bg-slate-800/50 p-3 border border-slate-700/50">
              <div className="flex justify-between"><span>Uploaded:</span> <span className="font-medium text-white">{uploadedRecords}</span></div>
              <div className="flex justify-between"><span>Updated:</span> <span className="font-medium text-white">{updatedRecords}</span></div>
              <div className="flex justify-between"><span>Failed:</span> <span className="font-medium text-rose-400">{failedRecords}</span></div>
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
                <span className="font-semibold text-emerald-400">Status:</span> 
                <span className="font-semibold text-emerald-400">Ready</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    <AnimatePresence>
      {isOpen && (
        <div
          className={embeddedMode ? "w-full text-slate-900 font-sans" : "!fixed !inset-0 w-full h-full z-[9999] bg-[#F8FAFC] text-slate-900 overflow-hidden flex font-sans"}
        >
          {/* SIDEBAR - DESKTOP */}
          {!embeddedMode && (
          <aside className="hidden lg:flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white sticky top-0 z-30">
            {/* Brand Area */}
            <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-100">
              <div className="h-10 w-10 overflow-hidden rounded-full shadow-md ring-4 ring-emerald-50/50 flex-shrink-0">
                <img src="/logo.svg" className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0">
                <h1 className="text-[12px] font-black uppercase tracking-tight text-slate-900 leading-none">
                  Samaritan Review
                </h1>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 leading-none">
                  Score Management System
                </p>
              </div>
            </div>

            {/* Profile Card */}
            <div className="mt-4">
              <div className="mx-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-[#020617] flex items-center justify-center font-black text-[13px] text-white ring-2 ring-white shadow-sm">
                    {currentUser?.first_name?.[0]}{currentUser?.last_name?.[0]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black uppercase text-slate-900 leading-tight">
                      {`${currentUser?.first_name || 'Admin'} ${currentUser?.last_name || 'User'}`}
                    </p>
                    <p className="truncate text-[11px] font-bold text-slate-400 mt-0.5">
                      {currentUser?.seqId || "SRC-MEMBER"}
                    </p>
                  </div>

                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Switch Portal Section */}
            <div className="px-4 pt-4 border-b border-slate-100 pb-4">
              <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 leading-none">
                Switch Portal
              </p>

              <button className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-slate-700 bg-slate-50 border border-slate-200/50 hover:bg-slate-100 transition-colors cursor-pointer">
                <span className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-[#2563EB]" />
                  {isAdmin(currentUser) ? "Admin" : "Staff"} Portal
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Scrollable Menu Area */}
            <div className="mt-4 flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
              <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
                Menu
              </p>
              <nav className="space-y-1">
                {[
                  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                  { key: "reviewees", label: "Reviewees", icon: Users },
                  { key: "score-management", label: "Score Management", icon: BarChart3 },
                  { key: "upload-scores", label: "Import Scores", icon: UploadCloud },
                  { key: "archives", label: "Archives", icon: Archive },
                  { key: "analytics", label: "Analytics", icon: LineChart },
                  ...(isAdmin(currentUser) ? [
                    { key: "activity-log", label: "Activity Log", icon: ShieldCheck },
                    { key: "role-management", label: "Role Management", icon: Shield }
                  ] : []),
                  { key: "settings", label: "Settings", icon: Settings }
                ].map((item) => {
                  let isCurrentActive = false;
                  if (item.key === 'dashboard') {
                    isCurrentActive = false;
                  } else if (item.key === 'reviewees') {
                    isCurrentActive = showUsersList && activeTab === 'details';
                  } else if (item.key === 'score-management') {
                    isCurrentActive = showUsersList && activeTab === 'scores';
                  } else if (item.key === 'upload-scores') {
                    isCurrentActive = showUsersList && activeTab === 'import_scores';
                  } else if (item.key === 'archives') {
                    isCurrentActive = showUsersList && activeTab === 'archived';
                  } else if (item.key === 'leaderboard') {
                    isCurrentActive = showUsersList && activeTab === 'leaderboard';
                  } else if (item.key === 'activity-log') {
                    isCurrentActive = showUsersList && activeTab === 'activity';
                  } else if (item.key === 'role-management') {
                    isCurrentActive = showUsersList && activeTab === 'details' && false;
                  } else if (item.key === 'settings') {
                    isCurrentActive = !showUsersList && !showDuplicates && !showMapping;
                  }

                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (item.key === 'dashboard') {
                          onClose();
                        } else if (item.key === 'reviewees') {
                          setShowUsersList(true);
                          setShowDuplicates(false);
                          setShowMapping(false);
                          handleTabChange('details');
                        } else if (item.key === 'score-management') {
                          setShowUsersList(true);
                          setShowDuplicates(false);
                          setShowMapping(false);
                          handleTabChange('scores');
                        } else if (item.key === 'upload-scores') {
                          setShowUsersList(true);
                          setShowDuplicates(false);
                          setShowMapping(false);
                          handleTabChange('import_scores');
                        } else if (item.key === 'archives') {
                          setShowUsersList(true);
                          setShowDuplicates(false);
                          setShowMapping(false);
                          handleTabChange('archived');
                        } else if (item.key === 'leaderboard') {
                          setShowUsersList(true);
                          setShowDuplicates(false);
                          setShowMapping(false);
                          handleTabChange('leaderboard');
                        } else if (item.key === 'activity-log') {
                          setShowUsersList(true);
                          setShowDuplicates(false);
                          setShowMapping(false);
                          handleTabChange('activity');
                        } else if (item.key === 'role-management') {
                          setShowUsersList(true);
                          setShowDuplicates(false);
                          setShowMapping(false);
                          handleTabChange('details');
                        } else if (item.key === 'settings') {
                          setShowUsersList(false);
                          setShowDuplicates(false);
                          setShowMapping(false);
                        }
                      }}
                      className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-bold transition-all cursor-pointer ${
                        isCurrentActive
                          ? "bg-[#020617] text-white shadow-md font-extrabold"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${
                          isCurrentActive ? "text-white" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom CTA Button */}
            <div className="px-4 py-3 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/50">
              <button 
                onClick={() => { setShowUsersList(false); setShowDuplicates(false); setShowMapping(false); }}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/50 px-3 text-[11px] font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer shadow-sm w-full"
              >
                <RefreshCw className="h-4 w-4" />
                Sync Scores
              </button>
              
              <button 
                onClick={onClose}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 border border-slate-200/50 hover:bg-slate-200 text-slate-700 px-3 text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer shadow-sm w-full"
              >
                <X className="h-4 w-4" />
                Back to Dashboard
              </button>
            </div>

            {/* Developer Credit Footer */}
            <div className="border-t border-slate-100 px-5 py-4 text-center bg-slate-50">
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-400">
                Developed by
              </p>
              <p className="mt-0.5 text-[9px] font-black uppercase leading-tight text-slate-500">
                Ariel Orcia Pesalver, RCrim, MSCJ
              </p>
            </div>
          </aside>
          )}

          {/* MAIN WORKSPACE AREA */}
          <main className={embeddedMode ? "w-full" : "flex-1 flex flex-col h-screen overflow-hidden bg-gradient-to-br from-[#99F6E4]/10 via-[#CCFBF1]/5 to-[#F8FAFC]"}>
            {/* HEADER - COMPACT TOP BAR */}
            {!embeddedMode && (
            <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0 text-slate-900">
              <div className="flex items-center gap-3">
                {/* Page Title */}
                <h2 className="text-[12px] font-black uppercase tracking-wider text-slate-800">
                  {showMapping ? "School Name Mappings" : showDuplicates ? "Duplicate Resolver" : !showUsersList ? "Sync Settings" : activeTab === 'details' ? "Reviewees" : activeTab === 'scores' ? "Score Management" : activeTab === 'import_scores' ? "Import Scores" : activeTab === 'archived' ? "Archives" : activeTab === 'leaderboard' ? "Leaderboard" : "Activity Log"}
                </h2>
                <span className="h-4 w-px bg-slate-200" />
                {/* Breadcrumbs */}
                <p className="text-[11px] font-semibold text-slate-400">
                  Home / Samaritan Review / {showMapping ? "School Mappings" : showDuplicates ? "Duplicate Resolver" : !showUsersList ? "Sync" : activeTab === 'details' ? "Reviewees" : activeTab === 'scores' ? "Scores" : activeTab === 'import_scores' ? "Import Scores" : activeTab === 'archived' ? "Archives" : activeTab === 'leaderboard' ? "Leaderboard" : "Activity"}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 shrink-0">
                <button 
                  onClick={onClose}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center gap-2 text-slate-700 font-bold text-xs uppercase cursor-pointer"
                >
                  <span>Close</span>
                  <X size={14} />
                </button>
              </div>
            </header>
            )}

            {/* SCROLLABLE CONTENT BODY */}
            <div className={embeddedMode ? "w-full text-slate-900" : "flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar text-slate-900"}>
              <div className="w-full max-w-[1800px] mx-auto bg-white border border-slate-200 rounded-[1.5rem] p-4 lg:p-6 shadow-sm">
            
            {!showMapping && !showDuplicates && !showUsersList ? (
              <div className="space-y-6">
                <div className="space-y-2 relative">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    Academic Year
                    {autoSyncEnabled && <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"><Lock size={10} /> LOCK</span>}
                  </label>
                  <input
                    placeholder="Select Year..."
                    value={year}
                    onChange={(e) => { if (!autoSyncEnabled) { setYear(e.target.value.toUpperCase()); setShowYearSuggestions(true); } }}
                    onFocus={() => { if (!autoSyncEnabled) setShowYearSuggestions(true); }}
                    disabled={autoSyncEnabled}
                    className={`w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all ${autoSyncEnabled ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed select-none' : 'bg-slate-50 border-slate-200 uppercase'}`}
                  />
                  {showYearSuggestions && !autoSyncEnabled && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute z-20 w-full bg-white border border-slate-200 mt-1 max-h-40 overflow-y-auto rounded-xl shadow-lg">
                      <div className="flex justify-between items-center p-2 border-b bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        Select Year
                        <X size={14} onClick={() => setShowYearSuggestions(false)} className="cursor-pointer hover:text-slate-900"/>
                      </div>
                      {Array.from({ length: 4 }, (_, idx) => String(new Date().getFullYear() - 1 + idx)).filter(y => y.includes(year)).map(y => (
                          <li key={y} onClick={() => { setYear(y); setShowYearSuggestions(false); }} className="p-2 cursor-pointer hover:bg-slate-100 list-none text-sm whitespace-nowrap">{y}</li>
                      ))}
                    </motion.div>
                  )}
                </div>
                
                <div className="space-y-2 relative">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    Target School(s)
                    {autoSyncEnabled && <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"><Lock size={10} /> LOCK</span>}
                  </label>
                  {selectedSchools.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {selectedSchools.map(s => (
                            <div key={s} className="bg-slate-200 text-slate-800 text-xs px-2 py-1 flex items-center gap-1 rounded-md">
                                {s}
                                {!autoSyncEnabled && (
                                  <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSelectedSchools(selectedSchools.filter(x => x !== s))} />
                                )}
                            </div>
                        ))}
                    </div>
                  )}
                  <input
                    placeholder={autoSyncEnabled ? "Locked on currently selected school(s)" : (selectedSchools.length === 0 ? "All Schools (Default). Search to select specific..." : "Search and select school...")}
                    value={schoolQuery}
                    onChange={(e) => { if (!autoSyncEnabled) { setSchoolQuery(e.target.value.toUpperCase()); setShowSchoolSuggestions(true); } }}
                    onFocus={() => { if (!autoSyncEnabled) setShowSchoolSuggestions(true); }}
                    disabled={autoSyncEnabled}
                    className={`w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all ${autoSyncEnabled ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed select-none' : 'bg-slate-50 border-slate-200 uppercase'}`}
                  />
                  {showSchoolSuggestions && !autoSyncEnabled && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="fixed z-[100] w-[calc(100vw-48px)] bg-white border border-slate-200 mt-2 max-h-60 overflow-y-auto rounded-xl shadow-2xl">
                      <div className="flex justify-between items-center p-2 border-b bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        Select School
                        <X size={14} onClick={() => setShowSchoolSuggestions(false)} className="cursor-pointer hover:text-slate-900"/>
                      </div>
                      <li onClick={() => { setSelectedSchools([]); setShowSchoolSuggestions(false); }} className="p-2 cursor-pointer hover:bg-slate-100 list-none text-sm whitespace-nowrap text-rose-600 font-medium">Clear All (Reset to Default: All Schools)</li>
                      <li onClick={() => { setSelectedSchools([...officialNames]); setShowSchoolSuggestions(false); }} className="p-2 cursor-pointer hover:bg-slate-100 list-none text-sm whitespace-nowrap text-blue-600 font-medium">Select All Valid Schools (Pill View)</li>
                      {officialNames
                        .filter(s => s.toLowerCase().includes(schoolQuery.toLowerCase()) && !selectedSchools.includes(s))
                        .map(s => (
                          <li key={s} onClick={() => { setSelectedSchools([...selectedSchools, s]); setSchoolQuery(''); setShowSchoolSuggestions(false); }} className="p-2 cursor-pointer hover:bg-slate-100 list-none text-sm whitespace-nowrap">{s}</li>
                        ))
                      }
                    </motion.div>
                  )}
                </div>
                
                {!autoSyncEnabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date From</label>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date To</label>
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all" />
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-slate-200 mt-6 bg-slate-50 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Administrative Reset</h4>
                  <div className="space-y-3">
                     <div className="relative">
                        <button 
                          onClick={() => setShowAdminResetDropdown(!showAdminResetDropdown)}
                          className="w-full p-3 border border-slate-200 rounded-xl bg-white text-sm flex items-center justify-between shadow-sm hover:border-slate-300 transition-colors"
                        >
                          <span className="font-medium text-slate-700">
                             {adminCategories.find(c => c.id === adminResetCategory)?.label || 'Select Category'}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAdminResetDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {showAdminResetDropdown && (
                             <motion.div
                               initial={{ opacity: 0, y: -10 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0, y: -10 }}
                               className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden"
                             >
                               {adminCategories.map(cat => (
                                  <div 
                                    key={cat.id}
                                    onClick={() => { setAdminResetCategory(cat.id); setShowAdminResetDropdown(false); }}
                                    className={`p-3 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${adminResetCategory === cat.id ? 'bg-slate-50 font-bold text-slate-900 list-none' : 'text-slate-600 list-none'}`}
                                  >
                                    {cat.label}
                                  </div>
                               ))}
                             </motion.div>
                          )}
                        </AnimatePresence>
                     </div>
                     <input type="text" placeholder="Type DELETE to confirm" value={adminResetConfirmation} onChange={(e) => setAdminResetConfirmation(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                     <button 
                        disabled={adminResetConfirmation !== 'DELETE' || isResetting}
                        onClick={handleAdminReset}
                        className="w-full p-2 bg-red-600 text-white rounded text-sm font-bold disabled:bg-red-300 flex items-center justify-center gap-2">
                        {isResetting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Resetting...
                          </>
                        ) : 'Reset'}
                     </button>
                  </div>
                </div>

                {syncStatus === 'error' && syncError && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2 text-left"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 animate-pulse" />
                    <div className="space-y-1">
                      <span className="font-bold">Sync Error Occurred:</span>
                      <p className="font-medium text-red-700 leading-relaxed max-h-24 overflow-y-auto pr-1">{syncError}</p>
                    </div>
                  </motion.div>
                )}

                <button 
                  onClick={() => {
                    localStorage.setItem('lastManualSyncFrom', dateFrom);
                    localStorage.setItem('lastManualSyncTo', dateTo);
                    onSync({ year, schools: selectedSchools.length > 0 ? selectedSchools : undefined, dateFrom, dateTo });
                  }}
                  disabled={loading}
                  className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 relative overflow-hidden"
                >
                  {loading && syncProgress !== undefined && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300" 
                      style={{ width: `${syncProgress}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
                      {loading ? `Syncing... ${syncProgress !== undefined ? Math.round(syncProgress) + '%' : ''}` : 'Sync Data'}
                  </span>
                </button>
                <button onClick={() => setShowMapping(true)} className="text-xs text-slate-500 w-full text-center hover:text-slate-900 transition-colors">Manage school mapping</button>
                
                {/* Administrative Tools: Deduplicate & Sequentialize */}
                <div className="pt-4 border-t border-slate-100 space-y-2.5 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Administrative Tools</label>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleRepairUsers}
                      disabled={repairingUsers}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-bold text-[10px] uppercase whitespace-nowrap shadow-sm flex flex-row items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {repairingUsers ? <><Loader2 className="w-3.5 h-3.5 animate-spin outline-none" /> Repairing...</> : <>Repair Missing User Profiles</>}
                    </button>
                    {repairResult && (
                      <div className="text-[10px] p-2 bg-blue-50 text-blue-800 rounded">
                        {repairResult.error ? `Error: ${repairResult.error}` : `Created: ${repairResult.created}, Existing: ${repairResult.existing}`}
                      </div>
                    )}
                    <button
                      onClick={handleRestoreMergedScores}
                      disabled={restoringScores}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 font-bold text-[10px] uppercase whitespace-nowrap shadow-sm flex flex-row items-center justify-center gap-1 disabled:opacity-50"
                      title="Recover scores from any previously merged duplicate accounts into active student records"
                    >
                      {restoringScores ? <><Loader2 className="w-3.5 h-3.5 animate-spin outline-none" /> Restoring Scores...</> : <>Restore Merged Accounts Scores</>}
                    </button>
                    {restoreScoresResult && (
                      <div className="text-[10px] p-2 bg-emerald-50 text-emerald-800 rounded font-medium">
                        {restoreScoresResult.error ? `Error: ${restoreScoresResult.error}` : restoreScoresResult.message}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleFixAllDuplicates}
                        disabled={dedupLoading}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 border border-amber-600/10 text-white rounded-lg py-2 font-bold text-[10px] uppercase whitespace-nowrap shadow-sm flex flex-row items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {dedupLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin outline-none" />
                            Fixing...
                          </>
                        ) : (
                          <>
                            Fix IDs
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowDuplicates(true);
                          fetchDuplicates();
                        }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg py-2 font-bold text-[10px] uppercase whitespace-nowrap shadow-sm flex flex-row items-center justify-center gap-1"
                    >
                      Duplicates
                    </button>
                    <button
                      onClick={() => {
                        setShowUsersList(true);
                        fetchAllUsers();
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg py-2 font-bold text-[10px] uppercase whitespace-nowrap shadow-sm flex items-center justify-center gap-1"
                    >
                      <Search size={12} /> Search DB
                    </button>
                  </div>

                  </div>
                  <AnimatePresence>
                    {dedupResult && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 space-y-1"
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Deduplication Success!</span>
                        </div>
                        <p className="text-[10.5px] text-slate-600 font-medium pt-0.5">
                          Successfully cleaned up and reorganized sequence IDs chronologically:
                        </p>
                        <div className="grid grid-cols-3 gap-1 pt-1.5 text-center text-[10px] font-bold text-slate-500 uppercase">
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="block text-[11px] text-red-600">{dedupResult.deletedCount}</span>
                            <span className="text-[8px] text-slate-400">Deleted Dups</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="block text-[11px] text-blue-600">{dedupResult.reassignedCount}</span>
                            <span className="text-[8px] text-slate-400">Resequenced</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-100">
                            <span className="block text-[11px] text-slate-700">{dedupResult.remainingCount}</span>
                            <span className="text-[8px] text-slate-400">Remaining</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                     <div className="space-y-0.5">
                       <label className="text-sm font-semibold text-slate-800">Auto Sync</label>
                       <p className="text-[10px] text-slate-500">{autoSyncEnabled ? `Syncing every ${autoSyncInterval} min` : 'Manual sync only'}</p>
                       {lastSyncDate && <p className="text-[10px] text-slate-500 mt-1">Last synced: {new Date(lastSyncDate).toLocaleString()}</p>}
                     </div>
                     <div className="flex items-center gap-2 font-sans">
                       {autoSyncEnabled && (
                         <AnimatedSelect
                           value={String(autoSyncInterval)}
                           options={[
                             { value: "1", label: "1 min" },
                             { value: "5", label: "5 min" },
                             { value: "15", label: "15 min" },
                             { value: "60", label: "1 hr" },
                           ]}
                           onChange={(val) => setAutoSyncInterval(Number(val))}
                           searchable={false}
                           className="w-[100px]"
                           triggerClassName="h-7 px-2 text-[11px] font-bold rounded bg-slate-50 border-slate-200"
                         />
                       )}
                       <button
                         type="button"
                         onClick={() => {
                           if (!autoSyncEnabled) {
                             setShowAutoSyncConfirm(true);
                           } else {
                             setAutoSyncEnabled(false);
                           }
                         }}
                         className={`w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer ${autoSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                       >
                         <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                       </button>
                     </div>
                  </div>

                  <AnimatePresence>
                    {showAutoSyncConfirm && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-sky-50 border border-sky-100 rounded-xl p-3 space-y-3.5 z-10"
                      >
                        <div className="flex gap-2.5 text-xs text-slate-600">
                          <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5 animate-pulse" />
                          <div className="text-left">
                            <p className="font-bold text-slate-800">Auto Sync Confirmation</p>
                            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                              Enabling Auto Sync will lock your <strong>Academic Year</strong> and <strong>Target School(s)</strong> selections to prevent changes. Do you want to select Manual Sync or Auto Sync (which saves the updates)?
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 text-xs pt-1">
                          <label className="text-xs font-bold text-slate-700">Periodic Background Sync</label>
                        <button
                            type="button"
                            onClick={() => {
                              setAutoSyncEnabled(false);
                              setShowAutoSyncConfirm(false);
                            }}
                            className="px-2.5 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer border border-slate-200 bg-white"
                          >
                            Manual Sync
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAutoSyncEnabled(true);
                              setShowAutoSyncConfirm(false);
                            }}
                            className="px-3 py-1 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                          >
                            Auto Sync
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : showUsersList ? (
              <div className={`space-y-4 text-sm flex flex-col ${embeddedMode ? 'h-auto' : 'h-full'} sync-settings-container mobile-safe text-slate-800`}>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200 justify-between flex-wrap sync-settings-header">
                  <div className="flex items-center gap-2.5">
                    {!embeddedMode && (
                      <button onClick={() => setShowUsersList(false)} className="text-slate-500 hover:text-slate-900 transition-colors p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl">
                        <ChevronLeft size={16} />
                      </button>
                    )}
                    <Search className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="text-left">
                      <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider sync-settings-title">Search Database</h4>
                      <p className="text-xs text-slate-400">Find users and manage scores or details in real-time</p>
                    </div>
                  </div>
                  {!embeddedMode && (
                    <div className="flex items-center gap-3">
                      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mobile-scroll-tabs gap-1">
                        <button 
                          onClick={() => handleTabChange('details')}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${targetTab === 'details' ? 'bg-[#020617] text-white shadow-md font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                        >
                          Details
                        </button>
                        <button 
                          onClick={() => handleTabChange('scores')}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${targetTab === 'scores' ? 'bg-[#020617] text-white shadow-md font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                        >
                          Scores
                        </button>
                        <button 
                          onClick={() => handleTabChange('import_scores')}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${targetTab === 'import_scores' ? 'bg-[#020617] text-white shadow-md font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                        >
                          Import Scores
                        </button>
                        <button 
                          onClick={() => handleTabChange('leaderboard')}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${targetTab === 'leaderboard' ? 'bg-[#020617] text-white shadow-md font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                        >
                          Leaderboard
                        </button>
                        <button 
                          onClick={() => handleTabChange('archived')}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${targetTab === 'archived' ? 'bg-[#020617] text-white shadow-md font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                        >
                          Archived
                        </button>

                        {isAdmin(currentUser) && (
                          <button 
                            onClick={() => handleTabChange('activity')}
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${targetTab === 'activity' ? 'bg-[#020617] text-white shadow-md font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                          >
                            Activity Log
                          </button>
                        )}
                      </div>
                      <button onClick={() => setShowUsersList(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-colors uppercase tracking-wider cursor-pointer">
                         <ChevronLeft size={14} /> Back
                      </button>
                    </div>
                  )}
                </div>

                {activeTab !== 'leaderboard' && activeTab !== 'activity' && activeTab !== 'import_scores' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Registered: {usersToExport.length} / {filteredAndSortedUsers.length} selected
                    </div>
                </div>

                <div className="flex gap-1.5 flex-wrap items-center justify-between mt-2">
                    {activeTab === 'details' && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportReviewees}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm"
                            >
                                <Download size={12} />
                                Export Reviewees
                            </button>
                            <input type="file" id="import-reviewees" className="hidden" accept=".csv" onChange={handleImportReviewees} />
                            <label
                                htmlFor="import-reviewees"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm cursor-pointer"
                            >
                                <Upload size={12} />
                                Import Reviewees
                            </label>
                        </div>
                    )}
                    
                    <div className="flex gap-1.5 flex-wrap items-center relative ml-auto">
                      {/* Custom Animated Droplist Card */}
                      <div className="flex items-center gap-2">
                        <AnimatedSelect
                          value={filterSchool}
                          options={[
                            { value: 'ALL', label: 'ALL SCHOOLS' },
                            ...uniqueSchoolsList.map(school => ({ value: school, label: school }))
                          ]}
                          onChange={(val) => setFilterSchool(val)}
                          placeholder="All Schools"
                          searchPlaceholder="Search school..."
                          label="Filter by School"
                          className="w-full lg:w-[200px]"
                          triggerClassName="h-9 px-3 text-[10px] uppercase font-bold rounded-lg border-slate-200"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm print-hidden">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 pl-0.5">
                          Sort By:
                        </span>
                        <AnimatedSelect
                          value={sortColumn}
                          options={[
                            { value: 'id', label: 'ID Number' },
                            { value: 'name', label: 'Name' },
                            { value: 'rating', label: 'Overall Category Rating' },
                            { value: 'clj', label: 'CLJ Score / Rating' },
                            { value: 'lea', label: 'LEA Score / Rating' },
                            { value: 'cdi', label: 'CDI Score / Rating' },
                            { value: 'fs', label: 'FS Score / Rating' },
                            { value: 'crim', label: 'CRIM Score / Rating' },
                            { value: 'ca', label: 'CA Score / Rating' },
                            { value: 'school', label: 'School' },
                          ]}
                          onChange={(val) => {
                            setSortColumn(val);
                            if (['rating', 'clj', 'lea', 'crim', 'cdi', 'fs', 'ca'].includes(val)) {
                              setSortDirection('desc');
                            } else {
                              setSortDirection('asc');
                            }
                          }}
                          placeholder="Sort By"
                          mobileMode="popover"
                          variant="compact-popover"
                          searchable={false}
                          className="w-[160px]"
                          triggerClassName="h-7 px-2 text-[10px] uppercase font-bold rounded-md bg-slate-50 border-slate-200"
                        />

                        <button
                          type="button"
                          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                          title={`Click to switch order (Current: ${sortDirection === 'asc' ? 'Lowest to Highest' : 'Highest to Lowest'})`}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black uppercase transition-colors bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                        >
                          {sortDirection === 'asc' ? (
                            <>
                              <ChevronUp size={12} className="text-emerald-400 stroke-[3]" />
                              <span>Lowest to Highest</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown size={12} className="text-emerald-400 stroke-[3]" />
                              <span>Highest to Lowest</span>
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        onClick={handleExportCSV}
                        title="Download current table data as CSV"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"
                      >
                        <FileText size={12} />
                        CSV
                      </button>
                      <button
                        onClick={handleExportPDF}
                        title="Download current table data as PDF"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"
                      >
                        <Download size={12} />
                        PDF
                      </button>
                      {activeTab === 'scores' && (
                        <>
                          <div className="relative print-hidden">
                            <button
                              onClick={() => { setShowCategoryDropdown(!showCategoryDropdown); setShowSubjectDropdown(false); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm"
                            >
                              Categories ({selectedCategories.length})
                              <ChevronDown size={10} />
                            </button>
                            {showCategoryDropdown && (
                              <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute top-full right-0 mt-1 bg-white p-2.5 rounded-xl shadow-xl z-50 border border-slate-200 w-48 max-h-60 overflow-y-auto"
                              >
                                <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                  <span>Categories</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allCats = ['Preboard', 'Pretest', 'Posttest', 'Quiz', 'Daily Evaluation', 'Removal', 'Diagnostic'];
                                      if (selectedCategories.length === allCats.length) {
                                        const defaultCat = localStorage.getItem('lastSelectedCategory') || 'Diagnostic';
                                        const found = allCats.find(c => c.toLowerCase().replace(/\s+/g, '') === defaultCat.toLowerCase().replace(/\s+/g, '')) || 'Diagnostic';
                                        setSelectedCategories([found]);
                                      } else {
                                        setSelectedCategories(allCats);
                                      }
                                    }}
                                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                                  >
                                    {selectedCategories.length === 7 ? 'Reset (1)' : 'Select All'}
                                  </button>
                                </div>
                                {['Preboard', 'Pretest', 'Posttest', 'Quiz', 'Daily Evaluation', 'Removal', 'Diagnostic'].map(cat => (
                                  <label key={cat} className="flex items-center gap-2 text-xs py-1 px-1.5 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors font-medium text-slate-700">
                                    <input
                                      type="checkbox"
                                      className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                      checked={selectedCategories.includes(cat)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedCategories([...selectedCategories, cat]);
                                        } else {
                                          const next = selectedCategories.filter(c => c !== cat);
                                          const defaultCat = selectedCategories[0] || localStorage.getItem('lastSelectedCategory') || 'Diagnostic';
                                          const allCats = ['Preboard', 'Pretest', 'Posttest', 'Quiz', 'Daily Evaluation', 'Removal', 'Diagnostic'];
                                          const found = allCats.find(c => c.toLowerCase().replace(/\s+/g, '') === defaultCat.toLowerCase().replace(/\s+/g, '')) || 'Diagnostic';
                                          setSelectedCategories(next.length > 0 ? next : [found]);
                                        }
                                      }}
                                    />
                                    <span className="truncate">{cat}</span>
                                  </label>
                                ))}
                              </motion.div>
                            )}
                          </div>
                          {activeTab === 'scores' && (
                            <ScoreUploader allUsers={allUsers} fetchAllUsers={fetchAllUsers} currentUser={currentUser} backgroundTasks={backgroundTasks} setBackgroundTasks={setBackgroundTasks} />
                          )}
                        </>
                      )}
                      
                      <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"
                      >
                        <Printer size={12} />
                        Print List
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by name or ID Number..."
                        value={searchUserQuery}
                        onChange={(e) => setSearchUserQuery(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      {searchUserQuery && (
                        <button
                          onClick={() => setSearchUserQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Clear search"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button onClick={fetchAllUsers} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-sm" disabled={loadingUsers}>
                      <RefreshCw size={16} className={loadingUsers ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
                )}
                
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Users size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Reviewees</span>
                      <span className="text-xl font-black text-slate-900">{allUsers.length}</span>
                    </div>
                  </div>
                </div>

                {activeTab === 'scores' && selectedCategories.length >= 2 && (() => {
                  const sumWeights = selectedCategories.reduce((acc, cat) => acc + (gradeWeights[cat] || 0), 0);
                  if (Math.abs(sumWeights - 100) > 0.01) {
                    return (
                      <div className="mb-3 p-2.5 px-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Selected category weights total <strong>{sumWeights}%</strong>. Overall Grade is based on configured category weights and is not normalized.
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl relative bg-slate-50">
                  {(loadingUsers && allUsers.length === 0) || isTabLoading ? (
                    <div className="relative mobile-table-scroll border-b border-slate-200 flex-1 min-h-[500px] overflow-auto h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)] bg-white rounded-xl">
                      <table className="w-full text-left text-xs border-collapse table-auto">
                        <thead className="bg-slate-100/90 sticky top-0 z-10 shadow-sm text-slate-600 font-bold uppercase text-[9px] tracking-wider backdrop-blur-sm border-b border-slate-200">
                          <tr className="divide-x divide-slate-200">
                            {targetTab === 'scores' ? (
                              <>
                                <th className="p-3 text-center w-8"><Skeleton className="h-3.5 w-3.5 mx-auto rounded" /></th>
                                <th className="p-3 w-20">ID</th>
                                <th className="p-3">Name</th>
                                <th className="p-3">CLJ</th>
                                <th className="p-3">LEA</th>
                                <th className="p-3">CDI</th>
                                <th className="p-3">FS</th>
                                <th className="p-3">CRIM</th>
                                <th className="p-3">CA</th>
                                <th className="p-3">Rating</th>
                                <th className="p-3 text-right">Action</th>
                              </>
                            ) : (
                              <>
                                <th className="p-3 text-center w-8">
                                  <Skeleton className="h-3.5 w-3.5 mx-auto rounded" />
                                </th>
                                <th className="p-3 w-20">ID</th>
                                <th className="p-3">Name</th>
                                <th className="p-3">School Name</th>
                                <th className="p-3">Registered At</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-right">Action</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          <SkeletonTableRows rows={12} cols={targetTab === 'scores' ? 11 : 7} />
                        </tbody>
                      </table>
                    </div>

                  ) : activeTab === 'import_scores' ? (
                    <ScoreImporter
                      allUsers={allUsers}
                      fetchAllUsers={fetchAllUsers}
                      currentUser={currentUser}
                      backgroundTasks={backgroundTasks}
                      setBackgroundTasks={setBackgroundTasks}
                    />
                  ) : activeTab === 'activity' ? (
                    <ActivityLogTab activityLogs={activityLogs} loadingLogs={loadingLogs} onRefresh={fetchActivityLogs} error={activityLogsError} />
                  ) : activeTab === 'leaderboard' ? (
                    <LeaderboardDashboard users={allUsers} />
                  ) : (
                    <div className="relative mobile-table-scroll border-b border-slate-200 flex-1 min-h-[500px] overflow-auto h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)]">
                      {loadingUsers && allUsers.length > 0 && !syncingUserId && (
                        <>
                          <div className="sticky top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500/15 via-blue-600 to-indigo-500/15 animate-pulse z-50 pointer-events-none" />
                          <div className="sticky top-3 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pointer-events-none w-0 h-0 overflow-visible">
                            <div className="bg-blue-600 text-white shadow-xl text-[9px] font-black uppercase tracking-wider rounded-full py-1.5 px-3.5 flex items-center gap-2 pointer-events-auto border border-blue-500/30">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Refreshing Data...
                            </div>
                          </div>
                        </>
                      )}
                      <table className={`w-full text-left text-xs border-collapse table-auto transition-opacity duration-200 ${loadingUsers && !syncingUserId ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                      <thead className="bg-slate-100/90 sticky top-0 z-10 shadow-sm text-slate-600 font-bold uppercase text-[9px] tracking-wider backdrop-blur-sm border-b border-slate-200">
                        {activeTab === 'scores' && selectedCategories.length >= 2 ? (
                          <>
                            <tr className="divide-x divide-slate-200">
                              <th rowSpan={2} className="p-1 whitespace-nowrap text-center w-8">
                                <input 
                                  type="checkbox" 
                                  className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                  title="Select/Deselect All"
                                  checked={usersToExport.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    const userIds = filteredAndSortedUsers.map(u => String(u.doc_id || u.seq_id));
                                    handleToggleExclusionBatch(userIds, !checked);
                                  }} 
                                />
                              </th>
                              <th rowSpan={2} className="px-2 py-1.5 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors w-[90px] min-w-[90px]" onClick={() => handleSort('id')}>
                                <div className="flex items-center justify-between">ID {sortColumn === 'id' ? (sortDirection === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>) : <div className="w-3" />}</div>
                              </th>
                              <th rowSpan={2} className="px-2 py-1.5 cursor-pointer hover:bg-slate-200 transition-colors min-w-[250px]" onClick={() => handleSort('name')}>
                                <div className="flex items-center justify-between">Name {sortColumn === 'name' ? (sortDirection === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>) : <div className="w-3" />}</div>
                              </th>

                              {[
                                { id: 'clj', label: 'CLJ', weight: '20%' },
                                { id: 'lea', label: 'LEA', weight: '20%' },
                                { id: 'cdi', label: 'CDI', weight: '15%' },
                                { id: 'fs', label: 'FS', weight: '15%' },
                                { id: 'crim', label: 'CRIM', weight: '20%' },
                                { id: 'ca', label: 'CA', weight: '10%' }
                              ].map((subj) => (
                                <th key={subj.id} colSpan={selectedCategories.length} className="px-1 py-1.5 text-center font-bold text-[10px] bg-slate-200/80 border-b border-slate-300">
                                  {subj.label} ({subj.weight})
                                </th>
                              ))}

                              <th colSpan={selectedCategories.length + 1} className="p-1 text-center font-extrabold bg-blue-100/90 text-blue-950 border-b border-slate-300">
                                RATINGS & OVERALL GRADE
                              </th>
                              <th rowSpan={2} className="px-2 py-1.5 text-right whitespace-nowrap w-[110px] min-w-[110px]">Action</th>
                            </tr>
                            <tr className="divide-x divide-slate-200 bg-slate-100/95 border-b border-slate-200">
                              {SUBJECT_KEYS.map((subj) => (
                                selectedCategories.map((cat) => {
                                  const sortKey = `${subj}_${cat}`;
                                  const isSorted = sortColumn === sortKey;
                                  return (
                                    <th 
                                      key={sortKey}
                                      className={`px-1 py-1.5 text-center text-[10px] font-bold cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap w-[95px] min-w-[95px] ${isSorted ? 'bg-blue-100 text-blue-950 border-b-2 border-blue-600 font-extrabold' : ''}`}
                                      onClick={() => handleSort(sortKey)}
                                      title={`Click to sort by ${subj.toUpperCase()} (${cat})`}
                                    >
                                      <div className="flex items-center justify-center gap-0.5">
                                        <span>{getCategoryShortName(cat)}</span>
                                        {isSorted ? (
                                          sortDirection === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                                        ) : null}
                                      </div>
                                    </th>
                                  );
                                })
                              ))}
                              {selectedCategories.map((cat) => {
                                const sortKey = `rating_${cat}`;
                                const isSorted = sortColumn === sortKey;
                                return (
                                  <th 
                                    key={sortKey}
                                    className={`p-1 text-center text-[8.5px] font-bold cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap ${isSorted ? 'bg-blue-100 text-blue-950 border-b-2 border-blue-600 font-extrabold' : ''}`}
                                    onClick={() => handleSort(sortKey)}
                                    title={`Click to sort by ${cat} Rating`}
                                  >
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span>{getCategoryShortName(cat)} Rating</span>
                                      {isSorted ? (
                                        sortDirection === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                                      ) : null}
                                    </div>
                                  </th>
                                );
                              })}
                              <th 
                                className={`p-1 text-center text-[8.5px] font-black cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap bg-indigo-100/80 text-indigo-950 ${sortColumn === 'overall' ? 'bg-indigo-200 border-b-2 border-indigo-700 font-black' : ''}`}
                                onClick={() => handleSort('overall')}
                                title="Click to sort by Overall Grade"
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  <span>Overall Grade</span>
                                  {sortColumn === 'overall' ? (
                                    sortDirection === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                                  ) : null}
                                </div>
                              </th>
                            </tr>
                          </>
                        ) : (
                          <tr className="divide-x divide-slate-200">
                            <th className="p-1 whitespace-nowrap text-center w-8">
                              <input 
                                type="checkbox" 
                                className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                title="Select/Deselect All"
                                checked={usersToExport.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const userIds = filteredAndSortedUsers.map(u => String(u.doc_id || u.seq_id));
                                  handleToggleExclusionBatch(userIds, !checked);
                                }} 
                              />
                            </th>
                            <th className="px-2 py-1.5 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors w-[90px] min-w-[90px]" onClick={() => handleSort('id')}>
                              <div className="flex items-center justify-between">ID {sortColumn === 'id' ? (sortDirection === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>) : <div className="w-3" />}</div>
                            </th>
                            <th className="px-2 py-1.5 cursor-pointer hover:bg-slate-200 transition-colors min-w-[250px]" onClick={() => handleSort('name')}>
                              <div className="flex items-center justify-between">Name {sortColumn === 'name' ? (sortDirection === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>) : <div className="w-3" />}</div>
                            </th>

                            {activeTab === 'scores' ? (
                              <>
                                {[
                                  { id: 'clj', label: 'CLJ', weight: '20%' },
                                  { id: 'lea', label: 'LEA', weight: '20%' },
                                  { id: 'cdi', label: 'CDI', weight: '15%' },
                                  { id: 'fs', label: 'FS', weight: '15%' },
                                  { id: 'crim', label: 'CRIM', weight: '20%' },
                                  { id: 'ca', label: 'CA', weight: '10%' }
                                ].map((subj) => {
                                  return (
                                    <SubjectColumnHeader
                                      key={subj.id}
                                      subj={subj}
                                      allUsers={allUsers}
                                      getSubjectDetails={getSubjectDetails}
                                      handleDeleteScores={handleDeleteScores}
                                      isDeletingScores={isDeletingScores}
                                      selectedCategories={selectedCategories}
                                      sortColumn={sortColumn}
                                      sortDirection={sortDirection}
                                      onSort={() => handleSort(subj.id as any)}
                                    />
                                  )
                                })}
                                <th 
                                  className={`p-1 text-center font-black cursor-pointer hover:bg-slate-200 transition-colors select-none min-w-[70px] ${
                                    sortColumn === 'rating' ? 'bg-blue-100/80 text-blue-950 font-black border-b-2 border-blue-600' : ''
                                  }`}
                                  onClick={() => handleSort('rating')}
                                  title={`Click to sort by Overall Category Rating (${sortDirection === 'asc' && sortColumn === 'rating' ? 'Lowest to Highest' : 'Highest to Lowest'})`}
                                >
                                  <div className="flex items-center justify-center gap-0.5">
                                    <span>RATING</span>
                                    {sortColumn === 'rating' ? (
                                      sortDirection === 'asc' ? (
                                        <ChevronUp size={12} className="text-blue-700 font-extrabold stroke-[3]" />
                                      ) : (
                                        <ChevronDown size={12} className="text-blue-700 font-extrabold stroke-[3]" />
                                      )
                                    ) : null}
                                  </div>
                                </th>
                              </>
                            ) : (
                              <>
                                <th className="p-1 hidden sm:table-cell cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('school')}>
                                  <div className="flex items-center justify-between">School {sortColumn === 'school' ? (sortDirection === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>) : <div className="w-3" />}</div>
                                </th>
                                <th className="p-1 cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap" onClick={() => handleSort('timestamp')}>
                                  <div className="flex items-center justify-between">Registered At {sortColumn === 'timestamp' ? (sortDirection === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>) : <div className="w-3" />}</div>
                                </th>
                                <th className="p-1 text-center cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap" onClick={() => handleSort('status')}>
                                  <div className="flex items-center justify-center gap-1">Status {sortColumn === 'status' ? (sortDirection === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>) : <div className="w-3" />}</div>
                                </th>
                              </>
                            )}
                            <th className="px-2 py-1.5 text-right whitespace-nowrap w-[110px] min-w-[110px]">Action</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredAndSortedUsers.map((u, i) => {
                           const idStr = String(u.doc_id || u.seq_id);
                           const isExcluded = excludedUserIds.has(idStr);
                           
                           if (editingUserId === u.doc_id) {
                             return (
                               <tr key={i} className="bg-slate-50 border-y-2 border-slate-300 divide-x divide-slate-200">
                                 <td className="p-2 sm:p-3 text-center">
                                   {/* Disabled / Empty during edit */}
                                 </td>
                                 <td className="p-2 sm:p-3 font-sans text-xs font-bold text-slate-500 whitespace-nowrap">
                                   <input 
                                      type="text"
                                      value={editSeqId}
                                      onChange={e => setEditSeqId(e.target.value)}
                                      className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                                   />
                                   <div className="text-[8px] text-blue-600 font-bold uppercase mt-1 leading-none bg-blue-50 rounded px-1 py-0.5 inline-block text-center w-full">EDITING</div>
                                 </td>
                                 <td colSpan={activeTab === 'scores' ? 7 : 3} className="p-2 sm:p-3 space-y-2.5 bg-slate-50/60">
                                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">Last Name</label>
                                       <input 
                                         type="text" 
                                         value={editLastName} 
                                         onChange={e => setEditLastName(e.target.value)} 
                                         className="w-full p-1.5 border border-slate-300 rounded text-[11px] uppercase font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">First Name</label>
                                       <input 
                                         type="text" 
                                         value={editFirstName} 
                                         onChange={e => setEditFirstName(e.target.value)} 
                                         className="w-full p-1.5 border border-slate-300 rounded text-[11px] uppercase font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">Middle Name</label>
                                       <input 
                                         type="text" 
                                         value={editMiddleName} 
                                         onChange={e => setEditMiddleName(e.target.value)} 
                                         className="w-full p-1.5 border border-slate-300 rounded text-[11px] uppercase font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                   </div>
                                   <div>
                                     <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">School Name</label>
                                     <input 
                                       type="text" 
                                       value={editSchoolName} 
                                       onChange={e => setEditSchoolName(e.target.value)} 
                                       className="w-full p-1.5 border border-slate-300 rounded text-[11px] uppercase font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                     />
                                   </div>
                                   <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Criminal Law and Jurisprudence">CLJ</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreCLJ} 
                                         onChange={e => setEditScoreCLJ(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Law Enforcement and Administration">LEA</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreLEA} 
                                         onChange={e => setEditScoreLEA(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Forensic Science">FS</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreFS} 
                                         onChange={e => setEditScoreFS(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Crime Detection and Investigation">CDI</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreCDI} 
                                         onChange={e => setEditScoreCDI(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Criminology">CRIM</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreCRIM} 
                                         onChange={e => setEditScoreCRIM(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Correctional Administration">CA</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreCA} 
                                         onChange={e => setEditScoreCA(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                   </div>
                                   <div className="mt-2 text-left w-full">
                                     <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">Role / Admin Status (Who can see/use sync settings)</label>
                                     <select
                                       value={editRole}
                                       onChange={(e) => setEditRole(e.target.value)}
                                       className="w-full sm:w-[200px] p-1.5 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                                     >
                                       <option value="reviewee">Reviewee (Default)</option>
                                       <option value="staff">Staff</option>
                                       <option value="admin">Admin</option>
                                     </select>
                                   </div>
                                 </td>
                                 <td className="p-2 sm:p-3 text-center">
                                   <span className="text-[8px] text-slate-400 font-bold uppercase block mb-1 leading-none">Resets To:</span>
                                   <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-wider">
                                     <Clock size={10} /> PENDING
                                   </span>
                                 </td>
                                 <td className="p-2 sm:p-3 text-right">
                                   <div className="flex flex-col gap-1.5 justify-end">
                                     <button 
                                       type="button"
                                       onClick={() => handleUpdateUserDetails(u)} 
                                       disabled={updatingUser}
                                       className="w-full px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm text-[9px] uppercase tracking-wider whitespace-nowrap text-center disabled:opacity-50 cursor-pointer"
                                     >
                                       {updatingUser ? 'SAVING...' : 'SAVE'}
                                     </button>
                                     <button 
                                       type="button"
                                       onClick={() => setEditingUserId(null)} 
                                       disabled={updatingUser}
                                       className="w-full px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded shadow-sm text-[9px] uppercase tracking-wider whitespace-nowrap text-center disabled:opacity-50 cursor-pointer"
                                     >
                                       CANCEL
                                     </button>
                                   </div>
                                 </td>
                               </tr>
                             );
                           }

                             if (activeTab === 'scores') {
                               return (
                                 <tr key={i} className={`hover:bg-slate-50 transition-colors divide-x divide-slate-200 ${isExcluded ? 'opacity-40 bg-slate-50' : ''}`}>
                                   <td className="p-1 sm:px-2 sm:py-1.5 text-center w-[1%] whitespace-nowrap">
                                     <input 
                                       type="checkbox" 
                                       className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                       checked={!isExcluded}
                                       onChange={(e) => {
                                         handleToggleExclusionSingle(idStr, !e.target.checked);
                                       }} 
                                     />
                                   </td>
                                   <td className="px-2 py-1.5 font-sans text-xs font-bold text-slate-700 whitespace-nowrap w-[90px] min-w-[90px]">{highlightMatch(u.seq_id, searchUserQuery)}</td>
                                   <td className={`px-2 py-1.5 font-bold uppercase text-base leading-tight whitespace-nowrap min-w-[250px] pl-2 ${
                                     getRatingTextColorClass(
                                       selectedCategories.length <= 1
                                         ? (() => {
                                             const currentCat = selectedCategories[0] || 'preboard';
                                             const detailed = getCategoryDetailedScores(u, currentCat);
                                             return SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                                           })()
                                         : selectedCategories.reduce((acc, cat) => {
                                             const detailed = getCategoryDetailedScores(u, cat);
                                             const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                                             const weight = gradeWeights[cat] ?? 0;
                                             return acc + (catRating * (weight / 100));
                                           }, 0)
                                     )
                                   }`}>
                                     {formatFormalName({
                                   firstName: u.first_name || u.firstName,
                                   middleName: u.middle_name || u.middleName,
                                   lastName: u.last_name || u.lastName,
                                   fallbackFullName: u.full_name || u.fullName || u.displayName
                                 })}
                                   </td>
                                   {selectedCategories.length <= 1 ? (
                                     <>
                                       <td className="px-1 py-1.5 text-center text-slate-700 w-[95px] min-w-[95px]">
                                         {renderScoreCell(u, 'clj')}
                                       </td>
                                       <td className="px-1 py-1.5 text-center text-slate-700 w-[95px] min-w-[95px]">
                                         {renderScoreCell(u, 'lea')}
                                       </td>
                                       <td className="px-1 py-1.5 text-center text-slate-700 w-[95px] min-w-[95px]">
                                         {renderScoreCell(u, 'cdi')}
                                       </td>
                                       <td className="px-1 py-1.5 text-center text-slate-700 w-[95px] min-w-[95px]">
                                         {renderScoreCell(u, 'fs')}
                                       </td>
                                       <td className="px-1 py-1.5 text-center text-slate-700 w-[95px] min-w-[95px]">
                                         {renderScoreCell(u, 'crim')}
                                       </td>
                                       <td className="px-1 py-1.5 text-center text-slate-700 w-[95px] min-w-[95px]">
                                         {renderScoreCell(u, 'ca')}
                                       </td>
                                       <td className={`p-1 sm:px-2 sm:py-1.5 text-center font-black ${
                                         (() => {
                                           const currentCat = selectedCategories[0] || 'preboard';
                                           const detailed = getCategoryDetailedScores(u, currentCat);
                                           const rating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                                           return getRatingTextColorClass(rating);
                                         })()
                                       }`}>
                                         {(() => {
                                           const currentCat = selectedCategories[0] || 'preboard';
                                           const detailed = getCategoryDetailedScores(u, currentCat);
                                           const rating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                                           return `${rating.toFixed(2)}%`;
                                         })()}
                                       </td>
                                     </>
                                   ) : (
                                     <>
                                       {SUBJECT_KEYS.map((subj) => (
                                         selectedCategories.map((cat) => (
                                           <td key={subj + '_' + cat} className="px-1 py-1.5 text-center text-slate-700 w-[95px] min-w-[95px]">
                                             {renderScoreCell(u, subj, cat)}
                                           </td>
                                         ))
                                       ))}
                                       {selectedCategories.map((cat) => (
                                         <td key={'cat_rating_' + cat} className="p-1 sm:px-2 sm:py-1.5 text-center font-black text-slate-900 bg-slate-50/50 min-w-[60px]">
                                           {(() => {
                                             const detailed = getCategoryDetailedScores(u, cat);
                                             const rating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                                             return `${rating.toFixed(2)}%`;
                                           })()}
                                         </td>
                                       ))}
                                       <td className={`p-1 sm:px-2 sm:py-1.5 text-center font-black bg-indigo-50/80 min-w-[65px] ${
                                         (() => {
                                           const overallGrade = selectedCategories.reduce((acc, cat) => {
                                             const detailed = getCategoryDetailedScores(u, cat);
                                             const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                                             const weight = gradeWeights[cat] ?? 0;
                                             return acc + (catRating * (weight / 100));
                                           }, 0);
                                           return getRatingTextColorClass(overallGrade);
                                         })()
                                       }`}>
                                         {(() => {
                                           const overallGrade = selectedCategories.reduce((acc, cat) => {
                                             const detailed = getCategoryDetailedScores(u, cat);
                                             const catRating = SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                                             const weight = gradeWeights[cat] ?? 0;
                                             return acc + (catRating * (weight / 100));
                                           }, 0);
                                           return `${overallGrade.toFixed(2)}%`;
                                         })()}
                                       </td>
                                     </>
                                   )}
                                   {shouldShowRegisteredAtColumn && (
                                     <td className="p-1 sm:px-2 sm:py-1.5 text-xs text-slate-500 whitespace-nowrap">
                                       {u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'}
                                     </td>
                                   )}
                                   <td className="px-2 py-1.5 text-right overflow-visible w-[110px] min-w-[110px]">
                                     <div className="flex flex-row gap-1 justify-end items-center h-full ml-auto">
                                       <button
                                         onClick={() => {
                                           if ((isStaff(currentUser) || getUserRole(currentUser) === 'Staff') && (isAdmin(u) || u.role === 'Admin' || u.role === 'Staff')) {
                                             alert("Staff members can only edit Reviewee accounts.");
                                             return;
                                           }
                                           setEditingUserId(u.doc_id);
                                           setEditFirstName(u.first_name || '');
                                           setEditMiddleName(u.middle_name || '');
                                           setEditLastName(u.last_name || '');
                                           setEditSchoolName(u.school_name || '');
                                           setEditSeqId(u.seq_id || '');
                                           setEditScoreCLJ(u.score_clj || '');
                                           setEditScoreLEA(u.score_lea || '');
                                           setEditScoreFS(u.score_fs || '');
                                           setEditScoreCDI(u.score_cdi || '');
                                           setEditScoreCRIM(u.score_crim || '');
                                           setEditScoreCA(u.score_ca || '');
                                           setEditRole(u.role || '');
                                         }}
                                         className="p-1 px-1.5 font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-[9px] uppercase tracking-wider flex items-center gap-1 border border-slate-200 shadow-sm cursor-pointer whitespace-nowrap"
                                         title="Edit scores"
                                       >
                                         <Edit size={10} /> EDIT
                                       </button>
                                       <button 
                                          onClick={() => handleRowActionClick(u)}
                                          disabled={syncingUserId === u.doc_id}
                                          className={`p-1 px-1.5 font-bold outline-none rounded shadow-sm transition-all duration-150 active:scale-95 text-[9px] uppercase tracking-wider whitespace-nowrap cursor-pointer flex items-center gap-1
                                            ${
                                              activeTab === "scores"
                                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                                : activeTab === "archived" || u.is_archived
                                                  ? "bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"
                                                  : syncingUserId === u.doc_id
                                                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                                    : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                                            }`}
                                        >
                                          {syncingUserId === u.doc_id && <Loader2 size={10} className="animate-spin" />}
                                          {getRowActionLabel(u)}
                                        </button>
                                     </div>
                                   </td>
                                 </tr>
                               );
                             }

                            return (
                            <tr key={i} className={`hover:bg-slate-50 transition-colors divide-x divide-slate-200 ${isExcluded ? 'opacity-40 bg-slate-50' : ''}`}>
                              <td className="p-1 sm:p-2 text-center w-[1%] whitespace-nowrap">
                                <input 
                                  type="checkbox" 
                                  className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                  checked={!isExcluded}
                                  onChange={(e) => {
                                    handleToggleExclusionSingle(idStr, !e.target.checked);
                                  }} 
                                />
                              </td>
                              <td className="px-2 py-1.5 font-sans text-xs font-bold text-slate-700 whitespace-nowrap w-[90px] min-w-[90px]" suppressHydrationWarning>{highlightMatch(u.seq_id, searchUserQuery)}</td>
                              <td className="px-2 py-1.5 font-bold text-slate-900 uppercase text-base leading-tight break-words min-w-[250px]">
                                {formatFormalName({
                                  firstName: u.first_name || u.firstName,
                                  middleName: u.middle_name || u.middleName,
                                  lastName: u.last_name || u.lastName,
                                  fallbackFullName: u.full_name || u.fullName || u.displayName
                                })}
                                {isAdminLike(u) && (
                                  <div className="font-bold text-emerald-600 mt-1 text-[9px] uppercase tracking-wider">{isAdmin(u) ? "ADMIN" : "STAFF"}</div>
                                )}
                                <div className="font-normal text-slate-400 mt-1 sm:hidden leading-tight break-words">{u.school_name}</div>
                              </td>
                              <td className="p-1 sm:px-2 sm:py-1.5 text-[9px] text-slate-500 uppercase leading-tight break-words hidden sm:table-cell">
                                {u.school_name}
                              </td>
                              <td className="p-1 sm:px-2 sm:py-1.5 text-xs text-slate-500 whitespace-nowrap">
                                {u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'}
                              </td>
                              <td className="p-1 sm:px-2 sm:py-1.5 text-center">
                                {syncingUserId === u.doc_id ? (
                                   <span className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-wider">
                                     <Loader2 size={10} className="animate-spin" /> SYNCING...
                                   </span>
                                ) : u.is_synced ? (
                                   <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded bg-green-50 text-green-600 text-[9px] font-bold uppercase tracking-wider">
                                     <Check size={10} /> SYNCED
                                   </span>
                                ) : (
                                   <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-wider">
                                     <Clock size={10} /> PENDING
                                   </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right overflow-visible w-[110px] min-w-[110px]">
                                <div className="flex flex-row gap-1 justify-end items-center w-auto h-full ml-auto">
                                  {(activeTab as any) === 'scores' && (
                                    <button
                                      onClick={() => handleOpenManualScoreModal(u)}
                                      className="p-1 px-1.5 font-bold rounded bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 border border-blue-200 shadow-sm cursor-pointer text-center whitespace-nowrap"
                                      title="Add/Edit Manual Score"
                                    >
                                      <CloudUpload size={10} /> SCORE
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if ((isStaff(currentUser) || getUserRole(currentUser) === 'Staff') && (isAdmin(u) || u.role === 'Admin' || u.role === 'Staff')) {
                                        alert("Staff members can only edit Reviewee accounts.");
                                        return;
                                      }
                                      setEditingUserId(u.doc_id);
                                      setEditFirstName(u.first_name || '');
                                      setEditMiddleName(u.middle_name || '');
                                      setEditLastName(u.last_name || '');
                                      setEditSchoolName(u.school_name || '');
                                      setEditSeqId(u.seq_id || '');
                                      setEditScoreCLJ(u.score_clj || '');
                                      setEditScoreLEA(u.score_lea || '');
                                      setEditScoreFS(u.score_fs || '');
                                      setEditScoreCDI(u.score_cdi || '');
                                      setEditScoreCRIM(u.score_crim || '');
                                      setEditScoreCA(u.score_ca || '');
                                      setEditRole(u.role || '');
                                    }}
                                    className="p-1 px-1.5 font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 border border-slate-200 shadow-sm cursor-pointer text-center whitespace-nowrap"
                                    title="Edit details"
                                  >
                                    <Edit size={10} /> EDIT
                                  </button>
                                  <button 
                                    onClick={() => handleRowActionClick(u)} 
                                    disabled={syncingUserId === u.doc_id}
                                    className={`p-1 px-1.5 font-bold outline-none rounded shadow-sm transition-all duration-150 active:scale-95 text-[9px] uppercase tracking-wider whitespace-nowrap cursor-pointer flex items-center gap-1
                                      ${
                                        (activeTab as any) === "scores"
                                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                          : activeTab === "archived" || u.is_archived
                                            ? "bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"
                                            : syncingUserId === u.doc_id
                                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                              : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                                      }`}
                                  >
                                    {syncingUserId === u.doc_id && <Loader2 size={10} className="animate-spin" />}
                                    {getRowActionLabel(u)}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            );
                        })}

                        {filteredAndSortedUsers.length === 0 && (
                          <tr>
                            <td colSpan={activeTab === 'scores' ? 18 : 7} className="p-12">
                              <EmptyState 
                                icon={activeTab === 'archived' ? Archive : (searchUserQuery ? Search : Users)}
                                title={activeTab === 'archived' ? 'No archived users' : (searchUserQuery ? 'No results found' : 'No accounts found')}
                                description={
                                  activeTab === 'archived' 
                                    ? 'There are no current archived users in the database.' 
                                    : searchUserQuery 
                                      ? `We couldn't find any results matching "${searchUserQuery}". Try a different search term.` 
                                      : 'The database is currently empty for this category.'
                                }
                                onRefresh={fetchAllUsers}
                                loading={loadingUsers}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              </div>
            ) : showDuplicates ? (
              <div className={`space-y-6 text-sm flex flex-col ${embeddedMode ? 'h-auto' : 'h-full max-h-[70vh]'}`}>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowDuplicates(false)} className="flex items-center gap-1 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase transition-colors">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="text-left">
                      <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Duplicate Analysis</h4>
                      <p className="text-xs text-slate-500">Scanning for shared Sequence IDs and similar names</p>
                    </div>
                  </div>

                  {isAdmin(currentUser) && (
                    <button
                      onClick={handlePreviewStandardization}
                      disabled={loadingStandardization}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold uppercase transition-all shadow-sm disabled:opacity-50"
                      title="Dry-run scan for records with unseparated name fields and preview standardized corrections"
                    >
                      {loadingStandardization ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Standardize Name Fields</span>
                    </button>
                  )}
                </div>

                {standardizationMsg && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs font-medium flex items-center justify-between">
                    <span>{standardizationMsg}</span>
                    <button onClick={() => setStandardizationMsg(null)} className="text-blue-500 hover:text-blue-800 font-bold ml-2">Dismiss</button>
                  </div>
                )}

                {standardizationPreview !== null && (
                  <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-3 border border-slate-800 text-left shadow-lg">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <h5 className="font-bold text-sm uppercase tracking-wider text-blue-400">Name Standardization Preview (Dry-Run)</h5>
                        <p className="text-xs text-slate-400">Found {standardizationPreview.length} record(s) with unseparated or unstandardized name fields.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {standardizationPreview.length > 0 && (
                          <button
                            onClick={handleCommitStandardization}
                            disabled={loadingStandardization}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1 shadow disabled:opacity-50"
                          >
                            {loadingStandardization ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Apply Standardization ({standardizationPreview.length})
                          </button>
                        )}
                        <button
                          onClick={() => setStandardizationPreview(null)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    {standardizationPreview.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">All records are already fully standardized!</p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                              <th className="py-1 px-2">ID</th>
                              <th className="py-1 px-2">Role</th>
                              <th className="py-1 px-2">Current Storage</th>
                              <th className="py-1 px-2 text-emerald-400">Proposed Standardized</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                            {standardizationPreview.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-1.5 px-2 font-bold text-slate-300">{item.seq_id}</td>
                                <td className="py-1.5 px-2 text-slate-400">{item.role}</td>
                                <td className="py-1.5 px-2 text-amber-300">
                                  First: "{item.currentFields.first_name}" | Last: "{item.currentFields.last_name}"
                                </td>
                                <td className="py-1.5 px-2 text-emerald-300 font-bold">
                                  First: "{item.proposedFields.first_name}" | Last: "{item.proposedFields.lastName || item.proposedFields.last_name}"
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto pr-2 text-left">
                  {checkingDuplicates ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4 text-slate-500">
                       <Loader2 className="w-8 h-8 animate-spin" />
                       <span className="text-xs font-bold uppercase tracking-wider">Analyzing Database...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-6 h-full">
                      <div className="flex-1 space-y-6">
                        <h5 className="font-bold text-amber-600 mb-3 text-xs uppercase flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg"><CheckCircle2 className="w-4 h-4"/> Duplicate / Similar Name Groups ({similarNames.length} groups)</h5>
                        {similarNames.length === 0 ? <p className="text-xs text-slate-500 italic pl-2">No duplicate or similar name records found.</p> : (
                          <div className="space-y-3">
                            {similarNames.map((group, idx) => {
                              const matchReason = group[0]?._matchReason || 'Exact Name Match';
                              const badgeText = group[0]?._badgeText || 'Exact Match';
                              return (
                              <div key={idx} className="border border-amber-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-amber-50 px-3 py-2 border-b border-amber-200 font-bold text-amber-800 text-[10px] flex justify-between items-center uppercase tracking-wider flex-wrap gap-2">
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span>Name Group {idx + 1}:</span>
                                    <span className="bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded text-[10px] font-black">{matchReason}</span>
                                    <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">{badgeText}</span>
                                    <span title="These entries resolve to the same canonical name or similar name structure across fields and roles. Select record(s) to keep.">
                                      <HelpCircle className="w-3 h-3 text-amber-500 cursor-help" />
                                    </span>
                                  </span>
                                  <span className="bg-white px-2 py-0.5 rounded shadow-sm text-[10px]">{group.length} records</span>
                                </div>
                                <div className="p-3 bg-white flex flex-col xl:flex-row gap-3 overflow-x-auto">
                                  {group.map((r: any, i: number) => {
                                    const canonical = r._canonical || getCanonicalFullName(r);
                                    const roleStr = String(r?.role || r?.userRole || r?.accountType || 'Reviewee').toLowerCase().replace(/[\s\-_]/g, '');
                                    const roleWeight = (roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'owner') ? 3 : (roleStr === 'staff' || roleStr === 'coadmin' || roleStr === 'instructor' || roleStr === 'encoder') ? 2 : 1;
                                    const maxGroupWeight = Math.max(...group.map((item: any) => {
                                      const rs = String(item?.role || item?.userRole || item?.accountType || 'Reviewee').toLowerCase().replace(/[\s\-_]/g, '');
                                      return (rs === 'admin' || rs === 'superadmin' || rs === 'owner') ? 3 : (rs === 'staff' || rs === 'coadmin' || rs === 'instructor' || rs === 'encoder') ? 2 : 1;
                                    }));
                                    const isHighestRoleInMixedGroup = roleWeight === maxGroupWeight && group.some((item: any) => {
                                      const rs = String(item?.role || item?.userRole || item?.accountType || 'Reviewee').toLowerCase().replace(/[\s\-_]/g, '');
                                      const w = (rs === 'admin' || rs === 'superadmin' || rs === 'owner') ? 3 : (rs === 'staff' || rs === 'coadmin' || rs === 'instructor' || rs === 'encoder') ? 2 : 1;
                                      return w !== maxGroupWeight;
                                    });

                                    return (
                                    <label key={i} className={`flex-1 border rounded-xl p-3 flex flex-col gap-2 cursor-pointer transition-all relative min-w-[220px] ${selectionsToKeep[`name_${idx}`]?.includes(r.doc_id) ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/40' : 'border-slate-200 hover:border-amber-200 bg-white'}`}>
                                      <div className="absolute top-3 right-3">
                                        <input
                                          type="checkbox"
                                          name={`keep_name_${idx}`}
                                          checked={selectionsToKeep[`name_${idx}`]?.includes(r.doc_id)}
                                          onChange={() => {
                                            setSelectionsToKeep(prev => {
                                              const current = prev[`name_${idx}`] || [];
                                              const updated = current.includes(r.doc_id)
                                                ? current.filter(id => id !== r.doc_id)
                                                : [...current, r.doc_id];
                                              return { ...prev, [`name_${idx}`]: updated };
                                            });
                                            setConfirmResolve(false);
                                          }}
                                          className="w-4 h-4 text-amber-600 focus:ring-amber-500 rounded border-slate-300"
                                        />
                                      </div>
                                      <div className="pt-1 pr-6 space-y-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {roleWeight === 3 && <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wide">Admin</span>}
                                          {roleWeight === 2 && <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wide">Staff</span>}
                                          {roleWeight === 1 && <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">Reviewee</span>}
                                          {isHighestRoleInMixedGroup && (
                                            <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide flex items-center gap-1">
                                              <ShieldCheck className="w-3 h-3 text-emerald-600"/> Higher Role Preserved
                                            </span>
                                          )}
                                        </div>

                                        <div>
                                          <div className="mt-1 text-xs font-black text-slate-900">
                                            {canonical.displayName}
                                          </div>
                                        </div>

                                        <div className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
                                          <div className="flex justify-between gap-2"><span className="font-semibold text-slate-400">First:</span> <span className="font-bold text-slate-800 text-right truncate">{r.first_name || r.firstName || r['First Name'] || <span className="italic text-slate-400">None</span>}</span></div>
                                          <div className="flex justify-between gap-2"><span className="font-semibold text-slate-400">Middle:</span> <span className="font-bold text-slate-800 text-right truncate">{r.middle_name || r.middleName || r['Middle Name'] || <span className="italic text-slate-400">None</span>}</span></div>
                                          <div className="flex justify-between gap-2"><span className="font-semibold text-slate-400">Last:</span> <span className="font-bold text-slate-800 text-right truncate">{r.last_name || r.lastName || r['Last Name'] || <span className="italic text-slate-400">None</span>}</span></div>
                                          {(r.name || r.full_name || r.fullName || r.displayName) && (
                                            <div className="flex justify-between gap-2 border-t border-slate-200/60 pt-1 mt-1"><span className="font-semibold text-slate-400">Full field:</span> <span className="font-bold text-slate-800 text-right truncate">{r.name || r.full_name || r.fullName || r.displayName}</span></div>
                                          )}
                                        </div>

                                        <div className="text-[10px] text-slate-500 font-medium">ID: <span className="font-bold text-slate-700">{r.seq_id || r['ID Number'] || 'N/A'}</span></div>
                                        <div className="text-[9px] font-medium text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 whitespace-nowrap overflow-hidden text-ellipsis">{r.school_name || r['School'] || 'Unknown School'}</div>
                                        <div className="text-[9px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 flex-shrink-0" /> {r.created_at ? new Date(r.created_at).toLocaleString() : 'N/A'}</div>
                                      </div>
                                    </label>
                                  );
                                  })}
                                </div>
                              </div>
                            );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-6">
                        <h5 className="font-bold text-rose-600 mb-3 text-xs uppercase flex items-center gap-1.5 bg-rose-50 p-2 rounded-lg"><AlertCircle className="w-4 h-4"/> Shared ID Numbers ({duplicateIds.length} groups)</h5>
                        {duplicateIds.length === 0 ? <p className="text-xs text-slate-500 italic pl-2">No shared ID numbers found.</p> : (
                          <div className="space-y-3">
                            {duplicateIds.map((group, idx) => (
                              <div key={idx} className="border border-rose-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-rose-50 px-3 py-2 border-b border-rose-200 font-bold text-rose-800 text-xs flex justify-between">
                                  <span className="flex items-center gap-1">
                                    ID: {group[0]?.seq_id}
                                    <span title="These entries share the same ID number and may refer to the same student. Please select the correct record to keep.">
                                      <HelpCircle className="w-3 h-3 text-rose-500 cursor-help" />
                                    </span>
                                  </span>
                                  <span className="bg-white px-2 py-0.5 rounded shadow-sm text-[10px]">{group.length} records</span>
                                </div>
                                <div className="p-3 bg-white flex flex-col xl:flex-row gap-3 overflow-x-auto">
                                  {group.map((r: any, i: number) => {
                                    const roleStr = String(r?.role || r?.userRole || r?.accountType || 'Reviewee').toLowerCase().replace(/[\s\-_]/g, '');
                                    const roleWeight = (roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'owner') ? 3 : (roleStr === 'staff' || roleStr === 'coadmin' || roleStr === 'instructor' || roleStr === 'encoder') ? 2 : 1;
                                    const maxGroupWeight = Math.max(...group.map((item: any) => {
                                      const rs = String(item?.role || item?.userRole || item?.accountType || 'Reviewee').toLowerCase().replace(/[\s\-_]/g, '');
                                      return (rs === 'admin' || rs === 'superadmin' || rs === 'owner') ? 3 : (rs === 'staff' || rs === 'coadmin' || rs === 'instructor' || rs === 'encoder') ? 2 : 1;
                                    }));
                                    const isHighestRoleInMixedGroup = roleWeight === maxGroupWeight && group.some((item: any) => {
                                      const rs = String(item?.role || item?.userRole || item?.accountType || 'Reviewee').toLowerCase().replace(/[\s\-_]/g, '');
                                      const w = (rs === 'admin' || rs === 'superadmin' || rs === 'owner') ? 3 : (rs === 'staff' || rs === 'coadmin' || rs === 'instructor' || rs === 'encoder') ? 2 : 1;
                                      return w !== maxGroupWeight;
                                    });

                                    return (
                                    <label key={i} className={`flex-1 border rounded-lg p-3 flex flex-col gap-2 cursor-pointer transition-colors relative min-w-[200px] ${selectionsToKeep[`id_${idx}`]?.includes(r.doc_id) ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300' : 'border-slate-200 hover:border-rose-200'}`}>
                                      <div className="absolute top-3 right-3">
                                        <input
                                          type="radio"
                                          name={`keep_id_${idx}`}
                                          checked={selectionsToKeep[`id_${idx}`]?.includes(r.doc_id)}
                                          onChange={() => {
                                            setSelectionsToKeep(prev => ({ ...prev, [`id_${idx}`]: [r.doc_id] }));
                                            setConfirmResolve(false);
                                          }}
                                          className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-slate-300"
                                        />
                                      </div>
                                      <div className="pt-1 pr-6 space-y-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {roleWeight === 3 && <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wide">Admin</span>}
                                          {roleWeight === 2 && <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wide">Staff</span>}
                                          {roleWeight === 1 && <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">Reviewee</span>}
                                          {isHighestRoleInMixedGroup && (
                                            <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide flex items-center gap-1">
                                              <ShieldCheck className="w-3 h-3 text-emerald-600"/> Higher Role Preserved
                                            </span>
                                          )}
                                        </div>

                                        <div>
                                          <div className="text-xs font-black text-slate-800 capitalize">
                                            {String(r.last_name || r.lastName || r['Last Name'] || '').toLowerCase()}, {String(r.first_name || r.firstName || r['First Name'] || '').toLowerCase()}
                                          </div>
                                        </div>

                                        <div className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
                                          <div className="flex justify-between"><span className="font-semibold text-slate-400">First:</span> <span className="font-bold text-slate-800 capitalize">{r.first_name || r.firstName || r['First Name'] || 'N/A'}</span></div>
                                          <div className="flex justify-between"><span className="font-semibold text-slate-400">Middle:</span> <span className="font-bold text-slate-800 capitalize">{r.middle_name || r.middleName || r['Middle Name'] || <span className="italic text-slate-400">None</span>}</span></div>
                                          <div className="flex justify-between"><span className="font-semibold text-slate-400">Last:</span> <span className="font-bold text-slate-800 capitalize">{r.last_name || r.lastName || r['Last Name'] || 'N/A'}</span></div>
                                        </div>

                                        <div className="text-[9px] font-medium text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 whitespace-nowrap overflow-hidden text-ellipsis">{r.school_name || r['School'] || 'Unknown School'}</div>
                                        <div className="text-[9px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 flex-shrink-0" /> {new Date(r.created_at).toLocaleString()}</div>
                                      </div>
                                    </label>
                                  );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {resolveMessage && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${resolveMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {resolveMessage.text}
                  </div>
                )}

                 <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-4">
                  <div className="text-xs text-slate-500 max-w-[200px] text-left leading-tight">
                    Select the correct records to keep above. Unselected items in those groups will be deleted.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowDuplicates(false);
                        setConfirmResolve(false);
                        setResolveMessage(null);
                      }}
                      className="px-5 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      Cancel
                    </button>
                    {(duplicateIds.length > 0 || similarNames.length > 0) && (
                      <button
                        onClick={handleResolveDuplicates}
                        disabled={resolvingDuplicates}
                        className={`px-5 py-2 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 ${confirmResolve ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {resolvingDuplicates && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                        {confirmResolve ? 'Confirm Delete' : 'Resolve'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-sm">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <button onClick={() => setShowMapping(false)} className="flex items-center gap-1 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase transition-colors">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <div className="text-left">
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">School Mapping</h4>
                  </div>
                </div>

                {/* Mapping saved success banner */}
                <AnimatePresence>
                  {mappingSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-xs">School mapping successfully saved!</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Column 1: Verified School Official Name */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col h-[280px] md:h-[380px]">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Verified Official School</h4>
                        <p className="text-[10px] text-slate-500">Previously added official names</p>
                      </div>
                    </div>

                    {/* Box Search Input */}
                    <div className="relative mt-3">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search verified schools..."
                        value={searchOfficial}
                        onChange={e => setSearchOfficial(e.target.value.toUpperCase())}
                        className="pl-9 pr-3 py-1.5 w-full bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-900 outline-none uppercase"
                      />
                    </div>

                    {/* Scrollable List */}
                    <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {officialNames
                        .filter(name => name.toLowerCase().includes(searchOfficial.toLowerCase()))
                        .map(name => {
                          const isSelected = officialName.toUpperCase() === name.toUpperCase();
                          // find mapped aliases for preview
                          const mappedAliases = Object.entries(mappings)
                            .filter(([alias, off]) => String(off).toUpperCase() === name.toUpperCase())
                            .map(([alias]) => alias);

                          return (
                            <motion.div
                              key={name}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => {
                                setOfficialName(name);
                                setOfficialAbbr(abbreviations[name] || '');
                              }}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="font-bold text-xs truncate uppercase">{name}</div>
                              {mappedAliases.length > 0 && (
                                <div className={`mt-1.5 flex flex-wrap gap-1 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                  {mappedAliases.map(al => (
                                    <span key={al} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/20 border border-slate-300/20 uppercase font-mono">
                                      {al}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      {officialNames.filter(name => name.toLowerCase().includes(searchOfficial.toLowerCase())).length === 0 && (
                        <div className="text-center text-xs text-slate-400 mt-8 py-4">No verified schools map</div>
                      )}
                    </div>
                  </div>


                  {/* Column 2: Register New School Official Name */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col h-[280px] md:h-[380px]">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                      <Edit className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="text-left">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Register New Official</h4>
                        <p className="text-[10px] text-slate-500">Pick raw school or type custom</p>
                      </div>
                    </div>

                    {/* Custom Title Input / Manual input */}
                    <div className="mt-3 space-y-1 text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Input Designated Name</label>
                      <input
                        type="text"
                        placeholder="Type correct Official spelling..."
                        value={officialName}
                        onChange={e => setOfficialName(e.target.value.toUpperCase())}
                        className="p-2 w-full bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none uppercase"
                      />
                    </div>
                    <div className="mt-2 space-y-1 text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Input Abbreviation</label>
                      <input
                        type="text"
                        placeholder="e.g. CKCM"
                        value={officialAbbr}
                        onChange={e => setOfficialAbbr(e.target.value.toUpperCase())}
                        className="p-2 w-full bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none uppercase"
                      />
                    </div>

                    {/* Search Candidates to populate */}
                    <div className="relative mt-3">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </span>
                      <input
                        type="text"
                        placeholder="Filter recent registrations..."
                        value={searchNewOfficial}
                        onChange={e => setSearchNewOfficial(e.target.value.toUpperCase())}
                        className="pl-9 pr-3 py-1.5 w-full bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-900 outline-none uppercase"
                      />
                    </div>

                    {/* Scrollable List for candidate selection */}
                    <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                      {allSchools
                        .filter(s => {
                          const sUpper = s.toUpperCase();
                          const isOfficial = officialNames.some(o => o.toUpperCase() === sUpper);
                          const isMappedKey = Object.keys(mappings).some(k => k.toUpperCase() === sUpper);
                          return !isOfficial && !isMappedKey;
                        })
                        .filter(s => s.toLowerCase().includes(searchNewOfficial.toLowerCase()))
                        .map(s => {
                          const isSelected = officialName.toUpperCase() === s.toUpperCase();
                          return (
                            <motion.div
                              key={s}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => setOfficialName(s)}
                              className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <div className="text-xs truncate uppercase">{s}</div>
                            </motion.div>
                          );
                        })}
                      {allSchools
                        .filter(s => {
                          const sUpper = s.toUpperCase();
                          const isOfficial = officialNames.some(o => o.toUpperCase() === sUpper);
                          const isMappedKey = Object.keys(mappings).some(k => k.toUpperCase() === sUpper);
                          return !isOfficial && !isMappedKey;
                        })
                        .filter(s => s.toLowerCase().includes(searchNewOfficial.toLowerCase())).length === 0 && (
                        <div className="text-center text-xs text-slate-400 mt-8 py-4">No recent unmapped schools</div>
                      )}
                    </div>
                  </div>


                  {/* Column 3: Alias / Unverified School Name */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col h-[280px] md:h-[380px]">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                      <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="text-left">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Unverified Alias Name</h4>
                        <p className="text-[10px] text-slate-500">Pick multiple to correct automatic</p>
                      </div>
                    </div>

                     {/* Search Input */}
                    <div className="relative mt-3">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search raw registrations..."
                        value={searchAlias}
                        onChange={e => setSearchAlias(e.target.value.toUpperCase())}
                        className="pl-9 pr-3 py-1.5 w-full bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-900 outline-none uppercase"
                      />
                    </div>

                    {/* Scrollable checklist of other raw schools */}
                    <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                      {allSchools
                        .filter(s => {
                          const sUpper = s.toUpperCase();
                          const isOfficial = officialNames.some(o => o.toUpperCase() === sUpper);
                          const isMappedKey = Object.keys(mappings).some(k => k.toUpperCase() === sUpper);
                          return !isOfficial && !isMappedKey;
                        })
                        .filter(s => s.toLowerCase().includes(searchAlias.toLowerCase()))
                        .filter(s => s.toUpperCase() !== officialName.toUpperCase()) // Do not show the currently designated official name as its own alias
                        .map(s => {
                          const isSelected = aliases.some(al => al.toUpperCase() === s.toUpperCase());
                          return (
                            <motion.div
                              key={s}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => {
                                // Toggle in aliases list
                                if (isSelected) {
                                  setAliases(aliases.filter(al => al.toUpperCase() !== s.toUpperCase()));
                                } else {
                                  setAliases([...aliases, s]);
                                }
                              }}
                              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-1 ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350'
                              }`}
                            >
                              <div className="text-xs truncate uppercase flex-1">{s}</div>
                              {isSelected ? (
                                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                              ) : (
                                <div className="w-4 h-4 border border-slate-300 rounded-md shrink-0 transition-colors hover:border-slate-400" />
                              )}
                            </motion.div>
                          );
                        })}
                      {allSchools
                        .filter(s => {
                          const sUpper = s.toUpperCase();
                          const isOfficial = officialNames.some(o => o.toUpperCase() === sUpper);
                          const isMappedKey = Object.keys(mappings).some(k => k.toUpperCase() === sUpper);
                          return !isOfficial && !isMappedKey;
                        })
                        .filter(s => s.toLowerCase().includes(searchAlias.toLowerCase()))
                        .filter(s => s.toUpperCase() !== officialName.toUpperCase()).length === 0 && (
                        <div className="text-center text-xs text-slate-400 mt-8 py-4">No unmapped aliases matching</div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Action Banner below columns */}
                <AnimatePresence>
                  {officialName && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15 }}
                      className="mt-6 p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl text-left"
                    >
                      <div className="text-left space-y-1">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Target Official Assignment</div>
                        <div className="text-sm font-extrabold tracking-tight text-white uppercase">{officialName}</div>
                        {aliases.length > 0 && (
                          <div className="text-xs text-slate-300">
                            Will automatically map <span className="font-bold text-white bg-white/15 px-1.5 py-0.5 rounded">{aliases.length} aliases</span>: {aliases.join(', ')}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={saveMapping}
                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-750 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Assign & Save Mappings
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setShowMapping(false)}
                    className="px-5 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    Back to Sync
                  </button>
                </div>
              </div>
            )}
              </div>
            </div>
          </main>
        </div>
      )}
    </AnimatePresence>
    <AnimatePresence>
      {isDeletingScores && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-8 shadow-xl text-center w-72"
          >
            <Loader2 className="mx-auto mb-4 animate-spin text-red-600" size={48} />
            <h2 className="font-bold text-lg">Deleting Scores...</h2>
            <p className="text-sm text-slate-500 mt-2">
              Please wait while records are being removed.
            </p>
            <div className="mt-5 h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5 }}
                className="h-full bg-red-600"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <AnimatePresence>
      {showConfirmDelete && deleteData && (
        <motion.div
           initial={{opacity:0}}
           animate={{opacity:1}}
           exit={{opacity:0}}
           className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4"
        >
          <motion.div
             initial={{scale:0.9, opacity:0}}
             animate={{scale:1, opacity:1}}
             className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm"
          >
             <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Scores</h3>
             <p className="text-slate-600 mb-6 text-sm">
                Are you sure you want to delete all {deleteData.category.toUpperCase()} {deleteData.subject.toUpperCase()} scores? This action cannot be undone.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => { setShowConfirmDelete(false); setDeleteData(null); }}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => executeDelete(deleteData.category, deleteData.subject)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  Delete
                </button>
             </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <AnimatePresence>
      {isResetting && (
        <motion.div
           initial={{opacity:0}}
           animate={{opacity:1}}
           exit={{opacity:0}}
           className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4"
        >
          <motion.div
             initial={{scale:0.8}}
             animate={{scale:1}}
             className="bg-white rounded-2xl p-8 w-72 text-center shadow-xl"
          >
            <Loader2 size={50} className="mx-auto animate-spin text-red-600" />
            <h2 className="font-bold text-lg mt-4">Resetting Data...</h2>
            <p className="text-sm text-gray-500">Please wait while records are removed.</p>
            <div className="mt-5 h-2 bg-gray-200 rounded-full overflow-hidden">
               <motion.div
                  initial={{width:"0%"}}
                  animate={{width:"100%"}}
                  transition={{duration:1.5}}
                  className="h-full bg-red-500"
               />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    {showUnmatchedModal && importReport && (
      <UnmatchedRecordsModal
        isOpen={showUnmatchedModal}
        onClose={() => setShowUnmatchedModal(false)}
        unmatchedEntries={importReport.unmatchedEntries}
        onManualSync={handleManualSync}
        isManualSyncing={isManualSyncing}
        missingUsersForSelectedScore={importReport?.missingUsers || allUsers.filter(u => !u.is_archived)}
      />
    )}
    <AnimatePresence>
      {passConfirmUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-950"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Move to Archive?
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Mark this reviewee as passed
                </p>
              </div>
            </div>

            <p className="mb-5 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
              {`${passConfirmUser?.last_name || ""}, ${passConfirmUser?.first_name || ""}`.trim() || "This reviewee"} already passed. This will move the reviewee to Archived. Other reviewees will remain in the Scores tab.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPassConfirmUser(null)}
                disabled={isPassingReviewee}
                className="h-11 rounded-2xl bg-slate-100 text-sm font-black text-slate-700 transition-all active:scale-95 disabled:opacity-60 dark:bg-white/10 dark:text-slate-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmPassReviewee}
                disabled={isPassingReviewee}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-60"
              >
                {isPassingReviewee ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Moving...
                  </>
                ) : (
                  "Move to Archive"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {unarchiveConfirmUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 animate-fade-in"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            className="w-full max-w-sm rounded-[2rem] bg-[#0B1220] border border-white/10 p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <RefreshCw className="h-5 w-5 animate-spin-slow" />
              </div>

              <div className="min-w-0">
                <h3 className="text-base font-black text-white">
                  Restore Reviewee?
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  Unarchive selected reviewee
                </p>
              </div>
            </div>

            <p className="mb-5 text-sm font-medium leading-6 text-slate-300">
              This will restore {`${unarchiveConfirmUser?.last_name || ""}, ${unarchiveConfirmUser?.first_name || ""}`.trim() || "this reviewee"} from Archive back to the active list.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUnarchiveConfirmUser(null)}
                className="h-11 rounded-2xl bg-white/5 text-sm font-black text-slate-300 hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmUnarchiveReviewee}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-sm font-black text-white transition-all cursor-pointer shadow-lg shadow-amber-500/10"
              >
                Restore
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {manualScoreUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-slate-950"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {manualScoreUser?.scoresByDate?.[`${manualScoreUser.doc_id}_${manualScoreCategory.toLowerCase().replace(/\s+/g, '_')}_${manualScoreDate}`] ? 'Edit Score' : 'Add Manual Score'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {manualScoreUser.last_name}, {manualScoreUser.first_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManualScoreUser(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Category
                </label>
                <AnimatedSelect
                  value={manualScoreCategory}
                  options={[
                    { value: "", label: "Select Category" },
                    ...selectedCategories.map(cat => ({ value: cat, label: cat })),
                    ...(!selectedCategories.includes('CLJ Daily Evaluation') ? [{ value: "CLJ Daily Evaluation", label: "CLJ Daily Evaluation" }] : []),
                    ...(!selectedCategories.includes('LEA Daily Evaluation') ? [{ value: "LEA Daily Evaluation", label: "LEA Daily Evaluation" }] : []),
                    ...(!selectedCategories.includes('CDI Daily Evaluation') ? [{ value: "CDI Daily Evaluation", label: "CDI Daily Evaluation" }] : []),
                    ...(!selectedCategories.includes('FS Daily Evaluation') ? [{ value: "FS Daily Evaluation", label: "FS Daily Evaluation" }] : []),
                    ...(!selectedCategories.includes('CRIM Daily Evaluation') ? [{ value: "CRIM Daily Evaluation", label: "CRIM Daily Evaluation" }] : []),
                    ...(!selectedCategories.includes('CA Daily Evaluation') ? [{ value: "CA Daily Evaluation", label: "CA Daily Evaluation" }] : []),
                  ]}
                  onChange={(val) => setManualScoreCategory(val)}
                  placeholder="Select Category"
                  label="Category"
                  className="w-full"
                  triggerClassName="h-11 rounded-2xl bg-slate-50 border-2 border-slate-100 px-4 text-sm font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Evaluation Date
                  </label>
                  <input
                    type="date"
                    value={manualScoreDate}
                    onChange={(e) => setManualScoreDate(e.target.value)}
                    className="w-full h-11 rounded-2xl bg-slate-50 border-2 border-slate-100 px-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-0 transition-all outline-none dark:bg-white/5 dark:border-white/10 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Score
                  </label>
                  <input
                    type="number"
                    value={manualScoreValue}
                    onChange={(e) => setManualScoreValue(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-full h-11 rounded-2xl bg-slate-50 border-2 border-slate-100 px-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-0 transition-all outline-none dark:bg-white/5 dark:border-white/10 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Remarks (Optional)
                </label>
                <textarea
                  value={manualScoreRemarks}
                  onChange={(e) => setManualScoreRemarks(e.target.value)}
                  placeholder="Reason for manual entry..."
                  rows={2}
                  className="w-full rounded-2xl bg-slate-50 border-2 border-slate-100 p-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-0 transition-all outline-none dark:bg-white/5 dark:border-white/10 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setManualScoreUser(null)}
                disabled={isSavingManualScore}
                className="flex-1 h-12 rounded-2xl bg-slate-100 text-sm font-black text-slate-700 transition-all active:scale-95 disabled:opacity-60 dark:bg-white/10 dark:text-slate-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveManualScore}
                disabled={isSavingManualScore}
                className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-blue-500/20"
              >
                {isSavingManualScore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Score"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Manual Score Edit Modal */}
    <AnimatePresence>
      {showManualEditModal && editingScoreData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10005] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-white rounded-xl shadow-2xl p-5 sm:p-6 w-full max-w-sm mx-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                {editingScoreData.currentScore !== null ? "Edit Score" : "Add Missing Score"}
              </h3>
              <button
                onClick={() => setShowManualEditModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={savingManualScore}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Reviewee</div>
                <div className="font-semibold text-slate-700">
                  {editingScoreData.reviewee.first_name || ""} {editingScoreData.reviewee.last_name || ""}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                  <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Category</div>
                  <div className="font-semibold text-slate-700 capitalize">{editingScoreData.category}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                  <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Subject</div>
                  <div className="font-semibold text-slate-700 uppercase">{editingScoreData.subject}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Score Value (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={manualScoreInput}
                  onChange={(e) => setManualScoreInput(e.target.value)}
                  disabled={savingManualScore}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-slate-800"
                  placeholder="Enter score..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Reason for Change</span>
                  {editingScoreData.currentScore !== null && (
                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-wide">Required</span>
                  )}
                </label>
                <textarea
                  value={manualScoreReason}
                  onChange={(e) => setManualScoreReason(e.target.value)}
                  disabled={savingManualScore}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[80px]"
                  placeholder="E.g., Medical absence, Late submission, Error correction..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualEditModal(false)}
                  disabled={savingManualScore}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAreaScore}
                  disabled={savingManualScore || manualScoreInput === ""}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingManualScore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Save Score
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {toastMessage && <Toast message={toastMessage.text} type={toastMessage.type} onClose={() => setToastMessage(null)} />}
    </>
  );
};
