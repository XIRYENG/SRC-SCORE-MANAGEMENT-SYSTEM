import React, { useState, useMemo, useEffect } from 'react';
import { getClientDb } from '../utils/firebaseClient';
import { useNotifications } from '../hooks/useNotifications';
import { getDisplayIdNumber } from '../utils/idResolver';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  RefreshCw, 
  BarChart3, 
  Archive, 
  PlusCircle, 
  Layers, 
  Settings, 
  LineChart,
  UserCheck,
  Award,
  FileSpreadsheet,
  FileText,
  UploadCloud,
  LayoutDashboard,
  ArrowRight,
  ClipboardList,
  Target,
  CheckCircle2,
  Clock,
  History,
  Edit3,
  User,
  Bell,
  Menu,
  ChevronDown,
  Check,
  Search,
  HelpCircle,
  Info
} from 'lucide-react';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import { useScoreFolders } from '../hooks/useScoreFolders';
import { isRevieweeInFolderScope, formatFolderType } from '../utils/folderScope';
import type { RevieweeData } from '../types';
import { getUserRole } from '../utils/roleUtils';
import { isValidRevieweeRecord } from '../services/userIdentityResolver';
import { PortalLayout } from './PortalLayout';
import { AreaProgressCard, ScoreTrend } from './DashboardShared';
import { StatCard, ActivityFeed, QuickActionsGrid, SimpleTable, SectionHeader } from './DashboardKit';
import { aggregateAreaScores } from '../utils/aggregateAreaScores';
import { ProfileDashboard } from './ProfileDashboard';
import { AllUsersDirectory } from './AllUsersDirectory';
import { EditUserModal } from './EditUserModal';
import { clientUpdateUser } from '../utils/firebaseClient';
import { SyncModal } from './SyncModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_GRADE_WEIGHTS, GradeWeights, SubjectArea, GRADE_CATEGORY_LABELS, GradeCategoryKey } from '../utils/gradeCalculation';
import { calculateAreaDashboardData, calculateRevieweeArea } from '../utils/calculateRevieweeArea';
import { calculateRevieweeCombinedRatings, RevieweeCombinedRatings, CombineMethod, calculateAggregateCombinedBreakdown } from '../utils/combinedCalculation';
import { getResolvedScore } from '../utils/scoreFieldResolver';
import { AlertTriangle } from 'lucide-react';
import { BoardSubjectAreasSection } from './BoardSubjectAreasSection';
import { AreaPerformanceModal } from './performance/AreaPerformanceModal';
import { ScoreManagementWrapper } from './admin/ScoreManagementWrapper';

const STAFF_MENU_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "profile", label: "My Profile", icon: <User size={18} /> },
  { key: "users", label: "All Users", icon: <Users size={18} /> },
  { key: "upload-scores", label: "Score Management", icon: <BarChart3 size={18} /> },
  { key: "manual-score", label: "Manual Entry", icon: <Edit3 size={18} /> },
  { key: "reports", label: "Reports", icon: <FileText size={18} /> },
  { key: "reviewees", label: "Reviewees", icon: <Users size={18} /> },
  { key: "categories", label: "Categories", icon: <Layers size={18} /> },
  { key: "leaderboard", label: "Leaderboard", icon: <Award size={18} /> },
];

const FOOTER_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "reviewees", label: "Reviewees", icon: <Users size={18} /> },
  { key: "upload-scores", label: "Scores", icon: <BarChart3 size={18} /> },
  { key: "notifications", label: "Notifications", icon: <Bell size={18} /> },
  { key: "profile", label: "Profile", icon: <User size={18} /> },
  { key: "menu", label: "Menu", icon: <Menu size={18} /> },
];

interface StaffPortalProps {
  data: RevieweeData;
  onLogout: () => void;
  onOpenSyncModal: (section?: 'main' | 'search' | 'duplicates' | 'mapping', tab?: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity', folderId?: string) => void;
  syncProps?: any;
}

export function StaffPortal({ data, onLogout, onOpenSyncModal, syncProps }: StaffPortalProps) {
  const db = getClientDb();
  const { notifications } = useNotifications(db!, data.uid);
  const { allUsers, loading } = useFirestoreUsers();
  const [userData, setUserData] = useState(data);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const normalizedPath = decodeURIComponent(window.location.pathname).toLowerCase();
    if (normalizedPath.includes('/staff/allusers') || normalizedPath.includes('/users')) {
      return 'users';
    }
    if (normalizedPath.includes('/staff/reviewees') || normalizedPath.includes('/reviewees')) {
      return 'reviewees';
    }
    if (normalizedPath.includes('/staff/upload-scores/csv')) {
      return 'import-scores-tab';
    }
    if (normalizedPath.includes('/staff/upload-scores') || normalizedPath.includes('/upload-scores')) {
      return 'upload-scores';
    }
    if (normalizedPath.includes('/staff/manual-score') || normalizedPath.includes('/manual-score')) {
      return 'manual-score';
    }
    if (normalizedPath.includes('/staff/reports') || normalizedPath.includes('/reports')) {
      return 'reports';
    }
    if (normalizedPath.includes('/staff/profile')) {
      return 'profile';
    }
    if (normalizedPath.includes('/staff/categories') || normalizedPath.includes('/categories')) {
      return 'categories';
    }
    if (normalizedPath.includes('/staff/leaderboard') || normalizedPath.includes('/leaderboard')) {
      return 'leaderboard';
    }
    return 'dashboard';
  });

  const staffMenuItems = useMemo(() => STAFF_MENU_ITEMS, []);

  const fullName = `${data.first_name || ''} ${data.middle_name ? data.middle_name + ' ' : ''}${data.last_name || ''}`.trim() || 'Staff Member';
  const { folders: rawScoreFolders } = useScoreFolders();
  const allScoreFolders = useMemo(() => {
    return rawScoreFolders.filter(f => f.publicationStatus !== 'hidden');
  }, [rawScoreFolders]);
  const [dashboardFolderId, setDashboardFolderId] = useState<string>(() => {
    return localStorage.getItem('staff_dashboard_folder_id') || 'all';
  });

  // Validate dashboardFolderId against available folders
  useEffect(() => {
    if (dashboardFolderId !== 'all' && allScoreFolders.length > 0) {
      const exists = allScoreFolders.some(f => f.id === dashboardFolderId);
      if (!exists) {
        setDashboardFolderId('all');
      }
    }
  }, [dashboardFolderId, allScoreFolders]);
  const [dashboardMode, setDashboardMode] = useState<'single' | 'combined'>(() => {
    return (localStorage.getItem('staff_dashboard_mode') as 'single' | 'combined') || 'single';
  });
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('staff_selected_folder_ids');
    return saved ? JSON.parse(saved) : [];
  });

  // Validate selectedFolderIds
  useEffect(() => {
    if (selectedFolderIds.length > 0 && allScoreFolders.length > 0) {
      const validIds = selectedFolderIds.filter(id => allScoreFolders.some(f => f.id === id));
      if (validIds.length !== selectedFolderIds.length) {
        setSelectedFolderIds(validIds);
      }
    }
  }, [selectedFolderIds, allScoreFolders]);
  const [combineMethod, setCombineMethod] = useState<CombineMethod>('combined_scores');
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [isRuleDropdownOpen, setIsRuleDropdownOpen] = useState(false);
  const [isSingleFolderDropdownOpen, setIsSingleFolderDropdownOpen] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem('staff_dashboard_folder_id', dashboardFolderId);
    localStorage.setItem('staff_dashboard_mode', dashboardMode);
    localStorage.setItem('staff_selected_folder_ids', JSON.stringify(selectedFolderIds));
  }, [dashboardFolderId, dashboardMode, selectedFolderIds]);

  const activeDashboardFolder = useMemo(() => {
    if (dashboardMode === 'combined' || !dashboardFolderId || dashboardFolderId === 'all') return null;
    return allScoreFolders.find(f => f.id === dashboardFolderId) || null;
  }, [dashboardFolderId, allScoreFolders, dashboardMode]);

  const activeCombinedFolders = useMemo(() => {
    if (dashboardMode !== 'combined') return [];
    return allScoreFolders.filter(f => selectedFolderIds.includes(f.id));
  }, [allScoreFolders, selectedFolderIds, dashboardMode]);

  const reviewees = useMemo(() => {
    const base = allUsers.filter((u) => getUserRole(u) === "Reviewee" && isValidRevieweeRecord(u));
    
    if (dashboardMode === 'combined') {
      if (selectedFolderIds.length === 0) return [];
      return base.filter(u => activeCombinedFolders.some(f => isRevieweeInFolderScope(u, f)));
    }

    if (!activeDashboardFolder) return base;
    return base.filter(u => isRevieweeInFolderScope(u, activeDashboardFolder));
  }, [allUsers, activeDashboardFolder, activeCombinedFolders, dashboardMode, selectedFolderIds]);

  const totalReviewees = reviewees.length;

  const [gradeWeights, setGradeWeights] = useState<GradeWeights>(DEFAULT_GRADE_WEIGHTS);
  const [noScoreHandling, setNoScoreHandling] = useState<'include' | 'exclude'>('include');
  const [selectedSubjectBreakdown, setSelectedSubjectBreakdown] = useState<{
    subject: string;
    areaCode?: string;
    revieweeName?: string;
    breakdown: any[];
    totalPercentage: number;
    totalEarned: number;
    totalPossible: number;
  } | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      doc(db, "system_settings", "grade_calculation"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && data.weights) {
            setGradeWeights(data.weights);
          }
          if (data && data.noScoreHandling) {
            setNoScoreHandling(data.noScoreHandling);
          }
        }
      },
      (err) => console.error("Error listening to grade weights:", err)
    );
    return () => unsub();
  }, [db]);

  const [localScoreFolderId, setLocalScoreFolderId] = useState<string | undefined>(undefined);

  const handleAreaCardClick = (subjectLabel: string, subjectKey: SubjectArea) => {
    let breakdown: any[] = [];
    let totalPercentage = 0;

    if (dashboardMode === 'combined' && selectedFolderIds.length > 0) {
      const folders = allScoreFolders.filter(f => selectedFolderIds.includes(f.id));
      const result = calculateAggregateCombinedBreakdown(reviewees, folders, gradeWeights, subjectKey, noScoreHandling);
      breakdown = result.breakdown;
      totalPercentage = result.totalPercentage;
    } else {
      const folderId = dashboardMode === 'single' && dashboardFolderId !== 'all' ? dashboardFolderId : undefined;
      const categories: GradeCategoryKey[] = ["preboard", "pretest", "posttest", "quiz", "dailyEvaluation", "removal", "diagnostic"];
      breakdown = categories.map(cat => {
        const validScores = reviewees.map(r => getResolvedScore(r, cat, subjectKey, folderId)).filter(s => s !== null && s !== undefined) as number[];
        
        let avgScore = 0;
        if (noScoreHandling === 'exclude') {
           avgScore = validScores.length > 0 ? (validScores.reduce((sum, v) => sum + v, 0) / validScores.length) : 0;
        } else {
           const allScores = reviewees.map(r => getResolvedScore(r, cat, subjectKey, folderId) ?? 0);
           avgScore = allScores.length > 0 ? (allScores.reduce((sum, v) => sum + v, 0) / allScores.length) : 0;
        }
        
        const weight = gradeWeights[cat] ?? 0;
        const contribution = avgScore * (weight / 100);
        return {
          category: cat,
          label: GRADE_CATEGORY_LABELS[cat],
          score: avgScore,
          weight,
          contribution
        };
      });
      totalPercentage = breakdown.reduce((sum, item) => sum + item.contribution, 0);
    }

    setSelectedSubjectBreakdown({
      subject: subjectLabel,
      areaCode: subjectKey,
      revieweeName: undefined,
      breakdown,
      totalPercentage,
      totalEarned: 0,
      totalPossible: 0,
    });
  };

  const areaTitleMap: Record<string, string> = {
    "CLJ": "Criminal Law and Jurisprudence",
    "LEA": "Law Enforcement Administration",
    "CDI": "Crime Detection and Investigation",
    "FS": "Forensic Science",
    "CRIM": "Criminology",
    "CA": "Correctional Administration",
  };

  const areaScores = useMemo(() => {
    const MAJOR_AREA_WEIGHTS: Record<string, number> = {
      clj: 20,
      lea: 20,
      cdi: 15,
      fs: 20,
      crim: 15,
      ca: 10,
      "cor-ad": 10,
    };

    const subjects: { key: SubjectArea; label: string }[] = [
      { key: "clj", label: "CLJ" },
      { key: "lea", label: "LEA" },
      { key: "cdi", label: "CDI" },
      { key: "fs", label: "FS" },
      { key: "crim", label: "CRIM" },
      { key: "ca", label: "CA" },
    ];

    return subjects.map(subj => {
      let percent = 0;
      if (dashboardMode === 'combined' && activeCombinedFolders.length > 0) {
        const rawRatings = reviewees.map(r => 
          calculateRevieweeCombinedRatings(r, activeCombinedFolders, gradeWeights, combineMethod, noScoreHandling, reviewees).subjects[subj.key]
        );
        const validRatings = rawRatings.filter(r => r !== null) as number[];
        
        if (noScoreHandling === 'exclude') {
          percent = validRatings.length > 0 
            ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length
            : 0;
        } else {
          const allRatings = rawRatings.map(r => r ?? 0);
          percent = allRatings.length > 0 
            ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
            : 0;
        }
      } else {
        const folderId = dashboardMode === 'single' && dashboardFolderId !== 'all' ? dashboardFolderId : undefined;
        const result = calculateAreaDashboardData(reviewees, subj.key, gradeWeights, noScoreHandling, folderId, allScoreFolders);
        percent = result.percentage;
      }
      
      const weight = MAJOR_AREA_WEIGHTS[subj.key] || 20;
      const overallContribution = percent * (weight / 100);
      return {
        key: subj.key,
        area: subj.label,
        title: areaTitleMap[subj.label] || subj.label,
        percent,
        weight,
        overallContribution,
        count: reviewees.length
      };
    });
  }, [reviewees, gradeWeights, dashboardMode, activeCombinedFolders, combineMethod, allScoreFolders]);

  const handleTabSelect = React.useCallback((tabKey: string) => {
    setSelectedSubjectBreakdown(null);
    setActiveTab(tabKey);
    let url = '/staff/dashboard';
    if (tabKey === 'users') {
      url = '/staff/allusers';
    } else if (tabKey === 'reviewees') {
      url = '/staff/reviewees';
    } else if (tabKey === 'upload-scores') {
      url = '/staff/upload-scores';
    } else if (tabKey === 'import-scores-tab') {
      url = '/staff/upload-scores/csv';
    } else if (tabKey === 'manual-score') {
      url = '/staff/manual-score';
    } else if (tabKey === 'reports') {
      url = '/staff/reports';
    } else if (tabKey === 'profile') {
      url = '/staff/profile';
    } else if (tabKey === 'categories') {
      url = '/staff/categories';
    } else if (tabKey === 'leaderboard') {
      url = '/staff/leaderboard';
    } else if (tabKey === 'dashboard') {
      url = '/staff/dashboard';
    }
    window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const todayTasks = [
    { id: '1', title: 'Upload Scores: IA_MockExam4.xlsx', meta: 'Mock Exam 4 • 89 Reviewees', tag: 'High', tone: 'rose' as const, icon: <UploadCloud size={16} /> },
    { id: '2', title: 'Encode Scores: Weekly Assessment 8', meta: 'Weekly Assessment • 67 Reviewees', tag: 'Medium', tone: 'amber' as const, icon: <Edit3 size={16} /> },
    { id: '3', title: 'Data Validation: Daily Evaluation 18', meta: 'Daily Evaluation • 52 Reviewees', tag: 'Medium', tone: 'amber' as const, icon: <CheckCircle2 size={16} /> },
    { id: '4', title: 'Final Check: Final Coaching', meta: 'Final Coaching • 31 Reviewees', tag: 'Low', tone: 'emerald' as const, icon: <History size={16} /> },
  ];

  const recentReviewees = reviewees.slice(0, 5).map(u => ({
    id: u.doc_id || u.seqId,
    seqId: u.seqId || '—',
    name: `${u.first_name || ''} ${u.middle_name ? u.middle_name + ' ' : ''}${u.last_name || ''}`.trim(),
    evaluation: 'Mock Exam 4',
    area: 'CLJ',
    score: '94%',
    status: 'Encoded'
  }));

  const getSyncModalProps = () => {
    let section = 'search';
    let tab = 'details';
    if (activeTab === 'reviewees') { tab = 'details'; }
    if (activeTab === 'manual-score' || activeTab === 'upload-scores') { tab = 'scores'; }
    if (activeTab === 'import-scores-tab') { tab = 'import_scores'; }
    if (activeTab === 'categories') { tab = 'details'; }
    if (activeTab === 'leaderboard') { tab = 'leaderboard'; }
    if (activeTab === 'reports') { tab = 'details'; }
    if (activeTab === 'profile') { section = 'main'; }
    
    return { initialSection: section as any, initialTab: tab as any };
  };

  return (
    <PortalLayout
      title="Staff Portal"
      subtitle={`Welcome back, ${fullName}! 👋`}
      role="Staff"
      roleDetail={fullName}
      activeTab={activeTab}
      onTabChange={handleTabSelect}
      navItems={staffMenuItems}
      footerItems={FOOTER_ITEMS}
      onLogout={onLogout}
      notificationCount={notifications.filter(n => !n.isRead).length}
      notifications={notifications}
      idNumber={getDisplayIdNumber("Staff", data)}
      photoURL={userData?.photo_url || userData?.photoUrl}
      db={db!}
    >
      <div className={activeTab === 'dashboard' ? "space-y-6" : "hidden"}>
          {/* Score Folder Scope Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                  <Layers size={20} className="text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Dashboard Score Context</span>
                  <span className="text-[11px] text-slate-400">Filter calculations by specific folders or combine multiple phases</span>
                </div>
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setDashboardMode('single')}
                  className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-tight rounded-lg transition-all ${
                    dashboardMode === 'single'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Single Folder
                </button>
                <button
                  onClick={() => setDashboardMode('combined')}
                  className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-tight rounded-lg transition-all ${
                    dashboardMode === 'combined'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Combined Folders
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 relative z-10">
              {/* Click-away overlay */}
              {(isFolderDropdownOpen || isRuleDropdownOpen || isSingleFolderDropdownOpen) && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => {
                    setIsFolderDropdownOpen(false);
                    setIsRuleDropdownOpen(false);
                    setIsSingleFolderDropdownOpen(false);
                  }} 
                />
              )}

              {dashboardMode === 'single' ? (
                <div className="flex items-center gap-3 relative z-50">
                  <div className="relative w-full max-w-md">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSingleFolderDropdownOpen(!isSingleFolderDropdownOpen);
                      }}
                      className="w-full h-11 px-4 bg-white border border-slate-200 text-slate-800 rounded-xl flex items-center justify-between cursor-pointer focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-sm font-bold text-slate-800 truncate">
                          {dashboardFolderId === 'all' ? '📂 All Folders (Pooled Analytics)' : (
                          <>📁 {activeDashboardFolder?.name} {(activeDashboardFolder?.folderType ?? activeDashboardFolder?.type) ? `(${formatFolderType(activeDashboardFolder.folderType ?? activeDashboardFolder.type)})` : ''}</>
                          )}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isSingleFolderDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {isSingleFolderDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden left-0"
                        >
                          <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search folders..."
                                value={folderSearchQuery}
                                onChange={(e) => setFolderSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                          <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                            {'all folders (pooled analytics)'.includes(folderSearchQuery.toLowerCase()) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDashboardFolderId('all');
                                  setIsSingleFolderDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-left ${
                                  dashboardFolderId === 'all' ? 'bg-teal-50/50 hover:bg-teal-50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <span className="text-xs font-bold text-slate-800">📂 All Folders (Pooled Analytics)</span>
                                {dashboardFolderId === 'all' && <Check className="w-4 h-4 text-teal-600" />}
                              </button>
                            )}
                            {allScoreFolders
                              .filter(f => !f.isArchived)
                              .filter(f => f.name.toLowerCase().includes(folderSearchQuery.toLowerCase()))
                              .map(folder => (
                                <button
                                  key={folder.id}
                                  type="button"
                                  onClick={() => {
                                    setDashboardFolderId(folder.id);
                                    setIsSingleFolderDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-left ${
                                    dashboardFolderId === folder.id ? 'bg-teal-50/50 hover:bg-teal-50' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs font-bold text-slate-800 truncate">📁 {folder.name}</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-black">{formatFolderType(folder.folderType ?? folder.type)}</span>
                                  </div>
                                  {dashboardFolderId === folder.id && <Check className="w-4 h-4 text-teal-600" />}
                                </button>
                              ))}
                            {allScoreFolders.filter(f => !f.isArchived && f.name.toLowerCase().includes(folderSearchQuery.toLowerCase())).length === 0 && !('all folders (pooled analytics)'.includes(folderSearchQuery.toLowerCase())) && (
                              <div className="px-3 py-6 text-center text-sm font-medium text-slate-500">
                                No folders found
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {activeDashboardFolder && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-100 text-[10px] font-black text-teal-700 uppercase">
                      Active: {activeDashboardFolder.name}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {allScoreFolders.filter(f => !f.isArchived).map(folder => (
                      <label 
                        key={folder.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedFolderIds.includes(folder.id)
                            ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-800'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={selectedFolderIds.includes(folder.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFolderIds(prev => [...prev, folder.id]);
                            } else {
                              setSelectedFolderIds(prev => prev.filter(id => id !== folder.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{folder.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-black">{formatFolderType(folder.folderType ?? folder.type)}</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {selectedFolderIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-500">Aggregation Rule:</span>
                        <select 
                          value={combineMethod}
                          onChange={(e) => setCombineMethod(e.target.value as CombineMethod)}
                          className="text-[10px] font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 outline-none"
                        >
                          <option value="combined_scores">Combined Earned & Possible (Weighted Volume)</option>
                          <option value="equal_folder_average">Equal Folder Average</option>
                        </select>
                      </div>
                      <div className="text-[10px] font-black text-teal-700 dark:text-teal-400 ml-auto">
                        {reviewees.length} Unique Reviewees Identified
                      </div>
                    </div>
                  )}

                  {selectedFolderIds.length < 2 && (
                    <p className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                      <AlertTriangle size={12} /> Select at least two folders to enable combined analytics.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Pending Uploads"
            value="8"
            icon={<UploadCloud size={18} />}
            tone="blue"
            subtitle="Files waiting to be encoded"
          />
          <StatCard
            label="Scores Encoded Today"
            value="126"
            icon={<Edit3 size={18} />}
            tone="emerald"
            subtitle="+18% vs yesterday"
          />
          <StatCard
            label="Reviewees Assigned"
            value={totalReviewees.toString()}
            icon={<Users size={18} />}
            tone="sky"
            subtitle="Across all evaluators"
          />
          <StatCard
            label="Accuracy Rate"
            value="95.42%"
            icon={<Target size={18} />}
            tone="teal"
            subtitle="+2.31% vs yesterday"
          />
        </div>

        {/* Middle Row: Tasks and Area Scores */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Today's Tasks */}
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader title="Today's Tasks" onViewAll={() => {}} />
            <div className="space-y-4">
              {todayTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between rounded-2xl border border-slate-50 bg-slate-50/50 p-4 transition-all hover:bg-white hover:shadow-md">
                   <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm text-slate-400`}>
                         {task.icon}
                      </div>
                      <div>
                         <p className="text-sm font-black text-slate-900">{task.title}</p>
                         <p className="text-xs font-semibold text-slate-500">{task.meta}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                        task.tag === 'High' ? 'bg-rose-50 text-rose-600' : 
                        task.tag === 'Medium' ? 'bg-amber-50 text-amber-600' : 
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {task.tag}
                      </span>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">Due 10:00 AM</p>
                   </div>
                </div>
              ))}
            </div>
          </section>

          {/* Scores by Area */}
          <BoardSubjectAreasSection
            areas={areaScores.slice(0, 6).map((item) => ({
              key: item.area,
              area: item.area,
              title: item.title,
              percent: item.percent,
              count: item.count,
              onClick: () => handleAreaCardClick(item.area, item.key as SubjectArea),
            }))}
            onViewAll={() => handleTabSelect('leaderboard')}
          />
        </div>

        {/* Manual Score Entry & Recent Reviewees */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
           <section className="xl:col-span-2 space-y-4">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                 <h3 className="mb-4 text-sm font-black text-slate-900 flex items-center gap-2">
                    <Edit3 size={18} className="text-[#007C89]" /> Manual Score Entry
                 </h3>
                 <p className="text-xs text-slate-500 mb-6">Encode scores directly for a reviewee.</p>
                 
                 <div className="space-y-4">
                    <button className="w-full rounded-2xl bg-[#007C89] py-4 text-sm font-black text-white shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2">
                       <PlusCircle size={18} /> New Manual Entry
                    </button>
                    <button className="w-full rounded-2xl border border-slate-200 py-4 text-sm font-black text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                       <RefreshCw size={18} /> Continue Last Entry
                    </button>
                 </div>
              </div>
           </section>

           <section className="xl:col-span-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <SectionHeader title="Recent Reviewees" onViewAll={() => handleTabSelect('reviewees')} />
              <SimpleTable 
                rows={recentReviewees}
                columns={[
                  { key: 'seqId', header: 'Reviewee ID', render: (r) => <span className="text-xs font-bold text-slate-500 uppercase">{r.seqId}</span> },
                  { key: 'name', header: 'Reviewee Name', render: (r) => <span className="text-sm font-black text-slate-900">{r.name}</span> },
                  { key: 'area', header: 'Area', render: (r) => <span className="text-xs font-black text-[#007C89]">{r.area}</span> },
                  { key: 'score', header: 'Score', render: (r) => <span className="text-sm font-black text-slate-900">{r.score}</span> },
                  { key: 'status', header: 'Status', render: (r) => <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600 uppercase">{r.status}</span> },
                ]}
              />
           </section>
        </div>

        {/* Activity Feed and Quick Actions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
           <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <SectionHeader title="Recent Activity" onViewAll={() => {}} />
              <ActivityFeed 
                items={[
                  { id: '1', title: 'You uploaded Mock Exam 4.xlsx', meta: '89 reviewees • May 20, 2025 9:15 AM', tag: 'Upload', tone: 'emerald', icon: <UploadCloud size={16} /> },
                  { id: '2', title: 'You encoded scores for Weekly Assessment 7', meta: 'May 20, 2025 8:42 AM', tag: 'System', tone: 'blue', icon: <Edit3 size={16} /> },
                  { id: '3', title: 'You validated Daily Evaluation 18', meta: 'May 19, 2025 11:03 PM', tag: 'Validation', tone: 'emerald', icon: <CheckCircle2 size={16} /> },
                ]}
              />
           </section>

           <section className="space-y-4">
              <h3 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Tools</h3>
              <QuickActionsGrid 
                actions={[
                  { key: 'sync', label: 'Sync Sheets', icon: <RefreshCw size={18} />, onClick: () => handleTabSelect('profile') },
                  { key: 'reports', label: 'Reports', icon: <FileText size={18} />, onClick: () => handleTabSelect('reports') },
                  { key: 'upload', label: 'Batch Upload', icon: <UploadCloud size={18} />, onClick: () => handleTabSelect('upload-scores') },
                  { key: 'settings', label: 'Profile', icon: <Settings size={18} />, onClick: () => handleTabSelect('profile') },
                ]}
              />
           </section>
        </div>
        </div>
      {activeTab === 'users' && (
        <AllUsersDirectory users={allUsers} loading={loading} onEditUser={(u) => setEditingUser(u)} />
      )}

      {editingUser && (
        <EditUserModal 
          user={editingUser} 
          currentUserRole={getUserRole(userData)}
          isOpen={!!editingUser} 
          onClose={() => setEditingUser(null)} 
          onSave={async (updatedUser) => {
            try {
              if (editingUser.role === 'Admin' || editingUser.role === 'Staff') {
                alert("Staff users are only authorized to edit Reviewee accounts.");
                return;
              }
              const docId = updatedUser.uid || updatedUser.doc_id;
              if (docId) {
                await clientUpdateUser(docId, {
                  first_name: updatedUser.firstName,
                  firstName: updatedUser.firstName,
                  middle_name: updatedUser.middleName,
                  middleName: updatedUser.middleName,
                  last_name: updatedUser.lastName,
                  lastName: updatedUser.lastName,
                  email: updatedUser.email,
                  role: updatedUser.role,
                  seq_id: updatedUser.seqId,
                  seqId: updatedUser.seqId,
                  id_number: updatedUser.seqId,
                  idNumber: updatedUser.seqId,
                  srcId: updatedUser.seqId,
                  studentId: updatedUser.seqId,
                  school_name: updatedUser.schoolName,
                  schoolName: updatedUser.schoolName,
                  school: updatedUser.schoolName,
                  review_branch: updatedUser.reviewBranch,
                  reviewBranch: updatedUser.reviewBranch,
                  branch: updatedUser.reviewBranch,
                });
                alert("Reviewee account updated successfully!");
              }
            } catch (error) {
              console.error("Failed to update user:", error);
              alert("Failed to update user.");
            }
          }}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileDashboard currentUser={userData} onUpdate={setUserData} />
      )}

      {activeTab === 'upload-scores' && (
        <ScoreManagementWrapper 
          onOpenSyncModal={(section, tab, folderId) => {
            if (tab === 'import_scores') {
              if (folderId) {
                setLocalScoreFolderId(folderId);
              }
              handleTabSelect('import-scores-tab');
            } else {
              onOpenSyncModal(section, tab, folderId);
            }
          }}
          currentUser={userData}
        />
      )}

      <div className={activeTab !== 'dashboard' && activeTab !== 'profile' && activeTab !== 'users' && activeTab !== 'upload-scores' && activeTab !== 'import-scores-tab' ? "block" : "hidden"}>
        <SyncModal 
          {...(syncProps || {})} 
          isOpen={true} 
          embeddedMode={true} 
          scoreFolderId={localScoreFolderId || syncProps?.scoreFolderId}
          initialSection={getSyncModalProps().initialSection} 
          initialTab={getSyncModalProps().initialTab} 
          onSubTabChange={(tab) => {
            if (tab === 'details') setActiveTab('reviewees');
            else if (tab === 'scores') setActiveTab('upload-scores');
            else if (tab === 'import_scores') setActiveTab('import-scores-tab');
            else if (tab === 'leaderboard') setActiveTab('leaderboard');
          }}
          onSectionChange={(section) => {
            if (section === 'main') setActiveTab('profile');
          }}
        />
      </div>

      {selectedSubjectBreakdown && (
        <AreaPerformanceModal
          isOpen={!!selectedSubjectBreakdown}
          onClose={() => setSelectedSubjectBreakdown(null)}
          areaTitle={selectedSubjectBreakdown.subject}
          areaCode={selectedSubjectBreakdown.areaCode || selectedSubjectBreakdown.subject}
          revieweeLabel={selectedSubjectBreakdown.revieweeName}
          breakdown={selectedSubjectBreakdown.breakdown}
          totalPercentage={selectedSubjectBreakdown.totalPercentage}
          totalEarned={selectedSubjectBreakdown.totalEarned}
          totalPossible={selectedSubjectBreakdown.totalPossible}
          reviewees={reviewees}
          gradeWeights={gradeWeights}
          selectedFolders={dashboardMode === 'combined' ? activeCombinedFolders : (activeDashboardFolder ? [activeDashboardFolder] : [])}
        />
      )}
    </PortalLayout>
  );
}
