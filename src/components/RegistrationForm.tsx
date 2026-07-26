import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, BookOpen, GraduationCap, Loader2, AlertTriangle, HelpCircle, X, CheckCircle2 } from 'lucide-react';
import { getFriendlyErrorMessage } from '../utils/getFriendlyErrorMessage';
import type { RevieweeData } from '../types';
import { checkOfflineDuplicate, saveOfflineRecord } from '../utils/localStorageDb';
import { clientCheckDuplicate, clientVerifyPin, clientEnroll } from '../utils/firebaseClient';
import { playSuccessSound, playDuplicateSound } from '../utils/audio';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Paste your direct image URL or Google Drive share link here below to apply Custom Logo!
const CUSTOM_LOGO_URL = '/logo.svg';

// Resolves and transforms standard Google Drive sharing links into raw direct image sources for standard <img> tags
function resolveImageUrl(url: string): string {
  if (!url) return '';
  const val = url.trim();
  if (val.includes('drive.google.com')) {
    const idMatch = val.match(/\/d\/([a-zA-Z0-9-_]+)/) || val.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      // First try the highly-reliable direct unauthenticated CDN url representation
      return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
  }
  return val;
}

interface RegistrationFormProps {
  onSuccess: (data: RevieweeData) => void;
}

export function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const lastNameRef = React.useRef<HTMLInputElement>(null);
  const firstNameRef = React.useRef<HTMLInputElement>(null);
  const middleNameRef = React.useRef<HTMLInputElement>(null);
  const schoolNameRef = React.useRef<HTMLInputElement>(null);

  const [lastName, setLastName] = useLocalStorage('enroll_lastName', '');
  const [firstName, setFirstName] = useLocalStorage('enroll_firstName', '');
  const [middleName, setMiddleName] = useLocalStorage('enroll_middleName', '');
  const [schoolName, setSchoolName] = useLocalStorage('enroll_schoolName', '');
  const [allSchools, setAllSchools] = useState<string[]>([]);
  const [officialNames, setOfficialNames] = useState<string[]>([]);
  const [schoolMappings, setSchoolMappings] = useState<Record<string, string>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pinInput, setPinInput] = useState('');

  // Fetch all schools and mappings for autocomplete
  useEffect(() => {
    const fetchWithRetry = async (url: string, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url);
          if (res.ok) return await res.json();
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    };

    fetchWithRetry('/api/schools')
      .then(data => {
        if (data && data.schools) setAllSchools(data.schools);
      })
      .catch(() => {}); // silently fail to prevent console noise
      
    const DEFAULT_SCHOOLS = [
      "CHRIST THE KING COLLEGE DE MARANDING, INC.",
      "LANAO SCHOOL OF SCIENCE AND TECHNOLOGY, INC.",
      "NORTH CENTRAL MINDANAO COLLEGE",
      "PHILIPPINE COLLEGE OF CRIMINOLOGY",
      "UNIVERSITY OF THE CORDILLERAS",
      "UNIVERSITY OF MANILA",
      "CAGAYAN DE ORO COLLEGE",
      "MISAMIS UNIVERSITY",
      "UNIVERSITY OF MINDANAO",
      "HOLY CROSS OF DAVAO COLLEGE",
      "WESTERN MINDANAO STATE UNIVERSITY",
      "BICOL UNIVERSITY",
      "BULACAN STATE UNIVERSITY",
      "CAVITE STATE UNIVERSITY",
      "CENTRAL LUZON STATE UNIVERSITY",
      "LAGUNA STATE POLYTECHNIC UNIVERSITY",
      "PANGASINAN STATE UNIVERSITY",
      "TARLAC STATE UNIVERSITY",
      "UNIVERSITY OF NORTHERN PHILIPPINES",
      "VISAYAS STATE UNIVERSITY",
      "WEST VISAYAS STATE UNIVERSITY",
      "ZAMBOANGA STATE COLLEGE OF MARINE SCIENCES AND TECHNOLOGY",
      "SAINT JOHN THE BAPTIST COLLEGE",
      "SAINT MICHAEL'S COLLEGE",
      "ILIGAN MEDICAL CENTER COLLEGE",
      "ILIGAN CAPITOL COLLEGE",
      "MINDANAO STATE UNIVERSITY",
      "LANAO DEL NORTE AGRICULTURAL COLLEGE",
      "ST. FRANCIS XAVIER ACADEMY",
      "OUR LADY OF PERPETUAL HELP EDUCATION SYSTEM"
    ];

    fetchWithRetry('/api/school-mappings')
      .then(data => {
        if (data) {
          if (data.officialNames && data.officialNames.length > 0) {
            setOfficialNames(data.officialNames);
          } else {
            setOfficialNames(DEFAULT_SCHOOLS);
          }
          if (data.mappings) {
            setSchoolMappings(data.mappings);
          }
        } else {
          setOfficialNames(DEFAULT_SCHOOLS);
        }
      })
      .catch(() => {
        setOfficialNames(DEFAULT_SCHOOLS);
      });
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);

  const checkErrorForQuota = (err: any) => {
    const errMsg = String(err?.message || err?.details || err || '').toLowerCase();
    if (
      errMsg.includes('quota') || 
      errMsg.includes('resource_exhausted') || 
      errMsg.includes('limit exceeded') || 
      errMsg.includes('exhausted') ||
      errMsg.includes('quota_exceeded')
    ) {
      setIsQuotaExhausted(true);
    }
  };

  const [duplicateRecord, setDuplicateRecord] = useState<RevieweeData | null>(null);
  const [cachedDuplicate, setCachedDuplicate] = useState<RevieweeData | null>(null);
  const [knownDuplicateName, setKnownDuplicateName] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  
  const [showDraftNotice, setShowDraftNotice] = useState(false);

  // Check for any existing draft on mount to alert the user it has been restored
  useEffect(() => {
    try {
      const hasDraft = !!(
        localStorage.getItem('enroll_lastName') ||
        localStorage.getItem('enroll_firstName') ||
        localStorage.getItem('enroll_middleName') ||
        localStorage.getItem('enroll_schoolName')
      );
      if (hasDraft) {
        setShowDraftNotice(true);
        const timer = setTimeout(() => {
          setShowDraftNotice(false);
        }, 8000); // Keep it visible long enough for readability, or allow manual closing
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('Error checking local storage draft:', e);
    }
  }, []);

  const handleClearDraft = () => {
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setSchoolName('');
    setShowDraftNotice(false);
  };

  // Logo fallback state
  const resolvedUrl = resolveImageUrl(CUSTOM_LOGO_URL);
  const [imgSrc, setImgSrc] = useState(resolvedUrl);
  const [logoError, setLogoError] = useState(false);

  // Update logo source if configuration changes
  useEffect(() => {

    setImgSrc(resolvedUrl);
    setLogoError(false);
  }, [resolvedUrl]);

  // Dynamic lookup for the verified official school name matching the entered schoolName alias or exact official spelling
  const uSchoolInput = schoolName.trim().toUpperCase();
  const exactOfficialMatch = officialNames.find(
    name => name.trim().toUpperCase() === uSchoolInput
  );
  const mappedOfficialMatch = schoolMappings[uSchoolInput];
  const finalVerifiedSchool = exactOfficialMatch || mappedOfficialMatch || null;

  // Debounced duplicate entry check as the user types
  useEffect(() => {
    if (!lastName.trim() || !firstName.trim()) {
      setDuplicateRecord(null);
      setPinInput('');
      return;
    }

    const controller = new AbortController();
    
    const delayDebounce = setTimeout(async () => {
      setIsCheckingDuplicate(true);
      // Extra timeout just for the fetch
      const fetchTimeoutId = setTimeout(() => controller.abort(), 3500);
      try {
        const query = new URLSearchParams({
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim()
        });
        const res = await fetch(`/api/check-duplicate?${query.toString()}`, { signal: controller.signal });
        clearTimeout(fetchTimeoutId);
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const result = await res.json();
            if (result.exists) {
              setDuplicateRecord(result);
            } else {
              setDuplicateRecord(null);
              setPinInput('');
            }
          } else {
            try {
              const result = await clientCheckDuplicate(lastName, firstName, middleName);
              if (result.exists) {
                setDuplicateRecord(result);
              } else {
                setDuplicateRecord(null);
                setPinInput('');
              }
            } catch (fbErr) {
              checkErrorForQuota(fbErr);
              console.warn("Client Firebase check error (as a Netlify fallback):", fbErr);
              const offlineMatch = checkOfflineDuplicate(lastName, firstName, middleName);
              setDuplicateRecord(offlineMatch);
              if (!offlineMatch) setPinInput('');
            }
          }
        } else {
          try {
            const result = await clientCheckDuplicate(lastName, firstName, middleName);
            if (result.exists) {
              setDuplicateRecord(result);
            } else {
              setDuplicateRecord(null);
              setPinInput('');
            }
          } catch (fbErr) {
            checkErrorForQuota(fbErr);
            console.warn("Client Firebase check error (as a server-error fallback):", fbErr);
            const offlineMatch = checkOfflineDuplicate(lastName, firstName, middleName);
            setDuplicateRecord(offlineMatch);
            if (!offlineMatch) setPinInput('');
          }
        }
      } catch (err: any) {
        clearTimeout(fetchTimeoutId);
        checkErrorForQuota(err);
        if (err.name === 'AbortError') {
          console.warn('API fetch aborted by concurrent keystroke or timeout.');
        } else {
          console.warn('API error or backend unreachable. Attempting client-side Firebase:', err);
        }
        try {
          const result = await clientCheckDuplicate(lastName, firstName, middleName);
          if (result.exists) {
            setDuplicateRecord(result);
          } else {
            setDuplicateRecord(null);
            setPinInput('');
          }
        } catch (firebaseErr) {
          checkErrorForQuota(firebaseErr);
          console.warn('Direct Firebase check on catch failed, using LocalStorage:', firebaseErr);
          const offlineMatch = checkOfflineDuplicate(lastName, firstName, middleName);
          setDuplicateRecord(offlineMatch);
          if (!offlineMatch) setPinInput('');
        }
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 450);

    return () => {
      clearTimeout(delayDebounce);
      controller.abort();
    };
  }, [lastName, firstName, middleName]);

  // Trigger sensory feedback upon duplicate record detection
  useEffect(() => {
    if (duplicateRecord) {
      playDuplicateSound();
      setCachedDuplicate(duplicateRecord);
      setKnownDuplicateName(`${lastName.trim().toUpperCase()}|${firstName.trim().toUpperCase()}|${middleName.trim().toUpperCase()}`);
    }
  }, [duplicateRecord, lastName, firstName, middleName]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [customPin, setCustomPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const currentNameKey = `${lastName.trim().toUpperCase()}|${firstName.trim().toUpperCase()}|${middleName.trim().toUpperCase()}`;
    
    // If we've already detected a duplicate with these same fields, restore it instantly and block submission
    if (!duplicateRecord && knownDuplicateName === currentNameKey && cachedDuplicate) {
      setDuplicateRecord(cachedDuplicate);
      setError(null);
      return;
    }
    
    // If duplicate exists, verify PIN on the server
    if (duplicateRecord) {
      if (!pinInput || pinInput.length !== 4) {
        setError('Please enter your 4-digit PIN password.');
        return;
      }
      
      setLoading(true);
      setError(null);
      try {
        let isVerified = false;
        let result: any = {};
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const res = await fetch('/api/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lastName: lastName.trim(),
              firstName: firstName.trim(),
              middleName: middleName.trim(),
              pin: pinInput.trim()
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          const contentType = res.headers.get("content-type");
          if (res.ok && contentType && contentType.includes("application/json")) {
            result = await res.json();
            isVerified = result.success;
          } else if (res.status === 401) {
            // Explicitly handle incorrect PIN from server without falling back
            let errorMsg = 'Incorrect PIN code.';
            if (contentType && contentType.includes("application/json")) {
                const errData = await res.json();
                errorMsg = errData.error || errorMsg;
            }
            throw new Error(`SERVER_AUTH_FAIL:${errorMsg}`);
          } else {
            const text = await res.text();
            throw new Error(text || 'Connection issue.');
          }
        } catch (apiErr: any) {
          if (apiErr.message && apiErr.message.startsWith('SERVER_AUTH_FAIL:')) {
            throw new Error(apiErr.message.replace('SERVER_AUTH_FAIL:', ''));
          }
          console.warn("Server verify-pin failed or unreachable. Falling back to direct client Firebase verification:", apiErr);
          try {
            result = await clientVerifyPin(lastName, firstName, middleName, pinInput);
            isVerified = result.success;
          } catch (fbErr: any) {
            console.warn("Direct client Firebase verification failed. Falling back to LocalStorage:", fbErr);
            const offlineMatch = checkOfflineDuplicate(lastName, firstName, middleName);
            if (offlineMatch) {
              if (offlineMatch.pin === pinInput.trim()) {
                result = offlineMatch;
                isVerified = true;
              } else {
                throw new Error("Incorrect PIN code (local backup verified).");
              }
            } else {
              throw new Error(fbErr?.message || "Incorrect PIN code or connection issue.");
            }
          }
        }
        
        if (isVerified) {
          playSuccessSound();
          try {
            localStorage.removeItem('enroll_lastName');
            localStorage.removeItem('enroll_firstName');
            localStorage.removeItem('enroll_middleName');
            localStorage.removeItem('enroll_schoolName');
          } catch (e) {
            console.warn('Failed to clear form cache:', e);
          }
          onSuccess(result as RevieweeData);
        } else {
          setError(result.error || 'Incorrect PIN code.');
        }
      } catch (err: any) {
        console.error('PIN verification failed:', err);
        setError(err?.message || 'Incorrect PIN password.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Always re-check for duplicate right before confirming enrollment to prevent bypass
    setLoading(true);
    try {
      const result = await clientCheckDuplicate(lastName.trim(), firstName.trim(), middleName.trim());
      if (result.exists) {
        setDuplicateRecord(result);
        setLoading(false);
        return;
      }
    } catch (err) {
      checkErrorForQuota(err);
      // If network fails, try offline cache check
      const offlineMatch = checkOfflineDuplicate(lastName, firstName, middleName);
      if (offlineMatch) {
         setDuplicateRecord(offlineMatch);
         setLoading(false);
         return;
      }
    }
    setLoading(false);

    setCustomPin('');
    setPinError(null);
    setShowConfirmModal(true);
  };

  const executeEnrollment = async () => {
    if (!customPin || customPin.length !== 4) {
      setPinError('Please enter a valid 4-digit PIN password.');
      return;
    }

    setShowConfirmModal(false);
    setLoading(true);
    setError(null);
    
    const data = {
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      schoolName: schoolName.trim(),
      pin: customPin,
    };

    try {
      let result: any = null;
      let success = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const response = await fetch('/api/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          result = await response.json();
          success = true;
        } else {
          let errorMsg = `Server returned status ${response.status}`;
          if (contentType && contentType.includes("application/json")) {
            try {
              const errData = await response.json();
              errorMsg = errData.error || errorMsg;
            } catch (e) {}
            
            // Only throw API_REJECT (which skips fallback) if it's a critical duplicate validation error
            const isCriticalValidation = errorMsg.toLowerCase().includes('duplicate') || errorMsg.toLowerCase().includes('exists');
            if (isCriticalValidation) {
              throw new Error(`API_REJECT:${errorMsg}`);
            } else {
              throw new Error(errorMsg);
            }
          } else {
            // Trigger fallback for 404s/500s that return HTML or Text (e.g., Vercel backend routing mismatches)
            throw new Error(`API unreachable or invalid format (status ${response.status})`);
          }
        }
      } catch (apiErr: any) {
        checkErrorForQuota(apiErr);
        if (apiErr.message && apiErr.message.startsWith('API_REJECT:')) {
          const directError = apiErr.message.replace('API_REJECT:', '');
          throw new Error(directError);
        }
        console.warn("API Server enrollment failed. Attempting direct client Firebase enrollment...", apiErr);
        try {
          result = await clientEnroll(lastName, firstName, middleName, schoolName, customPin);
          success = true;
        } catch (firebaseErr: any) {
          checkErrorForQuota(firebaseErr);
          console.warn("Direct client Firebase enrollment failed, enrolling locally offline:", firebaseErr);
          try {
            // Save local offline record and mark as offline
            result = saveOfflineRecord(
              lastName,
              firstName,
              middleName,
              schoolName,
              customPin,
              false // submit to App Script Webhook in background!
            );
            result.isOffline = true;
            success = true;
          } catch (offlineErr: any) {
            console.error("Local offline fallback also failed:", offlineErr);
            throw new Error(offlineErr?.message || 'Failed to complete registration.');
          }
        }
      }
      
      if (!success || !result) {
        throw new Error('Enrollment failed.');
      }
      
      playSuccessSound();
      
      // Save offline copy in localStorage for backup/verification if needed (only if not already saved during offline registration)
      if (!result.isOffline) {
        try {
          saveOfflineRecord(
            lastName,
            firstName,
            middleName,
            schoolName,
            customPin,
            true // skipWebhook = true since the backend already recorded it
          );
        } catch (e) {
          console.warn("Offline copy save skipped:", e);
        }
      }
      
      try {
        localStorage.removeItem('enroll_lastName');
        localStorage.removeItem('enroll_firstName');
        localStorage.removeItem('enroll_middleName');
        localStorage.removeItem('enroll_schoolName');
      } catch (e) {
        console.warn('Failed to clear form cache:', e);
      }
      
      setCustomPin('');
      setPinError(null);
      onSuccess(result as RevieweeData);
      
    } catch (err: any) {
      console.error('Enrollment submission failed:', err);
      const friendly = getFriendlyErrorMessage(err);
      setError(friendly.message);
      setLoading(false);
    }
  };

  return (
    <div className="registration-form-container group w-full max-w-full mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 flex flex-col relative mb-8 mt-12 sm:mt-16">
      <style>{`
        @media print {
          .registration-form-container {
            padding: 20px !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
      <div id="registration-top-gradient-bar" className="absolute top-0 left-0 right-0 w-full h-2.5 animate-logo-gradient z-10 transition-all duration-300 hover:scale-[1.01] group-hover:scale-[1.01] origin-top rounded-t-3xl"></div>
      
      {/* Centered logo container */}
      <div className="flex flex-col items-center justify-center text-center mt-3 mb-6">
        <div className="relative mb-4">
          <motion.a 
            href="https://samaritanreviewcenter.com/student/" 
            className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-md overflow-hidden relative cursor-pointer block z-10"
            animate={{ y: [0, -15, 0] }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          >
            {imgSrc && !logoError ? (
              <img 
                src={imgSrc} 
                alt="SRC Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => {
                  if (imgSrc === '/logo.svg') {
                    setImgSrc('/api/logo');
                  } else {
                    setLogoError(true);
                  }
                }}
              />
            ) : null}
            {(logoError || !imgSrc) ? (
              <div className="bg-gradient-to-tr from-blue-700 to-blue-500 absolute inset-0 flex items-center justify-center text-white">
                <GraduationCap className="w-10 h-10 drop-shadow" />
              </div>
            ) : null}
          </motion.a>
          <motion.div 
            className="absolute -bottom-2.5 left-1/2 -ml-7 w-14 h-3 bg-slate-900/20 border-none blur-[4px] rounded-[50%] pointer-events-none"
            animate={{ 
              scale: [1, 0.6, 1],
              opacity: [0.5, 0.2, 0.5]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
        </div>

        <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 max-w-xs leading-none text-center mx-auto">
          SAMARITAN REVIEW CENTER
        </h3>
        <span className="text-[10px] font-black text-blue-600 tracking-widest uppercase mt-1 mb-2 text-center block mx-auto">
          Registration Form
          <span className="text-[9px] lowercase font-normal text-slate-400 block mt-0.5 tracking-normal">
            (progress auto-saves to local storage)
          </span>
        </span>
        <p className="text-xs text-slate-400 font-medium mb-1 text-center mx-auto">Please complete the form below to enroll.</p>
      </div>

      {isQuotaExhausted && (
        <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs font-semibold leading-relaxed shadow-sm flex items-start gap-2.5">
          <span className="text-base select-none shrink-0 mt-0.5">⚠️</span>
          <div>
            <h5 className="font-bold uppercase tracking-wider mb-0.5 text-amber-800">Database Quota Active (Offline-Optimized Mode)</h5>
            <p className="text-slate-600 font-medium">
              The primary database is currently under high usage and operating on its daily capacity limit. 
              Don't worry! **Your registration will still work perfectly.**
              Your profile is safely cached locally and will synchronize to Google Sheets automatically upon completion.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Draft Auto-saved Indicator / Notice */}
        <AnimatePresence>
          {showDraftNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/80 text-blue-900 text-xs font-semibold leading-relaxed shadow-sm flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                  <span>Unsaved progress restored.</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="text-[9px] uppercase font-black tracking-wider text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded transition-colors shrink-0"
                >
                  Clear Draft
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Last Name */}
        <div className="space-y-1">
          <label htmlFor="lastName" className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
            Last Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <User size={16} />
            </div>
            <input
              type="text"
              id="lastName"
              name="lastName"
              required
              ref={lastNameRef}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); firstNameRef.current?.focus(); } }}
              value={lastName ?? ''}
              onChange={(e) => setLastName(e.target.value.toUpperCase())}
              placeholder="PESALVER"
              className="w-full pl-11 pr-14 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors uppercase"
            />
            {lastName && (
              <div className="absolute inset-y-0 right-9 flex items-center pointer-events-none">
                {lastName.trim().length > 0 && <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>
            )}
            {lastName && (
              <button
                type="button"
                onClick={() => setLastName('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* First Name */}
        <div className="space-y-1">
          <label htmlFor="firstName" className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
            First Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <User size={16} />
            </div>
            <input
              type="text"
              id="firstName"
              name="firstName"
              required
              ref={firstNameRef}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); middleNameRef.current?.focus(); } }}
              value={firstName ?? ''}
              onChange={(e) => setFirstName(e.target.value.toUpperCase())}
              placeholder="ARIEL"
              className="w-full pl-11 pr-14 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors uppercase"
            />
            {firstName && (
              <div className="absolute inset-y-0 right-9 flex items-center pointer-events-none">
                {firstName.trim().length > 0 && <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>
            )}
            {firstName && (
              <button
                type="button"
                onClick={() => setFirstName('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Middle Name */}
        <div className="space-y-1">
          <label htmlFor="middleName" className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
            Middle Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <User size={16} />
            </div>
            <input
              type="text"
              id="middleName"
              name="middleName"
              ref={middleNameRef}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); schoolNameRef.current?.focus(); } }}
              value={middleName ?? ''}
              onChange={(e) => setMiddleName(e.target.value.toUpperCase())}
              placeholder="ORCIA (OPTIONAL)"
              className="w-full pl-11 pr-14 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors uppercase"
            />
            {middleName && (
              <div className="absolute inset-y-0 right-9 flex items-center pointer-events-none">
                {middleName.trim().length === 1 && <AlertTriangle size={16} className="text-amber-500" />}
                {middleName.trim().length > 1 && <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>
            )}
            {middleName && (
              <button
                type="button"
                onClick={() => setMiddleName('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {middleName.trim().length === 1 && (
            <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1 bg-amber-50 p-1.5 rounded-md"><AlertTriangle size={12} className="shrink-0" /> Please enter your complete middle name, not just the initial.</p>
          )}
        </div>

        {/* School Name */}
        <div className="space-y-1 relative">
          <label htmlFor="schoolName" className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
            School Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <svg 
                viewBox="0 0 103.09 122.88" 
                className="w-4 h-4 fill-current text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g>
                  <path 
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11.76,63.87l3.72-0.23c0.08,0.6,0.24,1.06,0.49,1.38c0.4,0.51,0.98,0.77,1.73,0.77 c0.56,0,0.99-0.13,1.29-0.39c0.3-0.26,0.45-0.57,0.45-0.91c0-0.33-0.14-0.62-0.43-0.88c-0.29-0.26-0.95-0.5-2-0.74 c-1.72-0.38-2.94-0.9-3.67-1.54c-0.74-0.64-1.11-1.45-1.11-2.44c0-0.65,0.19-1.26,0.57-1.84c0.38-0.58,0.94-1.04,1.7-1.37 c0.76-0.33,1.8-0.5,3.12-0.5c1.62,0,2.86,0.3,3.71,0.91c0.85,0.6,1.36,1.56,1.52,2.88l-3.69,0.22c-0.1-0.58-0.3-0.99-0.62-1.25 c-0.32-0.26-0.75-0.39-1.3-0.39c-0.45,0-0.8,0.1-1.03,0.29c-0.23,0.19-0.35,0.43-0.35,0.71c0,0.2,0.09,0.38,0.28,0.54 c0.18,0.17,0.62,0.32,1.31,0.47c1.71,0.37,2.94,0.74,3.68,1.12c0.74,0.38,1.28,0.84,1.62,1.41c0.34,0.56,0.51,1.18,0.51,1.88 c0,0.81-0.22,1.56-0.67,2.25c-0.45,0.68-1.08,1.21-1.89,1.56c-0.81,0.35-1.82,0.53-3.05,0.53c-2.16,0-3.65-0.42-4.48-1.25 C12.34,66.2,11.87,65.15,11.76,63.87L11.76,63.87z M53.64,84.95v32.45h11.52V84.95H53.64L53.64,84.95z M49.46,117.41V84.95H38.04 v32.45H49.46L49.46,117.41z M51.75,3.33c8.76-6.06,9.42,5.93,18.02-1.55v12.22c-8.21,7.38-9.98-4.54-18.02,1.52V3.33L51.75,3.33z M49.59,0c0.92,0,1.67,0.75,1.67,1.67c0,0.61-0.33,1.15-0.82,1.44l0.08,0v19.06h25.43v17.32h27.15v83.36 c-34.36,0-68.72,0.03-103.09,0.03V39.49h27.18V22.18h21.48V3.11h0.08c-0.49-0.29-0.82-0.83-0.82-1.44C47.92,0.75,48.66,0,49.59,0 L49.59,0z M50.15,30.52c0-0.59,0.48-1.07,1.07-1.07c0.59,0,1.07,0.48,1.07,1.07v4.13h3.06c0.59,0,1.07,0.48,1.07,1.07 c0,0.59-0.48,1.07-1.07,1.07h-4.13c-0.59,0-1.07-0.48-1.07-1.07V30.52L50.15,30.52z M51.55,27.66c4.02,0,7.28,3.26,7.28,7.28 c0,4.02-3.26,7.28-7.28,7.28c-4.02,0-7.28-3.26-7.28-7.28C44.27,30.92,47.53,27.66,51.55,27.66L51.55,27.66z M5.73,48.49h92.32 v24.86H5.73V48.49L5.73,48.49z M11.07,94.59h13.59V110H11.07V94.59L11.07,94.59z M78.43,94.59h13.59V110H78.43V94.59L78.43,94.59z M81.97,55.38h3.92v9.57h6.13v3.12H81.97V55.38L81.97,55.38z M66.98,61.73c0-2.07,0.58-3.68,1.73-4.83 c1.15-1.15,2.76-1.73,4.82-1.73c2.11,0,3.74,0.57,4.88,1.7c1.14,1.13,1.71,2.72,1.71,4.76c0,1.48-0.25,2.7-0.75,3.64 c-0.5,0.95-1.22,1.69-2.16,2.21c-0.94,0.53-2.12,0.79-3.53,0.79c-1.43,0-2.61-0.23-3.55-0.68c-0.94-0.46-1.7-1.18-2.28-2.16 C67.27,64.45,66.98,63.21,66.98,61.73L66.98,61.73z M70.89,61.74c0,1.28,0.24,2.2,0.71,2.76c0.48,0.56,1.13,0.84,1.95,0.84 c0.84,0,1.5-0.27,1.96-0.82c0.46-0.55,0.69-1.53,0.69-2.95c0-1.19-0.24-2.06-0.72-2.61c-0.48-0.55-1.14-0.83-1.96-0.83 c-0.79,0-1.43,0.28-1.91,0.84C71.13,59.52,70.89,60.45,70.89,61.74L70.89,61.74z M52.48,61.73c0-2.07,0.58-3.68,1.73-4.83 c1.15-1.15,2.76-1.73,4.82-1.73c2.11,0,3.74,0.57,4.88,1.7c1.14,1.13,1.71,2.72,1.71,4.76c0,1.48-0.25,2.7-0.75,3.64 c-0.5,0.95-1.22,1.69-2.16,2.21c-0.95,0.53-2.12,0.79-3.53,0.79c-1.43,0-2.61-0.23-3.55-0.68c-0.94-0.46-1.7-1.18-2.28-2.16 C52.77,64.45,52.48,63.21,52.48,61.73L52.48,61.73z M56.4,61.74c0,1.28,0.24,2.2,0.71,2.76c0.48,0.56,1.13,0.84,1.95,0.84 c0.84,0,1.5-0.27,1.96-0.82c0.46-0.55,0.69-1.53,0.69-2.95c0-1.19-0.24-2.06-0.72-2.61c-0.48-0.55-1.14-0.83-1.96-0.83 c-0.79,0-1.43,0.28-1.91,0.84C56.64,59.52,56.4,60.45,56.4,61.74L56.4,61.74z M38.5,55.38h3.92v4.43h4.29v-4.43h3.93v12.68H46.7 v-5.14h-4.29v5.14H38.5V55.38L38.5,55.38z M33.42,62.87l3.44,1.04c-0.23,0.96-0.59,1.77-1.09,2.41c-0.5,0.65-1.11,1.13-1.85,1.46 c-0.74,0.33-1.67,0.49-2.81,0.49c-1.38,0-2.51-0.2-3.38-0.6c-0.87-0.4-1.63-1.11-2.26-2.11c-0.63-1.01-0.95-2.3-0.95-3.87 c0-2.1,0.56-3.71,1.67-4.84c1.12-1.13,2.7-1.69,4.74-1.69c1.6,0,2.86,0.32,3.77,0.97c0.91,0.65,1.59,1.64,2.04,2.98l-3.45,0.76 c-0.12-0.38-0.25-0.66-0.38-0.84c-0.22-0.3-0.49-0.53-0.81-0.69c-0.32-0.16-0.67-0.24-1.07-0.24c-0.89,0-1.57,0.36-2.05,1.07 c-0.36,0.53-0.54,1.36-0.54,2.49c0,1.41,0.21,2.37,0.64,2.89c0.43,0.52,1.03,0.78,1.8,0.78c0.75,0,1.32-0.21,1.7-0.63 C32.97,64.28,33.24,63.67,33.42,62.87L33.42,62.87z"
                  />
                </g>
              </svg>
            </div>
            <input
              type="text"
              id="schoolName"
              name="schoolName"
              required={!duplicateRecord}
              ref={schoolNameRef}
              onKeyDown={(e) => { if (e.key === 'Enter') { /* Forms submit on enter naturally if button is submit type */ } }}
              value={schoolName ?? ''}
              onChange={(e) => {
                setSchoolName(e.target.value.toUpperCase());
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="COLLEGE OF CRIMINOLOGY"
              className="w-full pl-11 pr-14 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors uppercase"
            />
            {schoolName && (
              <div className="absolute inset-y-0 right-9 flex items-center pointer-events-none">
                {schoolName.trim().length > 0 && <CheckCircle2 size={16} className={finalVerifiedSchool ? "text-emerald-500" : "text-amber-500"} />}
              </div>
            )}
            {schoolName && (
              <button
                type="button"
                onClick={() => setSchoolName('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear school name"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Real-time green verification badge with a pulse animation */}
          {finalVerifiedSchool && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 font-extrabold bg-emerald-50/80 border border-emerald-100 px-3 py-2 rounded-xl uppercase tracking-wide shadow-sm"
            >
              <CheckCircle2 size={13} className="shrink-0 text-emerald-600 animate-pulse" />
              <span>Verified Official School: {finalVerifiedSchool}</span>
            </motion.div>
          )}
          
          {/* Suggestions List */}
          {showSuggestions && officialNames.filter(s => s.toLowerCase().includes(schoolName.toLowerCase())).length > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl shadow-lg border border-slate-100 py-2 max-h-56 overflow-auto shadow-2xl">
              {officialNames.filter(s => s.toLowerCase().includes(schoolName.toLowerCase())).map(school => (
                <button
                  key={school}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent onBlur from hiding it immediately
                    setSchoolName(school);
                    setShowSuggestions(false);
                  }}
                  onClick={() => {
                    setSchoolName(school);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  {school}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Prominent Warning if Duplication Exists (Floating Modal) */}
        <AnimatePresence>
          {duplicateRecord && (
            <div className="!fixed !inset-0 !top-0 !left-0 !m-0 !p-4 w-[100vw] h-[100dvh] z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm p-5 bg-amber-50 border-2 border-amber-200 rounded-3xl shadow-2xl relative"
              >
                <div className="flex items-center gap-2 text-amber-800 mb-3">
                  <AlertTriangle size={20} className="shrink-0 text-amber-600" />
                  <span className="text-sm font-black uppercase tracking-wider">Duplicate Entry Detected</span>
                </div>
                
                <p className="text-xs text-amber-700 font-medium leading-relaxed mb-4">
                  A registration record with this name already exists. Please enter your 4-digit PIN to access your registration details.
                </p>

                <div className="bg-white rounded-xl p-4 text-xs space-y-4 border border-amber-100 text-slate-700 shadow-inner text-center">
                  <div className="border-b border-amber-100 pb-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Name</span>
                    <p className="font-semibold text-slate-900 text-sm">
                      {duplicateRecord.last_name}, {duplicateRecord.first_name} {duplicateRecord.middle_name || ''}
                    </p>
                    <div className="mt-2 text-[10px] font-bold uppercase text-slate-400">Institution</div>
                    <p className="font-semibold text-slate-900 text-sm">{duplicateRecord.school_name}</p>
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    autoFocus
                    value={pinInput ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      setPinInput(val);
                      setError(null);
                    }}
                    className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xl font-sans font-black tracking-widest text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="ENTER 4-DIGIT PIN"
                  />
                  
                  {error && (
                    <div className="mt-2 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      // Trigger the submit handler logic
                      handleSubmit(e as any);
                    }}
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold mt-2 text-sm uppercase tracking-wider flex justify-center items-center focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all active:scale-[0.98] bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        Processing...
                      </>
                    ) : (
                      'View Existing Registration'
                    )}
                  </button>

                  {confirmCancel ? (
                    <div className="mt-4 pt-2 border-t border-amber-100 flex flex-col items-center">
                      <span className="text-xs font-bold text-amber-800 mb-2 uppercase">Are you sure you want to cancel?</span>
                      <div className="flex gap-2 w-full">
                        <button 
                          type="button" 
                          onClick={() => {
                              setConfirmCancel(false);
                              setDuplicateRecord(null);
                              setPinInput('');
                          }}
                          className="flex-1 py-2 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg uppercase tracking-wider hover:bg-amber-200 focus:outline-none"
                        >
                          Yes
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setConfirmCancel(false)}
                          className="flex-1 py-2 text-xs font-bold bg-slate-800 text-white rounded-lg uppercase tracking-wider hover:bg-slate-700 focus:outline-none"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => setConfirmCancel(true)}
                      className="w-full py-2 mt-2 text-xs font-bold text-amber-700 uppercase tracking-wider hover:text-amber-900 focus:outline-none"
                    >
                      Cancel / Go Back
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {error && !duplicateRecord && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
            {error}
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading || (isCheckingDuplicate && !duplicateRecord)}
          className={`w-full py-3 rounded-xl font-bold mt-4 text-sm uppercase tracking-wider flex justify-center items-center focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all active:scale-[0.98] ${
            duplicateRecord 
              ? 'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500'
              : 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Processing...
            </>
          ) : isCheckingDuplicate && !duplicateRecord ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Checking...
            </>
          ) : duplicateRecord ? (
            'View Existing Registration'
          ) : (
            'Submit Registration'
          )}
        </button>
      </form>

      {/* Loading Skeleton Overlay */}
      {loading && !duplicateRecord && !showConfirmModal && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] z-50 flex flex-col items-center pt-32 px-6 rounded-3xl overflow-hidden animate-fade-in transition-opacity">
          <div className="w-full max-w-sm space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2 opacity-50">
                <div className="h-3 w-20 bg-slate-200 rounded animate-pulse"></div>
                <div className="h-12 w-full bg-slate-100 rounded-lg border border-slate-200 animate-pulse" style={{ animationDelay: `${i * 150}ms` }}></div>
              </div>
            ))}
            <div className="h-12 w-full bg-slate-200 rounded-xl mt-8 animate-pulse" style={{ animationDelay: '600ms' }}></div>
          </div>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="bg-white/95 backdrop-blur-md p-5 pb-4 justify-center items-center flex flex-col rounded-3xl shadow-2xl border border-slate-100/50">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
              <p className="text-[11px] font-black text-slate-800 tracking-widest uppercase">Processing</p>
              <p className="text-[9px] text-slate-500 font-medium mt-1">Please wait a moment...</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Overlay */}
      {showConfirmModal && (
        <div className="!fixed !inset-0 !top-0 !left-0 !m-0 !p-4 w-[100vw] h-[100dvh] z-[9999] flex items-center justify-center">
          {/* Backdrop wrapper */}
          <div 
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity"
            onClick={() => {
              setShowConfirmModal(false);
              setPinError(null);
            }}
          ></div>
          
          {/* Modal dialogue card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden relative z-10 p-6 sm:p-8 animate-fade-in">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <HelpCircle size={24} className="animate-pulse" />
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Confirm Details</h4>
              <p className="text-[11px] text-slate-400 mt-1">Please verify your details and define your 4-digit PIN code.</p>
            </div>

            {/* Structured details dashboard inside the popup */}
            <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-3 border border-slate-100 text-slate-700 mb-4 font-medium shadow-inner">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Name</span>
                <span className="font-extrabold text-slate-900">
                  {lastName.toUpperCase()}, {firstName.toUpperCase()} {middleName.toUpperCase()}
                </span>
              </div>
              
              <div className="flex flex-col gap-0.5 pt-2 border-t border-slate-100">
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">School</span>
                <span className="font-extrabold text-slate-900 flex items-center gap-1 flex-wrap">
                  {finalVerifiedSchool ? finalVerifiedSchool : schoolName.toUpperCase()}
                  {finalVerifiedSchool && (
                    <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                      <CheckCircle2 size={10} className="text-emerald-600" />
                      Official
                    </span>
                  )}
                </span>
                {finalVerifiedSchool && finalVerifiedSchool.toUpperCase() !== schoolName.toUpperCase() && (
                  <span className="text-[9.5px] text-slate-400 font-medium italic mt-0.5">
                    Mapped from alias: "{schoolName.toUpperCase()}"
                  </span>
                )}
              </div>
            </div>

            {/* Choice Pin Input inside the Confirmation Modal */}
            <div className="mb-5 space-y-1.5">
              <label htmlFor="customPinInput" className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 block text-center">
                SET YOUR 4-DIGIT PIN CODE
              </label>
              <input
                id="customPinInput"
                type="text"
                pattern="\d*"
                maxLength={4}
                autoFocus
                value={customPin ?? ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, '');
                  setCustomPin(val);
                  if (val.length === 4) {
                    setPinError(null);
                  }
                }}
                placeholder="Ex. 1234"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-sans font-black tracking-widest text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
              />
              <p className="text-[9.5px] leading-snug text-slate-400 text-center font-medium">
                You will need this PIN password to view or reprint your ID Badge & Receipt later.
              </p>
              {pinError && (
                <p className="text-[10px] text-red-650 font-bold bg-red-50 text-red-600 py-1.5 px-3 rounded-lg text-center animate-pulse">
                  {pinError}
                </p>
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPinError(null);
                }}
                className="flex-1 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all rounded-xl font-bold text-xs"
              >
                No, Go Back
              </button>
              <button
                type="button"
                onClick={executeEnrollment}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white transition-all rounded-xl font-bold text-xs shadow-md shadow-blue-600/10 active:scale-[0.98]"
              >
                Yes, Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
