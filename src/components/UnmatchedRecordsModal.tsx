import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search } from 'lucide-react';
import { getBestMatch } from '../lib/stringSimilarity';

interface UnmatchedRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unmatchedEntries: any[];
  onManualSync: (index: number, entry: any, targetId: string) => void;
  isManualSyncing: { [key: number]: boolean };
  missingUsersForSelectedScore: any[];
}

export const UnmatchedRecordsModal: React.FC<UnmatchedRecordsModalProps> = ({
  isOpen,
  onClose,
  unmatchedEntries,
  onManualSync,
  isManualSyncing,
  missingUsersForSelectedScore
}) => {
  const [search, setSearch] = useState('');
  const [manualSyncTargets, setManualSyncTargets] = useState<{ [key: number]: string }>({});

  const filteredEntries = unmatchedEntries.filter(entry => 
    entry.name.toLowerCase().includes(search.toLowerCase()) || 
    (entry.id && entry.id.toLowerCase().includes(search.toLowerCase()))
  );

  const handleBulkMatch = () => {
    const newTargets = { ...manualSyncTargets };
    unmatchedEntries.forEach((entry, i) => {
      const bestMatch = getBestMatch(entry.name, missingUsersForSelectedScore);
      if (bestMatch) {
         newTargets[i] = bestMatch.doc_id;
      }
    });
    setManualSyncTargets(newTargets);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-lg text-slate-800">Unmatched Records ({unmatchedEntries.length})</h2>
              <div className="flex gap-2">
                <button
                   onClick={handleBulkMatch}
                   className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded"
                >
                    Bulk Match
                </button>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
            </div>
            
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {filteredEntries.map((entry, i) => (
                <div key={i} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-slate-900">{entry.name}</span>
                    <span className="text-xs font-mono bg-slate-200 px-2 py-0.5 rounded">ID: {entry.id || 'N/A'}</span>
                  </div>
                  
                  {/* Re-linking dropdown */}
                  <div className="flex flex-col gap-2 mt-3">
                    {entry.possibleMatches && entry.possibleMatches.length > 0 && (
                        <div className="text-[10px] uppercase font-bold text-slate-500">Suggested Matches</div>
                    )}
                    {entry.possibleMatches?.map((match: any) => (
                      <button 
                        key={match.doc_id}
                        onClick={() => onManualSync(i, entry, match.doc_id)}
                        className="text-left text-xs p-2 rounded bg-blue-50 text-blue-800 border border-blue-100 hover:bg-blue-100"
                      >
                         {match.last_name}, {match.first_name} ({match.seq_id || 'N/A'})
                      </button>
                    ))}
                    
                    <select
                      className="flex-1 text-xs p-2 border border-slate-300 rounded-md bg-white"
                      value={manualSyncTargets[i] || ''}
                      onChange={(e) => setManualSyncTargets(prev => ({ ...prev, [i]: e.target.value }))}
                    >
                      <option value="">-- Select from database --</option>
                      {missingUsersForSelectedScore.map(u => (
                        <option key={u.doc_id} value={u.doc_id}>
                          {u.last_name}, {u.first_name} ({u.seq_id || 'N/A'})
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!manualSyncTargets[i] || isManualSyncing[i]}
                      onClick={() => onManualSync(i, entry, manualSyncTargets[i])}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isManualSyncing[i] ? 'Syncing...' : 'Link'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
