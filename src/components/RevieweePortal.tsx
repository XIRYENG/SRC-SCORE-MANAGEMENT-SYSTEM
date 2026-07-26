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
  Menu
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
    setActiveTab(tab);
    localStorage.setItem('reviewee_active_tab', tab);
    let url = '/reviewee/dashboard';
    if (tab === 'my-scores') {
      url = '/reviewee/my-scores';
    } else if (tab === 'scores') {
      url = '/reviewee/scores';
    } else if (tab === 'profile') {
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
    const name = `${revieweeData.first_name || ''} ${revieweeData.last_name || ''}`.trim() || "Reviewee";
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
      return { rank: "N/A", subtitle: "No scores yet", topPercent: null };
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
      return { rank: "N/A", subtitle: `Out of ${revieweesList.length} Reviewees`, topPercent: null };
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
      percentStr: scores.length > 0 ? `${progressPercent}%` : "N/A",
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

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'my-scores', label: 'My Scores', icon: <ClipboardList size={18} /> },
    { key: 'profile', label: 'Profile', icon: <User size={18} /> },
  ];

  const footerItems = [
    { key: 'dashboard', label: 'Home', icon: <LayoutDashboard size={18} /> },
    { key: 'my-scores', label: 'Scores', icon: <ClipboardList size={18} /> },
    { key: 'profile', label: 'Profile', icon: <User size={18} /> },
    { key: 'menu', label: 'Menu', icon: <Menu size={18} /> },
  ];

  const revieweeName = `${revieweeData.first_name || ''} ${revieweeData.middle_name ? revieweeData.middle_name + ' ' : ''}${revieweeData.last_name || ''}`.trim() || 'Reviewee';

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Overall Average"
          value={scores.length > 0 ? `${avgScore}%` : 'N/A'}
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
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <SectionHeader title="Performance by Area" onViewAll={() => handleTabChange('progress')} />
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 lg:grid lg:grid-cols-6 lg:overflow-visible lg:mx-0 lg:px-0">
          {areaScores.length === 0 ? (
            <p className="py-6 text-xs font-medium text-slate-500">No scores encoded yet.</p>
          ) : (
            areaScores.map((item) => (
              <AreaPerformanceCircle 
                key={item.area} 
                subject={item.area} 
                percentage={item.percent} 
                subtitle={item.subtitle} 
                onClick={() => handleAreaCardClick(item.area, item.key as SubjectArea)}
              />
            ))
          )}
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
          value={scores.length > 0 ? `${avgScore}%` : 'N/A'}
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

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader title="Subject Area Performance" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {areaScores.map((item) => (
            <AreaPerformanceCircle 
              key={item.area} 
              subject={item.area} 
              percentage={item.percent} 
              subtitle={item.subtitle} 
              onClick={() => handleAreaCardClick(item.area, item.key as SubjectArea)}
            />
          ))}
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

  return (
    <PortalLayout
      title="Reviewee Portal"
      seqId={revieweeData.seq_id || revieweeData.seqId || revieweeData.id_number}
      idNumber={getDisplayIdNumber("Reviewee", revieweeData)}
      subtitle={
        <>
          Welcome back, {revieweeName}! 👋
        </>
      }
      role="Reviewee"
      roleDetail={revieweeName}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      navItems={navItems}
      footerItems={footerItems}
      onLogout={onLogout}
      notificationCount={unreadCount}
      notifications={notifications}
      photoURL={revieweeData?.photo_url || revieweeData?.photoUrl}
      db={firestoreDb}
    >
      <div className="relative">
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
         {activeTab === "progress" && renderProgress()}
         {activeTab === "results" && renderResults()}
         {activeTab === "profile" && <ProfileDashboard currentUser={revieweeData} onUpdate={setRevieweeData} />}
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
