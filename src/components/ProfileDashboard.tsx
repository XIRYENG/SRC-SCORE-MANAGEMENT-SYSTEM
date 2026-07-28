import React, { useState } from 'react';
import { User, Mail, Building2, MapPin, Key, Shield, Calendar, Camera, Loader2, Save, CheckCircle2, Lock } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { getClientDb } from '../utils/firebaseClient';
import { auth } from '../utils/auth';
import { getUserRole } from '../utils/roleUtils';
import { compressAndConvertToBase64 } from '../utils/imageUtils';
import { UserAvatar } from './UserAvatar';

interface ProfileDashboardProps {
  currentUser: any;
  onUpdate?: (updatedUser: any) => void;
}

export const ProfileDashboard: React.FC<ProfileDashboardProps> = ({ currentUser, onUpdate }) => {
  const [firstName, setFirstName] = useState(currentUser?.first_name || currentUser?.firstName || '');
  const [middleName, setMiddleName] = useState(currentUser?.middle_name || currentUser?.middleName || '');
  const [lastName, setLastName] = useState(currentUser?.last_name || currentUser?.lastName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [schoolName, setSchoolName] = useState(currentUser?.school_name || currentUser?.schoolName || '');
  const [reviewBranch, setReviewBranch] = useState(currentUser?.review_branch || currentUser?.reviewBranch || '');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photo_url || currentUser?.photoUrl || '');
  const [pin, setPin] = useState(currentUser?.pin || '');

  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const role = getUserRole(currentUser);
  const uid = currentUser?.uid || currentUser?.id || currentUser?.doc_id || currentUser?.docId;
  const seqId = currentUser?.seqId || currentUser?.seq_id || currentUser?.id_number || 'SRC-USER';
  const status = currentUser?.accountStatus || currentUser?.status || 'Active';
  const createdAt = currentUser?.createdAt || currentUser?.created_at || currentUser?.timestamp || 'Recently';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    try {
      const compressedBase64 = await compressAndConvertToBase64(file);
      setPhotoUrl(compressedBase64);
    } catch (err: any) {
      console.error("Error compressing image:", err);
      setErrorMsg("Failed to process and compress the selected image.");
    }
  };

  const handlePasswordReset = async () => {
    const targetEmail = (email.trim() || currentUser?.email || '').toLowerCase();
    if (!targetEmail) {
      setErrorMsg("No email address found to send password reset link.");
      return;
    }

    setSendingReset(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setSuccessMsg(`Password reset link sent to ${targetEmail}. Please check your Inbox or Spam folder.`);
    } catch (err: any) {
      console.warn("Client Password Reset error in profile:", err);
      if (err.code === 'auth/user-not-found') {
        setErrorMsg("We could not find an account with that email address.");
        setSendingReset(false);
        return;
      }

      // Try server fallback
      try {
        const res = await fetch('/api/send-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSuccessMsg(`Password reset instructions processed for ${targetEmail}. Please check your Inbox or Spam folder.`);
        } else {
          setSuccessMsg(`Password reset request submitted for ${targetEmail}. Please check your Inbox or Spam folder.`);
        }
      } catch (fallbackErr) {
        setSuccessMsg(`Password reset request submitted for ${targetEmail}. Please check your Inbox or Spam folder.`);
      }
    } finally {
      setSendingReset(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) {
      setErrorMsg("User ID not found for updating profile.");
      return;
    }

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const db = getClientDb();
      const updatedData = {
        email: email.trim(),
        first_name: firstName.trim(),
        firstName: firstName.trim(),
        middle_name: middleName.trim(),
        middleName: middleName.trim(),
        last_name: lastName.trim(),
        lastName: lastName.trim(),
        school_name: schoolName.trim(),
        schoolName: schoolName.trim(),
        review_branch: reviewBranch.trim(),
        reviewBranch: reviewBranch.trim(),
        photo_url: photoUrl,
        photoUrl: photoUrl,
        pin: pin.trim(),
        updated_at: new Date().toISOString()
      };

      if (db) {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, updatedData);
      }

      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { photoURL: photoUrl });
        } catch (authErr) {
          console.warn("Could not update firebase auth photoURL profile:", authErr);
        }
      }

      const merged = { ...currentUser, ...updatedData };
      if (onUpdate) {
        onUpdate(merged);
      }

      setSuccessMsg("Profile successfully updated!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Profile update error:", err);
      setErrorMsg(err.message || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-center gap-6">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Avatar Upload Container */}
        <div className="relative group shrink-0">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 border-white/20 overflow-hidden bg-slate-800 shadow-2xl flex items-center justify-center">
            <UserAvatar 
              photoURL={photoUrl} 
              altText={`${firstName} ${lastName}`} 
              className="w-full h-full object-cover" 
            />
          </div>
          <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center cursor-pointer text-white text-xs font-bold gap-1">
            <Camera size={20} />
            <span>Change Photo</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>

        {/* User Info Header */}
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-bold">
            <Shield size={14} />
            <span>{role} Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {firstName} {middleName ? middleName + ' ' : ''}{lastName}
          </h1>
          <p className="text-teal-100 text-xs sm:text-sm font-medium flex items-center justify-center sm:justify-start gap-2">
            <Mail size={14} className="text-teal-300" />
            {email || 'No email attached'}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-300 font-semibold">
            <span className="bg-white/10 px-3 py-1 rounded-lg">ID: <strong className="text-white">{seqId}</strong></span>
            <span className="bg-white/10 px-3 py-1 rounded-lg">Status: <strong className="text-emerald-400 uppercase">{status}</strong></span>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <span className="text-rose-600 font-black">Error:</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Edit Details Form Card */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">Account Details & Profile Settings</h2>
            <p className="text-xs text-slate-500 font-medium">Update your personal information, email, school, review branch, and PIN.</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save Changes</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">First Name</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Middle Name (Optional)</label>
            <input
              type="text"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Name</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Mail size={13} className="text-teal-600" /> Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Key size={13} className="text-teal-600" /> Registration PIN
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 1234"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Building2 size={13} className="text-teal-600" /> School Name
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <MapPin size={13} className="text-teal-600" /> Review Branch
            </label>
            <input
              type="text"
              value={reviewBranch}
              onChange={(e) => setReviewBranch(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-xs font-bold text-slate-900 outline-none transition-all"
            />
          </div>
        </div>

        {/* Password & Security Section */}
        <div className="border-t border-slate-100 pt-6 mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Lock size={16} className="text-teal-600" /> Password & Security
              </h3>
              <p className="text-xs text-slate-500 font-medium">Request a secure password reset link sent to your email.</p>
            </div>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={sendingReset}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer flex items-center gap-2"
            >
              {sendingReset ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              <span>Reset Password</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
