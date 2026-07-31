import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Folder } from 'lucide-react';
import { firestoreDb } from '../../utils/firebaseClient';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ScoreFolder, RevieweeData } from '../../types';
import { EmptyState } from './EmptyState';

interface DeletedFoldersTabProps {
  currentUser?: RevieweeData | null;
}

export const DeletedFoldersTab: React.FC<DeletedFoldersTabProps> = ({ currentUser }) => {
  const [deletedFolders, setDeletedFolders] = useState<ScoreFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestoreDb) return;
    const q = query(collection(firestoreDb, 'score_folders'), where('isDeleted', '==', true));
    const unsub = onSnapshot(q, (snapshot) => {
      const folders: ScoreFolder[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        folders.push({ id: doc.id, ...data } as ScoreFolder);
      });
      setDeletedFolders(folders.sort((a, b) => b.deletedAt?.seconds - a.deletedAt?.seconds));
      setLoading(false);
    });
    return unsub;
  }, []);

  const restoreFolder = async (folderId: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(firestoreDb, 'score_folders', folderId), {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        restoredAt: serverTimestamp(),
        restoredBy: currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      });
    } catch (err) {
      console.error("Error restoring folder:", err);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="bg-[#0B1220] rounded-[2rem] border border-white/10 overflow-hidden flex flex-col h-[calc(100vh-14rem)] shadow-2xl">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Deleted Folders</h3>
        <p className="text-xs text-slate-400 mt-1">Folders deleted within the last 30 days can be restored.</p>
      </div>
      <div className="overflow-x-auto flex-1 p-4 custom-scrollbar">
        {deletedFolders.length === 0 ? (
          <EmptyState 
            icon={Trash2}
            title="No deleted folders"
            description="Deleted folders will appear here for 30 days."
          />
        ) : (
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase tracking-widest font-black text-[10px]">
                <th className="p-3">Folder Name</th>
                <th className="p-3">Deleted At</th>
                <th className="p-3">Deleted By</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deletedFolders.map(folder => (
                <tr key={folder.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-3 font-medium text-white flex items-center gap-2">
                    <Folder size={14} className="text-slate-500" />
                    {folder.name}
                  </td>
                  <td className="p-3 font-mono text-slate-400">
                    {folder.deletedAt ? new Date(folder.deletedAt.seconds * 1000).toLocaleString() : 'N/A'}
                  </td>
                  <td className="p-3 text-slate-400">{folder.deletedBy || 'Unknown'}</td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => restoreFolder(folder.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20 font-bold transition-all"
                    >
                      <RotateCcw size={12} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
