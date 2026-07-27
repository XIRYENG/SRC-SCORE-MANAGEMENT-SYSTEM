import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Search
} from 'lucide-react';
import { AnimatedSelect } from './ui/animated-select';
import { UXDashboardCards } from './UXDashboardCards';
import { EmptyState } from './sync-modal-tabs/EmptyState';

import { isValidUserRecord } from '../services/userIdentityResolver';

interface AnalysisDashboardProps {
  users: any[];
  importReport?: { unmatchedEntries: any[], missingUsers: any[] } | null;
  handleManualSync?: (entryIdx: number, entry: any) => Promise<void>;
  manualSyncTargets?: Record<number, string>;
  setManualSyncTargets?: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  isManualSyncing?: Record<number, boolean>;
}

const CATEGORIES = [
  { label: 'Diagnostic', value: 'diagnostic' },
  { label: 'Pre-Board', value: 'preboard' },
  { label: 'Post Test', value: 'posttest' },
  { label: 'Final Coaching', value: 'finalcoaching' }
];

const SUBJECTS = ['CLJ', 'LEA', 'FS', 'CDI', 'CRIM', 'CA'];

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  users,
  importReport,
  handleManualSync,
  manualSyncTargets,
  setManualSyncTargets,
  isManualSyncing
}) => {
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastSelectedCategory');
      if (saved) return saved.toLowerCase().replace(/\s+/g, '');
    }
    return 'diagnostic';
  });

  useEffect(() => {
    if (selectedCategory) {
      localStorage.setItem('lastSelectedCategory', selectedCategory);
    }
  }, [selectedCategory]);
  const [selectedSubject, setSelectedSubject] = useState('CLJ');
  const [sortConfig, setSortConfig] = useState<{ key: 'similarCorrect' | 'similarWrong' | 'total', direction: 'asc' | 'desc' }>({ key: 'total', direction: 'desc' });
  const [unmatchedSearch, setUnmatchedSearch] = useState('');

  const subjectLower = selectedSubject.toLowerCase();
  const answerPrefix = `${selectedCategory}_${subjectLower}`;

  const getScoreField = () => {
    if (selectedCategory === 'diagnostic') return `diag_${subjectLower}`;
    if (selectedCategory === 'preboard') return `score_${subjectLower}`;
    if (selectedCategory === 'posttest') return `post_${subjectLower}`;
    if (selectedCategory === 'finalcoaching') return `final_${subjectLower}`;
    return `score_${subjectLower}`;
  };

  const scoreField = getScoreField();

  const getStudentAnswer = (stu: any, item: number) => {
    return stu[`${answerPrefix}_Stu${item}`] ?? stu[`Stu${item}`] ?? '';
  };

  const getAnswerKey = (stu: any, item: number) => {
    return stu[`${answerPrefix}_Key${item}`] ?? stu[`Key${item}`] ?? '';
  };

  const getScore = (stu: any) => {
    const value = stu[scoreField];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return `${selectedCategory.toUpperCase()} ${selectedSubject}: ${value}`;
    }
    return `${selectedCategory.toUpperCase()} ${selectedSubject}: N/A`;
  };

  const filteredUnmatchedEntries = useMemo(() => {
    if (!importReport?.unmatchedEntries) return [];

    return importReport.unmatchedEntries.filter((entry: any) => {
      const entryCategory = entry.category || entry.updateData?.category;
      const entrySubject = entry.subject || entry.updateData?.subject;

      if (!entryCategory && !entrySubject) return true;

      return String(entryCategory).toLowerCase() === selectedCategory &&
        String(entrySubject).toUpperCase() === selectedSubject;
    });
  }, [importReport, selectedCategory, selectedSubject]);

  const missingUsersForSelectedScore = useMemo(() => {
    const activeUsers = users.filter(u => {
      const status = String(u.accountStatus || u.status || '').toLowerCase();
      const isDeleted = status === 'merged' || status === 'deleted' || u.isDeleted || u.deleted || u.is_deleted;
      return !u.is_archived && !isDeleted && isValidUserRecord(u);
    });

    return activeUsers.filter(u => {
      const value = u[scoreField];
      return value === undefined || value === null || String(value).trim() === '';
    });
  }, [users, scoreField]);




  return (
    <div className="p-2 sm:p-4">
      <UXDashboardCards
        users={users}
        selectedCategory={
          selectedCategory === 'diagnostic'
            ? 'Diagnostic'
            : selectedCategory === 'preboard'
            ? 'Pre-Board'
            : selectedCategory === 'posttest'
            ? 'Post Test'
            : 'Final Coaching'
        }
        selectedSubject={selectedSubject}
        unmatchedCount={filteredUnmatchedEntries.length}
      />

      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-1 gap-2 sm:gap-3 min-w-0 lg:min-w-0 analysis-one-column analysis-grid">
                <div className="space-y-2 text-xs border-l border-slate-200 pl-3">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
          <AlertCircle className="text-rose-500 w-5 h-5" />
          Unmatched Imported Scores
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <label className="block mb-1 text-[10px] uppercase font-black text-slate-500">Category</label>
            <AnimatedSelect
              value={selectedCategory}
              options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
              onChange={(val) => setSelectedCategory(val)}
              placeholder="Select Category"
              searchable={false}
              className="w-full"
              triggerClassName="h-9 border-slate-300 rounded-lg px-3 py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="block mb-1 text-[10px] uppercase font-black text-slate-500">Subject</label>
            <AnimatedSelect
              value={selectedSubject}
              options={SUBJECTS.map(s => ({ value: s, label: s }))}
              onChange={(val) => setSelectedSubject(val)}
              placeholder="Select Subject"
              searchable={false}
              className="w-full"
              triggerClassName="h-9 border-slate-300 rounded-lg px-3 py-2 text-xs font-bold"
            />
          </div>
        </div>

        {!importReport || filteredUnmatchedEntries.length === 0 ? (
          <EmptyState 
            icon={Search}
            title="No unmatched scores"
            description={`No unmatched scores found for ${selectedCategory.toUpperCase()} - ${selectedSubject}. All imported data correctly mapped to registered reviewees.`}
          />
        ) : (
          <div className="flex flex-col h-full space-y-4">
            <div className="bg-rose-50 text-rose-600 text-xs font-medium p-3 rounded-lg border border-rose-100 leading-relaxed">
              These scores did not automatically match. Select a reviewee to manually sync this {selectedCategory.toUpperCase()} - {selectedSubject} score.
            </div>

            <input
              value={unmatchedSearch}
              onChange={(e) => setUnmatchedSearch(e.target.value)}
              placeholder="Search reviewee name..."
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500"
            />

            <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col bg-white">
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 font-bold text-slate-600 text-xs uppercase tracking-wider flex justify-between">
                <span>CSV Entry Details</span>
                <span>Action</span>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[70vh] lg:max-h-[85vh] custom-scrollbar bg-white divide-y divide-slate-100">
                {filteredUnmatchedEntries
                  .filter((e: any) =>
                    String(e.name || '').toLowerCase().includes(unmatchedSearch.toLowerCase())
                  )
                  .map((e: any, i: number) => (
                  <div key={i} className="p-2 sm:p-3 hover:bg-slate-50 transition-colors flex flex-col gap-2 compact-analysis-card">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-800 text-sm mb-1">{e.name || 'Unknown Name'}</div>
                        <div className="text-xs font-mono text-slate-500 font-bold flex items-center gap-2">
                          ID: <span className="bg-slate-100 px-1.5 rounded">{e.id || 'N/A'}</span>
                        </div>
                        <div className="text-[10px] mt-1 font-black uppercase text-blue-600">
                          {e.category || e.updateData?.category || selectedCategory} / {e.subject || e.updateData?.subject || selectedSubject}
                        </div>
                      </div>

                      {e.rawScore !== undefined && (
                        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md text-xs font-black shadow-sm">
                          Score: {e.rawScore}
                        </div>
                      )}
                    </div>

                    {e.possibleMatches && e.possibleMatches.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-400">
                          Suggested Matches
                        </p>

                        {e.possibleMatches.map((m: any) => (
                          <button
                            key={m.doc_id}
                            onClick={() =>
                              setManualSyncTargets?.(prev => ({
                                ...prev,
                                [i]: m.doc_id
                              }))
                            }
                            className="w-full text-left px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-100 text-[10px] font-bold text-blue-700"
                          >
                            {m.last_name}, {m.first_name}
                            <span className="ml-1 text-blue-400">
                              ({m.seq_id || 'No ID'})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {e.updateData && missingUsersForSelectedScore.length > 0 && (
                      <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg border border-slate-200">
                        <AnimatedSelect
                          value={manualSyncTargets?.[i] || ''}
                          options={[
                            { value: "", label: "-- Select corresponding reviewee --" },
                            ...missingUsersForSelectedScore.map(u => ({
                              value: u.doc_id,
                              label: `${u.last_name}, ${u.first_name} (${u.seq_id || 'N/A'})`
                            }))
                          ]}
                          onChange={(val) => setManualSyncTargets?.(prev => ({ ...prev, [i]: val }))}
                          placeholder="Select Reviewee"
                          label="Corresponding Reviewee"
                          className="flex-1"
                          triggerClassName="h-9 text-xs border-slate-300 rounded-md shadow-sm bg-white"
                        />

                        <button
                          disabled={!manualSyncTargets?.[i] || isManualSyncing?.[i]}
                          onClick={() => handleManualSync?.(i, e)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                        >
                          {isManualSyncing?.[i] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'SYNC'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</div>
  );
};
