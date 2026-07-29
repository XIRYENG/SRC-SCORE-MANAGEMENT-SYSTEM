import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, ClipboardList, BookOpen, Calendar, 
  TrendingUp, User, Activity, ClipboardCheck, Star, Award,
  ArrowRight,
  ChevronRight,
  Trophy,
  History,
  Target,
  Bell,
  Menu,
  LogOut
} from 'lucide-react';
import type { RevieweeData } from '../types';
import { parseScores } from '../utils/scoreParser';
import { getUserRole } from '../utils/roleUtils';
import { getDisplayIdNumber } from '../utils/idResolver';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import { useNotifications } from '../hooks/useNotifications';
import { firestoreDb } from '../utils/firebaseClient';
import { MyScoresPage } from './reviewee/MyScoresPage';
import { PortalLayout } from './PortalLayout';
import { AreaProgressCard, ScoreTrend, getScoreColor, getScoreLabel } from './DashboardShared';
import { StatCard, ActivityFeed, SimpleTable, SectionHeader, QuickActionsGrid } from './DashboardKit';
import { ProfileDashboard } from './ProfileDashboard';
import RevieweeScoresDashboard from './reviewee/RevieweeScoresDashboard';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { DEFAULT_GRADE_WEIGHTS, GradeWeights, SubjectArea, GRADE_CATEGORY_LABELS, GradeCategoryKey } from '../utils/gradeCalculation';
import { calculateRevieweeArea } from '../utils/calculateRevieweeArea';
import { AreaPerformanceCircle } from './AreaPerformanceCircle';
import { AreaPerformanceModal } from './performance/AreaPerformanceModal';
import { getResolvedScore } from '../utils/scoreFieldResolver';
import { isValidRevieweeRecord } from '../services/userIdentityResolver';
import { UserAvatar } from './UserAvatar';
import { PortalBottomMenu } from './ui/portal-bottom-menu';

const areaTitleMap: Record<string, string> = {
  "CLJ": "Criminal Law and Jurisprudence",
  "LEA": "Law Enforcement Administration",
  "CDI": "Crime Detection and Investigation",
  "FS": "Forensic Science",
  "CRIM": "Criminology",
  "COR-AD": "Correctional Administration",
};

export function RevieweePortal({ data, onLogout }: { data: RevieweeData, onLogout: () => void }) {
  const [revieweeData, setRevieweeData] = useState(data);
  const [activeTab, setActiveTab] = useState(() => {
    const normalizedPath = decodeURIComponent(window.location.pathname).toLowerCase();
    if (normalizedPath.includes('/reviewee/my-scores')) {
      return 'my-scores';
    }
    if (normalizedPath.includes('/reviewee/scores') || normalizedPath.includes('/scores')) {
      return 'scores';
    }
    if (normalizedPath.includes('/reviewee/profile') || normalizedPath.includes('/profile')) {
      return 'profile';
    }
    return localStorage.getItem('reviewee_active_tab') || 'dashboard';
  });
  const { allUsers } = useFirestoreUsers();
  const { notifications } = useNotifications(firestoreDb, data.uid || "");
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const handleTabChange = (tab: string) => {
    setSelectedSubjectBreakdown(null);
    
    // Map 'daily' and 'eval' to 'my-scores'
    const targetTab = (tab === 'daily' || tab === 'eval') ? 'my-scores' : tab;
    
    setActiveTab(targetTab);
    localStorage.setItem('reviewee_active_tab', targetTab);
    
    let url = '/reviewee/dashboard';
    if (targetTab === 'my-scores') {
      url = '/reviewee/my-scores';
    } else if (targetTab === 'scores') {
      url = '/reviewee/scores';
    } else if (targetTab === 'profile') {
      url = '/reviewee/profile';
    }
    window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    const unsub = onSnapshot(
      doc(firestoreDb, "system_settings", "grade_calculation"),
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
  }, []);

  const handleAreaCardClick = (subjectLabel: string, subjectKey: SubjectArea) => {
    const result = calculateRevieweeArea(revieweeData, subjectKey, gradeWeights);
    const name = [
      revieweeData.first_name,
      revieweeData.middle_name,
      revieweeData.last_name
    ].filter(Boolean).join(' ').trim() || "Reviewee";
    setSelectedSubjectBreakdown({
      subject: subjectLabel,
      revieweeName: name,
      breakdown: result.breakdown,
      totalPercentage: result.percentage,
      totalEarned: result.totalEarned,
      totalPossible: result.totalPossible
    });
  };
  
  const scores = useMemo(() => parseScores(revieweeData), [revieweeData]);
  
  const avgScore = useMemo(() => {
    const subjects: SubjectArea[] = ["clj", "lea", "cdi", "fs", "crim", "ca"];
    const areaScores = subjects.map(subj => {
      return calculateRevieweeArea(revieweeData, subj, gradeWeights).percentage;
    });
    return Number((areaScores.reduce((sum, val) => sum + val, 0) / subjects.length).toFixed(1));
  }, [revieweeData, gradeWeights]);
  
  // Calculate dynamic rank for this specific reviewee among all reviewees
  const rankInfo = useMemo(() => {
    if (!allUsers || allUsers.length === 0 || scores.length === 0) {
      return { rank: "0", subtitle: "No scores yet", topPercent: null };
    }

    const revieweesList = allUsers.filter((u: any) => getUserRole(u) === "Reviewee");
    
    // Calculate average for each reviewee
    const ranked = revieweesList.map((u: any) => {
      const subjects: SubjectArea[] = ["clj", "lea", "cdi", "fs", "crim", "ca"];
      const areaScores = subjects.map(subj => {
        return calculateRevieweeArea(u, subj, gradeWeights).percentage;
      });
      const uAvg = areaScores.reduce((sum, val) => sum + val, 0) / subjects.length;
      const count = subjects.reduce((sum, subj) => {
        const categories: GradeCategoryKey[] = ["preboard", "pretest", "posttest", "quiz", "dailyEvaluation", "removal", "diagnostic"];
        const actualCount = categories.reduce((c, cat) => getResolvedScore(u, cat, subj) !== null ? c + 1 : c, 0);
        return sum + actualCount;
      }, 0);
      const uSeq = u.seq_id || u.seqId || u.srcId || u.id_number || u.uid || u.id;
      return {
        uid: u.uid || u.id,
        seqId: uSeq,
        avg: uAvg,
        count
      };
    }).filter(u => u.count > 0);

    ranked.sort((a, b) => b.avg - a.avg);

    const rData = revieweeData as any;
    const currentSeq = rData.seq_id || rData.seqId || rData.srcId || rData.id_number || rData.uid || rData.id;
    const currentUid = rData.uid || rData.id;

    const idx = ranked.findIndex(r => 
      (currentUid && r.uid === currentUid) || 
      (currentSeq && r.seqId === currentSeq)
    );

    if (idx === -1) {
      return { rank: "0", subtitle: `Out of ${revieweesList.length} Reviewees`, topPercent: null };
    }

    const rankNum = idx + 1;
    const total = ranked.length;
    const percentile = Math.max(1, Math.round((rankNum / total) * 100));

    return {
      rank: `#${rankNum}`,
      subtitle: `Out of ${total} Evaluated Reviewees`,
      topPercent: percentile <= 20 ? `Top ${percentile}% of Batch` : `Ranked ${rankNum} of ${total}`
    };
  }, [allUsers, revieweeData, scores, gradeWeights]);

  // Calculate dynamic course progress for this specific reviewee
  const progressInfo = useMemo(() => {
    const evaluatedAreasCount = new Set(scores.map(s => s.area)).size;
    const progressPercent = Math.min(100, Math.round((evaluatedAreasCount / 6) * 100));
    return {
      percentStr: scores.length > 0 ? `${progressPercent}%` : "0.00%",
      subtitle: scores.length > 0 ? `${evaluatedAreasCount} of 6 Subject Areas Evaluated` : "No scores yet"
    };
  }, [scores]);

  const trendData = useMemo(() => {
    const sorted = [...scores].sort((a,b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    return sorted.slice(-8).map(s => ({ date: s.date || 'N/A', score: s.percentage }));
  }, [scores]);
  
  const areaScores = useMemo(() => {
    const subjects: { key: SubjectArea; label: string }[] = [
      { key: "clj", label: "CLJ" },
      { key: "lea", label: "LEA" },
      { key: "cdi", label: "CDI" },
      { key: "fs", label: "FS" },
      { key: "crim", label: "CRIM" },
      { key: "ca", label: "COR-AD" },
    ];

    return subjects.map(subj => {
      const result = calculateRevieweeArea(revieweeData, subj.key, gradeWeights);
      const categories: GradeCategoryKey[] = ["preboard", "pretest", "posttest", "quiz", "dailyEvaluation", "removal", "diagnostic"];
      const actualCount = categories.reduce((c, cat) => getResolvedScore(revieweeData, cat, subj.key) !== null ? c + 1 : c, 0);
      return {
        key: subj.key,
        area: subj.label,
        title: areaTitleMap[subj.label] || subj.label,
        percent: result.percentage,
        count: actualCount,
        subtitle: `${actualCount} ${actualCount === 1 ? 'evaluation' : 'evaluations'} encoded`
      };
    });
  }, [revieweeData, gradeWeights]);

  const latestResultsItems = useMemo(() => scores.slice(-5).reverse().map((s, idx) => ({
    id: `${s.date}-${idx}`,
    title: `${s.category} ${s.area}`,
    meta: s.date || 'Recently Encoded',
    tag: `${s.percentage}%`,
    tone: (s.percentage >= 75 ? 'emerald' : s.percentage >= 50 ? 'amber' : 'rose') as any,
    icon: <Award size={16} />
  })), [scores]);

  const latestTableRows = useMemo(() => scores.slice(-8).reverse().map((s, idx) => ({
    id: `${s.date}-${idx}`,
    category: s.category,
    area: s.area,
    score: s.percentage,
    date: s.date || '—',
  })), [scores]);

  const revieweeName = `${revieweeData.first_name || ''} ${revieweeData.middle_name ? revieweeData.middle_name + ' ' : ''}${revieweeData.last_name || ''}`.trim() || 'Reviewee';

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Overall Average"
          value={scores.length > 0 ? `${Number(avgScore).toFixed(2)}%` : '0.00%'}
          icon={<Star size={18} />}
          tone="blue"
          subtitle={scores.length > 0 ? getScoreLabel(avgScore) : 'No scores yet'}
        />
        <StatCard
          label="Course Progress"
          value={progressInfo.percentStr}
          icon={<TrendingUp size={18} />}
          tone="emerald"
          subtitle={progressInfo.subtitle}
        />
        <StatCard
          label="My Rank"
          value={rankInfo.rank}
          icon={<Trophy size={18} />}
          tone="sky"
          subtitle={rankInfo.topPercent || rankInfo.subtitle}
        />
        <StatCard
          label="Evaluations Taken"
          value={scores.length.toString()}
          icon={<ClipboardCheck size={18} />}
          tone="purple"
          subtitle="Total encoded sessions"
        />
      </div>

      {/* Area Scores */}
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm overflow-hidden">
        <SectionHeader title="Performance by Area" onViewAll={() => handleTabChange('progress')} />
        <div className="-mx-4 overflow-x-auto px-4 pb-3">
          <div className="flex w-max gap-3 lg:grid lg:w-full lg:grid-cols-6">
            {areaScores.length === 0 ? (
              <p className="py-6 text-xs font-medium text-slate-500">No scores encoded yet.</p>
            ) : (
              areaScores.map((item) => (
                <div key={item.area} className="w-[180px] shrink-0 lg:w-auto">
                  <AreaPerformanceCircle 
                    subject={item.area} 
                    percentage={item.percent} 
                    subtitle={item.subtitle} 
                    onClick={() => handleAreaCardClick(item.area, item.key as SubjectArea)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Trend + Latest Results */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ScoreTrend trendData={trendData} />
        </div>

        <section className="xl:col-span-2 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Latest Results" onViewAll={() => handleTabChange('scores')} />
          <ActivityFeed items={latestResultsItems} emptyLabel="No scores encoded yet." />
        </section>
      </div>

      {/* Detailed Score History */}
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader title="Recent Score Logs" onViewAll={() => handleTabChange('scores')} />
        <SimpleTable 
          rows={latestTableRows}
          columns={[
            { key: 'category', header: 'Category', render: (r) => <span className="text-sm font-black text-slate-900">{r.category}</span> },
            { key: 'area', header: 'Board Area', render: (r) => <span className="text-xs font-black text-[#007C89]">{r.area}</span> },
            { 
              key: 'score', 
              header: 'Score', 
              render: (r) => (
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${getScoreColor(r.score)}`}>{r.score}%</span>
                  <div className="hidden sm:block h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${r.score >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              ) 
            },
            { key: 'date', header: 'Date Taken', render: (r) => <span className="text-xs font-semibold text-slate-500">{r.date}</span> },
          ]}
        />
      </section>

      {/* Quick Access Grid */}
      <section className="space-y-3">
        <h3 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Student Utilities</h3>
        <QuickActionsGrid 
          actions={[
            { key: 'scores', label: 'Score History', icon: <ClipboardList size={18} />, onClick: () => handleTabChange('scores') },
            { key: 'eval', label: 'Daily Evaluation', icon: <Calendar size={18} />, onClick: () => handleTabChange('daily') },
            { key: 'progress', label: 'Progress Analytics', icon: <TrendingUp size={18} />, onClick: () => handleTabChange('progress') },
            { key: 'profile', label: 'My Account', icon: <User size={18} />, onClick: () => handleTabChange('profile') },
          ]}
        />
      </section>
    </div>
  );

  const renderProgress = () => (
    <div className="space-y-6">
      <SectionHeader title="Progress Analytics" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Overall Average"
          value={scores.length > 0 ? `${avgScore}%` : '0.00%'}
          icon={<Star size={18} />}
          tone="blue"
          subtitle={scores.length > 0 ? getScoreLabel(avgScore) : 'No scores yet'}
        />
        <StatCard
          label="Course Progress"
          value={progressInfo.percentStr}
          icon={<TrendingUp size={18} />}
          tone="emerald"
          subtitle={progressInfo.subtitle}
        />
        <StatCard
          label="My Rank"
          value={rankInfo.rank}
          icon={<Trophy size={18} />}
          tone="sky"
          subtitle={rankInfo.topPercent || rankInfo.subtitle}
        />
      </div>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
        <SectionHeader title="Subject Area Performance" />
        <div className="-mx-4 overflow-x-auto px-4 pb-3">
          <div className="flex w-max gap-4 lg:grid lg:w-full lg:grid-cols-6">
            {areaScores.map((item) => (
              <div key={item.area} className="w-[180px] shrink-0 lg:w-auto">
                <AreaPerformanceCircle 
                  subject={item.area} 
                  percentage={item.percent} 
                  subtitle={item.subtitle} 
                  onClick={() => handleAreaCardClick(item.area, item.key as SubjectArea)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <ScoreTrend trendData={trendData} />
      </section>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-6">
      <SectionHeader title="Evaluation Results" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="xl:col-span-2 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Latest Evaluation Feeds" />
          <ActivityFeed items={latestResultsItems} emptyLabel="No scores encoded yet." />
        </section>

        <section className="xl:col-span-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Full Score Records" />
          <SimpleTable 
            rows={scores}
            columns={[
              { key: 'category', header: 'Category', render: (r) => <span className="text-sm font-black text-slate-900">{r.category}</span> },
              { key: 'area', header: 'Board Area', render: (r) => <span className="text-xs font-black text-[#007C89]">{r.area}</span> },
              { 
                key: 'score', 
                header: 'Score', 
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black ${getScoreColor(r.percentage)}`}>{r.percentage}%</span>
                    <div className="hidden sm:block h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${r.percentage >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${r.percentage}%` }} />
                    </div>
                  </div>
                ) 
              },
              { key: 'date', header: 'Date Taken', render: (r) => <span className="text-xs font-semibold text-slate-500">{r.date || 'Recently Encoded'}</span> },
            ]}
          />
        </section>
      </div>
    </div>
  );

  const navItems = [
    { key: 'dashboard', label: 'Home', icon: <LayoutDashboard size={18} /> },
    { key: 'scores', label: 'Scores', icon: <ClipboardList size={18} /> },
    { key: 'profile', label: 'Profile', icon: <User size={18} /> },
  ];

  const handleMessengerClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Basic handler for Messenger if needed
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-slate-50 overflow-hidden">
      {/* Compact Mobile Header */}
      <header className="sticky top-0 z-40 flex h-auto min-h-[64px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <UserAvatar 
            photoURL={revieweeData?.photo_url || revieweeData?.photoUrl} 
            altText={revieweeName} 
            size={36} 
            className="h-9 w-9 shrink-0 rounded-xl object-cover border border-slate-100 bg-white shadow-sm" 
          />
          <div className="flex flex-col min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-slate-900">{revieweeName}</h1>
            <span className="truncate text-xs font-medium text-slate-500 mt-0.5">ID: {getDisplayIdNumber("Reviewee", revieweeData) || 'No ID'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-3">
          <div className="relative group">
            <a
              href="https://www.messenger.com/j/AbaK9Q9EUN0N4VmQ/?send_source=gc%3Acopy_invite_link_c"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleMessengerClick}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors select-none"
              title="Open Messenger"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-600">
                <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.34 5.57 3.51 7.37v3.75c0 .35.39.55.68.34l3.37-2.48c.8.23 1.63.35 2.48.35 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.18 12.87l-2.6-2.77-5.07 2.77 5.57-5.91 2.62 2.77 5.05-2.77-5.57 5.91z" />
              </svg>
            </a>
          </div>
          
          <button
            onClick={onLogout}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scroll-smooth px-4 pb-[calc(80px+env(safe-area-inset-bottom))] pt-6 custom-scrollbar">
        <div className="mx-auto max-w-5xl">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "my-scores" && (
            <MyScoresPage 
              revieweeData={revieweeData} 
              scores={scores}
            />
          )}
          {activeTab === "scores" && (
            <RevieweeScoresDashboard
              currentUser={revieweeData}
            />
          )}
          {activeTab === "profile" && <ProfileDashboard currentUser={revieweeData} onUpdate={setRevieweeData} />}
        </div>
      </main>

      {/* Touch-Friendly Bottom Navigation */}
      <div className="block">
        <PortalBottomMenu
          items={navItems.map(item => ({
            id: item.key,
            label: item.label,
            icon: item.icon,
          }))}
          activeId={activeTab === 'my-scores' ? 'scores' : activeTab}
          onSelect={handleTabChange}
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
    </div>
  );
}
