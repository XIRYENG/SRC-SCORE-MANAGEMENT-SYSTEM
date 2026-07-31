import React, { useState, useEffect } from 'react';
import { ScoreFolder, RevieweeData } from '../../types';
import { firestoreDb } from '../../utils/firebaseClient';
import { doc, setDoc, updateDoc, collection, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { AnimatedDatePicker } from '../ui/animated-date-picker';
import { AnimatedSelect } from '../ui/animated-select';
import { FolderScopeConfig } from './FolderScopeConfig';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { normalizeFolderType, formatFolderType } from '../../utils/folderScope';
import { STANDARD_FOLDER_TYPES, AVAILABLE_FOLDER_TYPES } from '../../constants/folderTypes';

// You might need to import these or move them to a shared types/constants file
const DEFAULT_SCHOOL_OPTIONS = [
  { id: 'CKCM', name: 'CKCM (Christ the King College de Maranding)' },
  { id: 'LSSTI', name: 'LSSTI (Lanao School of Science and Technology, Inc.)' },
  { id: 'NCMC', name: 'NCMC (North Central Mindanao College)' },
  { id: 'PCCr', name: 'Philippine College of Criminology' },
  { id: 'UC', name: 'University of the Cordilleras' },
];
const DEFAULT_BRANCH_OPTIONS = [
  { id: 'Main', name: 'Main Campus' },
];

interface FolderModalProps {
  onClose: () => void;
  currentUser: any;
  initialFolder?: ScoreFolder;
}

export function FolderModal({ onClose, currentUser, initialFolder }: FolderModalProps) {
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);

  const formatSchoolScopeChanges = () => {
    const oldScope = initialFolder?.schoolScope || 'all';
    const newScope = formData.schoolScope;
    if (oldScope === newScope) {
      if (newScope === 'selected') {
        const oldIds = initialFolder?.selectedSchoolIds || [];
        const added = formData.selectedSchoolIds.filter(id => !oldIds.includes(id));
        const removed = oldIds.filter(id => !formData.selectedSchoolIds.includes(id));
        if (added.length === 0 && removed.length === 0) return 'Unchanged (Selected Schools)';
        return `Selected Schools updated: +${added.length} added, -${removed.length} removed`;
      }
      return 'Unchanged (All Schools)';
    }
    return `Changed from ${oldScope === 'all' ? 'All Schools' : 'Selected Schools'} to ${newScope === 'all' ? 'All Schools' : 'Selected Schools'}`;
  };

  const formatBranchScopeChanges = () => {
    const oldScope = initialFolder?.branchScope || 'all';
    const newScope = formData.branchScope;
    if (oldScope === newScope) {
      if (newScope === 'selected') {
        const oldIds = initialFolder?.selectedBranchIds || [];
        const added = formData.selectedBranchIds.filter(id => !oldIds.includes(id));
        const removed = oldIds.filter(id => !formData.selectedBranchIds.includes(id));
        if (added.length === 0 && removed.length === 0) return 'Unchanged (Selected Branches)';
        return `Selected Branches updated: +${added.length} added, -${removed.length} removed`;
      }
      return 'Unchanged (All Branches)';
    }
    return `Changed from ${oldScope === 'all' ? 'All Branches' : 'Selected Branches'} to ${newScope === 'all' ? 'All Branches' : 'Selected Branches'}`;
  };

  const getInitialType = () => {
    const rawType = initialFolder?.folderType ?? initialFolder?.type;
    const normalized = normalizeFolderType(rawType);
    if (!normalized) return 'phase_1';
    if (STANDARD_FOLDER_TYPES.includes(normalized)) return normalized;
    return 'custom';
  };

  const getInitialCustomTypeName = () => {
    const rawType = initialFolder?.folderType ?? initialFolder?.type;
    const normalized = normalizeFolderType(rawType);
    if (!normalized) return '';
    if (STANDARD_FOLDER_TYPES.includes(normalized)) return '';
    return rawType || '';
  };

  const [formData, setFormData] = useState({
    name: initialFolder?.name || '',
    type: getInitialType(),
    customTypeName: getInitialCustomTypeName(),
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

  useEffect(() => {
    const rawType = initialFolder?.folderType ?? initialFolder?.type;
    const normalized = normalizeFolderType(rawType);
    const initialType = !normalized ? 'phase_1' : (STANDARD_FOLDER_TYPES.includes(normalized) ? normalized : 'custom');
    const initialCustomTypeName = !normalized ? '' : (STANDARD_FOLDER_TYPES.includes(normalized) ? '' : (rawType || ''));

    setFormData({
      name: initialFolder?.name || '',
      type: initialType,
      customTypeName: initialCustomTypeName,
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
  }, [initialFolder?.id, initialFolder]);

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

    if (!formData.type || formData.type.trim() === '') {
      alert('Folder Type cannot be empty.');
      return;
    }

    if (formData.type === 'custom' && (!formData.customTypeName || formData.customTypeName.trim() === '')) {
      alert('Please enter a custom folder type name.');
      return;
    }

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

    if (initialFolder && !showConfirmEdit) {
      setShowConfirmEdit(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    const finalType = formData.type === 'custom' ? formData.customTypeName.trim() : formData.type;
    const finalSchoolIds = formData.schoolScope === 'all' ? [] : formData.selectedSchoolIds;
    const finalSchoolNames = formData.schoolScope === 'all' ? [] : formData.selectedSchoolNames;
    const finalBranchIds = formData.branchScope === 'all' ? [] : formData.selectedBranchIds;
    const finalBranchNames = formData.branchScope === 'all' ? [] : formData.selectedBranchNames;

    try {
      if (initialFolder) {
        const docRef = doc(firestoreDb, 'score_folders', initialFolder.id);
        await updateDoc(docRef, {
          name: formData.name,
          normalizedName: formData.name.toLowerCase().trim(),
          type: finalType,
          folderType: finalType,
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

        // Write activity/audit log
        const logRef = doc(collection(firestoreDb, 'activity_logs'));
        await setDoc(logRef, {
          user_id: initialFolder.id,
          user_name: formData.name,
          action: 'update_score_folder',
          details: `Updated score folder "${formData.name}". Type: ${initialFolder.folderType ?? initialFolder.type} -> ${finalType}. Publication: ${initialFolder.publicationStatus} -> ${formData.publicationStatus}.`,
          performed_by: currentUser?.email || currentUser?.uid || 'unknown',
          timestamp: serverTimestamp(),
          created_at: new Date().toISOString()
        });

        alert('Score Folder updated successfully.');
      } else {
        const folderRef = doc(collection(firestoreDb, 'score_folders'));
        await setDoc(folderRef, {
          id: folderRef.id,
          name: formData.name,
          normalizedName: formData.name.toLowerCase().trim(),
          type: finalType,
          folderType: finalType,
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

        // Write audit log
        const logRef = doc(collection(firestoreDb, 'activity_logs'));
        await setDoc(logRef, {
          user_id: folderRef.id,
          user_name: formData.name,
          action: 'create_score_folder',
          details: `Created score folder "${formData.name}" with type "${finalType}"`,
          performed_by: currentUser?.email || currentUser?.uid || 'unknown',
          timestamp: serverTimestamp(),
          created_at: new Date().toISOString()
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
          <h2 className="text-lg font-bold text-slate-900">
            {showConfirmEdit ? 'Confirm Folder Changes' : (initialFolder ? 'Edit Score Folder' : 'Create Score Folder')}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        {showConfirmEdit ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <p className="text-sm text-slate-600 font-semibold">Please review the proposed changes before finalizing:</p>
            <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-200/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Folder Name</span>
                <span className="text-sm font-semibold text-slate-900 col-span-2">{formData.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-200/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Current Type</span>
                <span className="text-sm font-semibold text-slate-700">{formatFolderType(initialFolder?.folderType ?? initialFolder?.type)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-200/50">
                <span className="text-xs font-bold text-slate-500 uppercase">New Type</span>
                <span className="text-sm font-black text-teal-600">{formatFolderType(formData.type)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-200/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Schools Scope</span>
                <span className="text-sm font-semibold text-slate-800 col-span-2">{formatSchoolScopeChanges()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-200/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Branches Scope</span>
                <span className="text-sm font-semibold text-slate-800 col-span-2">{formatBranchScopeChanges()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase">Publication</span>
                <span className="text-sm font-semibold text-slate-800 col-span-2">
                  {initialFolder?.publicationStatus !== formData.publicationStatus 
                    ? `Changed from ${initialFolder?.publicationStatus} to ${formData.publicationStatus}`
                    : `Unchanged (${formData.publicationStatus})`}
                </span>
              </div>
            </div>
            {showScopeWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-900 leading-relaxed">
                  Changing this folder's school or branch scope may hide some reviewees and their scores from this folder. Existing records will not be deleted.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
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

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Folder Type</label>
              <AnimatedSelect 
                value={formData.type}
                options={AVAILABLE_FOLDER_TYPES}
                onChange={val => {
                  setFormData(prev => ({
                    ...prev,
                    type: val as any,
                    customTypeName: val === 'custom' ? prev.customTypeName : ''
                  }));
                }}
                searchable={false}
              />
              {formData.type === 'custom' && (
                <div className="mt-2.5 animate-in fade-in-50 duration-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custom Folder Type (Manual Name) <span className="text-rose-500">*</span></label>
                  <input 
                    required
                    type="text"
                    value={formData.customTypeName}
                    onChange={e => setFormData(prev => ({ ...prev, customTypeName: e.target.value }))}
                    placeholder="e.g., Diagnostic Exam, Board Preparation" 
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Description (Optional)</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Briefly describe what this folder is for..." 
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow min-h-[70px] resize-none"
              />
            </div>

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
        )}
        
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3">
          {showConfirmEdit ? (
            <>
              <button 
                type="button" 
                onClick={() => setShowConfirmEdit(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Back to Edit
              </button>
              <button 
                type="button" 
                onClick={performSave}
                className="rounded-xl px-6 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-sm transition-all active:scale-95"
              >
                Confirm & Update
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
