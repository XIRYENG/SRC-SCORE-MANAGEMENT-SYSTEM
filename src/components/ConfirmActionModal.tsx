import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, Loader2, ShieldAlert, User, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  message?: string;
  recordName?: string;
  recordDetails?: {
    label: string;
    value: string;
    icon?: React.ReactNode;
  }[];
  confirmWord?: string; // Default: 'DELETE'
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title = "Confirm Record Removal",
  subtitle = "Permanent Removal Confirmation",
  message = "This action cannot be undone. Please confirm you want to proceed with removing this record.",
  recordName,
  recordDetails = [],
  confirmWord = "DELETE",
  isLoading = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatched = confirmInput.trim() === confirmWord;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched || isLoading) return;
    onConfirm();
  };

  return (
    <AnimatePresence>
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
                <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Record summary card */}
            {(recordName || recordDetails.length > 0) && (
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
                {recordName && (
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <User size={15} className="text-slate-500" />
                    {recordName}
                  </h4>
                )}
                {recordDetails.map((detail, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    {detail.icon || <Hash size={13} className="text-slate-400" />}
                    <span>{detail.label}: <strong className="text-slate-800">{detail.value}</strong></span>
                  </div>
                ))}
              </div>
            )}

            {/* Warning Message */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed font-medium">
                {message}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 font-bold leading-relaxed">
                  {error}
                </div>
              </div>
            )}

            {/* Text Confirmation Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                To confirm removal, please type <span className="font-mono font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">{confirmWord}</span> below:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={`Type ${confirmWord} to confirm`}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all text-slate-900 placeholder:font-sans placeholder:font-normal"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isMatched || isLoading}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 shadow-sm shadow-rose-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Confirm Delete
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
