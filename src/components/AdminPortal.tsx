import React, { useEffect, useState, useMemo } from 'react';
import { getClientDb } from '../utils/firebaseClient';
import { fetchWithFirebaseAuth } from '../utils/auth';
import { useNotifications } from '../hooks/useNotifications';
import { getDisplayIdNumber } from '../utils/idResolver';
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
  Menu
} from 'lucide-react';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
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
import { getResolvedScore } from '../utils/scoreFieldResolver';
import { GradeCalculationSettings } from './GradeCalculationSettings';
import { AreaPerformanceCard } from './performance/AreaPerformanceCard';
import { AreaPerformanceCircle } from './AreaPerformanceCircle';
import { AreaPerformanceModal } from './performance/AreaPerformanceModal';
import { AdminSummaryCard } from './admin/AdminSummaryCard';
import { AdminPageHeader } from './admin/AdminPageHeader';
import { ScoreManagementDashboard } from './admin/ScoreManagementDashboard';
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
  onOpenSyncModal: (section?: 'main' | 'search' | 'duplicates' | 'mapping', tab?: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity') => void;
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
  const [selectedSubjectBreakdown, setSelectedSubjectBreakdown] = useState<{
    subject: string;
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
        }
      },
      (err) => console.error("Error listening to grade weights:", err)
    );
    return () => unsub();
  }, [db]);

  const handleAreaCardClick = (subjectLabel: string, subjectKey: SubjectArea) => {
    const categories: GradeCategoryKey[] = ["preboard", "pretest", "posttest", "quiz", "dailyEvaluation", "removal", "diagnostic"];
    const breakdown = categories.map(cat => {
      const validScores = reviewees.map(r => getResolvedScore(r, cat, subjectKey) ?? 0);
      const avgScore = validScores.length > 0 ? (validScores.reduce((sum, v) => sum + v, 0) / validScores.length) : 0;
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
    const totalPercentage = breakdown.reduce((sum, item) => sum + item.contribution, 0);

    setSelectedSubjectBreakdown({
      subject: subjectLabel,
      revieweeName: "All Enrolled Reviewees (Averages)",
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

  const reviewees = activeUsersList.filter((u) => getUserRole(u) === "Reviewee");
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
    const subjects: SubjectArea[] = ["clj", "lea", "cdi", "fs", "crim", "ca"];
    const areaScores = subjects.map(subj => {
      return calculateRevieweeArea(user, subj, gradeWeights).percentage;
    });
    return areaScores.reduce((sum, val) => sum + val, 0) / subjects.length;
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
    const subjects: { key: SubjectArea; label: string }[] = [
      { key: "clj", label: "CLJ" },
      { key: "lea", label: "LEA" },
      { key: "cdi", label: "CDI" },
      { key: "fs", label: "FS" },
      { key: "crim", label: "CRIM" },
      { key: "ca", label: "CA" },
    ];

    return subjects.map(subj => {
      const result = calculateAreaDashboardData(reviewees, subj.key, gradeWeights);
      return {
        key: subj.key,
        area: subj.label,
        title: areaTitleMap[subj.label] || subj.label,
        percent: result.percentage,
        count: reviewees.length
      };
    });
  }, [reviewees, gradeWeights]);

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
      url = '/admin/upload-scores';
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
    let tab: 'details' | 'scores' | 'archived' | 'leaderboard' | 'activity' = 'details';
    
    if (activeTab === 'reviewees') {
      section = 'search';
      tab = 'details';
    } else if (activeTab === 'score-management' || activeTab === 'upload-scores') {
      section = 'search';
      tab = 'scores';
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Performance by Area</h3>
            <button onClick={() => handleTabSelect('leaderboard')} className="text-xs font-black text-[#007C89] hover:text-teal-800 transition-colors">
              View All Areas
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {areaScores.length === 0 ? (
              <p className="py-6 text-xs font-medium text-slate-500">No scores encoded yet.</p>
            ) : (
              areaScores.map((item) => (
                <AreaPerformanceCircle 
                  key={item.area} 
                  subject={item.area} 
                  percentage={item.percent} 
                  revieweeCount={item.count} 
                  onClick={() => handleAreaCardClick(item.area, item.key as SubjectArea)}
                />
              ))
            )}
          </div>
        </section>

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
                render: (r) => (r.avg == null ? <span className="text-slate-400">—</span> : <span className="font-black text-slate-900">{r.avg.toFixed(1)}%</span>),
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
        <ScoreManagementDashboard 
          onOpenSyncModal={onOpenSyncModal}
          currentUser={userData}
        />
      )}

      <div className={activeTab !== 'dashboard' && activeTab !== 'profile' && activeTab !== 'users' && activeTab !== 'grade-calculation' && activeTab !== 'score-management' ? "block" : "hidden"}>
        <SyncModal 
          {...(syncProps || {})} 
          isOpen={true} 
          embeddedMode={true} 
          initialSection={getSyncModalProps().initialSection} 
          initialTab={getSyncModalProps().initialTab} 
          onSubTabChange={(tab) => {
            if (tab === 'details') handleTabSelect('reviewees');
            else if (tab === 'scores') handleTabSelect('score-management');
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
          areaCode={selectedSubjectBreakdown.subject}
          revieweeLabel={selectedSubjectBreakdown.revieweeName}
          breakdown={selectedSubjectBreakdown.breakdown}
          totalPercentage={selectedSubjectBreakdown.totalPercentage}
          totalEarned={selectedSubjectBreakdown.totalEarned}
          totalPossible={selectedSubjectBreakdown.totalPossible}
        />
      )}
    </PortalLayout>
  );
}
