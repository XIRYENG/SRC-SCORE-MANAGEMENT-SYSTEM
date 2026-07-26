import React, { useEffect, useRef } from 'react';
import { LogOut, LoaderCircle } from 'lucide-react';

export type SignOutConfirmDialogProps = {
  open: boolean;
  isSigningOut?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function SignOutConfirmDialog({
  open,
  isSigningOut = false,
  onCancel,
  onConfirm,
}: SignOutConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      lastFocusedElementRef.current = document.activeElement as HTMLElement;
      // Focus cancel button by default
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);

      // Lock body scroll
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
        lastFocusedElementRef.current?.focus();
      };
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSigningOut) {
          onCancel();
        }
      } else if (e.key === 'Tab' && dialogRef.current) {
        // Focus trap
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isSigningOut, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-out-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSigningOut) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 transition-all transform animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <LogOut size={22} />
        </div>

        <h2
          id="sign-out-title"
          className="mt-4 text-xl font-black text-slate-900 tracking-tight"
        >
          Confirm Sign Out
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600 font-medium">
          Are you sure you want to sign out of your account?
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isSigningOut}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isSigningOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut && (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            )}

            {isSigningOut ? "Signing Out…" : "Sign Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
