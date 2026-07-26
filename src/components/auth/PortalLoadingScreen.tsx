import React from 'react';
import { SAMARITAN_LOGO_URL } from '../../constants';

export type PortalLoadingScreenProps = {
  message?: string;
  subMessage?: string;
  status?: string;
  isTakingLonger?: boolean;
  onRetry?: () => void;
  onBackToLogin?: () => void;
};

export function PortalLoadingScreen({
  message = "Waiting to Log In",
  subMessage = "Please wait, Future RCrim.",
  status = "Preparing your portal…",
  isTakingLonger = false,
  onRetry,
  onBackToLogin,
}: PortalLoadingScreenProps) {
  return (
    <div 
      className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-slate-50/95 dark:bg-slate-950/95 px-5 backdrop-blur-sm select-none"
      role="status"
      aria-live="polite"
      aria-label="Portal Loading Screen"
    >
      <div className="w-full max-w-sm rounded-3xl border border-teal-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-9 text-center shadow-2xl transition-all">
        {/* Official SRC Logo with soft jumping/bouncing animation */}
        <div className="mx-auto flex h-28 w-28 items-center justify-center relative">
          <img
            src={SAMARITAN_LOGO_URL}
            alt="Samaritan Review Center Official Logo"
            className="src-logo-bounce h-24 w-24 object-contain filter drop-shadow-md"
          />
        </div>

        {!isTakingLonger ? (
          <>
            <h1 className="mt-5 text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {message}
            </h1>

            <p className="mt-2 text-sm font-semibold text-teal-700">
              {subMessage}
            </p>

            {/* 3 Animated Bouncing Dots */}
            <div
              className="mt-5 flex items-center justify-center gap-1.5"
              aria-label="Loading"
            >
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.3s]" />
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.15s]" />
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-teal-600" />
            </div>

            {status && (
              <p className="mt-4 text-xs font-medium text-slate-400 animate-pulse">
                {status}
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-5 text-xl font-black text-amber-600 tracking-tight">
              Taking longer than expected
            </h1>

            <p className="mt-2 text-sm font-semibold text-slate-600">
              Please check your connection and try again.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors shadow-sm"
                >
                  Try Again
                </button>
              )}
              {onBackToLogin && (
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Back to Login
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
