import React from 'react';
import {
  Users,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';

interface UXDashboardCardsProps {
  users: any[];
  selectedCategory?: string;
  selectedSubject?: string;

  unmatchedCount?: number;
}

export const UXDashboardCards: React.FC<UXDashboardCardsProps> = ({
  users,
  selectedCategory = 'Pre-Board',
  selectedSubject = 'CLJ',

  unmatchedCount = 0
}) => {
  const activeUsers = users.filter((u: any) => !u.is_archived);
  const totalUsers = activeUsers.length;

  const subjectLower = selectedSubject.toLowerCase();

  const scoreField =
    selectedCategory.toLowerCase() === 'diagnostic'
      ? `diag_${subjectLower}`
      : selectedCategory.toLowerCase() === 'post test'
      ? `post_${subjectLower}`
      : selectedCategory.toLowerCase() === 'final coaching'
      ? `final_${subjectLower}`
      : `score_${subjectLower}`;

  const withScores = activeUsers.filter((u: any) => {
    const value = u[scoreField];
    return value !== undefined && value !== null && String(value).trim() !== '';
  }).length;

  const coverage = totalUsers > 0 ? Math.round((withScores / totalUsers) * 100) : 0;

  const cards = [
    {
      title: 'Total Reviewees',
      value: totalUsers,
      sub: 'Active enrolled reviewees',
      icon: Users,
      bg: 'bg-blue-50',
      text: 'text-blue-700'
    },
    {
      title: `${selectedSubject} Scores`,
      value: withScores,
      sub: `${coverage}% score coverage`,
      icon: FileSpreadsheet,
      bg: 'bg-emerald-50',
      text: 'text-emerald-700'
    },
{
      title: 'Unmatched Scores',
      value: unmatchedCount,
      sub: 'Need manual checking',
      icon: CheckCircle2,
      bg: 'bg-rose-50',
      text: 'text-rose-700'
    }
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-6">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white/90 p-3 sm:p-5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {card.title}
                </p>

                <p className="text-xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2">
                  {card.value}
                </p>

                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {card.sub}
                </p>
              </div>

              <div className={`h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl ${card.bg} ${card.text} flex items-center justify-center`}>
                <Icon size={18} />
              </div>
            </div>

            <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${card.text.replace('text', 'bg')}`}
                style={{
                  width:
                    card.title.includes('Scores')
                      ? `${coverage}%`
                      : card.value > 0
                      ? '70%'
                      : '10%'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
