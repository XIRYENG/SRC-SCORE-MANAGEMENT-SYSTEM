import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder, FolderPlus, MoreVertical, Edit, Archive, Trash2, Eye, EyeOff, Calendar, Users, AlertTriangle, Building2, GitBranch, Loader2 } from 'lucide-react';
import { AnimatedDatePicker } from '../ui/animated-date-picker';
import { AnimatedSelect } from '../ui/animated-select';
import { ScoreFolder, ScoreFolderType, RevieweeData } from '../../types';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { firestoreDb } from '../../utils/firebaseClient';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, onSnapshot, where, getCountFromServer } from 'firebase/firestore';
import { SearchableMultiSelect } from '../searchable-multi-select';
import { formatFolderScopeDisplay, formatFolderType } from '../../utils/folderScope';
import { FolderScopeConfig } from './FolderScopeConfig';
import { FolderModal } from './FolderModal';
import { ConfirmActionModal } from '../ConfirmActionModal';

const DEFAULT_SCHOOL_OPTIONS = [
  { id: 'CKCM', name: 'CKCM (Christ the King College de Maranding)' },
  { id: 'LSSTI', name: 'LSSTI (Lanao School of Science and Technology, Inc.)' },
  { id: 'NCMC', name: 'NCMC (North Central Mindanao College)' },
  { id: 'PCCr', name: 'Philippine College of Criminology' },
  { id: 'UC', name: 'University of the Cordilleras' },
  { id: 'UM', name: 'University of Manila' },
  { id: 'COC', name: 'Cagayan de Oro College' },
  { id: 'MU', name: 'Misamis University' },
  { id: 'UMindanao', name: 'University of Mindanao' },
  { id: 'HCC', name: 'Holy Cross of Davao College' },
  { id: 'WMSU', name: 'Western Mindanao State University' },
  { id: 'MSU', name: 'Mindanao State University' },
  { id: 'unassigned', name: 'Unassigned School' }
];

const DEFAULT_BRANCH_OPTIONS = [
  { id: 'Iligan City', name: 'Iligan City' },
  { id: 'Lala/Maranding', name: 'Lala/Maranding' },
  { id: 'Labason', name: 'Labason' },
  { id: 'Valencia', name: 'Valencia' },
  { id: 'Balingasag', name: 'Balingasag' },
  { id: 'No Branch', name: 'No Branch' },
  { id: 'unassigned', name: 'Unassigned Branch' }
];

export function ScoreFolderDashboard({ 
  currentUser, 
  onOpenFolder 
}: { 
  currentUser?: RevieweeData | null;
  onOpenFolder: (folder: ScoreFolder) => void;
}) {
  const { folders, loading } = useScoreFolders();
  const [isCreating, setIsCreating] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ScoreFolder | null>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    folder: ScoreFolder | null;
    action: 'delete' | 'archive' | 'bulkDelete' | 'hide' | 'publish' | null;
    recordCount: number | null;
    isLoading: boolean;
  }>({ isOpen: false, folder: null, action: null, recordCount: null, isLoading: false });

  const activeFolders = folders.filter(f => !f.isArchived && !f.isDeleted);
  
  const toggleFolderSelection = (folderId: string) => {
    setSelectedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };
  
  const handleArchive = async () => {
    if (!confirmModal.folder || !currentUser) return;
    setConfirmModal(prev => ({ ...prev, isLoading: true }));
    try {
      await updateDoc(doc(firestoreDb, 'score_folders', confirmModal.folder.id), {
        isArchived: true,
        archivedAt: serverTimestamp(),
        archivedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      });
      setConfirmModal({ isOpen: false, folder: null, action: null, recordCount: null, isLoading: false });
    } catch (err) {
      console.error("Error archiving folder:", err);
      setConfirmModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleDelete = async () => {
    if (!confirmModal.folder || !currentUser) return;
    setConfirmModal(prev => ({ ...prev, isLoading: true }));
    try {
      if (confirmModal.action === 'bulkDelete') {
        await Promise.all(
          Array.from(selectedFolderIds).map(id =>
            updateDoc(doc(firestoreDb, 'score_folders', id), {
              isDeleted: true,
              publicationStatus: 'hidden',
              deletedAt: serverTimestamp(),
              deletedBy: currentUser.uid,
              updatedAt: serverTimestamp(),
              updatedBy: currentUser.uid
            })
          )
        );
        setSelectedFolderIds(new Set());
      } else {
        await updateDoc(doc(firestoreDb, 'score_folders', confirmModal.folder.id), {
          isDeleted: true,
          publicationStatus: 'hidden',
          deletedAt: serverTimestamp(),
          deletedBy: currentUser.uid,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid
        });
      }
      setConfirmModal({ isOpen: false, folder: null, action: null, recordCount: null, isLoading: false });
    } catch (err) {
      console.error("Error deleting folder:", err);
      setConfirmModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleTogglePublish = async () => {
    if (!confirmModal.folder || !currentUser) return;
    setConfirmModal(prev => ({ ...prev, isLoading: true }));
    try {
      await updateDoc(doc(firestoreDb, 'score_folders', confirmModal.folder.id), {
        publicationStatus: confirmModal.action === 'publish' ? 'published' : 'hidden',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      });
      setConfirmModal({ isOpen: false, folder: null, action: null, recordCount: null, isLoading: false });
    } catch (err) {
      console.error("Error toggling publish:", err);
      setConfirmModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const openConfirmModal = async (folder: ScoreFolder | null, action: 'delete' | 'archive' | 'bulkDelete' | 'hide' | 'publish') => {
    setConfirmModal({ isOpen: true, folder, action, recordCount: null, isLoading: true });
    try {
      if (action === 'bulkDelete') {
        // For simplicity in this bulk delete, we don't count records here, but we can if requested later.
        setConfirmModal(prev => ({ ...prev, recordCount: null, isLoading: false }));
      } else if (folder) {
        const q = query(collection(firestoreDb, 'scoreRecords'), where('folderId', '==', folder.id));
        const snapshot = await getCountFromServer(q);
        setConfirmModal(prev => ({ ...prev, recordCount: snapshot.data().count, isLoading: false }));
      }
    } catch (err) {
      console.error("Error counting records:", err);
      setConfirmModal(prev => ({ ...prev, isLoading: false, recordCount: 0 }));
    }
  };
  
  if (loading) {
    return (
      <div className="flex-1 min-h-0 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (activeFolders.length === 0 && !isCreating && !editingFolder) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-yellow-100 to-yellow-50 border border-yellow-200/50 shadow-xl shadow-yellow-500/10 backdrop-blur-sm">
            <FolderPlus className="h-10 w-10 text-yellow-600 drop-shadow-sm" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2">No score folders yet</h2>
        <p className="text-slate-500 max-w-sm mb-8 text-sm leading-relaxed">
          Create a score folder to organize reviewee scores by review phase, marathon, final coaching, or another review period.
        </p>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 transition-all active:scale-95"
        >
          <FolderPlus size={18} />
          Create New Score Folder
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-auto bg-slate-50/50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Score Management</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Organize and manage reviewee scores by phase and target school/branch scope</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-500 transition-all active:scale-95"
          >
            <FolderPlus size={18} />
            New Folder
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeFolders.map(folder => (
            <FolderCard 
              key={folder.id} 
              folder={folder} 
              onOpen={() => onOpenFolder(folder)} 
              currentUser={currentUser} 
              onEdit={setEditingFolder} 
              onArchive={() => openConfirmModal(folder, 'archive')}
              onDelete={() => openConfirmModal(folder, 'delete')}
              onTogglePublish={(action) => openConfirmModal(folder, action)}
              isSelected={selectedFolderIds.has(folder.id)}
              onToggleSelection={() => toggleFolderSelection(folder.id)}
            />
          ))}
        </div>
      </div>
      
      {selectedFolderIds.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 flex items-center gap-4">
          <span className="text-sm font-bold text-slate-700">{selectedFolderIds.size} folders selected</span>
          <button 
            onClick={() => openConfirmModal(null, 'bulkDelete')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-500 transition-colors"
          >
            <Trash2 size={16} /> Bulk Delete
          </button>
        </div>
      )}

      {/* We intercept hide/publish with a custom modal since ConfirmActionModal requires typing */}
      <AnimatePresence>
        {(confirmModal.action === 'hide' || confirmModal.action === 'publish') && confirmModal.isOpen && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900">
                {confirmModal.action === 'hide' ? 'Hide this Score Folder from Reviewees?' : 'Publish this Score Folder to Reviewees?'}
              </h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                {confirmModal.action === 'hide'
                  ? 'This will remove the folder and its scores from the Reviewee Portal. Existing records will not be deleted.'
                  : 'Eligible Reviewees matching the folder’s School and Branch scope will be able to view it.'}
              </p>
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false, folder: null, action: null }))}
                  disabled={confirmModal.isLoading}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTogglePublish}
                  disabled={confirmModal.isLoading}
                  className={`px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50 flex items-center gap-2 ${confirmModal.action === 'hide' ? 'bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-200' : 'bg-teal-600 hover:bg-teal-700 shadow-sm shadow-teal-200'}`}
                >
                  {confirmModal.isLoading ? <Loader2 size={16} className="animate-spin" /> : confirmModal.action === 'hide' ? <EyeOff size={16} /> : <Eye size={16} />}
                  {confirmModal.action === 'hide' ? 'Hide Folder' : 'Publish Folder'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmActionModal 
        isOpen={confirmModal.isOpen && confirmModal.action !== 'hide' && confirmModal.action !== 'publish'}
        title={confirmModal.action === 'bulkDelete' ? 'Bulk Delete Folders' : confirmModal.action === 'delete' ? 'Delete Score Folder' : 'Archive Score Folder'}
        subtitle={confirmModal.action === 'bulkDelete' ? 'Permanent Deletion' : confirmModal.action === 'delete' ? 'Permanent Deletion' : 'Folder Archiving'}
        message={
          confirmModal.action === 'bulkDelete'
            ? `This action cannot be undone. You are about to permanently delete ${selectedFolderIds.size} folders.`
            : confirmModal.action === 'delete' 
              ? `This action cannot be undone. You are about to permanently delete "${confirmModal.folder?.name}". This folder contains ${confirmModal.recordCount} records.`
              : `You are about to archive "${confirmModal.folder?.name}". This folder contains ${confirmModal.recordCount} records, which will be hidden from reviewees.`
        }
        confirmWord={confirmModal.action === 'bulkDelete' ? 'BULK DELETE' : confirmModal.action === 'delete' ? 'DELETE' : 'ARCHIVE'}
        isLoading={confirmModal.isLoading}
        onConfirm={confirmModal.action === 'delete' || confirmModal.action === 'bulkDelete' ? handleDelete : handleArchive}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false, folder: null, action: null }))}
      />

      <AnimatePresence>
        {(isCreating || editingFolder) && (
          <FolderModal 
            onClose={() => { setIsCreating(false); setEditingFolder(null); }} 
            currentUser={currentUser}
            initialFolder={editingFolder || undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FolderCard({ folder, onOpen, currentUser, onEdit, onArchive, onDelete, onTogglePublish, isSelected, onToggleSelection }: { 
  folder: ScoreFolder; 
  onOpen: () => void; 
  currentUser: any; 
  onEdit: (folder: ScoreFolder) => void;
  onArchive: () => void;
  onDelete: () => void;
  onTogglePublish: (action: 'hide' | 'publish') => void;
  isSelected: boolean;
  onToggleSelection: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const scopeDisplay = formatFolderScopeDisplay(folder);

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <div 
      onClick={onOpen}
      className={`group relative flex flex-col rounded-2xl bg-white p-5 shadow-sm border ${isSelected ? 'border-teal-500 shadow-md' : 'border-slate-200'} hover:shadow-md hover:border-teal-200 transition-all cursor-pointer text-left ${isMenuOpen ? 'z-50 overflow-visible' : 'z-10'}`}
    >
      <div className={`flex justify-between items-start mb-3 relative ${isMenuOpen ? 'z-50' : 'z-20'}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 border border-yellow-100/50">
          <Folder size={24} className="fill-yellow-100" />
        </div>
        
        <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={(e) => { e.stopPropagation(); onToggleSelection(); }}
              className="h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <div className="relative z-50">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              >
                <MoreVertical size={18} />
              </button>

          
          <AnimatePresence>
            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }} 
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, transformOrigin: 'top right' }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="folder-card-options-menu absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 overflow-visible"
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onEdit(folder); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <Edit size={16} className="text-slate-500" /> Edit
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onTogglePublish(folder.publicationStatus === 'published' ? 'hide' : 'publish'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                  >
                    {folder.publicationStatus === 'published' ? <><EyeOff size={16} className="text-slate-500" /> Hide from Reviewees</> : <><Eye size={16} className="text-slate-500" /> Publish to Reviewees</>}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onArchive(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium transition-colors border-t border-slate-100"
                  >
                    <Archive size={16} className="text-rose-500" /> Archive
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onDelete(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium transition-colors border-t border-slate-100"
                    >
                      <Trash2 size={16} className="text-rose-500" /> Delete
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>

      <div className="mb-3 relative z-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">{folder.name}</h3>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 shrink-0">
            {formatFolderType(folder.folderType ?? folder.type)}
          </span>
        </div>
        {folder.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-2">{folder.description}</p>
        )}

        {/* School and Branch Scope details */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <div 
            className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200/60"
            title={scopeDisplay.schoolsDetail.length > 0 ? scopeDisplay.schoolsDetail.join(', ') : 'All Schools'}
          >
            <Building2 size={12} className="text-slate-400" />
            <span className="text-slate-500 font-bold">Schools:</span>
            <span className="truncate max-w-[120px]">{scopeDisplay.schoolsLabel}</span>
          </div>
          <div 
            className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200/60"
            title={scopeDisplay.branchesDetail.length > 0 ? scopeDisplay.branchesDetail.join(', ') : 'All Branches'}
          >
            <GitBranch size={12} className="text-slate-400" />
            <span className="text-slate-500 font-bold">Branches:</span>
            <span className="truncate max-w-[120px]">{scopeDisplay.branchesLabel}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 relative z-0">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Calendar size={14} className="text-slate-400" />
          {folder.startDate ? new Date(folder.startDate?.seconds * 1000 || folder.startDate).toLocaleDateString() : 'No date'}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <div className={`h-2 w-2 rounded-full ${folder.publicationStatus === 'published' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          {folder.publicationStatus === 'published' ? 'Published' : 'Hidden'}
        </div>
      </div>
      

      {/* Background decoration */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute right-0 bottom-0 p-4 opacity-[0.03] pointer-events-none transition-transform group-hover:scale-110 duration-500 ease-out">
          <Folder size={120} />
        </div>
      </div>
    </div>
  );
}
