import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, Loader2, ShieldAlert, User, Mail, Hash, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getUserRole } from '../utils/roleUtils';
import { getAuth } from 'firebase/auth';

export interface DeleteUserTarget {
  authUid: string;
  profileDocumentId: string;
  displayName: string;
  email?: string;
  role: string;
  idNumber?: string;
  originalUser: any;
}

interface DeleteUserModalProps {
  isOpen: boolean;
  user: any | null;
  currentUser: any | null;
  onClose: () => void;
  onSuccess: (deletedUserUid: string, deletedDocId: string, deletedName: string) => void;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  isOpen,
  user,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsDeleting(false);
      setConfirmText('');
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // Resolve canonical user identifiers
  const firstName = user.first_name || user.firstName || '';
  const middleName = user.middle_name || user.middleName || '';
  const lastName = user.last_name || user.lastName || '';
  const rawFullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
  const displayName = rawFullName || user.displayName || user.email || 'User';

  const authUid = user.uid || user.auth_uid || user.doc_id || '';
  const profileDocumentId = user.doc_id || user.uid || '';
  const email = user.email || '';
  const role = getUserRole(user);
  const idNumber = user.seq_id || user.seqId || user.id_number || user.student_id || '';

  // Current logged in user info
  const callerRole = getUserRole(currentUser);
  const isCallerAdmin = callerRole === 'Admin';

  const currentAuthUid = currentUser?.uid || currentUser?.auth_uid || currentUser?.doc_id || '';
  const currentDocId = currentUser?.doc_id || currentUser?.uid || '';
  const currentEmail = (currentUser?.email || '').toLowerCase().trim();

  // Self deletion check
  const isSelfDeletion =
    (authUid && currentAuthUid && authUid === currentAuthUid) ||
    (profileDocumentId && currentDocId && profileDocumentId === currentDocId) ||
    (email && currentEmail && email.toLowerCase().trim() === currentEmail);

  // Validation
  let restrictionMessage: string | null = null;
  if (!isCallerAdmin) {
    restrictionMessage = 'Only administrators are authorized to delete user accounts.';
  } else if (isSelfDeletion) {
    restrictionMessage = 'You cannot delete your own active admin account.';
  }

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (restrictionMessage) {
      setError(restrictionMessage);
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Get Firebase Auth ID token
      const auth = getAuth();
      let idToken = '';
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken(true);
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(authUid || profileDocumentId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': idToken ? `Bearer ${idToken}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authUid,
          profileDocumentId,
          displayName,
          email,
          role,
          idNumber,
          adminUid: currentAuthUid,
          adminEmail: currentUser?.email,
          adminName: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.displayName || currentUser?.email || 'Admin',
          adminRole: callerRole,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user account.');
      }

      onSuccess(authUid, profileDocumentId, displayName);
      onClose();
    } catch (err: any) {
      console.error('User deletion error:', err);
      setError(err.message || 'An error occurred while attempting to delete the account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-2xl">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Delete User Account</h3>
                  <p className="text-xs text-slate-500 font-medium">Permanent Account Removal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <form onSubmit={handleDelete} className="p-6 space-y-5">
              {/* Target User Summary Card */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <User size={15} className="text-slate-500" />
                      {displayName}
                    </h4>
                    {email && (
                      <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mt-1">
                        <Mail size={13} className="text-slate-400" />
                        {email}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                      role === 'Admin'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : role === 'Staff'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}
                  >
                    {role}
                  </span>
                </div>

                {idNumber && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 text-xs text-slate-600 font-mono">
                    <Hash size={13} className="text-slate-400" />
                    <span>ID: <strong className="text-slate-800">{idNumber}</strong></span>
                  </div>
                )}
              </div>

              {/* Warning Notice */}
              {!restrictionMessage ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed font-medium">
                    Are you sure you want to delete <strong className="font-extrabold">{displayName}</strong>?
                    This will remove the user’s access and related account data. This action cannot be undone.
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                  <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-900 font-bold leading-relaxed">
                    {restrictionMessage}
                  </div>
                </div>
              )}

              {/* Runtime Error Display */}
              {error && !restrictionMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                  <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-900 font-bold leading-relaxed">
                    {error}
                  </div>
                </div>
              )}

              {/* Text Confirmation Input */}
              {!restrictionMessage && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    To confirm removal, please type <span className="font-mono font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">DELETE</span> below:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all text-slate-900 placeholder:font-sans placeholder:font-normal"
                    disabled={isDeleting}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || !!restrictionMessage || confirmText.trim() !== 'DELETE'}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 shadow-sm shadow-rose-200"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      Delete User
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
