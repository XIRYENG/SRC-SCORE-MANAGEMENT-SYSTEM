import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  runTransaction, 
  deleteDoc, 
  setDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { getClientDb, withTimeout } from "./firebaseClient";
import { matchRevieweeRecord, normalizeStr } from "./nameMatcher";
import { normalizeEmail } from "./stringUtils";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function parseSeqNum(seqIdStr: string): number | null {
  if (!seqIdStr) return null;
  const cleaned = String(seqIdStr).toUpperCase().replace(/^SRC\s*/, '').replace(/[\s-]/g, '').trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 4) {
    const numPart = digits.slice(0, -2);
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) return parsed;
  }
  const parsedDirect = parseInt(digits, 10);
  if (!isNaN(parsedDirect)) return parsedDirect;
  return null;
}

/**
 * Generates the next sequence ID safely inside a transaction, scanning all existing users to prevent duplication
 */
export async function generateNextSeqId(): Promise<string> {
  const db = getClientDb();
  if (!db) {
    throw new Error("Firestore database is not initialized.");
  }

  const currentFullYear = new Date().getFullYear();
  const currentYearSuffix = String(currentFullYear).slice(-2);
  const counterId = `reviewee_sequence_${currentFullYear}`;

  let maxNum = 1000;
  try {
    const allUsersSnap = await getDocs(collection(db, "users"));
    allUsersSnap.forEach(docSnap => {
      const d = docSnap.data();
      const idVal = d.seq_id || d.seqId || d.id_number || d.student_id;
      if (idVal) {
        const parsed = parseSeqNum(idVal);
        if (parsed !== null && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    });
  } catch (e) {
    console.warn("Could not scan all users for max seq ID:", e);
  }

  let counterCount = 1000;
  try {
    const counterRef = doc(db, "counters", counterId);
    const counterDoc = await getDoc(counterRef);
    if (counterDoc.exists() && typeof counterDoc.data().count === 'number') {
      counterCount = counterDoc.data().count;
    }
  } catch (e) {
    console.warn("Could not fetch counter:", e);
  }

  let nextAvailableNumber = Math.max(maxNum, counterCount) + 1;

  let seqId = "";
  await runTransaction(db, async (transaction) => {
    const counterRef = doc(db, "counters", counterId);
    const counterDoc = await transaction.get(counterRef);

    const prevCount = counterDoc.exists() ? (counterDoc.data().count || 1000) : Math.max(maxNum, 1000);
    const nextCount = Math.max(nextAvailableNumber, prevCount + 1);
    const seqNum = String(nextCount).padStart(4, '0');
    seqId = `SRC ${seqNum}${currentYearSuffix}`;

    const newMaxCount = Math.max(prevCount, nextCount);

    transaction.set(counterRef, { count: newMaxCount, year: currentFullYear });
  });

  return seqId;
}

export interface LinkOrCreateResult {
  status: 'active' | 'pending_verification';
  matchType: 'none' | 'perfect' | 'requires_verification';
  seqId: string | null;
  message?: string;
}

/**
 * Searches Firestore for unlinked reviewee records matching the provided first and last name.
 */
export async function findMatchingUnlinkedCandidates(
  firstName: string,
  lastName: string
): Promise<any[]> {
  const normFirst = normalizeStr(firstName);
  const normLast = normalizeStr(lastName);

  if (!normLast || normLast.length < 2) return [];

  const db = getClientDb();
  if (!db) return [];

  try {
    const q = query(
      collection(db, "users"),
      where("last_name", "==", normLast)
    );

    const querySnapshot = await withTimeout(getDocs(q));
    const candidates: any[] = [];

    querySnapshot.forEach(d => {
      const data = d.data();
      const isUnlinked = !data.uid || String(data.uid).trim() === '' || data.status === 'unlinked' || data.accountStatus === 'unlinked' || data.accountStatus === 'pending';
      const isReviewee = !data.role || String(data.role).toLowerCase() === 'reviewee';
      
      const fName = normalizeStr(data.first_name || data.firstName);
      const lName = normalizeStr(data.last_name || data.lastName);

      if (isUnlinked && isReviewee && lName === normLast) {
        if (!normFirst || fName === normFirst || fName.includes(normFirst) || normFirst.includes(fName)) {
          candidates.push({ id: d.id, ...data });
        }
      }
    });

    return candidates;
  } catch (err) {
    console.warn("Error finding matching unlinked candidates:", err);
    return [];
  }
}

/**
 * Links an existing reviewee record with a Firebase Auth account, or creates a new one.
 * Preserves historical score sheets and evaluations.
 */
export async function linkOrCreateUserRecord(
  uid: string,
  email: string,
  firstName: string,
  middleName: string,
  lastName: string,
  schoolName: string,
  reviewBranch: string,
  forcedMatchedRecord?: any | null,
  forceNewAccount?: boolean
): Promise<LinkOrCreateResult> {
  const db = getClientDb();
  if (!db) {
    throw new Error("Firestore database is not initialized.");
  }

  const path = `users/${uid}`;
  try {
    const uLastName = normalizeStr(lastName);
    const uFirstName = normalizeStr(firstName);
    const cleanEmail = normalizeEmail(email);
    const isAdminEmail = cleanEmail === "arielpesalver1998@gmail.com" || cleanEmail === "arielpesalver@ckcm.edu.ph" || (uFirstName === "ARIEL" && uLastName === "PESALVER");
    const timestamp = new Date().toISOString();

    // 0. CASE: User explicitly confirmed "Yes, this is me" for forcedMatchedRecord
    if (forcedMatchedRecord) {
      const oldRecord = forcedMatchedRecord;
      const oldDocId = oldRecord.id;
      const existingSeqId = oldRecord.seq_id || oldRecord.seqId || oldRecord.srcId || oldRecord.id_number || "";

      const mergedData = {
        ...oldRecord, // preserve ALL historical scores (scoresByDate, latestScores, diag_*, score_*, etc.)
        uid,
        authUid: uid,
        firebaseUid: uid,
        email: cleanEmail,
        email_lower: cleanEmail,
        normalizedEmail: cleanEmail,
        firstName: firstName || oldRecord.firstName || oldRecord.first_name,
        first_name: uFirstName || oldRecord.first_name,
        middleName: middleName || oldRecord.middleName || oldRecord.middle_name,
        middle_name: normalizeStr(middleName) || oldRecord.middle_name,
        lastName: lastName || oldRecord.lastName || oldRecord.last_name,
        last_name: uLastName || oldRecord.last_name,
        schoolName: schoolName || oldRecord.schoolName || oldRecord.school_name,
        school_name: normalizeStr(schoolName) || oldRecord.school_name,
        school: schoolName || oldRecord.school,
        reviewBranch: reviewBranch || oldRecord.reviewBranch || oldRecord.review_branch,
        review_branch: normalizeStr(reviewBranch) || oldRecord.review_branch,
        branch: reviewBranch || oldRecord.branch,
        srcId: existingSeqId,
        seq_id: existingSeqId,
        role: isAdminEmail ? "Admin" : (oldRecord.role || "Reviewee"),
        accountStatus: "active",
        createdAt: oldRecord.created_at || timestamp,
        created_at: oldRecord.created_at || timestamp,
        updatedAt: timestamp,
        updated_at: timestamp
      };

      await setDoc(doc(db, "users", uid), mergedData, { merge: true });

      if (oldDocId && oldDocId !== uid) {
        try {
          await deleteDoc(doc(db, "users", oldDocId));
        } catch (delErr) {
          console.warn("Notice deleting old unlinked doc after merge:", delErr);
        }
      }

      return {
        status: 'active',
        matchType: 'perfect',
        seqId: existingSeqId,
        message: `Successfully merged into ID Number ${existingSeqId}! All your scores are now loaded on your account.`
      };
    }

    // 0.1 CASE: User explicitly confirmed "No, create new ID"
    if (forceNewAccount) {
      const newSeqId = await generateNextSeqId();
      const newRecordData = {
        uid,
        authUid: uid,
        firebaseUid: uid,
        email: cleanEmail,
        email_lower: cleanEmail,
        normalizedEmail: cleanEmail,
        firstName,
        first_name: uFirstName,
        middleName,
        middle_name: normalizeStr(middleName),
        lastName,
        last_name: uLastName,
        schoolName,
        school_name: normalizeStr(schoolName),
        school: schoolName,
        reviewBranch,
        review_branch: normalizeStr(reviewBranch),
        branch: reviewBranch,
        srcId: newSeqId,
        seq_id: newSeqId,
        role: isAdminEmail ? "Admin" : "Reviewee",
        accountStatus: "active",
        createdAt: timestamp,
        created_at: timestamp,
        updatedAt: timestamp,
        updated_at: timestamp
      };

      await setDoc(doc(db, "users", uid), newRecordData);

      return {
        status: 'active',
        matchType: 'none',
        seqId: newSeqId,
        message: "Welcome to Samaritan Review Center! Your reviewee account is active with a new ID Number."
      };
    }

    // 1. Query existing users for matching Last Name to find unlinked candidates
    const q = query(
      collection(db, "users"),
      where("last_name", "==", uLastName)
    );

    const querySnapshot = await withTimeout(getDocs(q));
    const allUsersList: any[] = [];
    querySnapshot.forEach(d => {
      allUsersList.push({ id: d.id, ...d.data() });
    });

    // 2. Perform name/school/branch match
    const matchResult = matchRevieweeRecord(
      firstName,
      middleName,
      lastName,
      schoolName,
      reviewBranch,
      allUsersList
    );

    if (matchResult.matchType === 'perfect' && matchResult.matchedRecord) {
      const oldRecord = matchResult.matchedRecord;
      const oldDocId = oldRecord.id;
      const existingSeqId = oldRecord.seq_id || oldRecord.seqId || "";

      // Copy historical record to new users/{uid} document with active status and merged keys
      const mergedData = {
        ...oldRecord, // preserve all scores, logs, and historical fields
        uid,
        email: cleanEmail,
        email_lower: cleanEmail,
        normalizedEmail: cleanEmail,
        firstName,
        first_name: uFirstName,
        middleName,
        middle_name: normalizeStr(middleName),
        lastName,
        last_name: uLastName,
        schoolName,
        school_name: normalizeStr(schoolName),
        school: schoolName,
        reviewBranch,
        review_branch: normalizeStr(reviewBranch),
        branch: reviewBranch,
        srcId: existingSeqId,
        seq_id: existingSeqId,
        role: isAdminEmail ? "Admin" : (oldRecord.role || "Reviewee"),
        accountStatus: "active",
        createdAt: oldRecord.created_at || timestamp,
        created_at: oldRecord.created_at || timestamp,
        updatedAt: timestamp,
        updated_at: timestamp
      };

      // Perform write-then-delete atomically using transactional operations or standard calls
      await setDoc(doc(db, "users", uid), mergedData);
      
      // Delete old unlinked record
      try {
        await deleteDoc(doc(db, "users", oldDocId));
      } catch (delErr) {
        console.warn("Failed to delete old unlinked record, but merged copy is written:", delErr);
      }

      return {
        status: 'active',
        matchType: 'perfect',
        seqId: existingSeqId,
        message: "Existing record found and successfully merged! Welcome back!"
      };

    } else if (matchResult.matchType === 'requires_verification') {
      // Pending status for manual confirmation
      const pendingData = {
        uid,
        email: cleanEmail,
        email_lower: cleanEmail,
        normalizedEmail: cleanEmail,
        firstName,
        first_name: uFirstName,
        middleName,
        middle_name: normalizeStr(middleName),
        lastName,
        last_name: uLastName,
        schoolName,
        school_name: normalizeStr(schoolName),
        school: schoolName,
        reviewBranch,
        review_branch: normalizeStr(reviewBranch),
        branch: reviewBranch,
        role: isAdminEmail ? "Admin" : "Reviewee",
        accountStatus: "pending_verification",
        createdAt: timestamp,
        created_at: timestamp,
        updatedAt: timestamp,
        updated_at: timestamp,
        srcId: "",
        seq_id: ""
      };

      await setDoc(doc(db, "users", uid), pendingData);

      return {
        status: 'pending_verification',
        matchType: 'requires_verification',
        seqId: null,
        message: "Account verification required. Multiple profiles with similar names were detected. Admin/Staff will confirm and link your records."
      };

    } else {
      // Create fresh new record with auto-generated sequence ID
      const newSeqId = await generateNextSeqId();

      const newRecordData = {
        uid,
        email: cleanEmail,
        email_lower: cleanEmail,
        normalizedEmail: cleanEmail,
        firstName,
        first_name: uFirstName,
        middleName,
        middle_name: normalizeStr(middleName),
        lastName,
        last_name: uLastName,
        schoolName,
        school_name: normalizeStr(schoolName),
        school: schoolName,
        reviewBranch,
        review_branch: normalizeStr(reviewBranch),
        branch: reviewBranch,
        srcId: newSeqId,
        seq_id: newSeqId,
        role: isAdminEmail ? "Admin" : "Reviewee",
        accountStatus: "active",
        createdAt: timestamp,
        created_at: timestamp,
        updatedAt: timestamp,
        updated_at: timestamp
      };

      await setDoc(doc(db, "users", uid), newRecordData);

      return {
        status: 'active',
        matchType: 'none',
        seqId: newSeqId,
        message: "Welcome to Samaritan Review Center! Your reviewee account is successfully activated."
      };
    }

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Manually activate/link an existing unlinked record using a PIN.
 */
export async function activateExistingWithPin(
  uid: string,
  email: string,
  lastName: string,
  firstName: string,
  middleName: string,
  pin: string
): Promise<{ success: boolean; message: string }> {
  const db = getClientDb();
  if (!db) {
    throw new Error("Firestore database is not initialized.");
  }

  const uLastName = normalizeStr(lastName);
  const uFirstName = normalizeStr(firstName);
  const uPin = String(pin || '').trim();
  const cleanEmail = email.trim().toLowerCase();
  const isAdminEmail = cleanEmail === "arielpesalver1998@gmail.com" || cleanEmail === "arielpesalver@ckcm.edu.ph" || (uFirstName === "ARIEL" && uLastName === "PESALVER");

  if (!uPin) {
    throw new Error("Please enter your PIN code.");
  }

  const path = `users/${uid}`;
  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, "users")));
    const candidates: any[] = [];
    querySnapshot.forEach(d => {
      const data = d.data();
      const isUnlinked = !data.uid || data.uid.trim() === '';
      if (isUnlinked) {
        candidates.push({ id: d.id, ...data });
      }
    });

    let matchedRecord = candidates.find(c => {
      const cPin = String(c.pin || '').trim();
      if (cPin !== uPin) return false;
      const cLast = normalizeStr(c.last_name || c.lastName);
      const cFirst = normalizeStr(c.first_name || c.firstName);
      return (!uLastName || cLast === uLastName) && (!uFirstName || cFirst === uFirstName);
    });

    if (!matchedRecord && uPin) {
      matchedRecord = candidates.find(c => String(c.pin || '').trim() === uPin);
    }

    if (!matchedRecord) {
      throw new Error("No matching registration profile was found with that PIN. Please check your PIN code.");
    }

    const timestamp = new Date().toISOString();
    const existingSeqId = matchedRecord.seq_id || matchedRecord.seqId || "";

    // Merge historical scores/records
    const mergedData = {
      ...matchedRecord, // preserve scores, history, sheets, and logs
      uid,
      email,
      firstName: matchedRecord.firstName || matchedRecord.first_name || firstName,
      first_name: normalizeStr(matchedRecord.first_name || matchedRecord.firstName || firstName),
      middleName: matchedRecord.middleName || matchedRecord.middle_name || middleName,
      middle_name: normalizeStr(matchedRecord.middle_name || matchedRecord.middleName || middleName),
      lastName: matchedRecord.lastName || matchedRecord.last_name || lastName,
      last_name: normalizeStr(matchedRecord.last_name || matchedRecord.lastName || lastName),
      schoolName: matchedRecord.schoolName || matchedRecord.school_name || "",
      school_name: normalizeStr(matchedRecord.schoolName || matchedRecord.school_name),
      reviewBranch: matchedRecord.reviewBranch || matchedRecord.review_branch || "",
      review_branch: normalizeStr(matchedRecord.reviewBranch || matchedRecord.review_branch),
      srcId: existingSeqId,
      seq_id: existingSeqId,
      role: isAdminEmail ? "Admin" : (matchedRecord.role || "Reviewee"),
      accountStatus: "active",
      createdAt: matchedRecord.created_at || matchedRecord.createdAt || timestamp,
      created_at: matchedRecord.created_at || matchedRecord.createdAt || timestamp,
      updatedAt: timestamp,
      updated_at: timestamp
    };

    await setDoc(doc(db, "users", uid), mergedData);

    try {
      await deleteDoc(doc(db, "users", matchedRecord.id));
    } catch (delErr) {
      console.warn("Failed to delete old unlinked record during PIN activation:", delErr);
    }

    return {
      success: true,
      message: "Welcome back! Your account has been successfully verified and activated using your PIN."
    };

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("No matching")) {
      throw new Error("Incorrect PIN or user does not match. Please try again.");
    }
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
