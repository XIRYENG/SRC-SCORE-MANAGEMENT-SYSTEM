import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Download, Printer, Filter, ChevronDown, ChevronUp, Eye, CheckCircle2, FileText, Upload, ChevronLeft, ChevronRight, Check, MoreVertical, X, Pencil, Plus, Archive, Settings2, Users } from 'lucide-react';
import { useFirestoreUsers } from '../../hooks/useFirestoreUsers';
import { normalizeScoreCategory, normalizeScoreSubject, getResolvedDetailedScore, getScoreFieldName } from '../../utils/scoreFieldResolver';
import { getScoreLabel, getScoreColor } from '../DashboardShared';
import { calculateAggregatedAreaRating } from '../../lib/scoreCalculations';
import { ScoreRecord } from '../../utils/scoreParser';
import { RevieweeData, ScoreFolder } from '../../types';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { isRevieweeInFolderScope, formatFolderScopeDisplay } from '../../utils/folderScope';
import { CompactEditableScoreCell } from '../CompactEditableScoreCell';
import { firestoreDb } from '../../utils/firebaseClient';
import { doc, updateDoc, serverTimestamp, collection, query, onSnapshot, writeBatch, deleteField } from 'firebase/firestore';
import { getCanonicalFullName } from '../../utils/nameNormalization';
import { getSubjectsByArea, MajorAreaCode } from '../../config/criminologyCurriculum';
import { DailyEvaluationRevieweeMatrix, DailyEvalRevieweeRow } from '../score-management/DailyEvaluationRevieweeMatrix';
import { isValidUserRecord, resolveCanonicalUserIdentity, compareUsersAlphabetically, formatFormalName } from '../../services/userIdentityResolver';
import { AnimatedSelect } from '../ui/animated-select';
import { AnimatedDatePicker } from '../ui/animated-date-picker';
import { ConfirmActionModal } from '../ConfirmActionModal';

type ScoreManagementDashboardProps = {
  onViewDetails?: (user: RevieweeData) => void;
  onOpenUploadModal?: () => void;
  onOpenSyncModal?: (section?: any, tab?: any) => void;
  currentUser?: RevieweeData | null;
  scoreFolderId?: string;
  scoreFolderName?: string;
  scoreFolder?: ScoreFolder | null;
};

const SUBJECTS_BY_AREA: Record<string, { code: string; title: string }[]> = {
  "CLJ": [
    { code: "CLJ 1", title: "Introduction to Philippine Criminal Justice System" },
    { code: "CLJ 2", title: "Human Rights Education" },
    { code: "CLJ 3", title: "Criminal Law Book 1" },
    { code: "CLJ 4", title: "Criminal Law Book 2" },
    { code: "CLJ 5", title: "Evidence" },
    { code: "CLJ 6", title: "Criminal Procedure" },
    { code: "CLJ 7", title: "Court Testimony" },
  ],
  "LEA": [
    { code: "LEA 1", title: "Law Enforcement Administration (Inter-Agency Approach)" },
    { code: "LEA 2", title: "Comparative Models in Policing" },
    { code: "LEA 3", title: "Introduction to Industrial Security Concepts" },
    { code: "LEA 4", title: "Law Enforcement Operation and Planning with Crime Mapping" },
    { code: "CLFM 1", title: "Character Formation, Nationalism, and Patriotism" },
    { code: "CLFM 2", title: "Leadership, Decision Making, Management, and Administration" },
  ],
  "CDI": [
    { code: "CDI 1", title: "Fundamentals of Criminal Investigation and Intelligence" },
    { code: "CDI 2", title: "Special Crime Investigation 1 with Legal Medicine" },
    { code: "CDI 3", title: "Special Crime Investigation 2 with Simulation on Interview and Interrogation" },
    { code: "CDI 4", title: "Traffic Management and Accident Investigation with Driving" },
    { code: "CDI 5", title: "Technical English 1 (Investigative Report Writing and Presentation)" },
    { code: "CDI 6", title: "Fire Protection and Arson Investigation" },
    { code: "CDI 7", title: "Vice and Drug Education and Control" },
    { code: "CDI 8", title: "Technical English 2 (Legal Forms)" },
    { code: "CDI 9", title: "Introduction to Cybercrime and Environmental Laws and Protection" },
  ],
  "FS": [
    { code: "FS 1", title: "Forensic Photography" },
    { code: "FS 2", title: "Personal Identification Techniques" },
    { code: "FS 3", title: "Forensic Chemistry and Toxicology" },
    { code: "FS 4", title: "Questioned Documents Examination" },
    { code: "FS 5", title: "Lie Detection Techniques" },
    { code: "FS 6", title: "Forensic Ballistics" },
  ],
  "CRIM": [
    { code: "CRIM 1", title: "Introduction to Criminology" },
    { code: "CRIM 2", title: "Theories of Crime Causation" },
    { code: "CRIM 3", title: "Human Behavior and Victimology" },
    { code: "CRIM 4", title: "Professional Conduct and Ethical Standards" },
    { code: "CRIM 5", title: "Juvenile Delinquency and Juvenile Justice System" },
    { code: "CRIM 6", title: "Dispute Resolution and Crisis/Incident Management" },
    { code: "CRIM 7", title: "Criminological Research 1 and 2" },
  ],
  "CA": [
    { code: "CA 1", title: "Institutional Corrections" },
    { code: "CA 2", title: "Non-Institutional Corrections" },
    { code: "CA 3", title: "Therapeutic Modalities" },
  ]
};

function normalizeDateString(dateStr: any): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (e) {}
  return trimmed;
}

function normalizeIndividualSubjectCode(subj: string): string {
  return String(subj || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getUnifiedScore(user: any, category: string, subject: string, selectedDate: string, scoreFolderId?: string) {
  const catKey = normalizeScoreCategory(category);
  const isDailyEval = catKey === 'dailyevaluation';

  let totalEarned = 0;
  let totalPossible = 0;
  let hasMatchingRecords = false;

  // 1. Check assessmentRecords (the primary persistent record storage)
  if (user.assessmentRecords && typeof user.assessmentRecords === 'object') {
    Object.values(user.assessmentRecords).forEach((r: any) => {
      if (!r || typeof r !== 'object') return;

      // Filter by folder if specified
      if (scoreFolderId && r.scoreFolderId && r.scoreFolderId !== scoreFolderId) return;

      const recordCatKey = normalizeScoreCategory(r.category || '');
      if (recordCatKey !== catKey) return;

      // Filter by date if specified
      if (selectedDate !== 'All Dates') {
        const rDate = normalizeDateString(r.date || r.createdAt);
        const sDate = normalizeDateString(selectedDate);
        if (rDate !== sDate) return;
      }

      // Match subject
      const recordSubj = r.subject || r.area || r.subjectCode || r.subject_code || '';
      const recordSubjNormalized = isDailyEval 
        ? normalizeIndividualSubjectCode(recordSubj)
        : normalizeScoreSubject(recordSubj);

      const targetSubjNormalized = isDailyEval
        ? normalizeIndividualSubjectCode(subject)
        : normalizeScoreSubject(subject);

      if (recordSubjNormalized === targetSubjNormalized) {
        const score = parseOptionalNumber(r.score ?? r.earnedPoints ?? r.rawScore);
        const total = parseOptionalNumber(r.totalScore ?? r.totalItems ?? r.possiblePoints ?? r.perfectScore);
        if (score !== null) {
          totalEarned += score;
          totalPossible += (total !== null && total > 0 ? total : 100);
          hasMatchingRecords = true;
        }
      }
    });
  }

  if (hasMatchingRecords) {
    return {
      earnedScore: totalEarned,
      possiblePoints: totalPossible,
    };
  }

  // 2. Fallback to scoresByDate if selectedDate is specified or "All Dates"
  if (user.scoresByDate && typeof user.scoresByDate === 'object') {
    const entries = Object.values(user.scoresByDate).filter((entry: any) => {
      if (!entry || typeof entry !== "object") return false;

      // Filter by folder if specified
      if (scoreFolderId && entry.scoreFolderId && entry.scoreFolderId !== scoreFolderId) return false;

      const entryCat = String(entry.category || "").toLowerCase();
      const entryCatKey = normalizeScoreCategory(entry.categoryKey || entryCat);
      if (entryCatKey !== catKey && !entryCat.includes(catKey)) return false;

      if (selectedDate !== 'All Dates') {
        const eDate = normalizeDateString(entry.date || entry.updatedAt);
        const sDate = normalizeDateString(selectedDate);
        if (eDate !== sDate) return false;
      }

      const entrySubjKey = normalizeScoreSubject(entry.subject || entryCat);
      const targetSubjKey = normalizeScoreSubject(subject);
      const subjMatches =
        entrySubjKey === targetSubjKey ||
        entryCat.includes(targetSubjKey) ||
        String(entry.subject || "").toLowerCase().includes(targetSubjKey);

      return subjMatches;
    });

    if (entries.length > 0) {
      let subEarned = 0;
      let subPossible = 0;
      let valid = false;
      entries.forEach((entry: any) => {
        const earned = parseOptionalNumber(entry.earnedPoints ?? entry.rawScore ?? entry.score);
        const possible = parseOptionalNumber(entry.possiblePoints ?? entry.totalItems);
        if (earned !== null) {
          subEarned += earned;
          subPossible += (possible !== null && possible > 0 ? possible : 100);
          valid = true;
        }
      });
      if (valid) {
        return {
          earnedScore: subEarned,
          possiblePoints: subPossible,
        };
      }
    }
  }

  // 3. Fallback to flat fields ONLY if selectedDate is "All Dates"
  if (selectedDate === 'All Dates') {
    const scoreField = getScoreFieldName(category, subject);
    let flatFieldKeys: string[] = [scoreField];
    const subjKey = normalizeScoreSubject(subject);
    if (catKey === "preboard") {
      flatFieldKeys = [`preboard_${subjKey}`, `score_${subjKey}_preboard`];
    } else if (catKey === "pretest") {
      flatFieldKeys = [`pretest_${subjKey}`, `score_${subjKey}_pretest`, `score_${subjKey}`];
    } else if (catKey === "posttest") {
      flatFieldKeys = [`post_${subjKey}`, `posttest_${subjKey}`, `score_${subjKey}_posttest`, `score_${subjKey}_post`];
    } else if (catKey === "quiz") {
      flatFieldKeys = [`score_${subjKey}_quiz`, `score_${subjKey}_quizzes`, `quiz_${subjKey}`];
    } else if (catKey === "dailyevaluation") {
      flatFieldKeys = [
        `score_${subjKey}_dailyevaluation`,
        `score_${subjKey}_evaluation`,
        `score_${subjKey}_daily_evaluation`,
        `score_clj_dailyevaluation`,
        `score_${subjKey}_daily`
      ];
    } else if (catKey === "removal") {
      flatFieldKeys = [`score_${subjKey}_removal`, `score_removal_${subjKey}`];
    } else if (catKey === "diagnostic") {
      flatFieldKeys = [`diag_${subjKey}`, `diagnostic_${subjKey}`, `score_${subjKey}_diagnostic`];
    }

    let earnedScore: number | null = null;
    for (const fk of flatFieldKeys) {
      const val = user?.[fk];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        const num = Number(val);
        if (Number.isFinite(num)) {
          earnedScore = num;
          break;
        }
      }
    }

    if (earnedScore !== null) {
      const metadataKey = `${catKey}_${subjKey}`;
      const latestRecord =
        user?.latestScores?.[metadataKey] ??
        user?.latestScores?.[catKey] ??
        user?.manualScores?.[metadataKey];

      const possiblePoints =
        parseOptionalNumber(
          latestRecord?.possiblePoints ??
            latestRecord?.totalItems ??
            latestRecord?.perfectScore ??
            latestRecord?.maxScore ??
            user?.scoreMetadata?.[metadataKey]?.possiblePoints ??
            user?.[`possible_points_${subjKey}`] ??
            user?.[`total_items_${subjKey}`]
        ) ?? 100;

      return {
        earnedScore,
        possiblePoints: possiblePoints > 0 ? possiblePoints : 100
      };
    }
  }

  return {
    earnedScore: null,
    possiblePoints: 0
  };
}

export function ScoreManagementDashboard({ onViewDetails, onOpenUploadModal, onOpenSyncModal, currentUser, scoreFolderId, scoreFolderName, scoreFolder }: ScoreManagementDashboardProps) {
  const { allUsers, loading } = useFirestoreUsers();
  const { folders: allScoreFolders } = useScoreFolders();
  
  const activeScoreFolder = useMemo(() => {
    if (scoreFolder) return scoreFolder;
    if (scoreFolderId) return allScoreFolders.find(f => f.id === scoreFolderId) || null;
    return null;
  }, [scoreFolder, scoreFolderId, allScoreFolders]);

  const [searchQuery, setSearchQuery] = useState('');

  // Score events (shared manual columns) state
  const [scoreEvents, setScoreEvents] = useState<any[]>([]);

  // Subscribe to score_events
  useEffect(() => {
    if (!firestoreDb) return;
    const q = query(collection(firestoreDb, "score_events"));
    const unsub = onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setScoreEvents(events);
    }, (err) => {
      console.warn("Unable to load score_events collection:", err);
    });
    return () => unsub();
  }, []);

  // Modal control states
  const [showAddScoreModal, setShowAddScoreModal] = useState(false);
  const [addScoreMode, setAddScoreMode] = useState<'create' | 'existing'>('create');
  
  // Selected fields for Add Score form
  const [addScoreRevieweeId, setAddScoreRevieweeId] = useState('');
  const [addScoreCategory, setAddScoreCategory] = useState('Daily Evaluation');
  const [addScoreMajorArea, setAddScoreMajorArea] = useState('CLJ');
  const [addScoreSubject, setAddScoreSubject] = useState('');
  const [addScoreDate, setAddScoreDate] = useState('');
  const [addScoreTotalItems, setAddScoreTotalItems] = useState('50');
  const [addScoreValue, setAddScoreValue] = useState('');
  const [addScorePublicationStatus, setAddScorePublicationStatus] = useState<'published' | 'hidden'>('published');
  
  const [selectedScoreEventId, setSelectedScoreEventId] = useState<string | null>(null);
  const [isSubmittingAddScore, setIsSubmittingAddScore] = useState(false);
  
  // Date editing modal state
  const [showEditDateModal, setShowEditDateModal] = useState(false);
  const [editingEventObj, setEditingEventObj] = useState<any | null>(null);
  const [newDateInput, setNewDateInput] = useState('');
  const [isSubmittingDateEdit, setIsSubmittingDateEdit] = useState(false);

  // Total items editing modal state
  const [showEditTotalItemsModal, setShowEditTotalItemsModal] = useState(false);
  const [editingTotalItemsEventObj, setEditingTotalItemsEventObj] = useState<any | null>(null);
  const [newTotalItemsInput, setNewTotalItemsInput] = useState('');
  const [isSubmittingTotalItemsEdit, setIsSubmittingTotalItemsEdit] = useState(false);

  // Column deletion confirmation state
  const [showDeleteColumnConfirm, setShowDeleteColumnConfirm] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<any | null>(null);
  const [isDeletingColumn, setIsDeletingColumn] = useState(false);
  const [deleteColumnError, setDeleteColumnError] = useState<string | null>(null);
  const [activeRowMenuUserId, setActiveRowMenuUserId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [hiddenSubjectIds, setHiddenSubjectIds] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Daily Evaluation');
  const [selectedDate, setSelectedDate] = useState('All Dates');
  const [selectedSchool, setSelectedSchool] = useState('All Schools');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [selectedMajorArea, setSelectedMajorArea] = useState('CLJ');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Firestore branches collection state
  const [firestoreBranches, setFirestoreBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const loadBranches = async () => {
      try {
        if (!firestoreDb) {
          setBranchesLoading(false);
          return;
        }
        const q = query(collection(firestoreDb, "branches"));
        unsub = onSnapshot(
          q,
          (snapshot) => {
            const loaded = snapshot.docs.map(docSnap => {
              const data = docSnap.data();
              const rawName = data.name ?? data.branchName ?? data.branch ?? data.label ?? data.title ?? docSnap.id;
              return {
                id: docSnap.id,
                name: String(rawName).trim()
              };
            }).filter(b => Boolean(b.name));
            setFirestoreBranches(loaded);
            setBranchesLoading(false);
          },
          (err) => {
            console.warn("Unable to load branches collection from Firestore:", err);
            setBranchesError("Unable to load branch options");
            setBranchesLoading(false);
          }
        );
      } catch (err: any) {
        console.warn("Error initializing branch query:", err);
        setBranchesError("Unable to load branch options");
        setBranchesLoading(false);
      }
    };
    loadBranches();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const isDailyEvalCategory = normalizeScoreCategory(selectedCategory) === 'dailyevaluation';

  React.useEffect(() => {
    if (isDailyEvalCategory && selectedMajorArea === 'All Areas') {
      setSelectedMajorArea('CLJ');
    }
  }, [selectedCategory, selectedMajorArea, isDailyEvalCategory]);

  React.useEffect(() => {
    // Scroll reset could happen here if we used a ref for the scrollable container,
    // but the list will re-render naturally.
  }, [selectedCategory, selectedDate, selectedSchool, selectedBranch, selectedMajorArea, searchQuery, sortField, sortDirection]);

  const [editingScoreCell, setEditingScoreCell] = useState<{
    user: any;
    subject: string;
    category: string;
    currentScore: number | null;
    possiblePoints: number;
    event?: any;
  } | null>(null);
  const [newScoreInput, setNewScoreInput] = useState('');
  const [newTotalInput, setNewTotalInput] = useState('100');
  const [savingScore, setSavingScore] = useState(false);

  const handleEditScoreClick = (data: {
    reviewee: any;
    category: string;
    subject: string;
    currentScore: number | null;
    possiblePoints?: number;
    event?: any;
  }) => {
    setEditingScoreCell({
      user: data.reviewee,
      subject: data.subject,
      category: data.category,
      currentScore: data.currentScore,
      possiblePoints: data.possiblePoints || 100,
      event: data.event
    });
    setNewScoreInput(data.currentScore !== null ? String(data.currentScore) : '');
    setNewTotalInput(String(data.possiblePoints || 100));
  };

  const handleSaveScore = async () => {
    if (!editingScoreCell) return;
    setSavingScore(true);
    try {
      const { user, subject, category, event } = editingScoreCell;
      const userDocId = user.doc_id || user.uid || user.id;
      if (!userDocId) throw new Error("User ID not found");

      const scoreNum = Number(newScoreInput);
      const totalNum = Number(newTotalInput) || 100;
      if (isNaN(scoreNum)) {
        alert("Please enter a valid numeric score.");
        setSavingScore(false);
        return;
      }

      if (scoreNum < 0 || scoreNum > totalNum) {
        alert(`Score must be between 0 and ${totalNum}.`);
        setSavingScore(false);
        return;
      }

      const fieldName = getScoreFieldName(category, subject);

      if (!firestoreDb) throw new Error("Firestore client db not initialized");
      const userRef = doc(firestoreDb, 'users', userDocId);

      if (event) {
        const evaluationDate = normalizeDateString(event.evaluationDate);
        const normalizedCategoryKey = normalizeScoreCategory(category);
        const scoreRecordKey = `${userDocId}_${normalizedCategoryKey}_${evaluationDate}`;
        const subjectId = normalizeScoreCategory(category) === 'dailyevaluation'
          ? normalizeIndividualSubjectCode(subject)
          : String(event.majorAreaId || '').toLowerCase();

        await updateDoc(userRef, {
          [fieldName]: scoreNum,
          [`${fieldName}_total`]: totalNum,
          [`scoresByDate.${scoreRecordKey}`]: {
            scoreEventId: event.id,
            category: category,
            categoryKey: normalizedCategoryKey,
            score: scoreNum,
            rawScore: scoreNum,
            earnedPoints: scoreNum,
            possiblePoints: totalNum,
            percentage: (scoreNum / totalNum) * 100,
            date: evaluationDate,
            source: 'manual_entry',
            remarks: 'Manually Entered Score',
            updatedAt: new Date().toISOString()
          },
          [`assessmentRecords.${event.id}`]: {
            scoreEventId: event.id,
            category: category,
            date: evaluationDate,
            score: scoreNum,
            totalScore: totalNum,
            subject: subject,
            subjectCode: subjectId,
            scoreFolderId: scoreFolderId || "main",
            publicationStatus: event.publicationStatus || 'published',
            updatedAt: new Date().toISOString()
          },
          last_score_update: serverTimestamp(),
          updated_at: new Date().toISOString()
        });
      } else {
        await updateDoc(userRef, {
          [fieldName]: scoreNum,
          [`${fieldName}_total`]: totalNum,
          last_score_update: serverTimestamp(),
          updated_at: new Date().toISOString()
        });
      }

      setEditingScoreCell(null);
      alert("Score saved successfully!");
    } catch (err: any) {
      console.error("Error saving score:", err);
      alert("Failed to save score: " + (err.message || err));
    } finally {
      setSavingScore(false);
    }
  };

  // Filter valid reviewees
  const allReviewees = useMemo(() => {
    return allUsers.filter((u: RevieweeData) => {
      const uAny = u as any;
      const status = String(uAny.accountStatus || uAny.status || "").toLowerCase();
      if (status === "merged" || status === "deleted" || uAny.isDeleted || uAny.deleted || uAny.is_deleted) return false;
      if (!isValidUserRecord(u)) return false;
      if (u.role !== "Reviewee") return false;

      // Filter by active score folder scope
      if (activeScoreFolder) {
        if (!isRevieweeInFolderScope(u, activeScoreFolder)) return false;
      }

      return true;
    }).map((u: RevieweeData) => {
      let filteredRecords = u.assessmentRecords;
      if (filteredRecords) {
        const newRecords: Record<string, any> = {};
        let hasRecords = false;
        Object.entries(filteredRecords).forEach(([key, record]: [string, any]) => {
          if (scoreFolderId) {
            if (record.scoreFolderId === scoreFolderId) { newRecords[key] = record; hasRecords = true; }
          } else { newRecords[key] = record; hasRecords = true; }
        });
        return { ...u, assessmentRecords: hasRecords ? newRecords : {} };
      }
      return u;
    });
  }, [allUsers, scoreFolderId]);

  // Dynamic options based on actual records & branch sources
  const { categories, dates, schools, branches } = useMemo(() => {
    const cats = new Set<string>();
    const dts = new Set<string>();
    const schs = new Set<string>();
    const branchMap = new Map<string, string>(); // lowercase -> formatted display name

    cats.add('Diagnostic');
    cats.add('Pretest');
    cats.add('Posttest');
    cats.add('Quiz');
    cats.add('Daily Evaluation');
    cats.add('Removal');
    cats.add('Preboard');

    // Standard Samaritan Review Center default branches
    const DEFAULT_SRC_BRANCHES = [
      "Iligan City",
      "Lala/Maranding",
      "Labason",
      "Valencia",
      "Balingasag",
      "No Branch"
    ];
    DEFAULT_SRC_BRANCHES.forEach(b => {
      branchMap.set(b.toLowerCase(), b);
    });

    // Add branches from Firestore collection
    firestoreBranches.forEach(b => {
      if (b.name) {
        const key = b.name.toLowerCase();
        if (!branchMap.has(key)) {
          branchMap.set(key, b.name);
        }
      }
    });

    // Add branches and schools from all users & reviewees
    allUsers.forEach((u: any) => {
      const canonical = resolveCanonicalUserIdentity(u);
      
      const sch = (u.school_name || u.schoolName || u.school || canonical.school || '').trim();
      if (sch) schs.add(sch);

      const rawBranch =
        canonical.branch ||
        u.branch ||
        u.branchName ||
        u.branch_name ||
        u.reviewBranch ||
        u.review_branch ||
        u.assignedBranch ||
        u.schoolBranch ||
        u.reviewCenterBranch ||
        '';
      const name = String(rawBranch).trim();
      if (name && name !== '—' && name !== '-' && name !== 'N/A') {
        const key = name.toLowerCase();
        if (!branchMap.has(key)) {
          branchMap.set(key, name);
        }
      }
    });

    allReviewees.forEach((u: RevieweeData) => {
      const records = Object.values(u.assessmentRecords || {}) as ScoreRecord[];
      records.forEach((r: ScoreRecord) => {
        if (r.category) {
          cats.add(r.category);
          if (normalizeScoreCategory(r.category) === normalizeScoreCategory(selectedCategory)) {
            if (r.date) {
              const normDate = normalizeDateString(r.date);
              if (normDate) dts.add(normDate);
            }
          }
        }
      });
    });

    // Merge in evaluation dates from scoreEvents as well
    scoreEvents.forEach((evt: any) => {
      if (evt.scoreFolderId === scoreFolderId && normalizeScoreCategory(evt.category) === normalizeScoreCategory(selectedCategory)) {
        const normDate = normalizeDateString(evt.evaluationDate);
        if (normDate) dts.add(normDate);
      }
    });

    let finalSchools = Array.from(schs).filter(Boolean).sort();
    let finalBranches = Array.from(branchMap.values()).sort((a, b) => a.localeCompare(b));

    if (activeScoreFolder?.schoolScope === 'selected' && activeScoreFolder.selectedSchoolNames?.length) {
      finalSchools = finalSchools.filter(s => activeScoreFolder.selectedSchoolNames!.some(sel => sel.toLowerCase() === s.toLowerCase()));
      // Also ensure selected school names themselves are included in the dropdown even if no reviewee currently has it
      activeScoreFolder.selectedSchoolNames.forEach(sel => {
        if (!finalSchools.some(s => s.toLowerCase() === sel.toLowerCase())) {
          finalSchools.push(sel);
        }
      });
      finalSchools.sort();
    }

    if (activeScoreFolder?.branchScope === 'selected' && activeScoreFolder.selectedBranchNames?.length) {
      finalBranches = finalBranches.filter(b => activeScoreFolder.selectedBranchNames!.some(sel => sel.toLowerCase() === b.toLowerCase()));
      activeScoreFolder.selectedBranchNames.forEach(sel => {
        if (!finalBranches.some(b => b.toLowerCase() === sel.toLowerCase())) {
          finalBranches.push(sel);
        }
      });
      finalBranches.sort((a, b) => a.localeCompare(b));
    }

    return {
      categories: Array.from(cats).sort(),
      dates: Array.from(dts).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()),
      schools: finalSchools,
      branches: finalBranches
    };
  }, [allUsers, allReviewees, selectedCategory, firestoreBranches, scoreEvents, scoreFolderId, activeScoreFolder]);

  React.useEffect(() => {
    if (selectedDate !== 'All Dates' && !dates.includes(selectedDate)) {
      setSelectedDate('All Dates');
    }
  }, [selectedCategory, dates, selectedDate]);

  const subjects = [
    { key: "CLJ", label: "CLJ" },
    { key: "LEA", label: "LEA" },
    { key: "CDI", label: "CDI" },
    { key: "FS", label: "FS" },
    { key: "CRIM", label: "CRIM" },
    { key: "CA", label: "CA" }
  ];

  const displayedSubjects = useMemo(() => {
    let base: any[] = [];
    if (normalizeScoreCategory(selectedCategory) !== 'dailyevaluation') {
      base = subjects;
    } else {
      const targetArea = selectedMajorArea === 'All Areas' ? 'CLJ' : selectedMajorArea;
      const subSubjects = SUBJECTS_BY_AREA[targetArea];
      if (subSubjects) {
        base = subSubjects.map(s => ({ key: s.code, label: s.code, fullTitle: s.title }));
      } else {
        base = subjects.filter(s => s.label === targetArea);
      }
    }
    return base.filter(s => !hiddenSubjectIds.has(s.key));
  }, [selectedCategory, selectedMajorArea, subjects, hiddenSubjectIds]);

  // Apply filters and sorting
  const processedReviewees = useMemo(() => {
    const filtered = allReviewees.filter((u: RevieweeData) => {
      const uAny = u as any;
      const canonical = resolveCanonicalUserIdentity(uAny);

      const formattedName = `${canonical.lastName || uAny.last_name || ''}, ${canonical.firstName || uAny.first_name || ''} ${canonical.middleName || uAny.middle_name || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || 
        formattedName.includes(searchQuery.toLowerCase()) ||
        canonical.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(canonical.idNumber || uAny.id_number || uAny.seqId || uAny.seq_id || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const uSchool = (u.school_name || uAny.schoolName || uAny.school || canonical.school || '').trim().toLowerCase();
      const matchesSchool = selectedSchool === 'All Schools' || selectedSchool === 'all' || uSchool === selectedSchool.trim().toLowerCase();

      const rawBranch = canonical.branch || uAny.branch || uAny.branchName || uAny.branch_name || uAny.reviewBranch || uAny.review_branch || uAny.assignedBranch || uAny.schoolBranch || uAny.reviewCenterBranch || '';
      const uBranch = String(rawBranch).trim().toLowerCase();
      const matchesBranch = selectedBranch === 'All Branches' || selectedBranch === 'all' || uBranch === selectedBranch.trim().toLowerCase();

      return matchesSearch && matchesSchool && matchesBranch;
    });

    const withScores = filtered.map((user: RevieweeData) => {
      const isDailyEval = normalizeScoreCategory(selectedCategory) === 'dailyevaluation';

      let totalEarned = 0;
      let totalPossible = 0;

      const subjScores = displayedSubjects.map(s => {
        const unified = getUnifiedScore(user, selectedCategory, s.label, selectedDate, scoreFolderId);
        const earned = unified.earnedScore;
        const possible = unified.possiblePoints;

        if (isDailyEval) {
          const actualEarned = earned !== null ? earned : 0;
          const actualPossible = earned !== null ? possible : 0;
          totalEarned += actualEarned;
          totalPossible += actualPossible;
          return { score: earned, total: actualPossible };
        } else {
          if (earned !== null) {
            totalEarned += earned;
            totalPossible += possible;
            return { score: earned, total: possible };
          }
          const fallbackPossible = possible > 0 ? possible : 100;
          totalPossible += fallbackPossible;
          return { score: null, total: fallbackPossible };
        }
      });

      const rating = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
      const hasScores = isDailyEval 
        ? totalPossible > 0 
        : subjScores.some(s => s.score !== null);

      return {
        user,
        subjScores,
        totalEarned,
        totalPossible,
        rating,
        hasScores
      };
    });

    return withScores.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'id') {
        const idA = String(a.user.id_number || a.user.seqId || a.user.seq_id || '').toLowerCase();
        const idB = String(b.user.id_number || b.user.seqId || b.user.seq_id || '').toLowerCase();
        
        const numA = parseFloat(idA.replace(/[^0-9.]/g, ''));
        const numB = parseFloat(idB.replace(/[^0-9.]/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) {
          comparison = numA - numB;
        } else {
          comparison = idA.localeCompare(idB);
        }
      } 
      else if (sortField === 'name') {
        comparison = compareUsersAlphabetically(a.user, b.user);
      } 
      else if (sortField === 'rating' || sortField === 'combined') {
        comparison = a.rating - b.rating;
      } 
      else if (sortField === 'status') {
        const statusA = a.hasScores ? '1' : '0';
        const statusB = b.hasScores ? '1' : '0';
        comparison = statusA.localeCompare(statusB);
      } 
      else {
        const subjIndex = displayedSubjects.findIndex(s => s.label === sortField);
        if (subjIndex !== -1) {
          const scoreAObj = a.subjScores[subjIndex];
          const scoreBObj = b.subjScores[subjIndex];

          const ratingA = (scoreAObj && scoreAObj.total > 0 && scoreAObj.score !== null)
            ? (scoreAObj.score / scoreAObj.total) * 100
            : 0;
          const ratingB = (scoreBObj && scoreBObj.total > 0 && scoreBObj.score !== null)
            ? (scoreBObj.score / scoreBObj.total) * 100
            : 0;

          comparison = ratingA - ratingB;

          if (comparison === 0) {
            const earnedA = scoreAObj?.score || 0;
            const earnedB = scoreBObj?.score || 0;
            comparison = earnedA - earnedB;
          }
        }
      }

      if (comparison === 0) {
        comparison = compareUsersAlphabetically(a.user, b.user);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [allReviewees, searchQuery, selectedSchool, selectedBranch, selectedCategory, selectedDate, displayedSubjects, sortField, sortDirection]);

  // Use processed reviewees directly for continuous scrolling
  const dailyEvalMatrixRows: DailyEvalRevieweeRow[] = useMemo(() => {
    if (!isDailyEvalCategory) return [];

    return processedReviewees.map((row: any) => {
      const user = row.user;
      const subjectScores: Record<string, { earned: number | null; possible: number | null }> = {};

      displayedSubjects.forEach((s, idx) => {
        const sObj = row.subjScores[idx];
        subjectScores[s.label] = {
          earned: sObj?.score !== undefined ? sObj.score : null,
          possible: sObj?.total !== undefined ? sObj.total : 0,
        };
      });

      return {
        user,
        subjectScores,
        isPublished: true,
      };
    });
  }, [isDailyEvalCategory, displayedSubjects, processedReviewees]);

  const handleToggleSelectAllUsers = () => {
    const currentIds = processedReviewees.map((r: any) => r.user.id || r.user.uid || '').filter(Boolean);
    if (selectedUserIds.length === currentIds.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(currentIds);
    }
  };

  const handleToggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleExportCSV = () => {
    if (processedReviewees.length === 0) return;
    const headers = ['ID Number', 'Name', ...displayedSubjects.map(s => s.label), 'Combined', 'Rating', 'Status'];
    const rows = processedReviewees.map((row: any) => {
      const { user, subjScores, totalEarned, totalPossible, rating, hasScores } = row;
      const canonical = resolveCanonicalUserIdentity(user);
      const name = formatFormalName(canonical);
      const id = canonical.idNumber || user.id_number || user.seqId || user.seq_id || user.id || '';
      const scores = subjScores.map((s: any) => s !== null ? s : '-');
      const combined = hasScores ? `${totalEarned}/${totalPossible}` : '-';
      const rat = `${(rating || 0).toFixed(2)}%`;
      const status = hasScores ? (subjScores.every((s: any) => s !== null) ? 'Completed' : 'In Progress') : 'Not Started';
      return [id, name, ...scores, combined, rat, status];
    });

    const csvString = [headers.join(','), ...rows.map((e: any[]) => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `score_management_${selectedCategory.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableHeaders = ['#', 'ID Number', 'Name', ...displayedSubjects.map(s => `${s.label}`), 'Combined', 'Rating', 'Status'];
    
    const tableRowsHtml = processedReviewees.map((row: any, idx: number) => {
      const { user, subjScores, totalEarned, totalPossible, rating, hasScores } = row;
      const canonical = resolveCanonicalUserIdentity(user);
      const name = formatFormalName(canonical);
      const idNum = canonical.idNumber || user.id_number || user.seqId || user.seq_id || '-';
      const scoreCells = subjScores.map((s: any) => {
        if (s !== null && s.score !== null) {
          const pct = s.total > 0 ? ((s.score / s.total) * 100).toFixed(2) : '0.00';
          return `${s.score}/${s.total}<br/><small style="color: #0d9488; font-weight: bold;">${pct}%</small>`;
        }
        const total = s?.total || 100;
        return `___/${total}<br/><small style="color: #94a3b8; font-weight: bold;">0.00%</small>`;
      });
      const combinedStr = `${totalEarned}/${totalPossible}`;
      const ratStr = `${rating.toFixed(2)}%`;
      const allDone = subjScores.every((s: any) => s !== null && s.score !== null);
      const someDone = subjScores.some((s: any) => s !== null && s.score !== null);
      const statusStr = allDone ? 'Completed' : (someDone ? 'In Progress' : 'Not Started');

      return `
        <tr>
          <td style="text-align: center; vertical-align: middle;">${idx + 1}</td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #2563eb;">${idNum}</td>
          <td style="text-align: left; vertical-align: middle; font-weight: bold; text-transform: uppercase;">${name}</td>
          ${scoreCells.map((sc: string) => `<td style="text-align: center; vertical-align: middle;">${sc}</td>`).join('')}
          <td style="text-align: center; vertical-align: middle; font-weight: bold; background-color: #f8fafc;">${combinedStr}</td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #9333ea;">${ratStr}</td>
          <td style="text-align: center; vertical-align: middle; font-size: 8px;">${statusStr}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Score Management Report - ${selectedCategory}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { width: 50px; height: 50px; margin: 0 auto 6px auto; display: block; }
            h1 { font-size: 16px; font-weight: bold; margin: 0; text-transform: uppercase; }
            p { font-size: 11px; color: #64748b; margin: 2px 0; }
            .meta { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 12px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 9px; }
            th { background-color: #f1f5f9; text-transform: uppercase; font-weight: bold; text-align: center; vertical-align: middle; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${window.location.origin}/logo.svg" class="logo" alt="Logo" />
            <h1>SAMARITAN REVIEW CENTER</h1>
            <p>Score Management Report - ${selectedCategory}</p>
          </div>
          <div class="meta">
            <div>Date: ${selectedDate} | Area: ${selectedMajorArea}</div>
            <div>School: ${selectedSchool} | Branch: ${selectedBranch}</div>
            <div>Total Reviewees: ${processedReviewees.length}</div>
          </div>
          <table>
            <thead>
              <tr>
                ${tableHeaders.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Active score event for editing date
  const activeScoreEvent = useMemo(() => {
    if (selectedDate === 'All Dates') return null;
    return scoreEvents.find(evt => {
      const isSameFolder = evt.scoreFolderId === scoreFolderId;
      const isSameCat = normalizeScoreCategory(evt.category) === normalizeScoreCategory(selectedCategory);
      // For non-daily evaluation, the majorAreaId of the scoreEvent matches standard board major areas
      const isSameArea = String(evt.majorAreaId || '').toLowerCase() === String(selectedMajorArea).toLowerCase();
      const isSameDate = normalizeDateString(evt.evaluationDate) === normalizeDateString(selectedDate);
      return isSameFolder && isSameCat && (isDailyEvalCategory ? isSameArea : true) && isSameDate;
    });
  }, [scoreEvents, selectedCategory, selectedMajorArea, selectedDate, scoreFolderId, isDailyEvalCategory]);

  // Helper to find a score event
  const findExistingScoreEvent = (category: string, majorArea: string, subjectCode: string, date: string) => {
    const normCat = normalizeScoreCategory(category);
    const normArea = String(majorArea || '').toLowerCase().trim();
    const normSubj = normCat === 'dailyevaluation' ? normalizeIndividualSubjectCode(subjectCode) : normArea;
    const normDate = normalizeDateString(date);

    return scoreEvents.find(evt => {
      const isSameFolder = evt.scoreFolderId === scoreFolderId;
      const isSameCat = normalizeScoreCategory(evt.category) === normCat;
      const isSameArea = String(evt.majorAreaId || '').toLowerCase().trim() === normArea;
      const isSameSubj = normCat === 'dailyevaluation' 
        ? normalizeIndividualSubjectCode(evt.subjectId || evt.subjectName || '') === normSubj
        : true;
      const isSameDate = normalizeDateString(evt.evaluationDate) === normDate;

      return isSameFolder && isSameCat && isSameArea && isSameSubj && isSameDate;
    });
  };

  const handleAddScoreButtonClick = (prefilled?: {
    reviewee?: any;
    category?: string;
    subject?: string;
    date?: string;
    isFirstScoreForSubject?: boolean;
  }) => {
    const initialReviewee = prefilled?.reviewee?.doc_id || prefilled?.reviewee?.uid || prefilled?.reviewee?.id || '';
    const initialCategory = prefilled?.category || selectedCategory || 'Daily Evaluation';
    
    let initialMajorArea = selectedMajorArea === 'All Areas' ? 'CLJ' : selectedMajorArea;
    let initialSubject = prefilled?.subject || '';

    if (prefilled?.subject) {
      if (normalizeScoreCategory(initialCategory) === 'dailyevaluation') {
        Object.entries(SUBJECTS_BY_AREA).forEach(([area, subjs]) => {
          if (subjs.some(s => s.code === prefilled.subject)) {
            initialMajorArea = area;
          }
        });
      } else {
        initialMajorArea = prefilled.subject;
      }
    }

    const initialDate = prefilled?.date || (selectedDate !== 'All Dates' ? selectedDate : '');
    
    setAddScoreRevieweeId(initialReviewee);
    setAddScoreCategory(initialCategory);
    setAddScoreMajorArea(initialMajorArea);
    setAddScoreSubject(initialSubject);
    setAddScoreDate(initialDate);
    setAddScoreValue('');
    setAddScorePublicationStatus('published');

    if (initialDate) {
      const existingEvt = findExistingScoreEvent(initialCategory, initialMajorArea, initialSubject || initialMajorArea, initialDate);
      if (existingEvt) {
        setAddScoreMode('existing');
        setSelectedScoreEventId(existingEvt.id);
        setAddScoreTotalItems(String(existingEvt.totalItems || 100));
        setShowAddScoreModal(true);
        return;
      }
    }

    setAddScoreMode('create');
    setSelectedScoreEventId(null);
    setAddScoreTotalItems(prefilled?.isFirstScoreForSubject ? '' : '100');
    setShowAddScoreModal(true);
  };

  const [duplicateColumnEvent, setDuplicateColumnEvent] = useState<any | null>(null);

  const handleSaveManualAddScoreClick = async () => {
    if (!addScoreDate) {
      alert("Please select an evaluation date.");
      return;
    }
    const totalItemsNum = Number(addScoreTotalItems);
    if (isNaN(totalItemsNum) || totalItemsNum <= 0) {
      alert("Please enter a valid positive number for total items.");
      return;
    }

    const category = addScoreCategory;
    const isDaily = normalizeScoreCategory(category) === 'dailyevaluation';
    if (isDaily && !addScoreSubject) {
      alert("Please select a subject area.");
      return;
    }

    const normDate = normalizeDateString(addScoreDate);

    // Check duplicate
    const existingEvt = findExistingScoreEvent(
      category,
      addScoreMajorArea,
      isDaily ? addScoreSubject : addScoreMajorArea,
      normDate
    );
    if (existingEvt) {
      alert("A score column already exists for this category, area, subject, and date.");
      return;
    }

    setIsSubmittingAddScore(true);
    try {
      if (!firestoreDb) throw new Error("Firestore not initialized");

      const majorArea = addScoreMajorArea;
      const subjectName = isDaily ? addScoreSubject : addScoreMajorArea;
      const subjectId = isDaily ? normalizeIndividualSubjectCode(addScoreSubject) : String(majorArea).toLowerCase();

      const batch = writeBatch(firestoreDb);
      const eventRef = doc(collection(firestoreDb, "score_events"));
      
      batch.set(eventRef, {
        scoreFolderId: scoreFolderId || "main",
        category: category,
        majorAreaId: String(majorArea).toLowerCase(),
        majorAreaName: majorArea,
        subjectId: subjectId,
        subjectName: subjectName,
        evaluationDate: normDate,
        totalItems: totalItemsNum,
        publicationStatus: addScorePublicationStatus,
        createdBy: currentUser?.uid || "admin",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      alert("Evaluation column created successfully!");
      setShowAddScoreModal(false);
    } catch (err: any) {
      console.error("Error creating score event column:", err);
      alert("Failed to create evaluation column: " + (err.message || err));
    } finally {
      setIsSubmittingAddScore(false);
    }
  };

  const handleOpenEditDateModal = () => {
    if (!activeScoreEvent) {
      alert("No registered score column found for the selected date.");
      return;
    }
    setEditingEventObj(activeScoreEvent);
    setNewDateInput(activeScoreEvent.evaluationDate);
    setShowEditDateModal(true);
  };

  const handleSaveColumnDate = async () => {
    if (!editingEventObj || !newDateInput) return;
    setIsSubmittingDateEdit(true);
    try {
      if (!firestoreDb) throw new Error("Firestore not initialized");
      const normNewDate = normalizeDateString(newDateInput);
      if (!normNewDate) {
        alert("Please select a valid date.");
        setIsSubmittingDateEdit(false);
        return;
      }

      const duplicate = scoreEvents.find(evt => 
        evt.id !== editingEventObj.id &&
        evt.scoreFolderId === scoreFolderId &&
        normalizeScoreCategory(evt.category) === normalizeScoreCategory(editingEventObj.category) &&
        String(evt.majorAreaId || '').toLowerCase() === String(editingEventObj.majorAreaId || '').toLowerCase() &&
        (normalizeScoreCategory(editingEventObj.category) === 'dailyevaluation' 
          ? normalizeIndividualSubjectCode(evt.subjectId || '') === normalizeIndividualSubjectCode(editingEventObj.subjectId || '')
          : true) &&
        normalizeDateString(evt.evaluationDate) === normNewDate
      );

      if (duplicate) {
        alert("A score column already exists for this category, area, subject, and date.");
        setIsSubmittingDateEdit(false);
        return;
      }

      const batch = writeBatch(firestoreDb);
      const eventRef = doc(firestoreDb, "score_events", editingEventObj.id);
      batch.update(eventRef, {
        evaluationDate: normNewDate,
        updatedAt: serverTimestamp()
      });

      allUsers.forEach((u: any) => {
        const userId = u.doc_id || u.uid || u.id;
        if (u.assessmentRecords?.[editingEventObj.id]) {
          const userRef = doc(firestoreDb, "users", userId);
          const oldDate = normalizeDateString(editingEventObj.evaluationDate);
          const oldRecordKey = `${userId}_${normalizeScoreCategory(editingEventObj.category)}_${oldDate}`;
          const newRecordKey = `${userId}_${normalizeScoreCategory(editingEventObj.category)}_${normNewDate}`;
          
          const oldScoreEntry = u.scoresByDate?.[oldRecordKey] || {};
          
          const updateObj: any = {
            [`assessmentRecords.${editingEventObj.id}.date`]: normNewDate,
            [`scoresByDate.${newRecordKey}`]: {
              ...oldScoreEntry,
              date: normNewDate,
              updatedAt: new Date().toISOString()
            },
            [`scoresByDate.${oldRecordKey}`]: null
          };
          
          batch.update(userRef, updateObj);
        }
      });

      await batch.commit();
      alert("Column date updated successfully!");
      setShowEditDateModal(false);
      setSelectedDate(normNewDate);
    } catch (err: any) {
      console.error("Error editing column date:", err);
      alert("Failed to edit column date: " + (err.message || err));
    } finally {
      setIsSubmittingDateEdit(false);
    }
  };

  const handleSaveTotalItems = async () => {
    if (!editingTotalItemsEventObj || !newTotalItemsInput) return;
    setIsSubmittingTotalItemsEdit(true);
    try {
      if (!firestoreDb) throw new Error("Firestore not initialized");
      const normTotalItems = Number(newTotalItemsInput);
      if (isNaN(normTotalItems) || normTotalItems <= 0) {
        alert("Please enter a valid positive number.");
        setIsSubmittingTotalItemsEdit(false);
        return;
      }

      const batch = writeBatch(firestoreDb);
      const eventRef = doc(firestoreDb, "score_events", editingTotalItemsEventObj.id);
      batch.update(eventRef, {
        totalItems: normTotalItems,
        updatedAt: serverTimestamp()
      });

      allUsers.forEach((u: any) => {
        const userId = u.doc_id || u.uid || u.id;
        if (u.assessmentRecords?.[editingTotalItemsEventObj.id]) {
          const userRef = doc(firestoreDb, "users", userId);
          const record = u.assessmentRecords[editingTotalItemsEventObj.id];
          const score = record.score ?? record.earnedPoints ?? 0;
          const percentage = (score / normTotalItems) * 100;
          
          const evaluationDate = normalizeDateString(editingTotalItemsEventObj.evaluationDate);
          const recordKey = `${userId}_${normalizeScoreCategory(editingTotalItemsEventObj.category)}_${evaluationDate}`;
          const oldScoreEntry = u.scoresByDate?.[recordKey] || {};

          const updateObj: any = {
            [`assessmentRecords.${editingTotalItemsEventObj.id}.totalScore`]: normTotalItems,
            [`scoresByDate.${recordKey}`]: {
              ...oldScoreEntry,
              possiblePoints: normTotalItems,
              percentage: percentage,
              updatedAt: new Date().toISOString()
            }
          };
          
          batch.update(userRef, updateObj);
        }
      });

      await batch.commit();
      alert("Column total items updated successfully!");
      setShowEditTotalItemsModal(false);
    } catch (err: any) {
      console.error("Error editing total items:", err);
      alert("Failed to edit total items: " + (err.message || err));
    } finally {
      setIsSubmittingTotalItemsEdit(false);
    }
  };

  const handlePublishColumn = async (evt: any) => {
    try {
      if (!firestoreDb) throw new Error("Firestore not initialized");
      const batch = writeBatch(firestoreDb);
      const eventRef = doc(firestoreDb, "score_events", evt.id);
      batch.update(eventRef, {
        publicationStatus: 'published',
        updatedAt: serverTimestamp()
      });

      allUsers.forEach((u: any) => {
        const userId = u.doc_id || u.uid || u.id;
        if (u.assessmentRecords?.[evt.id]) {
          const userRef = doc(firestoreDb, "users", userId);
          batch.update(userRef, {
            [`assessmentRecords.${evt.id}.publicationStatus`]: 'published',
            last_score_update: serverTimestamp()
          });
        }
      });

      await batch.commit();
      alert("Column published successfully!");
    } catch (err: any) {
      console.error("Error publishing column:", err);
      alert("Failed to publish column: " + (err.message || err));
    }
  };

  const handleHideColumn = async (evt: any) => {
    try {
      if (!firestoreDb) throw new Error("Firestore not initialized");
      const batch = writeBatch(firestoreDb);
      const eventRef = doc(firestoreDb, "score_events", evt.id);
      batch.update(eventRef, {
        publicationStatus: 'hidden',
        updatedAt: serverTimestamp()
      });

      allUsers.forEach((u: any) => {
        const userId = u.doc_id || u.uid || u.id;
        if (u.assessmentRecords?.[evt.id]) {
          const userRef = doc(firestoreDb, "users", userId);
          batch.update(userRef, {
            [`assessmentRecords.${evt.id}.publicationStatus`]: 'hidden',
            last_score_update: serverTimestamp()
          });
        }
      });

      await batch.commit();
      alert("Column hidden successfully!");
    } catch (err: any) {
      console.error("Error hiding column:", err);
      alert("Failed to hide column: " + (err.message || err));
    }
  };

  const handleArchiveColumn = async (evt: any) => {
    try {
      if (!firestoreDb) throw new Error("Firestore not initialized");
      const eventRef = doc(firestoreDb, "score_events", evt.id);
      await updateDoc(eventRef, {
        isArchived: true,
        updatedAt: serverTimestamp()
      });
      alert("Column archived successfully!");
    } catch (err: any) {
      console.error("Error archiving column:", err);
      alert("Failed to archive column: " + (err.message || err));
    }
  };

  const handleUnarchiveColumn = async (evt: any) => {
    try {
      if (!firestoreDb) throw new Error("Firestore not initialized");
      const eventRef = doc(firestoreDb, "score_events", evt.id);
      await updateDoc(eventRef, {
        isArchived: false,
        updatedAt: serverTimestamp()
      });
      alert("Column restored successfully!");
    } catch (err: any) {
      console.error("Error unarchiving column:", err);
      alert("Failed to unarchive column: " + (err.message || err));
    }
  };

  const handleDeleteColumn = (evt: any) => {
    setColumnToDelete(evt);
    setDeleteColumnError(null);
    setShowDeleteColumnConfirm(true);
  };

  const executeDeleteColumn = async () => {
    if (!columnToDelete || !firestoreDb) return;
    
    setIsDeletingColumn(true);
    setDeleteColumnError(null);
    
    try {
      const evt = columnToDelete;
      // 1. Delete the event itself
      const eventRef = doc(firestoreDb, "score_events", evt.id);
      
      // 2. Prepare user updates
      // We need to handle potential batch limit (500)
      const MAX_BATCH_SIZE = 450; 
      let currentBatch = writeBatch(firestoreDb);
      let opCount = 0;

      // Add event deletion to first batch
      currentBatch.delete(eventRef);
      opCount++;

      // We only want to update users who actually have this record
      const usersWithRecords = allUsers.filter((u: any) => u.assessmentRecords?.[evt.id]);
      
      for (const u of usersWithRecords) {
        if (opCount >= MAX_BATCH_SIZE) {
          await currentBatch.commit();
          currentBatch = writeBatch(firestoreDb);
          opCount = 0;
        }

        const userId = u.doc_id || u.uid || u.id;
        const userRef = doc(firestoreDb, "users", userId);
        const evaluationDate = normalizeDateString(evt.evaluationDate);
        const recordKey = `${userId}_${normalizeScoreCategory(evt.category)}_${evaluationDate}`;
        
        const updateData: any = {
          [`assessmentRecords.${evt.id}`]: deleteField(),
          last_score_update: serverTimestamp()
        };

        // Only delete from scoresByDate if the scoreEventId matches to avoid deleting other subjects on the same date
        const existingScoreEntry = u.scoresByDate?.[recordKey];
        if (existingScoreEntry && existingScoreEntry.scoreEventId === evt.id) {
          updateData[`scoresByDate.${recordKey}`] = deleteField();
        }
        
        currentBatch.update(userRef, updateData);
        opCount++;
      }

      if (opCount > 0) {
        await currentBatch.commit();
      }

      setShowDeleteColumnConfirm(false);
      setColumnToDelete(null);
      alert("Evaluation column and associated scores deleted successfully!");
    } catch (err: any) {
      console.error("Error deleting column:", err);
      setDeleteColumnError(err.message || "Failed to delete column. Please try again.");
    } finally {
      setIsDeletingColumn(false);
    }
  };

  useEffect(() => {
    if (!showAddScoreModal) return;
    const isDaily = normalizeScoreCategory(addScoreCategory) === 'dailyevaluation';
    const subjVal = isDaily ? addScoreSubject : addScoreMajorArea;
    const normDate = normalizeDateString(addScoreDate);

    if (addScoreCategory && addScoreMajorArea && (isDaily ? addScoreSubject : true) && normDate) {
      const existing = findExistingScoreEvent(addScoreCategory, addScoreMajorArea, subjVal, normDate);
      if (existing) {
        setAddScoreMode('existing');
        setSelectedScoreEventId(existing.id);
        setAddScoreTotalItems(String(existing.totalItems || 100));
      } else {
        setAddScoreMode('create');
        setSelectedScoreEventId(null);
      }
    }
  }, [addScoreCategory, addScoreMajorArea, addScoreSubject, addScoreDate, scoreEvents, showAddScoreModal]);

  return (
    <div className="flex flex-col min-h-0 h-full bg-white pb-16">
      <div className="p-4 sm:p-6 pb-4 shrink-0 relative z-40">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              {activeScoreFolder ? activeScoreFolder.name : "Score Management"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wider">{selectedCategory}</p>
              {activeScoreFolder && (() => {
                const scopeDisplay = formatFolderScopeDisplay(activeScoreFolder);
                return (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                      School Scope: {scopeDisplay.schoolsLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Branch Scope: {scopeDisplay.branchesLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Users size={12} />
                      {allReviewees.length} Matching Reviewees
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-colors shadow-sm ${showFilters ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <Filter size={14} />
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>
            <button 
              onClick={() => handleAddScoreButtonClick()}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer animate-in fade-in zoom-in-95 duration-200"
            >
              <Plus size={14} />
              Add Score
            </button>
            <button 
              onClick={() => {
                if (onOpenUploadModal) onOpenUploadModal();
                else if (onOpenSyncModal) (onOpenSyncModal as any)('main', 'import_scores', scoreFolderId);
              }}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
            >
              <Upload size={14} />
              <span className="hidden xs:inline">Upload</span> (CSV)
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end mb-4 overflow-visible relative z-40">
            {/* Category */}
            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
              <AnimatedSelect
                id="category-filter"
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={categories.map(c => ({ value: c, label: c }))}
                searchable={false}
                mobileMode="popover"
                triggerClassName="h-9 border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 py-2 px-2.5"
              />
            </div>

            {/* Evaluation Date */}
            <div className="lg:col-span-1 relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evaluation Date</label>
                {selectedDate !== 'All Dates' && activeScoreEvent && (
                  <button
                    type="button"
                    onClick={handleOpenEditDateModal}
                    className="text-[10px] text-teal-600 hover:text-teal-800 font-black flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0"
                    title="Edit column date for all reviewees"
                  >
                    <Pencil size={10} />
                    Edit
                  </button>
                )}
              </div>
              <AnimatedSelect
                id="evaluation-date-filter"
                value={selectedDate}
                onChange={setSelectedDate}
                options={['All Dates', ...dates].map(d => ({ value: d, label: d }))}
                searchable={dates.length > 5}
                mobileMode="popover"
                triggerClassName="h-9 border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 py-2 px-2.5"
              />
            </div>

            {/* Major Area - Only for Daily Evaluation */}
            {isDailyEvalCategory && (
              <div className="lg:col-span-1 relative">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Major Area</label>
                <AnimatedSelect
                  id="major-area-filter"
                  value={selectedMajorArea}
                  onChange={setSelectedMajorArea}
                  options={['CLJ', 'LEA', 'CDI', 'FS', 'CRIM', 'CA'].map(area => ({ value: area, label: area }))}
                  searchable={false}
                  mobileMode="popover"
                  triggerClassName="h-9 border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 py-2 px-2.5"
                />
              </div>
            )}

            {/* School */}
            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">School</label>
              <AnimatedSelect
                id="school-filter"
                value={selectedSchool}
                onChange={setSelectedSchool}
                options={['All Schools', ...schools].map(s => ({ value: s, label: s }))}
                searchable={schools.length > 5}
                mobileMode="popover"
                triggerClassName="h-9 border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 py-2 px-2.5"
              />
            </div>

            {/* Branch */}
            <div className="lg:col-span-1 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Branch</label>
              <AnimatedSelect
                id="branch-filter"
                value={selectedBranch}
                onChange={setSelectedBranch}
                options={
                  branchesLoading
                    ? [{ value: 'All Branches', label: 'Loading branches...' }]
                    : branchesError && branches.length === 0
                    ? [{ value: 'All Branches', label: 'Unable to load branches' }]
                    : branches.length === 0
                    ? [{ value: 'All Branches', label: 'No branches available' }]
                    : ['All Branches', ...branches].map(b => ({ value: b, label: b }))
                }
                searchable={branches.length > 5}
                mobileMode="popover"
                triggerClassName="h-9 border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 py-2 px-2.5"
              />
            </div>

            <div className="lg:col-span-1 relative flex flex-col justify-end">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center justify-center gap-2 h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${
                  showArchived 
                    ? 'bg-amber-100 text-amber-700 border-2 border-amber-300 ring-2 ring-amber-100' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                {showArchived ? (
                  <>
                    <X size={14} className="animate-in fade-in zoom-in-50" />
                    Hide Archived
                  </>
                ) : (
                  <>
                    <Archive size={14} />
                    Show Archived
                  </>
                )}
              </button>
            </div>

            <div className="lg:col-span-1 relative flex flex-col justify-end">
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className={`flex items-center justify-center gap-2 h-9 w-full px-3 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${
                    showColumnSelector 
                      ? 'bg-teal-600 text-white border-teal-600' 
                      : 'bg-white text-teal-600 border border-teal-200 hover:bg-teal-50'
                  }`}
                >
                  <Settings2 size={14} />
                  Columns
                </button>

                {showColumnSelector && (
                  <AnimatePresence>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColumnSelector(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-left"
                    >
                      <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Visible Columns</span>
                        <button 
                          onClick={() => setHiddenSubjectIds(new Set())}
                          className="text-[9px] font-black text-teal-600 hover:text-teal-700 uppercase"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                        {(isDailyEvalCategory 
                          ? (getSubjectsByArea(selectedMajorArea) || []) 
                          : subjects
                        ).map((s: any) => {
                          const id = s.id || s.code || s.key;
                          const code = s.subjectCode || s.code || s.label || s.key;
                          const name = s.subjectName || s.title || s.label;
                          const isVisible = !hiddenSubjectIds.has(id);
                          
                          return (
                            <label key={id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={isVisible}
                                onChange={() => {
                                  const next = new Set(hiddenSubjectIds);
                                  if (isVisible) next.add(id);
                                  else next.delete(id);
                                  setHiddenSubjectIds(next);
                                }}
                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800 uppercase">{code}</span>
                                <span className="text-[9px] text-slate-400 truncate w-44">{name}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

            <div className={`${isDailyEvalCategory ? 'lg:col-span-1' : 'lg:col-span-1'} relative`}>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Name or ID..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 px-4 sm:px-6 overflow-auto">
        {isDailyEvalCategory ? (
          <DailyEvaluationRevieweeMatrix
            areaCode={selectedMajorArea === 'All Areas' ? 'CLJ' : selectedMajorArea}
            evaluationDate={selectedDate}
            revieweeRows={dailyEvalMatrixRows}
            selectedUserIds={selectedUserIds}
            onToggleSelectAll={handleToggleSelectAllUsers}
            onToggleSelectUser={handleToggleSelectUser}
            onViewDetails={onViewDetails}
            onUpdateScore={(user, subjCode, earned, possible, eventObj) => {
              handleEditScoreClick({
                reviewee: user,
                category: selectedCategory,
                subject: subjCode,
                currentScore: earned,
                possiblePoints: possible,
                event: eventObj
              });
            }}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={(field) => {
              if (sortField === field) {
                if (sortDirection === 'asc') {
                  setSortDirection('desc');
                } else {
                  setSortField('name');
                  setSortDirection('asc');
                }
              } else {
                setSortField(field);
                setSortDirection('asc');
              }
            }}
            scoreEvents={scoreEvents}
            scoreFolderId={scoreFolderId}
            hiddenSubjectIds={hiddenSubjectIds}
            setHiddenSubjectIds={setHiddenSubjectIds}
            onEditColumnDate={(evt) => {
              setEditingEventObj(evt);
              setNewDateInput(evt.evaluationDate);
              setShowEditDateModal(true);
            }}
            onEditTotalItems={(evt) => {
              setEditingTotalItemsEventObj(evt);
              setNewTotalItemsInput(String(evt.totalItems || 100));
              setShowEditTotalItemsModal(true);
            }}
            onPublishColumn={handlePublishColumn}
            onHideColumn={handleHideColumn}
            onArchiveColumn={handleArchiveColumn}
            onUnarchiveColumn={handleUnarchiveColumn}
            onDeleteColumn={handleDeleteColumn}
            showArchived={showArchived}
            onAddScoreToExisting={(user, evt) => {
              handleEditScoreClick({
                reviewee: user,
                category: selectedCategory,
                subject: evt.subjectId || evt.subjectName,
                currentScore: null,
                possiblePoints: evt.totalItems || 100,
                event: evt
              });
            }}
            onAddFirstScoreForSubject={(subjectCode) => {
              handleAddScoreButtonClick({
                category: selectedCategory,
                subject: subjectCode,
                isFirstScoreForSubject: true
              });
            }}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-teal-50 border-b border-slate-200">
                    <th className="px-4 py-3 font-bold text-teal-900 whitespace-nowrap text-center">
                      <input type="checkbox" className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
                      <span className="ml-2">Select</span>
                    </th>
                    <th className="px-4 py-3 font-bold text-teal-900 whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => {
                          if (sortField === 'id') {
                            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('id');
                            setSortDirection('asc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-teal-700 transition-colors cursor-pointer font-bold"
                      >
                        ID Number
                        {sortField === 'id' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-bold text-teal-900 w-full min-w-[200px]">
                      <button 
                        type="button" 
                        onClick={() => {
                          if (sortField === 'name') {
                            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('name');
                            setSortDirection('asc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-teal-700 transition-colors cursor-pointer font-bold"
                      >
                        Reviewee
                        {sortField === 'name' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </button>
                    </th>
                    {displayedSubjects.map(s => (
                      <th key={s.key} className="px-3 py-3 font-bold text-teal-900 text-center whitespace-nowrap">
                        <button 
                          type="button" 
                          onClick={() => {
                            if (sortField === s.label) {
                              setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField(s.label);
                              setSortDirection('asc');
                            }
                          }}
                          className="flex items-center gap-1 justify-center hover:text-teal-700 transition-colors cursor-pointer font-bold mx-auto"
                        >
                          {s.label}
                          {sortField === s.label && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 font-bold text-teal-900 text-center whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => {
                          if (sortField === 'combined') {
                            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('combined');
                            setSortDirection('asc');
                          }
                        }}
                        className="flex items-center gap-1 justify-center hover:text-teal-700 transition-colors cursor-pointer font-bold mx-auto"
                      >
                        Combined
                        {sortField === 'combined' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-bold text-teal-900 text-center whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => {
                          if (sortField === 'rating') {
                            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('rating');
                            setSortDirection('asc');
                          }
                        }}
                        className="flex items-center gap-1 justify-center hover:text-teal-700 transition-colors cursor-pointer font-bold mx-auto"
                      >
                        Rating
                        {sortField === 'rating' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-bold text-teal-900 text-center whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => {
                          if (sortField === 'status') {
                            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('status');
                            setSortDirection('asc');
                          }
                        }}
                        className="flex items-center gap-1 justify-center hover:text-teal-700 transition-colors cursor-pointer font-bold mx-auto"
                      >
                        Status
                        {sortField === 'status' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-bold text-teal-900 text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedReviewees.map((row: any, idx: number) => {
                    const { user, subjScores, totalEarned, totalPossible, rating, hasScores } = row;
                    const scoreColorClass = getScoreColor(rating);
                    const rowKey = user.doc_id || user.uid || user.id || `row_${idx}`;
                    return (
                      <tr key={`${rowKey}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-center border-r border-slate-100/50">
                          <input type="checkbox" className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-blue-600">{user.id_number || user.seqId || user.seq_id || user.idNumber || user.revieweeId || user.id || '-'}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {formatFormalName(resolveCanonicalUserIdentity(user))}
                        </td>
                        {subjScores.map((s: any, i: number) => {
                          const subjObj = displayedSubjects[i];
                          return (
                            <td key={i} className="px-3 py-3 text-center border-l border-slate-100/50">
                              <CompactEditableScoreCell
                                reviewee={user}
                                category={selectedCategory}
                                subject={subjObj?.label || 'CLJ'}
                                isAreaActivated={true}
                                canEditScores={true}
                                onEdit={handleEditScoreClick}
                              />
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center border-l border-slate-100 font-bold bg-slate-50/50 text-slate-700">
                          {hasScores ? `${totalEarned}/${totalPossible}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-black bg-slate-50/50">
                          {hasScores ? (
                            <span className={scoreColorClass}>{rating.toFixed(2)}%</span>
                          ) : (
                            <span className="text-slate-400 font-bold">0.00%</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {subjScores.every((s: any) => s !== null && s.score !== null) ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Completed
                            </span>
                          ) : subjScores.some((s: any) => s !== null && s.score !== null) ? (
                            <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Not Started
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 relative">
                            <button 
                              onClick={() => onViewDetails && onViewDetails(user)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-md transition-colors"
                            >
                              <Eye size={14} />
                              View Details
                            </button>
                            <div className="relative">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveRowMenuUserId(activeRowMenuUserId === rowKey ? null : rowKey);
                                }}
                                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                                  activeRowMenuUserId === rowKey 
                                    ? 'bg-teal-600 text-white shadow-md' 
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <MoreVertical size={14} />
                              </button>

                              <AnimatePresence>
                                {activeRowMenuUserId === rowKey && (
                                  <>
                                    <div className="fixed inset-0 z-30" onClick={() => setActiveRowMenuUserId(null)} />
                                    <motion.div 
                                      initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, x: 0, scale: 1 }}
                                      exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                      transition={{ duration: 0.15 }}
                                      className="absolute right-full mr-2 top-0 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-slate-100 text-left py-1"
                                    >
                                      <div className="px-3 py-2 bg-slate-50/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reviewee Actions</p>
                                        <p className="text-xs font-bold text-slate-700 truncate">{formatFormalName(resolveCanonicalUserIdentity(user))}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveRowMenuUserId(null);
                                          onViewDetails && onViewDetails(user);
                                        }}
                                        className="w-full px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-2 transition-colors cursor-pointer"
                                      >
                                        <Eye size={13} /> View Full Profile
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveRowMenuUserId(null)}
                                        className="w-full px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                      >
                                        <FileText size={13} /> Performance Report
                                      </button>
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {processedReviewees.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                        No reviewees found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Score Modal */}
      {editingScoreCell && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-900">Edit Score</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getCanonicalFullName(editingScoreCell.user).displayName} • {editingScoreCell.subject} ({editingScoreCell.category})
                </p>
              </div>
              <button 
                onClick={() => setEditingScoreCell(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Score Earned</label>
                <input 
                  type="number"
                  value={newScoreInput}
                  onChange={e => setNewScoreInput(e.target.value)}
                  placeholder="e.g. 85"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Total Items / Possible Points</label>
                <input 
                  type="number"
                  value={newTotalInput}
                  onChange={e => setNewTotalInput(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingScoreCell(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScore}
                disabled={savingScore}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {savingScore && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Save Score
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Manual Add Score Modal */}
      {showAddScoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Add Evaluation Column</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create a new evaluation column. You can enter and edit individual scores directly in the table cells.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddScoreModal(false);
                  setDuplicateColumnEvent(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
                  <AnimatedSelect
                    value={addScoreCategory}
                    onChange={(val) => {
                      setAddScoreCategory(val);
                      setAddScoreSubject('');
                    }}
                    options={categories.map(cat => ({ value: cat, label: cat }))}
                    className="w-full"
                    triggerClassName="h-11 rounded-xl bg-slate-50 border-2 border-slate-100 px-4 text-sm font-semibold text-slate-900"
                  />
                </div>

                {/* Major Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Major Area</label>
                  <AnimatedSelect
                    value={addScoreMajorArea}
                    onChange={setAddScoreMajorArea}
                    options={[
                      { value: 'CLJ', label: 'CLJ' },
                      { value: 'LEA', label: 'LEA' },
                      { value: 'CDI', label: 'CDI' },
                      { value: 'FS', label: 'FS' },
                      { value: 'CRIM', label: 'CRIM' },
                      { value: 'CA', label: 'CA' },
                    ]}
                    className="w-full"
                    triggerClassName="h-11 rounded-xl bg-slate-50 border-2 border-slate-100 px-4 text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Subject Selection for Daily Evaluation */}
              {normalizeScoreCategory(addScoreCategory) === 'dailyevaluation' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Subject Area</label>
                  <AnimatedSelect
                    value={addScoreSubject}
                    onChange={setAddScoreSubject}
                    options={(SUBJECTS_BY_AREA[addScoreMajorArea] || []).map(s => ({
                      value: s.code,
                      label: `${s.code} - ${s.title}`
                    }))}
                    placeholder="Select Subject..."
                    className="w-full"
                    triggerClassName="h-11 rounded-xl bg-slate-50 border-2 border-slate-100 px-4 text-sm font-semibold text-slate-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Evaluation Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Evaluation Date</label>
                  <AnimatedDatePicker
                    value={addScoreDate}
                    onChange={setAddScoreDate}
                    triggerClassName="bg-slate-50 border-2 border-slate-100"
                  />
                </div>

                {/* Total Items */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Total Items</label>
                  <input
                    type="number"
                    value={addScoreTotalItems}
                    onChange={(e) => setAddScoreTotalItems(e.target.value)}
                    min="1"
                    className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-4 text-sm font-semibold text-slate-900 focus:border-teal-500 focus:ring-0 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Publication Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Publication Status</label>
                  <AnimatedSelect
                    value={addScorePublicationStatus}
                    onChange={(val: any) => setAddScorePublicationStatus(val)}
                    options={[
                      { value: 'published', label: 'Published' },
                      { value: 'hidden', label: 'Hidden' }
                    ]}
                    className="w-full"
                    triggerClassName="h-11 rounded-xl bg-slate-50 border-2 border-slate-100 px-4 text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setShowAddScoreModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveManualAddScoreClick}
                  disabled={isSubmittingAddScore}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingAddScore && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Create Column
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Date Modal */}
      {showEditDateModal && editingEventObj && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Edit Column Date</h3>
                <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wider font-bold text-teal-700">
                  {editingEventObj.category} • {editingEventObj.subjectName || editingEventObj.majorAreaName}
                </p>
              </div>
              <button 
                onClick={() => setShowEditDateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed space-y-1">
              <p className="font-bold">⚠️ Warning:</p>
              <p>This date is shared by all scores in this column. Updating it will change the date for every connected reviewee score.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">New Evaluation Date</label>
                <AnimatedDatePicker 
                  value={newDateInput}
                  onChange={setNewDateInput}
                  triggerClassName="bg-slate-50 border-2 border-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowEditDateModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveColumnDate}
                disabled={isSubmittingDateEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmittingDateEdit && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Update Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Total Items Modal */}
      {showEditTotalItemsModal && editingTotalItemsEventObj && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Edit Column Total Items</h3>
                <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wider font-bold text-teal-700">
                  {editingTotalItemsEventObj.category} • {editingTotalItemsEventObj.subjectName || editingTotalItemsEventObj.majorAreaName}
                </p>
              </div>
              <button 
                onClick={() => setShowEditTotalItemsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed space-y-1">
              <p className="font-bold">⚠️ Warning:</p>
              <p>Updating total items will recalculate the percentage rating for all connected reviewees who have scored in this column.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">New Total Items</label>
                <input 
                  type="number"
                  value={newTotalItemsInput}
                  onChange={e => setNewTotalItemsInput(e.target.value)}
                  min="1"
                  placeholder="e.g. 50"
                  className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-4 text-sm font-semibold text-slate-900 focus:border-teal-500 focus:ring-0 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowEditTotalItemsModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTotalItems}
                disabled={isSubmittingTotalItemsEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmittingTotalItemsEdit && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Update Total Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Column Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showDeleteColumnConfirm}
        onClose={() => !isDeletingColumn && setShowDeleteColumnConfirm(false)}
        onConfirm={executeDeleteColumn}
        isLoading={isDeletingColumn}
        error={deleteColumnError}
        title="Delete Evaluation Column"
        subtitle="Permanent Data Removal"
        message="Are you sure you want to delete this evaluation column and all its scores permanently? This will remove the records from all affected reviewees. This action is IRREVERSIBLE."
        confirmWord="DELETE"
        recordName={columnToDelete ? `${columnToDelete.category} - ${columnToDelete.subjectName || columnToDelete.majorAreaId || 'Unknown Subject'}` : ''}
        recordDetails={columnToDelete ? [
          { label: 'Evaluation Date', value: columnToDelete.evaluationDate },
          { label: 'Total Items', value: String(columnToDelete.totalItems || 100) },
          { label: 'Status', value: columnToDelete.publicationStatus || 'N/A' }
        ] : []}
      />
    </div>
  );
}
