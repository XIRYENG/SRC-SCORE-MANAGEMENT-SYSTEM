import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, MapPin, Loader2, User, ChevronDown, Check, ArrowRight, AlertCircle, UserCheck, CheckCircle2, Info } from 'lucide-react';
import { linkOrCreateUserRecord, findMatchingUnlinkedCandidates } from '../utils/idGenerator';
import { auth, logout } from '../utils/auth';
import { PortalLoading } from './PortalLoading';
import { getFriendlyErrorMessage, FriendlyError } from '../utils/getFriendlyErrorMessage';

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

const DEFAULT_BRANCHES = [
  "Iligan City",
  "Lala / Maranding",
  "Labason",
  "Valencia",
  "Balingasag",
  "Online Review"
];

interface ProfileSetupProps {
  onCompleted: (data: any) => void;
  initialData?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    schoolName?: string;
    reviewBranch?: string;
  };
}

export function ProfileSetup({ onCompleted, initialData }: ProfileSetupProps) {
  const [firstName, setFirstName] = useState(initialData?.firstName || '');
  const [middleName, setMiddleName] = useState(initialData?.middleName || '');
  const [lastName, setLastName] = useState(initialData?.lastName || '');
  
  // Searchable School State
  const [schoolInput, setSchoolInput] = useState(initialData?.schoolName || '');
  const [selectedSchool, setSelectedSchool] = useState(initialData?.schoolName || '');
  const [schoolSuggestions, setSchoolSuggestions] = useState<string[]>([]);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  // Searchable Branch State
  const [branchInput, setBranchInput] = useState(initialData?.reviewBranch || '');
  const [selectedBranch, setSelectedBranch] = useState(initialData?.reviewBranch || '');
  const [branchSuggestions, setBranchSuggestions] = useState<string[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  // Match candidate state for "Is this you?" flow
  const [matchCandidate, setMatchCandidate] = useState<any | null>(null);
  const [checkingMatch, setCheckingMatch] = useState(false);
  const [userMatchChoice, setUserMatchChoice] = useState<'pending' | 'yes' | 'no'>('pending');

  // Search for matching unlinked records when First Name & Last Name are provided
  useEffect(() => {
    if (!firstName.trim() || !lastName.trim() || firstName.trim().length < 2 || lastName.trim().length < 2) {
      setMatchCandidate(null);
      setUserMatchChoice('pending');
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingMatch(true);
      try {
        const candidates = await findMatchingUnlinkedCandidates(firstName.trim(), lastName.trim());
        if (candidates && candidates.length > 0) {
          setMatchCandidate(candidates[0]);
          setUserMatchChoice('pending');
        } else {
          setMatchCandidate(null);
          setUserMatchChoice('pending');
        }
      } catch (err) {
        console.warn("Candidate match check error:", err);
      } finally {
        setCheckingMatch(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [firstName, lastName]);

  // Sync initialData when provided asynchronously
  useEffect(() => {
    if (initialData) {
      if (initialData.firstName && !firstName) setFirstName(initialData.firstName);
      if (initialData.middleName && !middleName) setMiddleName(initialData.middleName);
      if (initialData.lastName && !lastName) setLastName(initialData.lastName);
      if (initialData.schoolName && !selectedSchool && !schoolInput) {
        setSelectedSchool(initialData.schoolName);
        setSchoolInput(initialData.schoolName);
      }
      if (initialData.reviewBranch && !selectedBranch && !branchInput) {
        setSelectedBranch(initialData.reviewBranch);
        setBranchInput(initialData.reviewBranch);
      }
    }
  }, [initialData]);

  // Fetch school list suggestions on mount or from API
  useEffect(() => {
    fetch('/api/schools')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.schools) {
          // merge and deduplicate
          const merged = Array.from(new Set([...DEFAULT_SCHOOLS, ...data.schools]));
          setSchoolSuggestions(merged);
        } else {
          setSchoolSuggestions(DEFAULT_SCHOOLS);
        }
      })
      .catch(() => {
        setSchoolSuggestions(DEFAULT_SCHOOLS);
      });

    setBranchSuggestions(DEFAULT_BRANCHES);
  }, []);

  // Filter school suggestions
  const filteredSchools = schoolInput.trim() === '' 
    ? schoolSuggestions 
    : schoolSuggestions.filter(s => s.toLowerCase().includes(schoolInput.toLowerCase()));

  // Filter branch suggestions
  const filteredBranches = branchInput.trim() === ''
    ? branchSuggestions
    : branchSuggestions.filter(b => b.toLowerCase().includes(branchInput.toLowerCase()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (!firstName.trim() || !lastName.trim()) {
      setError({ title: "Incomplete Fields", message: "Please fill out your First Name and Last Name." });
      return;
    }

    const finalSchool = selectedSchool || schoolInput.trim();
    if (!finalSchool) {
      setError({ title: "School Name Required", message: "Please select or enter your School Name." });
      return;
    }

    const finalBranch = selectedBranch || branchInput.trim();
    if (!finalBranch) {
      setError({ title: "Review Branch Required", message: "Please select or enter your Review Branch." });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user found.");
      }

      const res = await linkOrCreateUserRecord(
        user.uid,
        user.email || initialData?.email || "",
        firstName.trim(),
        middleName.trim(),
        lastName.trim(),
        finalSchool,
        finalBranch,
        userMatchChoice === 'yes' ? matchCandidate : null,
        userMatchChoice === 'no'
      );

      onCompleted(res);
    } catch (err: any) {
      console.error("Profile Setup Error:", err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && (
        <PortalLoading message="Activating Account…" subMessage="Please wait, Future RCrim." status="Activating Account…" />
      )}
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 max-w-xl w-full mx-4">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">Complete Your Profile</h2>
        <p className="text-slate-500 text-sm">
          Please provide your enrollment details so we can link your review records and scores.
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-2xl flex flex-col gap-3"
        >
          <div className="flex gap-2.5 items-start">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-red-800 text-sm">{error.title}</h4>
              <p className="text-red-700 text-xs leading-relaxed">{error.message}</p>
              {error.secondaryMessage && (
                <p className="text-red-600/95 text-[11px] font-medium leading-relaxed mt-0.5">
                  {error.secondaryMessage}
                </p>
              )}
              {error.referenceId && (
                <p className="text-red-400 text-[10px] uppercase tracking-wider font-semibold mt-1">
                  Reference: {error.referenceId}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2.5 mt-1 border-t border-red-200/50 pt-2.5">
            <button
              type="button"
              onClick={() => setError(null)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await logout();
                } catch (logoutErr) {
                  console.error("Logout failed:", logoutErr);
                }
              }}
              className="px-3 py-1.5 bg-white hover:bg-red-100/50 border border-red-200 active:scale-95 text-red-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* First Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User size={12} className="text-teal-600" /> First Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Juan"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-sm font-medium transition-all outline-none focus:ring-4 focus:ring-teal-500/10 text-slate-900"
            />
          </div>

          {/* Middle Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Middle Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Santos"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-sm font-medium transition-all outline-none focus:ring-4 focus:ring-teal-500/10 text-slate-900"
            />
          </div>
        </div>

        {/* Last Name */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <User size={12} className="text-teal-600" /> Last Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Dela Cruz"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-sm font-medium transition-all outline-none focus:ring-4 focus:ring-teal-500/10 text-slate-900"
          />
        </div>

        {/* Feedback Alert Prompt for Existing ID Match */}
        <AnimatePresence>
          {matchCandidate && userMatchChoice === 'pending' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -5 }}
              className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 my-2"
            >
              <div className="flex items-start gap-3">
                <div className="bg-amber-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200 px-2.5 py-0.5 rounded-full">
                      Existing Record Found
                    </span>
                    <span className="text-xs font-mono font-extrabold text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-lg border border-amber-300">
                      ID: {matchCandidate.seq_id || matchCandidate.seqId || matchCandidate.srcId || matchCandidate.id_number || "Unassigned"}
                    </span>
                  </div>
                  
                  <p className="text-xs text-amber-950 font-bold leading-relaxed">
                    An existing profile with ID Number <strong className="font-extrabold text-amber-700 font-mono underline">{matchCandidate.seq_id || matchCandidate.seqId || matchCandidate.id_number}</strong> was found under:
                  </p>
                  
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 text-xs space-y-0.5">
                    <div className="font-black text-amber-900">
                      👤 {(matchCandidate.first_name || matchCandidate.firstName || "").toUpperCase()} {(matchCandidate.last_name || matchCandidate.lastName || "").toUpperCase()}
                    </div>
                    {(matchCandidate.school_name || matchCandidate.schoolName) && (
                      <div className="text-[11px] text-amber-800 font-medium">
                        🏫 {matchCandidate.school_name || matchCandidate.schoolName}
                      </div>
                    )}
                    {(matchCandidate.review_branch || matchCandidate.reviewBranch) && (
                      <div className="text-[11px] text-amber-800 font-medium">
                        📍 Branch: {matchCandidate.review_branch || matchCandidate.reviewBranch}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-amber-800 font-semibold pt-1">
                    <strong>Is this you?</strong> If yes, your account will adopt this ID Number and all your previous scores will be linked immediately so you can see them.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    setUserMatchChoice('yes');
                    if (matchCandidate.school_name || matchCandidate.schoolName) {
                      const sc = matchCandidate.school_name || matchCandidate.schoolName;
                      setSelectedSchool(sc);
                      setSchoolInput(sc);
                    }
                    if (matchCandidate.review_branch || matchCandidate.reviewBranch) {
                      const br = matchCandidate.review_branch || matchCandidate.reviewBranch;
                      setSelectedBranch(br);
                      setBranchInput(br);
                    }
                  }}
                  className="w-full sm:flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Yes, this is me (Use this ID & Load Scores)
                </button>
                <button
                  type="button"
                  onClick={() => setUserMatchChoice('no')}
                  className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-300 transition-all cursor-pointer"
                >
                  No, create new ID
                </button>
              </div>
            </motion.div>
          )}

          {matchCandidate && userMatchChoice === 'yes' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-emerald-900 font-bold my-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Linked to existing ID: <strong className="font-mono font-black text-emerald-700">{matchCandidate.seq_id || matchCandidate.seqId || matchCandidate.id_number}</strong> (Your scores will be loaded)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUserMatchChoice('pending')}
                className="text-[10px] uppercase font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Change
              </button>
            </motion.div>
          )}

          {matchCandidate && userMatchChoice === 'no' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-slate-600 font-medium my-2"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Creating a new ID Number for this account.</span>
              </div>
              <button
                type="button"
                onClick={() => setUserMatchChoice('pending')}
                className="text-[10px] uppercase font-bold text-slate-500 hover:underline cursor-pointer"
              >
                Change
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* School Name Searchable Dropdown */}
        <div className="space-y-1 relative">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <GraduationCap size={13} className="text-teal-600" /> School Name
          </label>
          
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Search or type school name..."
              value={selectedSchool ? selectedSchool : schoolInput}
              onChange={(e) => {
                setSelectedSchool('');
                setSchoolInput(e.target.value);
                setShowSchoolDropdown(true);
              }}
              onFocus={() => setShowSchoolDropdown(true)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-sm font-medium transition-all outline-none focus:ring-4 focus:ring-teal-500/10 pr-10 text-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          <AnimatePresence>
            {showSchoolDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
              >
                {filteredSchools.length > 0 ? (
                  filteredSchools.map((school, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedSchool(school);
                        setSchoolInput('');
                        setShowSchoolDropdown(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                    >
                      <span>{school}</span>
                      {selectedSchool === school && <Check size={14} className="text-teal-600" />}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSchoolDropdown(false)}
                    className="w-full px-4 py-3 text-left text-xs text-slate-500 italic"
                  >
                    No exact match. Your custom text will be saved.
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Review Branch Searchable Dropdown */}
        <div className="space-y-1 relative">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <MapPin size={13} className="text-teal-600" /> Review Branch
          </label>
          
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Search or select review branch..."
              value={selectedBranch ? selectedBranch : branchInput}
              onChange={(e) => {
                setSelectedBranch('');
                setBranchInput(e.target.value);
                setShowBranchDropdown(true);
              }}
              onFocus={() => setShowBranchDropdown(true)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-2xl text-sm font-medium transition-all outline-none focus:ring-4 focus:ring-teal-500/10 pr-10 text-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          <AnimatePresence>
            {showBranchDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute z-45 left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
              >
                {filteredBranches.length > 0 ? (
                  filteredBranches.map((branch, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedBranch(branch);
                        setBranchInput('');
                        setShowBranchDropdown(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                    >
                      <span>{branch}</span>
                      {selectedBranch === branch && <Check size={14} className="text-teal-600" />}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBranchDropdown(false)}
                    className="w-full px-4 py-3 text-left text-xs text-slate-500 italic"
                  >
                    No match. Your custom text will be saved.
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-sm tracking-wider uppercase transition-all shadow-lg shadow-teal-600/20 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-8"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Activating Account…
            </>
          ) : (
            <>
              Activate My Account
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </div>
    </>
  );
}
