import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getClientDb } from '../utils/firebaseClient';
import { fetchWithFirebaseAuth } from '../utils/auth';
import { useNotifications } from '../hooks/useNotifications';
import { getDisplayIdNumber } from '../utils/idResolver';
import { formatFolderType } from '../utils/folderScope';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Users, 
  RefreshCw, 
  BarChart3, 
  History, 
  Archive, 
  PlusCircle, 
  Layers, 
  Settings, 
  LineChart,
  ShieldCheck,
  UserCheck,
  Award,
  FileSpreadsheet,
  FileText,
  UploadCloud,
  LayoutDashboard,
  ArrowRight,
  User,
  Sliders,
  Bug,
  Bell,
  Menu,
  AlertTriangle,
  ChevronDown,
  Check,
  Search,
  HelpCircle,
  Info
} from 'lucide-react';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import { useScoreFolders } from '../hooks/useScoreFolders';
import { isRevieweeInFolderScope } from '../utils/folderScope';
import { canViewActivityLog, isAdmin, getUserRole } from '../utils/roleUtils';
import { isValidUserRecord, formatFormalName } from '../services/userIdentityResolver';
import { aggregateAreaScores, buildOverallTrend } from '../utils/aggregateAreaScores';
import type { RevieweeData } from '../types';
import { PortalLayout } from './PortalLayout';
import { AreaProgressCard, ScoreTrend } from './DashboardShared';
import { StatCard, ActivityFeed, QuickActionsGrid, SimpleTable, type ActivityItem } from './DashboardKit';
import { ProfileDashboard } from './ProfileDashboard';
import { AllUsersDirectory } from './AllUsersDirectory';
import { SyncModal } from './SyncModal';
import { EditUserModal } from './EditUserModal';
import { DeleteUserModal } from './DeleteUserModal';
import { ConfirmActionModal } from './ConfirmActionModal';
import { FirebaseDiagnosticPanel } from './FirebaseDiagnosticPanel';
import { Toast } from './Toast';
import { clientUpdateUser, clientDeleteUser } from '../utils/firebaseClient';
import { doc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_GRADE_WEIGHTS, GradeWeights, SubjectArea, GRADE_CATEGORY_LABELS, GradeCategoryKey } from '../utils/gradeCalculation';
import { calculateAreaDashboardData, calculateRevieweeArea } from '../utils/calculateRevieweeArea';
import { calculateRevieweeCombinedRatings, RevieweeCombinedRatings, CombineMethod, calculateAggregateCombinedBreakdown } from '../utils/combinedCalculation';
import { getResolvedScore } from '../utils/scoreFieldResolver';
import { GradeCalculationSettings } from './GradeCalculationSettings';
import { AreaPerformanceCard } from './performance/AreaPerformanceCard';
import { BoardSubjectAreasSection } from './BoardSubjectAreasSection';
import { AreaPerformanceModal } from './performance/AreaPerformanceModal';
import { AdminSummaryCard } from './admin/AdminSummaryCard';
import { AdminPageHeader } from './admin/AdminPageHeader';
import { ScoreManagementWrapper } from './admin/ScoreManagementWrapper';
const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, adminOnly: false },
  { key: "profile", label: "My Profile", icon: <User size={18} />, adminOnly: false },
  { key: "users", label: "All Users", icon: <Users size={18} />, adminOnly: false },
  { key: "reviewees", label: "Reviewees", icon: <Users size={18} />, adminOnly: false },
  { key: "score-management", label: "Score Management", icon: <BarChart3 size={18} />, adminOnly: false },
  { key: "archives", label: "Archives", icon: <Archive size={18} />, adminOnly: false },
  { key: "leaderboard", label: "Leaderboard", icon: <Award size={18} />, adminOnly: false },
  { key: "mapping", label: "School Mappings", icon: <Layers size={18} />, adminOnly: false },
  { key: "duplicates", label: "Duplicate Resolver", icon: <UserCheck size={18} />, adminOnly: false },
  { key: "audit-log", label: "Audit Log", icon: <ShieldCheck size={18} />, adminOnly: true },
  { key: "grade-calculation", label: "Grade Weights", icon: <Sliders size={18} />, adminOnly: true },
  { key: "settings", label: "Sync & Settings", icon: <Settings size={18} />, adminOnly: false },
];

const FOOTER_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "users", label: "Users", icon: <Users size={18} /> },
  { key: "score-management", label: "Scores", icon: <BarChart3 size={18} /> },
  { key: "notifications", label: "Notifications", icon: <Bell size={18} /> },
  { key: "profile", label: "Profile", icon: <User size={18} /> },
  { key: "menu", label: "Menu", icon: <Menu size={18} /> },
];

interface AdminPortalProps {
  data: RevieweeData;
  onLogout: () => void;
  onOpenSyncModal: (section?: 'main' | 'search' | 'duplicates' | 'mapping', tab?: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity', folderId?: string) => void;
  syncProps?: any;
}

export function AdminPortal({ data, onLogout, onOpenSyncModal, syncProps }: AdminPortalProps) {
  const db = getClientDb();
  const { notifications } = useNotifications(db!, data.uid);
  const { allUsers, loading } = useFirestoreUsers();
  const [userData, setUserData] = useState(data);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [removedDocIds, setRemovedDocIds] = useState<Set<string>>(new Set());
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const normalizedPath = decodeURIComponent(window.location.pathname).toLowerCase();
    if (normalizedPath.includes('/admin/allusers') || normalizedPath.includes('/users')) {
      return 'users';
    }
    if (normalizedPath.includes('/admin/reviewees') || normalizedPath.includes('/search-database/details')) {
      return 'reviewees';
    }
    if (normalizedPath.includes('/admin/upload-scores/csv')) {
      return 'upload-scores';
    }
    if (normalizedPath.includes('/admin/scores') || normalizedPath.includes('/admin/upload-scores') || normalizedPath.includes('/search-database/scores') || normalizedPath.includes('/score-management') || normalizedPath.includes('/upload-scores')) {
      return 'score-management';
    }
    if (normalizedPath.includes('/admin/archives') || normalizedPath.includes('/search-database/archived') || normalizedPath.includes('/archives')) {
      return 'archives';
    }
    if (normalizedPath.includes('/admin/leaderboard') || normalizedPath.includes('/search-database/leaderboard') || normalizedPath.includes('/leaderboard')) {
      return 'leaderboard';
    }
    if (normalizedPath.includes('/admin/school-mapping') || normalizedPath.includes('/school-mapping') || normalizedPath.includes('/mapping')) {
      return 'mapping';
    }
    if (normalizedPath.includes('/admin/duplicates') || normalizedPath.includes('/duplicates')) {
      return 'duplicates';
    }
    if (normalizedPath.includes('/admin/audit-log') || normalizedPath.includes('/search-database/activity') || normalizedPath.includes('/audit-log') || normalizedPath.includes('/activity-log')) {
      return 'audit-log';
    }
    if (normalizedPath.includes('/admin/grade-weights') || normalizedPath.includes('/grade-calculation')) {
      return 'grade-calculation';
    }
    if (normalizedPath.includes('/admin/profile')) {
      return 'profile';
    }
    if (normalizedPath.startsWith('/syncsettings')) {
      return 'settings';
    }
    return 'dashboard';
  });

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

  const handleAreaCardClick = (subjectLabel: string, subjectKey: SubjectArea) => {
    let breakdown: any[] = [];
    let totalPercentage = 0;

    if (dashboardMode === 'combined' && activeCombinedFolders.length > 0) {
      const result = calculateAggregateCombinedBreakdown(reviewees, activeCombinedFolders, gradeWeights, subjectKey, noScoreHandling);
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
      revieweeName: undefined, // undefined so it renders aggregate school contribution breakdown
      breakdown,
      totalPercentage,
      totalEarned: 0,
      totalPossible: 0,
    });
  };

  // helpers now imported from roleUtils

  useEffect(() => {
    if (canViewActivityLog(data)) {
      setLoadingLogs(true);
      setLogsError(null);
      fetchWithFirebaseAuth('/api/activity-logs', {
        method: 'POST',
        body: JSON.stringify({
          adminId: data.seqId || (data as any).doc_id || (data as any).docId || "Admin",
          adminName: `${data.first_name || ''} ${data.last_name || ''}`.trim() || "Admin",
          adminRole: data.role || "Admin",
          password: ""
        })
      })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(logData => {
          setActivityLogs(logData.logs || []);
          setLogsError(null);
        })
        .catch(err => {
          console.warn("Unable to fetch activity logs for stats:", err?.message || err);
          setLogsError(err?.message || "Failed to retrieve logs");
          setActivityLogs([]);
        })
        .finally(() => setLoadingLogs(false));
    } else {
      setLoadingLogs(false);
    }
  }, [data?.uid, data?.seqId, data?.role]);

  const [localScoreFolderId, setLocalScoreFolderId] = useState<string | undefined>(undefined);

  const activeUsersList = useMemo(() => {
    return allUsers.filter((u) => {
      const status = String(u?.status || u?.accountStatus || '').toLowerCase();
      const docId = u?.doc_id || u?.uid || u?.id;
      const authUid = u?.authUid || u?.auth_uid || u?.uid;
      const email = (u?.email || '').toLowerCase().trim();

      if (status === 'merged' || status === 'deleted' || u?.isDeleted || u?.deleted) {
        return false;
      }
      if (
        (docId && removedDocIds.has(docId)) ||
        (authUid && removedDocIds.has(authUid)) ||
        (email && removedDocIds.has(email))
      ) {
        return false;
      }

      // Filter out invalid/blank records, specifically reviewees with blank ID or blank/comma-only names
      if (!isValidUserRecord(u)) {
        return false;
      }

      return true;
    });
  }, [allUsers, removedDocIds]);

  const { folders: allScoreFolders } = useScoreFolders();
  const [dashboardFolderId, setDashboardFolderId] = useState<string>(() => {
    return localStorage.getItem('admin_dashboard_folder_id') || 'all';
  });
  const [dashboardMode, setDashboardMode] = useState<'single' | 'combined'>(() => {
    return (localStorage.getItem('admin_dashboard_mode') as 'single' | 'combined') || 'single';
  });
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('admin_selected_folder_ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [combineMethod, setCombineMethod] = useState<CombineMethod>('combined_scores');
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [isRuleDropdownOpen, setIsRuleDropdownOpen] = useState(false);
  const [isSingleFolderDropdownOpen, setIsSingleFolderDropdownOpen] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem('admin_dashboard_folder_id', dashboardFolderId);
    localStorage.setItem('admin_dashboard_mode', dashboardMode);
    localStorage.setItem('admin_selected_folder_ids', JSON.stringify(selectedFolderIds));
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
    const base = activeUsersList.filter((u) => getUserRole(u) === "Reviewee");
    
    if (dashboardMode === 'combined') {
      if (selectedFolderIds.length === 0) return [];
      // Reviewees in ANY of the selected folders
      return base.filter(u => activeCombinedFolders.some(f => isRevieweeInFolderScope(u, f)));
    }

    if (!activeDashboardFolder) return base;
    return base.filter(u => isRevieweeInFolderScope(u, activeDashboardFolder));
  }, [activeUsersList, activeDashboardFolder, activeCombinedFolders, dashboardMode, selectedFolderIds]);

  const staffUsers = activeUsersList.filter((u) => getUserRole(u) === "Staff");

  const totalReviewees = reviewees.length;
  const activeStaff = staffUsers.length;

  const pendingActions = allUsers.filter((u) => {
    const status = String(u?.status || u?.accountStatus || "").toLowerCase();
    return (
      status === "pending" ||
      status === "for_review" ||
      status === "unverified" ||
      u?.needsReview === true
    );
  }).length;

  const getRevieweeAverageScore = (user: any) => {
    if (dashboardMode === 'combined' && activeCombinedFolders.length > 0) {
      return calculateRevieweeCombinedRatings(user, activeCombinedFolders, gradeWeights, combineMethod, noScoreHandling, reviewees).overall;
    }
    const subjects: SubjectArea[] = ["clj", "lea", "cdi", "fs", "crim", "ca"];
    const folderId = dashboardMode === 'single' && dashboardFolderId !== 'all' ? dashboardFolderId : undefined;
    const areaScores = subjects.map(subj => {
      return calculateRevieweeArea(user, subj, gradeWeights, noScoreHandling, folderId, reviewees, allScoreFolders).percentage;
    });
    const validScores = areaScores.filter(s => s !== null && s !== undefined) as number[];
    return validScores.length > 0 ? validScores.reduce((sum, val) => sum + val, 0) / subjects.length : 0;
  };

  const revieweeAverages = reviewees
    .map(getRevieweeAverageScore)
    .filter((value): value is number => typeof value === "number");

  const averageOverallScore =
    revieweeAverages.length > 0
      ? revieweeAverages.reduce((a, b) => a + b, 0) / revieweeAverages.length
      : 0;

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
        const revieweeRatings = rawRatings.filter(r => r !== null) as number[];
        
        if (noScoreHandling === 'exclude') {
          percent = revieweeRatings.length > 0 
            ? revieweeRatings.reduce((a, b) => a + b, 0) / revieweeRatings.length
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

  const trendData = buildOverallTrend(reviewees);

  const activityItems: ActivityItem[] = activityLogs.slice(0, 6).map((log, idx) => {
    const op = String(log?.operation || "LOG_OPERATION");
    let tag = 'Update';
    let tone: ActivityItem['tone'] = 'blue';

    if (op.includes('MANUAL_SCORE_EDITED')) { tag = 'Score Edited'; tone = 'amber'; }
    else if (op.includes('MANUAL_SCORE_ADDED')) { tag = 'Score Added'; tone = 'purple'; }
    else if (op.includes('REVIEWEE_PASSED_ARCHIVED')) { tag = 'Archived'; tone = 'emerald'; }
    else if (op.includes('REVIEWEE_UNARCHIVED')) { tag = 'Unarchived'; tone = 'teal'; }

    return {
      id: `${log?.timestamp || idx}-${idx}`,
      icon: <History size={16} />,
      title: op.replace(/_/g, ' '),
      meta: `${log?.admin_name || 'System'} • ${log?.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'Recent'}`,
      tag,
      tone,
    };
  });

  const latestRevieweeRows = reviewees.slice(0, 6).map((u: any) => {
    const avg = getRevieweeAverageScore(u);
    const formalName = formatFormalName({
      firstName: u.first_name || u.firstName,
      middleName: u.middle_name || u.middleName,
      lastName: u.last_name || u.lastName,
      fallbackFullName: u.full_name || u.fullName || u.displayName || u.name
    });
    return {
      id: u.doc_id || u.docId || u.seqId || u.seq_id || `${u.first_name}-${u.last_name}`,
      name: formalName,
      seqId: u.seq_id || u.seqId || u.id_number || u.idNumber || u.doc_id || '—',
      avg,
      status: u.status || u.accountStatus || 'Active',
    };
  });

  const visibleMenuItems = useMemo(() => {
    return SIDEBAR_ITEMS.filter((item) => {
      if (item.adminOnly) return isAdmin(data);
      return true;
    });
  }, [data]);

  const handleTabSelect = React.useCallback((tabKey: string) => {
    setSelectedSubjectBreakdown(null);
    setEditingUser(null);
    setActiveTab(tabKey);
    let url = '/admin/dashboard';
    if (tabKey === 'users') {
      url = '/admin/allusers';
    } else if (tabKey === 'reviewees') {
      url = '/admin/reviewees';
    } else if (tabKey === 'score-management') {
      url = '/admin/scores';
    } else if (tabKey === 'upload-scores') {
      url = '/admin/upload-scores/csv';
    } else if (tabKey === 'archives') {
      url = '/admin/archives';
    } else if (tabKey === 'leaderboard') {
      url = '/admin/leaderboard';
    } else if (tabKey === 'mapping') {
      url = '/admin/school-mapping';
    } else if (tabKey === 'duplicates') {
      url = '/admin/duplicates';
    } else if (tabKey === 'audit-log') {
      url = '/admin/audit-log';
    } else if (tabKey === 'grade-calculation') {
      url = '/admin/grade-weights';
    } else if (tabKey === 'profile') {
      url = '/admin/profile';
    } else if (tabKey === 'settings' || tabKey === 'sync') {
      url = '/syncsettings/search-database/details';
    } else if (tabKey === 'dashboard') {
      url = '/admin/dashboard';
    }
    window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const fullName = `${data.first_name || ''} ${data.middle_name ? data.middle_name + ' ' : ''}${data.last_name || ''}`.trim() || 'Admin User';

  const getSyncModalProps = () => {
    let section: 'main' | 'search' | 'duplicates' | 'mapping' = 'search';
    let tab: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity' = 'details';
    
    if (activeTab === 'reviewees') {
      section = 'search';
      tab = 'details';
    } else if (activeTab === 'score-management') {
      section = 'search';
      tab = 'scores';
    } else if (activeTab === 'upload-scores') {
      section = 'search';
      tab = 'import_scores';
    } else if (activeTab === 'archives') {
      section = 'search';
      tab = 'archived';
    } else if (activeTab === 'leaderboard') {
      section = 'search';
      tab = 'leaderboard';
    } else if (activeTab === 'audit-log' || activeTab === 'activity-log') {
      section = 'search';
      tab = 'activity';
    } else if (activeTab === 'role-management') {
      section = 'search';
      tab = 'details';
    } else if (activeTab === 'mapping') {
      section = 'mapping';
    } else if (activeTab === 'duplicates') {
      section = 'duplicates';
    } else if (activeTab === 'settings' || activeTab === 'sync') {
      section = 'main';
    }
    
    return { initialSection: section, initialTab: tab };
  };

  return (
    <PortalLayout
      title="Admin Portal"
      subtitle={`Welcome back, ${fullName}! 👋`}
      role="Admin"
      roleDetail={fullName}
      activeTab={activeTab}
      onTabChange={handleTabSelect}
      navItems={visibleMenuItems}
      footerItems={FOOTER_ITEMS}
      onLogout={onLogout}
      notificationCount={notifications.filter(n => !n.isRead).length}
      notifications={notifications}
      idNumber={getDisplayIdNumber("Admin", data)}
      photoURL={userData?.photo_url || userData?.photoUrl}
      db={db!}
    >
      <div className={activeTab === 'dashboard' ? "space-y-6" : "hidden"}>
        <AdminPageHeader 
          title="Admin Dashboard" 
          description="Monitor reviewee performance, account activity, and score publication." 
        />
        
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
                          <>📁 {activeDashboardFolder?.name} {activeDashboardFolder?.type ? `(${formatFolderType(activeDashboardFolder.type)})` : ''}</>
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
                                  <span className="text-[10px] text-slate-400 uppercase font-black">{formatFolderType(folder.type)}</span>
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
              <div className="space-y-4 relative z-50">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  
                  {/* Animated Dropcard for Combined Folders */}
                  <div className="relative w-full max-w-md">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFolderDropdownOpen(!isFolderDropdownOpen);
                        setIsRuleDropdownOpen(false);
                      }}
                      className="w-full h-11 px-4 bg-white border border-slate-200 text-slate-800 rounded-xl flex items-center justify-between cursor-pointer focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none shadow-sm transition-all"
                    >
                      <div className="flex items-center overflow-x-auto no-scrollbar gap-1 flex-1">
                        {activeCombinedFolders.length === 0 ? (
                          <span className="text-sm font-bold text-slate-400">Select folders...</span>
                        ) : (
                          <span className="text-sm font-bold text-teal-700">
                            {activeCombinedFolders.length} Folders Selected
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isFolderDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {isFolderDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute z-50 w-full md:w-96 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden left-0"
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
                            {allScoreFolders
                              .filter(f => !f.isArchived)
                              .filter(f => f.name.toLowerCase().includes(folderSearchQuery.toLowerCase()))
                              .map(folder => {
                                const isSelected = selectedFolderIds.includes(folder.id);
                                return (
                                  <label
                                    key={folder.id}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                      isSelected ? 'bg-teal-50/50 hover:bg-teal-50' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <input 
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedFolderIds(prev => [...prev, folder.id]);
                                        } else {
                                          setSelectedFolderIds(prev => prev.filter(id => id !== folder.id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 ml-1"
                                    />
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <span className="text-xs font-bold text-slate-800 truncate">{folder.name}</span>
                                      <span className="text-[10px] text-slate-400 uppercase font-black">{formatFolderType(folder.type)}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            {allScoreFolders.filter(f => !f.isArchived && f.name.toLowerCase().includes(folderSearchQuery.toLowerCase())).length === 0 && (
                              <div className="px-3 py-6 text-center text-sm font-medium text-slate-500">
                                No folders found
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Aggregation Rule Animated Dropcard */}
                  {selectedFolderIds.length > 0 && (
                    <div className="relative w-full sm:w-auto min-w-[280px]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRuleDropdownOpen(!isRuleDropdownOpen);
                          setIsFolderDropdownOpen(false);
                        }}
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl flex items-center justify-between cursor-pointer focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-slate-500">Rule:</span>
                          <span className="font-bold text-slate-700 text-xs truncate">
                            {combineMethod === 'combined_scores' ? 'Weighted Volume' : 'Equal Folder Average'}
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${isRuleDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isRuleDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute z-50 w-full sm:w-80 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden p-1 right-0 sm:left-0 sm:right-auto"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setCombineMethod('combined_scores');
                                setIsRuleDropdownOpen(false);
                              }}
                              className={`w-full flex flex-col items-start px-3 py-3 text-sm rounded-lg transition-colors text-left ${
                                combineMethod === 'combined_scores' ? 'bg-teal-50/50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${combineMethod === 'combined_scores' ? 'text-teal-700' : 'text-slate-700'}`}>Combined Earned & Possible</span>
                                {combineMethod === 'combined_scores' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                              </div>
                              <span className="text-[10px] font-medium mt-1 leading-tight text-slate-500">
                                Weighted volume: Pools all scores together. Better for unequal number of tests.
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCombineMethod('equal_folder_average');
                                setIsRuleDropdownOpen(false);
                              }}
                              className={`w-full flex flex-col items-start px-3 py-3 text-sm rounded-lg transition-colors text-left mt-1 ${
                                combineMethod === 'equal_folder_average' ? 'bg-teal-50/50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${combineMethod === 'equal_folder_average' ? 'text-teal-700' : 'text-slate-700'}`}>Equal Folder Average</span>
                                {combineMethod === 'equal_folder_average' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                              </div>
                              <span className="text-[10px] font-medium mt-1 leading-tight text-slate-500">
                                Averages the percentages of each folder equally, regardless of score volume.
                              </span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {selectedFolderIds.length > 0 && (
                    <div className="text-[10px] font-black text-teal-700 dark:text-teal-400 ml-auto bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100 hidden sm:block">
                      {reviewees.length} Unique Reviewees
                    </div>
                  )}
                </div>

                {selectedFolderIds.length < 2 && (
                  <p className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-2 w-fit">
                    <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'/><path d='M12 9v4'/><path d='M12 17h.01'/></svg> Select at least two folders to enable combined analytics.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminSummaryCard
            label="Total Reviewees"
            value={totalReviewees.toLocaleString()}
            icon={<Users size={20} />}
            tone="blue"
            loading={loading}
            onClick={() => handleTabSelect('reviewees')}
          />
          <AdminSummaryCard
            label="Active Staff"
            value={activeStaff.toLocaleString()}
            icon={<UserCheck size={20} />}
            tone="emerald"
            loading={loading}
            onClick={() => handleTabSelect('reviewees')}
          />
          <AdminSummaryCard
            label="Average Overall Score"
            value={`${averageOverallScore.toFixed(2)}%`}
            icon={<BarChart3 size={20} />}
            tone="sky"
            loading={loading}
            onClick={() => handleTabSelect('score-management')}
          />
          <AdminSummaryCard
            label="Pending Actions"
            value={pendingActions.toLocaleString()}
            icon={<FileText size={20} />}
            tone="purple"
            loading={loading}
            onClick={() => handleTabSelect('score-management')}
          />
        </div>

        <BoardSubjectAreasSection
          areas={areaScores.map((item) => ({
            key: item.area,
            area: item.area,
            title: item.title,
            percent: item.percent,
            count: item.count,
            onClick: () => handleAreaCardClick(item.area, item.key as SubjectArea),
          }))}
          onViewAll={() => handleTabSelect('leaderboard')}
        />

        {/* Score Trend + Recent Activity */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <ScoreTrend trendData={trendData} />
          </div>

          <section className="space-y-3 xl:col-span-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Activity</h3>
              <button onClick={() => handleTabSelect('activity-log')} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline">
                View All <ArrowRight size={10} />
              </button>
            </div>
            <div className="h-[280px] overflow-y-auto rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm scrollbar-thin">
              <ActivityFeed 
                items={activityItems} 
                loading={loadingLogs} 
                emptyLabel={logsError ? "Activity logs are temporarily offline due to database permissions." : "No activity logs recorded yet."} 
              />
            </div>
          </section>
        </div>

        {/* Latest Reviewees */}
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">Latest Reviewees</h3>
            <button onClick={() => handleTabSelect('reviewees')} className="flex items-center gap-1 text-xs font-black text-[#007C89]">
              View All <ArrowRight size={10} />
            </button>
          </div>
          <SimpleTable
            loading={loading}
            emptyLabel="No reviewees enrolled yet."
            rows={latestRevieweeRows}
            columns={[
              { key: 'seqId', header: 'Reviewee ID', render: (r) => <span className="font-mono text-xs text-slate-500">{r.seqId}</span> },
              { key: 'name', header: 'Name', render: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
              {
                key: 'avg',
                header: 'Overall Score',
                render: (r) => <span className="font-black text-slate-900">{r.avg != null ? `${r.avg.toFixed(2)}%` : '0.00%'}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black capitalize text-emerald-600">{r.status}</span>
                ),
              },
            ]}
          />
        </section>

        {/* Quick Administrative Actions */}
        <section className="space-y-3">
          <h3 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Administrative Actions</h3>
          <QuickActionsGrid
            actions={[
              { key: 'sync', label: 'Sync & Mappings', icon: <RefreshCw size={18} />, onClick: () => handleTabSelect('sync') },
              { key: 'upload', label: 'Upload Scores', icon: <PlusCircle size={18} />, onClick: () => handleTabSelect('score-management') },
              { key: 'mapping', label: 'School Mappings', icon: <Layers size={18} />, onClick: () => handleTabSelect('mapping') },
              { key: 'duplicates', label: 'Duplicate Resolver', icon: <UserCheck size={18} />, onClick: () => handleTabSelect('duplicates') },
              { key: 'settings', label: 'System Settings', icon: <Settings size={18} />, onClick: () => handleTabSelect('settings') },
              { key: 'diagnostics', label: 'Firebase Diagnostics', icon: <Bug size={18} />, onClick: () => setIsDiagnosticsOpen(true) },
            ]}
          />
        </section>
        </div>

      <FirebaseDiagnosticPanel isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />

      {activeTab === 'users' && (
        <AllUsersDirectory 
          users={activeUsersList} 
          loading={loading} 
          onEditUser={setEditingUser} 
          onDeleteUser={(user) => setDeletingUser(user)}
          currentUser={userData} 
        />
      )}

      {deletingUser && (
        <DeleteUserModal
          isOpen={!!deletingUser}
          user={deletingUser}
          currentUser={userData}
          onClose={() => setDeletingUser(null)}
          onSuccess={(deletedUid, deletedDocId, name) => {
            setRemovedDocIds((prev) => {
              const next = new Set(prev);
              if (deletedUid) next.add(deletedUid);
              if (deletedDocId) next.add(deletedDocId);
              if (deletingUser?.email) next.add(deletingUser.email.toLowerCase().trim());
              return next;
            });
            setToastMessage({ text: `User ${name} deleted successfully!`, type: 'success' });
            setDeletingUser(null);
          }}
        />
      )}

      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {editingUser && (
        <EditUserModal 
          user={editingUser} 
          currentUserRole={getUserRole(userData)}
          isOpen={!!editingUser} 
          onClose={() => setEditingUser(null)} 
          onSave={async (updatedUser) => {
            try {
              if (getUserRole(userData) === 'Staff' && (editingUser.role === 'Admin' || editingUser.role === 'Staff')) {
                alert("Staff users are not authorized to edit Admin or Staff accounts.");
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
                  srcId: updatedUser.seqId
                });
                alert("User updated successfully!");
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

      {activeTab === 'grade-calculation' && (
        <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-80px)]">
          <GradeCalculationSettings />
        </div>
      )}

      {activeTab === 'score-management' && (
        <ScoreManagementWrapper 
          onOpenSyncModal={(section, tab, folderId) => {
            if (tab === 'import_scores') {
              // Store folderId if we are navigating to upload-scores
              if (folderId) {
                setLocalScoreFolderId(folderId);
              }
              handleTabSelect('upload-scores');
            } else {
              onOpenSyncModal(section, tab, folderId);
            }
          }}
          currentUser={userData}
        />
      )}

      <div className={activeTab !== 'dashboard' && activeTab !== 'profile' && activeTab !== 'users' && activeTab !== 'grade-calculation' && activeTab !== 'score-management' ? "block" : "hidden"}>
        <SyncModal 
          {...(syncProps || {})} 
          isOpen={true} 
          embeddedMode={true} 
          scoreFolderId={localScoreFolderId || syncProps?.scoreFolderId}
          initialSection={getSyncModalProps().initialSection} 
          initialTab={getSyncModalProps().initialTab} 
          onSubTabChange={(tab) => {
            if (tab === 'details') handleTabSelect('reviewees');
            else if (tab === 'scores') handleTabSelect('score-management');
            else if (tab === 'import_scores') handleTabSelect('upload-scores');
            else if (tab === 'archived') handleTabSelect('archives');
            else if (tab === 'leaderboard') handleTabSelect('leaderboard');
            else if (tab === 'activity') handleTabSelect('audit-log');
          }}
          onSectionChange={(section) => {
            if (section === 'mapping') handleTabSelect('mapping');
            else if (section === 'duplicates') handleTabSelect('duplicates');
            else if (section === 'main') handleTabSelect('settings');
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
