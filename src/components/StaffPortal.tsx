import React, { useState, useMemo, useEffect } from 'react';
import { getClientDb } from '../utils/firebaseClient';
import { useNotifications } from '../hooks/useNotifications';
import { getDisplayIdNumber } from '../utils/idResolver';
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
  Menu
} from 'lucide-react';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import type { RevieweeData } from '../types';
import { getUserRole } from '../utils/roleUtils';
import { isValidRevieweeRecord } from '../services/userIdentityResolver';
import { PortalLayout } from './PortalLayout';
import { AreaProgressCard, ScoreTrend } from './DashboardShared';
import { StatCard, ActivityFeed, QuickActionsGrid, SimpleTable, SectionHeader } from './DashboardKit';
import { aggregateAreaScores } from '../utils/aggregateAreaScores';
import { ProfileDashboard } from './ProfileDashboard';
import { AllUsersDirectory } from './AllUsersDirectory';
import { SyncModal } from './SyncModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_GRADE_WEIGHTS, GradeWeights, SubjectArea, GRADE_CATEGORY_LABELS, GradeCategoryKey } from '../utils/gradeCalculation';
import { calculateAreaDashboardData, calculateRevieweeArea } from '../utils/calculateRevieweeArea';
import { getResolvedScore } from '../utils/scoreFieldResolver';
import { AreaPerformanceCircle } from './AreaPerformanceCircle';
import { AreaPerformanceModal } from './performance/AreaPerformanceModal';
import { ScoreManagementDashboard } from './admin/ScoreManagementDashboard';

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
  onOpenSyncModal: (section?: 'main' | 'search' | 'duplicates' | 'mapping', tab?: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity') => void;
  syncProps?: any;
}

export function StaffPortal({ data, onLogout, onOpenSyncModal, syncProps }: StaffPortalProps) {
  const db = getClientDb();
  const { notifications } = useNotifications(db!, data.uid);
  const { allUsers, loading } = useFirestoreUsers();
  const [userData, setUserData] = useState(data);
  const [activeTab, setActiveTab] = useState(() => {
    const normalizedPath = decodeURIComponent(window.location.pathname).toLowerCase();
    if (normalizedPath.includes('/staff/allusers') || normalizedPath.includes('/users')) {
      return 'users';
    }
    if (normalizedPath.includes('/staff/reviewees') || normalizedPath.includes('/reviewees')) {
      return 'reviewees';
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
  const reviewees = allUsers.filter((u) => getUserRole(u) === "Reviewee" && isValidRevieweeRecord(u));

  const totalReviewees = reviewees.length;

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
    name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
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
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
             <SectionHeader title="Scores by Area" onViewAll={() => handleTabSelect('leaderboard')} />
             <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {areaScores.slice(0, 6).map((item) => (
                   <AreaPerformanceCircle 
                    key={item.area} 
                    subject={item.area} 
                    percentage={item.percent} 
                    revieweeCount={item.count} 
                    onClick={() => handleAreaCardClick(item.area, item.key as SubjectArea)}
                   />
                ))}
             </div>
          </section>
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
        <AllUsersDirectory users={allUsers} loading={loading} onEditUser={() => {}} />
      )}

      {activeTab === 'profile' && (
        <ProfileDashboard currentUser={userData} onUpdate={setUserData} />
      )}

      {activeTab === 'upload-scores' && (
        <ScoreManagementDashboard 
          onOpenSyncModal={onOpenSyncModal}
          currentUser={userData}
        />
      )}

      <div className={activeTab !== 'dashboard' && activeTab !== 'profile' && activeTab !== 'users' && activeTab !== 'upload-scores' ? "block" : "hidden"}>
        <SyncModal 
          {...(syncProps || {})} 
          isOpen={true} 
          embeddedMode={true} 
          initialSection={getSyncModalProps().initialSection} 
          initialTab={getSyncModalProps().initialTab} 
          onSubTabChange={(tab) => {
            if (tab === 'details') setActiveTab('reviewees');
            else if (tab === 'scores') setActiveTab('upload-scores');
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
