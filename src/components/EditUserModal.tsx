import React, { useState } from 'react';
import { X, Save, AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { AnimatedSelect } from './ui/animated-select';

interface EditUserModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: any) => Promise<void>;
  currentUserRole?: string;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose, onSave, currentUserRole }) => {
  const [formData, setFormData] = useState({
    firstName: user.firstName || user.first_name || '',
    middleName: user.middleName || user.middle_name || '',
    lastName: user.lastName || user.last_name || '',
    email: user.email || '',
    role: user.role || user.role_name || 'Reviewee',
    seqId: user.seqId || user.seq_id || user.id_number || '',
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const isStaffLoggedIn = currentUserRole === 'Staff';
  const targetIsAdmin = user.role === 'Admin' || user.role === 'Staff';
  const isEditingForbidden = isStaffLoggedIn && targetIsAdmin;

  const availableRoles = isStaffLoggedIn ? ['Reviewee'] : ['Admin', 'Staff', 'Reviewee'];

  const handleSubmit = () => {
    if (isEditingForbidden) {
      alert("Staff members can only edit Reviewee users.");
      return;
    }
    setIsConfirming(true);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onSave({ ...user, ...formData });
      setIsConfirming(false);
      onClose();
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
      {isConfirming ? (
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center">
            <AlertTriangle className="mx-auto text-amber-500 mb-4" size={48} />
            <h2 className="text-lg font-extrabold text-slate-900 mb-2">Confirm Changes</h2>
            <p className="text-sm text-slate-600 mb-6">Are you sure you want to save these changes for {formData.firstName} {formData.lastName}?</p>
            <div className="flex gap-3">
                <button type="button" disabled={isSaving} onClick={() => setIsConfirming(false)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl hover:bg-slate-200 disabled:opacity-50">Cancel</button>
                <button type="button" disabled={isSaving} onClick={handleConfirm} className="flex-1 bg-teal-600 text-white font-bold py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Confirm'}</button>
            </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-slate-900">Edit User</h2>
            <button type="button" onClick={onClose}><X size={20} /></button>
          </div>
          {isEditingForbidden && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
              Staff users cannot edit Admin or Staff accounts. You can only edit Reviewee accounts.
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">First Name</label>
              <input type="text" disabled={isEditingForbidden} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Middle Name</label>
              <input type="text" disabled={isEditingForbidden} value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Last Name</label>
              <input type="text" disabled={isEditingForbidden} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
              <input 
                type="email" 
                disabled={isEditingForbidden} 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} 
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Role</label>
              <AnimatedSelect
                value={formData.role}
                options={availableRoles.map(r => ({ value: r, label: r }))}
                onChange={(r) => setFormData({...formData, role: r})}
                placeholder="Select Role"
                searchable={false}
                disabled={isEditingForbidden}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">ID Number</label>
              <input type="text" disabled={isEditingForbidden} value={formData.seqId} onChange={e => setFormData({...formData, seqId: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100" />
            </div>
          </div>
          <button type="button" disabled={isEditingForbidden} onClick={handleSubmit} className="w-full mt-6 bg-teal-600 text-white font-bold py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Save size={18} /> Save Changes
          </button>
        </div>
      )}
    </div>
  );
};
