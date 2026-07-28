import React, { useState, useMemo } from 'react';
import { Trophy, Medal, Search, Star, Award, Crown, User, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';
import { getResolvedDetailedScore } from '../utils/scoreFieldResolver';
import { isValidRevieweeRecord } from '../services/userIdentityResolver';

const CATEGORIES = [
  { label: 'Diagnostic', value: 'diagnostic' },
  { label: 'Pretest', value: 'pretest' },
  { label: 'Pre-Board', value: 'preboard' },
  { label: 'Post Test', value: 'posttest' },
  { label: 'Quiz', value: 'quiz' },
  { label: 'Daily Evaluation', value: 'dailyevaluation' },
  { label: 'Removal', value: 'removal' },
  { label: 'Final Coaching', value: 'finalcoaching' }
];

const SUBJECTS = [
  { id: 'OVERALL', label: 'Overall Ranking' },
  { id: 'CLJ', label: 'CLJ' },
  { id: 'LEA', label: 'LEA' },
  { id: 'FS', label: 'FS' },
  { id: 'CDI', label: 'CDI' },
  { id: 'CRIM', label: 'CRIM' },
  { id: 'CA', label: 'CA' }
];

interface LeaderboardDashboardProps {
  users: any[];
}

export const LeaderboardDashboard: React.FC<LeaderboardDashboardProps> = ({ users }) => {
  const [selectedCategory, setSelectedCategory] = useState('diagnostic');
  const [selectedSubject, setSelectedSubject] = useState('OVERALL');
  const [searchQuery, setSearchQuery] = useState('');

  const leaderboardData = useMemo(() => {
    const activeUsers = users.filter(u => (u.role === 'Reviewee' || u.role === 'Student') && !u.is_archived && isValidRevieweeRecord(u));
    
    const ranked = activeUsers.map(u => {
      let score: number | null = null;
      
      if (selectedSubject === 'OVERALL') {
        // Calculate average of all subjects for this category
        const subjs = ['CLJ', 'LEA', 'FS', 'CDI', 'CRIM', 'CA'];
        let sum = 0;
        let count = 0;
        subjs.forEach(s => {
          const detail = getResolvedDetailedScore(u, selectedCategory, s);
          if (detail.earnedScore !== null) {
            sum += (detail.earnedScore / detail.possiblePoints) * 100;
            count++;
          }
        });
        score = count > 0 ? Number((sum / count).toFixed(2)) : null;
      } else {
        const detail = getResolvedDetailedScore(u, selectedCategory, selectedSubject);
        score = detail.earnedScore !== null ? Number(((detail.earnedScore / detail.possiblePoints) * 100).toFixed(2)) : null;
      }

      return {
        ...u,
        displayScore: score
      };
    });

    // Sort by score descending
    const sorted = [...ranked].sort((a, b) => {
      if (a.displayScore === null) return 1;
      if (b.displayScore === null) return -1;
      return b.displayScore - a.displayScore;
    });

    // Filter by search query
    return sorted.filter(u => {
      if (!searchQuery) return true;
      const fullName = `${u.first_name || ''} ${u.middle_name ? u.middle_name + ' ' : ''}${u.last_name || ''}`.toLowerCase();
      const idStr = String(u.seq_id || u.id_number || '').toLowerCase();
      return fullName.includes(searchQuery.toLowerCase()) || idStr.includes(searchQuery.toLowerCase());
    });
  }, [users, selectedCategory, selectedSubject, searchQuery]);

  const top3 = leaderboardData.slice(0, 3).filter(u => u.displayScore !== null);

  return (
    <div className="space-y-4 p-2 sm:p-4 animate-fade-in">
      {/* Top 3 Spotlight */}
      {top3.length > 0 && !searchQuery && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {top3.map((user, index) => (
            <div 
              key={user.uid || user.doc_id}
              className={`relative overflow-hidden rounded-3xl p-6 border transition-all hover:scale-[1.02] duration-300 ${
                index === 0 
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-400 shadow-amber-200/50' 
                  : index === 1
                  ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white border-slate-300 shadow-slate-200/50'
                  : 'bg-gradient-to-br from-amber-700 to-amber-800 text-white border-amber-600 shadow-amber-900/20'
              } shadow-xl`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-20">
                {index === 0 ? <Crown size={64} /> : index === 1 ? <Award size={64} /> : <Star size={64} />}
              </div>
              
              <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border-2 border-white/30 shadow-inner">
                  <span className="text-2xl font-black">{index + 1}</span>
                </div>
                
                <div>
                  <h3 className="text-lg font-black tracking-tight w-full">
                    {user.first_name} {user.middle_name ? user.middle_name + ' ' : ''}{user.last_name}
                  </h3>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">
                    {user.school_name || 'No School'}
                  </p>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/20">
                   <span className="text-2xl font-black">{user.displayScore.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
              <Trophy size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">Top Performers</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">
                Ranking for {CATEGORIES.find(c => c.value === selectedCategory)?.label}
              </p>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              className="w-full lg:w-80 pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
               <Filter size={10} /> Select Category
             </span>
             <div className="flex flex-wrap gap-2">
               {CATEGORIES.map(cat => (
                 <button
                   key={cat.value}
                   onClick={() => setSelectedCategory(cat.value)}
                   className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                     selectedCategory === cat.value
                       ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                       : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                   }`}
                 >
                   {cat.label}
                 </button>
               ))}
             </div>
          </div>

          <div className="flex flex-col gap-3">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
               <Award size={10} /> Select Subject Area
             </span>
             <div className="flex flex-wrap gap-2">
               {SUBJECTS.map(subj => (
                 <button
                   key={subj.id}
                   onClick={() => setSelectedSubject(subj.id)}
                   className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                     selectedSubject === subj.id
                       ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                       : 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-slate-700'
                   }`}
                 >
                   {subj.label}
                 </button>
               ))}
             </div>
          </div>
        </div>
      </div>

      {/* Rankings List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-20 text-center">Rank</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Reviewee Information</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Score</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {leaderboardData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                       <Search className="text-slate-300 w-12 h-12" />
                       <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No records found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                leaderboardData.map((user, index) => {
                  const rank = index + 1;
                  const isTopRank = rank <= 3;
                  
                  return (
                    <tr key={user.doc_id || user.uid} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center">
                          {rank === 1 ? (
                            <div className="w-10 h-10 bg-amber-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200 rotate-3">
                               <Crown size={20} />
                            </div>
                          ) : rank === 2 ? (
                            <div className="w-10 h-10 bg-slate-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-200 -rotate-3">
                               <Award size={20} />
                            </div>
                          ) : rank === 3 ? (
                            <div className="w-10 h-10 bg-amber-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-900/20 rotate-1">
                               <Star size={20} />
                            </div>
                          ) : (
                            <span className="text-lg font-black text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                              {rank.toString().padStart(2, '0')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shadow-inner ${
                            rank === 1 ? 'bg-amber-100 text-amber-700' : 
                            rank === 2 ? 'bg-slate-100 text-slate-700' : 
                            rank === 3 ? 'bg-amber-50 text-amber-900' : 
                            'bg-slate-50 dark:bg-slate-800 text-slate-400'
                          }`}>
                            {user.first_name?.[0]}{user.middle_name?.[0] || user.last_name?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                              {user.last_name}, {user.first_name} {user.middle_name || ''}
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{user.school_name || 'No School'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-xl font-black tracking-tighter ${
                            (user.displayScore ?? 0) >= 75 ? 'text-emerald-600' : 
                            (user.displayScore ?? 0) >= 50 ? 'text-blue-600' : 
                            'text-slate-400'
                          }`}>
                            {user.displayScore !== null ? `${user.displayScore.toFixed(2)}%` : '0.00%'}
                          </span>
                          {user.displayScore !== null && (
                            <div className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                               <div 
                                 className={`h-full rounded-full ${
                                   user.displayScore >= 75 ? 'bg-emerald-500' : 'bg-blue-500'
                                 }`}
                                 style={{ width: `${user.displayScore}%` }}
                               />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                           {user.displayScore !== null ? (
                             <>
                               {user.displayScore >= 75 ? (
                                 <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                   <TrendingUp size={12} /> High Performer
                                 </div>
                               ) : user.displayScore >= 50 ? (
                                 <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                   <Star size={12} /> On Track
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-1.5 bg-slate-50 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                   <TrendingDown size={12} /> Developing
                                 </div>
                               )}
                             </>
                           ) : (
                             <div className="flex items-center gap-1.5 text-slate-300 text-[10px] font-black uppercase tracking-widest">
                               <Minus size={12} /> No Score Data
                             </div>
                           )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
