import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder, FolderPlus, MoreVertical, Edit, Archive, Eye, EyeOff, Calendar, Users, AlertTriangle, Building2, GitBranch } from 'lucide-react';
import { AnimatedDatePicker } from '../ui/animated-date-picker';
import { AnimatedSelect } from '../ui/animated-select';
import { ScoreFolder, ScoreFolderType, RevieweeData } from '../../types';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { firestoreDb } from '../../utils/firebaseClient';
import { doc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, onSnapshot } from 'firebase/firestore';
import { SearchableMultiSelect } from '../searchable-multi-select';
import { formatFolderScopeDisplay } from '../../utils/folderScope';
import { FolderScopeConfig } from './FolderScopeConfig';

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
  const scopeDisplay = formatFolderScopeDisplay(folder);

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
      className={`group relative flex flex-col rounded-2xl bg-white p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer text-left ${
        isMenuOpen ? 'z-50 overflow-visible' : 'z-10'
      }`}
    >
      <div className={`flex justify-between items-start mb-3 relative ${isMenuOpen ? 'z-50' : 'z-20'}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 border border-yellow-100/50">
          <Folder size={24} className="fill-yellow-100" />
        </div>
        
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
                    onClick={(e) => { setIsMenuOpen(false); togglePublish(e); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                  >
                    {folder.publicationStatus === 'published' ? <><EyeOff size={16} className="text-slate-500" /> Hide</> : <><Eye size={16} className="text-slate-500" /> Publish</>}
                  </button>
                  <button 
                    onClick={(e) => { setIsMenuOpen(false); archiveFolder(e); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium transition-colors border-t border-slate-100"
                  >
                    <Archive size={16} className="text-rose-500" /> Archive
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mb-3 relative z-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">{folder.name}</h3>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 shrink-0">
            {folder.type ? folder.type.replace(/_/g, ' ') : 'Custom'}
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

function FolderModal({ onClose, currentUser, initialFolder }: { onClose: () => void; currentUser: any, initialFolder?: ScoreFolder }) {
  const [formData, setFormData] = useState({
    name: initialFolder?.name || '',
    type: initialFolder?.type || 'phase_1',
    description: initialFolder?.description || '',

    schoolScope: (initialFolder?.schoolScope || 'all') as 'all' | 'selected',
    selectedSchoolIds: initialFolder?.selectedSchoolIds || [],
    selectedSchoolNames: initialFolder?.selectedSchoolNames || [],

    branchScope: (initialFolder?.branchScope || 'all') as 'all' | 'selected',
    selectedBranchIds: initialFolder?.selectedBranchIds || [],
    selectedBranchNames: initialFolder?.selectedBranchNames || [],

    startDate: initialFolder?.startDate ? (initialFolder.startDate?.seconds ? new Date(initialFolder.startDate.seconds * 1000).toISOString().split('T')[0] : new Date(initialFolder.startDate).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
    publicationStatus: (initialFolder?.publicationStatus || 'published') as 'published' | 'hidden',
    includeInReadiness: initialFolder?.includeInReadiness ?? true,
    readinessWeight: initialFolder?.readinessWeight || 10
  });

  const [availableSchools, setAvailableSchools] = useState<{ id: string; name: string }[]>(DEFAULT_SCHOOL_OPTIONS);
  const [availableBranches, setAvailableBranches] = useState<{ id: string; name: string }[]>(DEFAULT_BRANCH_OPTIONS);
  
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [showScopeWarning, setShowScopeWarning] = useState(false);

  // Load active schools and branches
  useEffect(() => {
    // 1. Fetch schools from /api/schools
    fetch('/api/schools')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.schools)) {
          const loadedMap = new Map<string, string>();
          DEFAULT_SCHOOL_OPTIONS.forEach(s => loadedMap.set(s.id.toLowerCase(), s.name));
          data.schools.forEach((sName: string) => {
            if (sName && sName.trim()) {
              const trimmed = sName.trim();
              const key = trimmed.toLowerCase();
              if (!loadedMap.has(key)) {
                loadedMap.set(key, trimmed);
              }
            }
          });
          const merged = Array.from(loadedMap.entries()).map(([k, v]) => ({ id: v, name: v }));
          setAvailableSchools(merged);
        }
      })
      .catch(() => {});

    // 2. Fetch branches from Firestore
    if (firestoreDb) {
      const q = query(collection(firestoreDb, 'branches'));
      onSnapshot(q, (snapshot) => {
        const loadedMap = new Map<string, string>();
        DEFAULT_BRANCH_OPTIONS.forEach(b => loadedMap.set(b.id.toLowerCase(), b.name));
        snapshot.docs.forEach(docSnap => {
          const d = docSnap.data();
          const name = String(d.name || d.branchName || docSnap.id).trim();
          if (name) {
            loadedMap.set(name.toLowerCase(), name);
          }
        });
        const merged = Array.from(loadedMap.entries()).map(([k, v]) => ({ id: v, name: v }));
        setAvailableBranches(merged);
      }, () => {});
    }
  }, []);

  // Check if scope has changed in edit mode
  useEffect(() => {
    if (!initialFolder) return;
    const schoolChanged = 
      formData.schoolScope !== (initialFolder.schoolScope || 'all') ||
      JSON.stringify(formData.selectedSchoolIds) !== JSON.stringify(initialFolder.selectedSchoolIds || []);
    const branchChanged = 
      formData.branchScope !== (initialFolder.branchScope || 'all') ||
      JSON.stringify(formData.selectedBranchIds) !== JSON.stringify(initialFolder.selectedBranchIds || []);

    if (schoolChanged || branchChanged) {
      setShowScopeWarning(true);
    } else {
      setShowScopeWarning(false);
    }
  }, [formData.schoolScope, formData.selectedSchoolIds, formData.branchScope, formData.selectedBranchIds, initialFolder]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate School Scope
    if (formData.schoolScope === 'selected' && formData.selectedSchoolIds.length === 0) {
      setSchoolError('Please select at least one school.');
      return;
    } else {
      setSchoolError(null);
    }

    // Validate Branch Scope
    if (formData.branchScope === 'selected' && formData.selectedBranchIds.length === 0) {
      setBranchError('Please select at least one branch.');
      return;
    } else {
      setBranchError(null);
    }

    // Clean data according to selection rule
    const finalSchoolIds = formData.schoolScope === 'all' ? [] : formData.selectedSchoolIds;
    const finalSchoolNames = formData.schoolScope === 'all' ? [] : formData.selectedSchoolNames;
    const finalBranchIds = formData.branchScope === 'all' ? [] : formData.selectedBranchIds;
    const finalBranchNames = formData.branchScope === 'all' ? [] : formData.selectedBranchNames;

    try {
      if (initialFolder) {
        await updateDoc(doc(firestoreDb, 'scoreFolders', initialFolder.id), {
          name: formData.name,
          normalizedName: formData.name.toLowerCase().trim(),
          type: formData.type,
          description: formData.description,

          schoolScope: formData.schoolScope,
          selectedSchoolIds: finalSchoolIds,
          selectedSchoolNames: finalSchoolNames,

          branchScope: formData.branchScope,
          selectedBranchIds: finalBranchIds,
          selectedBranchNames: finalBranchNames,

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

          schoolScope: formData.schoolScope,
          selectedSchoolIds: finalSchoolIds,
          selectedSchoolNames: finalSchoolNames,

          branchScope: formData.branchScope,
          selectedBranchIds: finalBranchIds,
          selectedBranchNames: finalBranchNames,

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

  const isFormValid = 
    formData.name.trim() !== '' &&
    (formData.schoolScope !== 'selected' || formData.selectedSchoolIds.length > 0) &&
    (formData.branchScope !== 'selected' || formData.selectedBranchIds.length > 0);

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
        className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{initialFolder ? 'Edit Score Folder' : 'Create Score Folder'}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <form id="folder-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Folder Name */}
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

            {/* Folder Type */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Folder Type</label>
              <AnimatedSelect 
                value={formData.type}
                options={[
                  { value: 'phase_1', label: 'Phase 1' },
                  { value: 'phase_2', label: 'Phase 2' },
                  { value: 'phase_3', label: 'Phase 3' },
                  { value: 'marathon', label: 'Marathon' },
                  { value: 'final_coaching', label: 'Final Coaching' },
                  { value: 'pre_board_series', label: 'Pre-Board Series' },
                  { value: 'custom', label: 'Custom' },
                ]}
                onChange={val => setFormData({...formData, type: val as any})}
                searchable={false}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Description (Optional)</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Briefly describe what this folder is for..." 
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow min-h-[70px] resize-none"
              />
            </div>

            {/* Folder Scope Configuration */}
            <FolderScopeConfig 
              schoolScope={formData.schoolScope}
              onSchoolScopeChange={scope => setFormData(prev => ({ ...prev, schoolScope: scope }))}
              selectedSchoolIds={formData.selectedSchoolIds}
              selectedSchoolNames={formData.selectedSchoolNames}
              onSchoolsChange={(ids, names) => {
                setFormData(prev => ({ ...prev, selectedSchoolIds: ids, selectedSchoolNames: names }));
                if (ids.length > 0) setSchoolError(null);
              }}
              availableSchools={availableSchools}
              schoolError={schoolError}

              branchScope={formData.branchScope}
              onBranchScopeChange={scope => setFormData(prev => ({ ...prev, branchScope: scope }))}
              selectedBranchIds={formData.selectedBranchIds}
              selectedBranchNames={formData.selectedBranchNames}
              onBranchesChange={(ids, names) => {
                setFormData(prev => ({ ...prev, selectedBranchIds: ids, selectedBranchNames: names }));
                if (ids.length > 0) setBranchError(null);
              }}
              availableBranches={availableBranches}
              branchError={branchError}
            />

            {/* Start Date */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Start Date</label>
              <AnimatedDatePicker 
                value={formData.startDate}
                onChange={val => setFormData({...formData, startDate: val})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Publication Status</label>
                <AnimatedSelect 
                  value={formData.publicationStatus}
                  options={[
                    { value: 'published', label: 'Published' },
                    { value: 'hidden', label: 'Hidden' },
                  ]}
                  onChange={val => setFormData({...formData, publicationStatus: val as any})}
                  searchable={false}
                />
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

            {/* Scope change warning in edit mode */}
            {initialFolder && showScopeWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-900 leading-relaxed">
                  Changing this folder's school or branch scope may hide some reviewees and their scores from this folder. Existing records will not be deleted.
                </p>
              </div>
            )}
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
            disabled={!isFormValid}
            className={`rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-95 ${
              isFormValid
                ? 'bg-teal-600 hover:bg-teal-500'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            {initialFolder 
              ? (showScopeWarning ? 'Update Folder Scope' : 'Save Changes') 
              : 'Create Folder'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
