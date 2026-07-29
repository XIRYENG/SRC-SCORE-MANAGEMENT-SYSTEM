import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder, FolderPlus, MoreVertical, Edit, Archive, Eye, EyeOff, Calendar, Users, Upload, CheckCircle } from 'lucide-react';
import { AnimatedDatePicker } from '../ui/animated-date-picker';
import { ScoreFolder, ScoreFolderType, RevieweeData } from '../../types';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { firestoreDb } from '../../utils/firebaseClient';
import { doc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';

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

  const activeFolders = folders.filter(f => !f.isArchived);
  
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
            <p className="text-sm font-medium text-slate-500 mt-1">Organize and manage reviewee scores by phase</p>
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
            <FolderCard key={folder.id} folder={folder} onOpen={() => onOpenFolder(folder)} currentUser={currentUser} onEdit={setEditingFolder} />
          ))}
        </div>
      </div>

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

function FolderCard({ folder, onOpen, currentUser, onEdit }: { folder: ScoreFolder; onOpen: () => void; currentUser: any; onEdit: (folder: ScoreFolder) => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const togglePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(firestoreDb, 'scoreFolders', folder.id), {
        publicationStatus: folder.publicationStatus === 'published' ? 'hidden' : 'published',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || 'unknown'
      });
    } catch (err) {
      console.error("Error toggling publish:", err);
    }
  };

  const archiveFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Archive this folder? This will hide it from reviewees but keep data intact.")) {
      try {
        await updateDoc(doc(firestoreDb, 'scoreFolders', folder.id), {
          isArchived: true,
          archivedAt: serverTimestamp(),
          archivedBy: currentUser?.uid || 'unknown',
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || 'unknown'
        });
      } catch (err) {
        console.error("Error archiving folder:", err);
      }
    }
  };

  return (
    <div 
      onClick={onOpen}
      className="group relative flex flex-col rounded-2xl bg-white p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer text-left overflow-hidden"
    >
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 border border-yellow-100/50">
          <Folder size={24} className="fill-yellow-100" />
        </div>
        
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <MoreVertical size={18} />
          </button>
          
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, transformOrigin: 'top right' }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20"
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onEdit(folder); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Edit size={16} /> Edit
                </button>
                <button 
                  onClick={togglePublish}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {folder.publicationStatus === 'published' ? <><EyeOff size={16} /> Hide</> : <><Eye size={16} /> Publish</>}
                </button>
                <button 
                  onClick={archiveFolder}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <Archive size={16} /> Archive
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mb-4 relative z-10">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">{folder.name}</h3>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
            {folder.type ? folder.type.replace(/_/g, ' ') : 'Custom'}
          </span>
        </div>
        {folder.description && (
          <p className="text-sm text-slate-500 line-clamp-2">{folder.description}</p>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 relative z-10">
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
      <div className="absolute right-0 bottom-0 p-4 opacity-[0.03] pointer-events-none transition-transform group-hover:scale-110 duration-500 ease-out">
        <Folder size={120} />
      </div>
    </div>
  );
}

function FolderModal({ onClose, currentUser, initialFolder }: { onClose: () => void; currentUser: any, initialFolder?: ScoreFolder }) {
  const [formData, setFormData] = useState({
    name: initialFolder?.name || '',
    type: initialFolder?.type || 'phase_1',
    description: initialFolder?.description || '',
    startDate: initialFolder?.startDate ? (initialFolder.startDate?.seconds ? new Date(initialFolder.startDate.seconds * 1000).toISOString().split('T')[0] : new Date(initialFolder.startDate).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
    publicationStatus: initialFolder?.publicationStatus || 'published',
    includeInReadiness: initialFolder?.includeInReadiness ?? true,
    readinessWeight: initialFolder?.readinessWeight || 10
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialFolder) {
        await updateDoc(doc(firestoreDb, 'scoreFolders', initialFolder.id), {
          name: formData.name,
          normalizedName: formData.name.toLowerCase().trim(),
          type: formData.type,
          description: formData.description,
          startDate: formData.startDate ? new Date(formData.startDate) : null,
          publicationStatus: formData.publicationStatus,
          includeInReadiness: formData.includeInReadiness,
          readinessWeight: Number(formData.readinessWeight),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.uid || 'unknown'
        });
      } else {
        const folderRef = doc(collection(firestoreDb, 'scoreFolders'));
        await setDoc(folderRef, {
          id: folderRef.id,
          name: formData.name,
          normalizedName: formData.name.toLowerCase().trim(),
          type: formData.type,
          description: formData.description,
          startDate: formData.startDate ? new Date(formData.startDate) : null,
          endDate: null,
          publicationStatus: formData.publicationStatus,
          isArchived: false,
          includeInReadiness: formData.includeInReadiness,
          readinessWeight: Number(formData.readinessWeight),
          displayOrder: 1,
          createdBy: currentUser?.uid || 'unknown',
          createdAt: serverTimestamp(),
          updatedBy: currentUser?.uid || 'unknown',
          updatedAt: serverTimestamp()
        });
      }
      onClose();
    } catch (err) {
      console.error("Error saving folder:", err);
      alert("Failed to save folder");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{initialFolder ? 'Edit Score Folder' : 'Create Score Folder'}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <form id="folder-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Folder Name <span className="text-rose-500">*</span></label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Phase 1" 
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Type</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as any})}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow appearance-none"
                >
                  <option value="phase_1">Phase 1</option>
                  <option value="phase_2">Phase 2</option>
                  <option value="phase_3">Phase 3</option>
                  <option value="marathon">Marathon</option>
                  <option value="final_coaching">Final Coaching</option>
                  <option value="pre_board_series">Pre-Board Series</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Start Date</label>
                <AnimatedDatePicker 
                  value={formData.startDate}
                  onChange={val => setFormData({...formData, startDate: val})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Description (Optional)</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Briefly describe what this folder is for..." 
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow min-h-[80px] resize-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Publication Status</label>
                <select 
                  value={formData.publicationStatus}
                  onChange={e => setFormData({...formData, publicationStatus: e.target.value as any})}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow appearance-none"
                >
                  <option value="published">Published</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Readiness Weight (%)</label>
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  value={formData.readinessWeight}
                  onChange={e => setFormData({...formData, readinessWeight: Number(e.target.value)})}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow"
                />
              </div>
            </div>
          </form>
        </div>
        
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="folder-form"
            className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 transition-all active:scale-95"
          >
            {initialFolder ? 'Save Changes' : 'Create Folder'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
