import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, CheckCircle, RefreshCw, Loader2, LogOut, ShieldAlert, AlertTriangle } from 'lucide-react';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
import { ProfileSetup } from './ProfileSetup';
import { auth, logout } from '../utils/auth';
import { firestoreDb, initFirebaseClient } from '../utils/firebaseClient';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';
import { activateExistingWithPin } from '../utils/idGenerator';
import { ensureUserDocument } from '../utils/userUtils';
import { PortalLoading } from './PortalLoading';

interface AuthPageProps {
  onSuccess: (userData: any) => void;
}

export function AuthPage({ onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'profile-setup' | 'email-verification-pending' | 'verification-pending'>('login');
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userDoc, setUserDoc] = useState<any>(null);
  const [checkingDoc, setCheckingDoc] = useState(false);
  const [initialSessionLoading, setInitialSessionLoading] = useState(true);
  const [hasCompletedInitialSessionCheck, setHasCompletedInitialSessionCheck] = useState(false);
  const [isTakingLonger, setIsTakingLonger] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [sandboxBypass, setSandboxBypass] = useState(false);

  useEffect(() => {
    let timer: any;
    if (checkingDoc || (initialSessionLoading && !hasCompletedInitialSessionCheck)) {
      timer = setTimeout(() => {
        setIsTakingLonger(true);
      }, 25000);
    } else {
      setIsTakingLonger(false);
    }
    return () => clearTimeout(timer);
  }, [checkingDoc, initialSessionLoading, hasCompletedInitialSessionCheck]);

  const onSuccessRef = React.useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const sandboxBypassRef = React.useRef(sandboxBypass);
  useEffect(() => {
    sandboxBypassRef.current = sandboxBypass;
  }, [sandboxBypass]);

  // States for PIN manual activation
  const [pin, setPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Auto-check email verification state
  useEffect(() => {
    if (mode !== 'email-verification-pending' || !currentUser) return;

    let intervalId: any;
    
    // Check verification status
    const checkStatus = async () => {
      try {
        await currentUser.reload();
        const updatedUser = auth.currentUser;
        if (updatedUser?.emailVerified) {
          if (userDoc) {
            clearInterval(intervalId);
            onSuccess({ id: updatedUser.uid, ...userDoc });
          }
        }
      } catch (err) {
        console.warn("Auto email verification check error:", err);
      }
    };

    // Poll every 3 seconds
    intervalId = setInterval(checkStatus, 3000);

    // Also check on window focus (e.g. when coming back from email tab)
    const handleFocus = () => {
      checkStatus();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [mode, currentUser, userDoc, onSuccess]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userDoc) return;
    setVerifyingPin(true);
    setPinError(null);
    try {
      const lastName = userDoc.lastName || userDoc.last_name || '';
      const firstName = userDoc.firstName || userDoc.first_name || '';
      const middleName = userDoc.middleName || userDoc.middle_name || '';
      
      const result = await activateExistingWithPin(
        currentUser.uid,
        currentUser.email || '',
        lastName,
        firstName,
        middleName,
        pin
      );
      setEmailMsg(result.message);
    } catch (err: any) {
      console.error("PIN Activation error:", err);
      let errMsg = err.message || "";
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed && parsed.error) {
          errMsg = parsed.error;
        }
      } catch (e) {}
      if (errMsg.includes("No matching") || errMsg.includes("error") || errMsg.includes("Firestore Error")) {
        errMsg = "Incorrect PIN or user does not match. Please try again.";
      }
      setPinError(errMsg || "Incorrect PIN or user does not match. Please try again.");
    } finally {
      setVerifyingPin(false);
    }
  };

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;
    let cancelled = false;

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      setCurrentUser(user);

      if (!user) {
        if (!cancelled) {
          setUserDoc(null);
          setMode('login');
          setCheckingDoc(false);
          setInitialSessionLoading(false);
          setHasCompletedInitialSessionCheck(true);
        }
        return;
      }

      if (!hasCompletedInitialSessionCheck) {
        setCheckingDoc(true);
        setInitialSessionLoading(true);
      }

      try {
        const { db } = await initFirebaseClient();
        if (!db) {
          throw new Error("Firestore database is not initialized.");
        }
        
        const resolvedProfile = await ensureUserDocument(user);

        if (cancelled || !resolvedProfile) {
          return;
        }

        const resolvedUserId = resolvedProfile.id || user.uid;
        const userRef = doc(db, "users", resolvedUserId);
        
        unsubscribeUserDoc = onSnapshot(userRef, (snap) => {
          if (cancelled) return;

          setCheckingDoc(false);
          setInitialSessionLoading(false);
          setHasCompletedInitialSessionCheck(true);

          if (snap.exists()) {
            const data: any = { id: snap.id, ...snap.data() };
            setUserDoc(data);

            const role = String(data.role || "").toLowerCase();
            const isAdminOrStaff = role === "admin" || role === "staff";

            if (data.accountStatus === 'pending_verification') {
              setMode('verification-pending');
              return;
            }

            if (isAdminOrStaff) {
              onSuccessRef.current(data);
              return;
            }

            const hasFirstName = Boolean(data.first_name || data.firstName);
            const hasLastName = Boolean(data.last_name || data.lastName);
            const hasName = hasFirstName && hasLastName;
            const hasSchool = Boolean(data.school_name || data.schoolName || data.school);
            const hasBranch = Boolean(data.review_branch || data.reviewBranch || data.branch);

            if (!hasName || !hasSchool || !hasBranch) {
              setMode('profile-setup');
              return;
            }

            const isGoogleUser = user.providerData?.some(p => p.providerId === 'google.com');

            if (user.emailVerified || isGoogleUser || sandboxBypassRef.current) {
              onSuccessRef.current(data);
            } else {
              setMode('email-verification-pending');
            }
          } else {
            setMode('profile-setup');
          }
        }, (err) => {
          if (cancelled) return;
          console.error("User doc listener error:", err);
          setCheckingDoc(false);
          setInitialSessionLoading(false);
          setHasCompletedInitialSessionCheck(true);
        });
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to initialize database listener:", e);
        setCheckingDoc(false);
        setInitialSessionLoading(false);
        setHasCompletedInitialSessionCheck(true);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, []);

  // Handle successful signup
  const handleSignupSuccess = (user: any, linkResult: any) => {
    setCurrentUser(user);
    if (linkResult.status === 'pending_verification') {
      setMode('verification-pending');
    } else {
      const isGoogle = user?.providerData?.some((p: any) => p.providerId === 'google.com');
      if (isGoogle || user?.emailVerified || sandboxBypassRef.current) {
        if (userDoc) {
          onSuccessRef.current(userDoc);
        }
      } else {
        setMode('email-verification-pending');
      }
    }
  };

  // Re-check email verification
  const handleCheckEmailVerified = async () => {
    if (!currentUser) return;
    setCheckingDoc(true);
    try {
      await currentUser.reload();
      const updatedUser = auth.currentUser;
      setCurrentUser(updatedUser);
      
      if (updatedUser?.emailVerified) {
        setEmailMsg("Your email has been verified! Redirecting...");
        // Re-read document to login
        if (userDoc) {
          setTimeout(() => {
            onSuccess({ id: updatedUser.uid, ...userDoc });
          }, 1500);
        }
      } else {
        setEmailMsg("Email not verified yet. Please click the link we sent to your inbox.");
      }
    } catch (e: any) {
      console.error("Error reloading user:", e);
      setEmailMsg("Could not verify status. Please try again.");
    } finally {
      setCheckingDoc(false);
    }
  };

  // Resend Verification Email
  const handleResendEmail = async () => {
    if (!currentUser) return;
    setResendingEmail(true);
    setEmailMsg(null);
    try {
      await sendEmailVerification(currentUser);
      setEmailMsg("A fresh verification email has been sent! Please check your Inbox and Spam folders.");
    } catch (e: any) {
      console.error("Resend Error:", e);
      setEmailMsg("Failed to resend email. Please try again in a few moments.");
    } finally {
      setResendingEmail(false);
    }
  };

  // Sandbox Verification Bypass (Developer/Tester help)
  const handleSandboxBypass = () => {
    setSandboxBypass(true);
    if (userDoc) {
      onSuccess({ id: currentUser.uid, ...userDoc });
    }
  };

  const handleLogout = async () => {
    await logout();
    setMode('login');
    setUserDoc(null);
    setSandboxBypass(false);
    setEmailMsg(null);
  };

  // Construct smart prefilled data for ProfileSetup
  const rawDisplayName = userDoc?.displayName || currentUser?.displayName || '';
  let parsedFirst = userDoc?.firstName || userDoc?.first_name || '';
  let parsedMiddle = userDoc?.middleName || userDoc?.middle_name || '';
  let parsedLast = userDoc?.lastName || userDoc?.last_name || '';

  if ((!parsedFirst || !parsedLast) && rawDisplayName) {
    const parts = rawDisplayName.trim().split(/\s+/);
    if (parts.length === 1) {
      if (!parsedFirst) parsedFirst = parts[0];
    } else if (parts.length === 2) {
      if (!parsedFirst) parsedFirst = parts[0];
      if (!parsedLast) parsedLast = parts[1];
    } else if (parts.length === 3) {
      if (!parsedFirst) parsedFirst = parts[0];
      if (!parsedMiddle) parsedMiddle = parts[1];
      if (!parsedLast) parsedLast = parts[2];
    } else if (parts.length >= 4) {
      if (!parsedFirst) parsedFirst = parts.slice(0, parts.length - 2).join(" ");
      if (!parsedMiddle) parsedMiddle = parts[parts.length - 2];
      if (!parsedLast) parsedLast = parts[parts.length - 1];
    }
  }

  const initialSetupData = {
    firstName: parsedFirst,
    middleName: parsedMiddle,
    lastName: parsedLast,
    email: currentUser?.email || userDoc?.email || '',
    schoolName: userDoc?.schoolName || userDoc?.school_name || userDoc?.school || '',
    reviewBranch: userDoc?.reviewBranch || userDoc?.review_branch || userDoc?.branch || ''
  };

  if ((initialSessionLoading && !hasCompletedInitialSessionCheck && checkingDoc) || checkingDoc) {
    const isRestoring = initialSessionLoading && !hasCompletedInitialSessionCheck;
    return (
      <PortalLoading
        message={isRestoring ? "Restoring Your Session" : "Waiting to Log In"}
        subMessage="Please wait, Future RCrim."
        status={isRestoring ? "Checking your portal access…" : "Preparing your portal…"}
        isTakingLonger={isTakingLonger}
        onRetry={() => {
          setIsTakingLonger(false);
          if (auth.currentUser) {
            setCheckingDoc(true);
          }
        }}
        onBackToLogin={async () => {
          await logout();
          setIsTakingLonger(false);
          setCheckingDoc(false);
          setInitialSessionLoading(false);
          setHasCompletedInitialSessionCheck(true);
          setMode('login');
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-xl flex flex-col items-center justify-center px-4">
      <AnimatePresence mode="wait">
        {mode === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full flex justify-center"
          >
            <LoginPage
              onSuccess={(user) => setCurrentUser(user)}
              onToggleSignup={() => setMode('signup')}
            />
          </motion.div>
        )}

        {mode === 'signup' && (
          <motion.div
            key="signup"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full flex justify-center"
          >
            <SignupPage
              onSuccess={handleSignupSuccess}
              onToggleLogin={() => setMode('login')}
            />
          </motion.div>
        )}

        {mode === 'profile-setup' && (
          <motion.div
            key="profile-setup"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full flex justify-center"
          >
            <ProfileSetup
              initialData={initialSetupData}
              onCompleted={(linkResult) => {
                if (linkResult.status === 'pending_verification') {
                  setMode('verification-pending');
                } else {
                  const isGoogle = currentUser?.providerData?.some((p: any) => p.providerId === 'google.com');
                  if (isGoogle || currentUser?.emailVerified || sandboxBypassRef.current) {
                    if (userDoc) {
                      onSuccessRef.current(userDoc);
                    } else if (currentUser) {
                      onSuccessRef.current({ id: currentUser.uid, email: currentUser.email, role: 'Reviewee' });
                    }
                  } else {
                    setMode('email-verification-pending');
                  }
                }
              }}
            />
          </motion.div>
        )}

        {mode === 'email-verification-pending' && (
          <motion.div
            key="email-verification"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 max-w-md w-full text-center flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mb-2">
              <Mail size={32} />
            </div>

            <h2 className="text-xl font-extrabold text-slate-800">Email Verification Sent</h2>
            
            <p className="text-slate-500 text-xs leading-relaxed font-semibold">
              We sent a verification link to <span className="text-teal-600 font-extrabold">{currentUser?.email}</span>. Please check your Inbox. <span className="font-bold text-rose-600">If you can't find it there, please check your SPAM folder</span> and click the link to verify your account.
            </p>

            {emailMsg && (
              <p className="text-xs bg-slate-50 border border-slate-100 p-3 rounded-xl text-teal-700 font-extrabold w-full">
                {emailMsg}
              </p>
            )}

            <div className="w-full space-y-3 pt-4">
              <button
                type="button"
                onClick={handleCheckEmailVerified}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs tracking-wider uppercase transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                I have verified my email
              </button>

              <button
                type="button"
                disabled={resendingEmail}
                onClick={handleResendEmail}
                className="w-full py-3 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {resendingEmail && <Loader2 size={12} className="animate-spin" />}
                Resend Verification Email
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 bg-transparent text-slate-500 hover:text-slate-700 text-xs font-semibold hover:underline flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut size={13} />
                Logout and use different account
              </button>
            </div>
          </motion.div>
        )}

        {mode === 'verification-pending' && (
          <motion.div
            key="verification-pending"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 max-w-md w-full text-center flex flex-col items-center overflow-hidden box-border"
          >
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-2">
              <ShieldAlert size={32} />
            </div>

            <h2 className="text-xl font-extrabold text-slate-800">Account Verification Required</h2>
            
            <p className="text-slate-500 text-xs leading-relaxed font-semibold">
              Multiple profiles with similar names were detected in our system. To prevent incorrect profile linking, our administrators/staff need to manually verify and link your account.
            </p>

            <div className="bg-amber-50 border border-amber-200/50 p-4 rounded-2xl flex gap-3 text-left w-full box-border">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <h4 className="text-xs font-extrabold text-amber-900">What happens next?</h4>
                <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                  Our staff is reviewing your details to safely merge any scores and evaluations. You will automatically gain full dashboard access once confirmed.
                </p>
              </div>
            </div>

            {/* Manual PIN Activation option */}
            <form onSubmit={handleVerifyPin} className="w-full border-t border-slate-100 pt-5 mt-2 space-y-3 text-left box-border">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                Have a Registration PIN?
              </label>
              <p className="text-[11px] text-slate-500 leading-normal font-medium">
                Enter your pre-registered PIN below to merge your records and activate your account immediately:
              </p>
              
              <div className="flex flex-row gap-2 w-full box-border">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="e.g. 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
                  className="w-[55%] px-3 sm:px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-xs font-bold transition-all outline-none text-slate-900 box-border min-w-0"
                />
                <button
                  type="submit"
                  disabled={verifyingPin || !pin.trim()}
                  className="w-[45%] px-2 sm:px-4 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] sm:text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap shrink-0 overflow-hidden"
                >
                  {verifyingPin ? <Loader2 size={12} className="animate-spin" /> : "Verify PIN"}
                </button>
              </div>

              {pinError && (
                <p className="text-[10px] text-rose-600 font-extrabold mt-1">{pinError}</p>
              )}
            </form>

            <div className="w-full space-y-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  if (!currentUser) return;
                  // check document again
                  const { db } = await initFirebaseClient();
                  if (!db) {
                    throw new Error("Firestore database is not initialized.");
                  }
                  const docRef = doc(db, "users", currentUser.uid);
                  const snap = await getDoc(docRef);
                  if (snap.exists() && snap.data().accountStatus === 'active') {
                    onSuccess({ id: snap.id, ...snap.data() });
                  } else {
                    setEmailMsg("Status checked: Still pending confirmation.");
                    setTimeout(() => setEmailMsg(null), 3000);
                  }
                }}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs tracking-wider uppercase transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                Check Status
              </button>

              {emailMsg && (
                <p className="text-[10px] text-slate-500 italic font-semibold">{emailMsg}</p>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 bg-transparent text-slate-500 hover:text-slate-700 text-xs font-semibold hover:underline flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut size={13} />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
