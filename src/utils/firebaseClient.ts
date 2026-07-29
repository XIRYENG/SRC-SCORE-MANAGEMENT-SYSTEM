import { type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  runTransaction,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { app, firebaseConfigured, getFirebaseConfig, db as sharedDb } from "./firebase";
import { cleanOptionalName } from "../services/userIdentityResolver";

// Use the shared database instance
export const firestoreDb = sharedDb as Firestore;

export const requireFirestore = (): Firestore => {
  if (!firestoreDb) {
    throw new Error("Firestore is unavailable because Firebase configuration is incomplete.");
  }
  return firestoreDb;
};

export const initFirebaseClient = async () => {
  if (!firebaseConfigured) {
      throw new Error("Firebase configuration is incomplete. Missing required fields.");
  }
  return {
    app: app,
    db: firestoreDb,
  };
};

export const getClientDb = () => firestoreDb;

export const withTimeout = <T>(promise: Promise<T>, ms = 10000): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("Firebase operation timed out")),
      ms
    );

    promise
      .then((value) => {
        clearTimeout(t);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(t);
        reject(error);
      });
  });
};

export async function clientCheckDuplicate(
  lastName: string,
  firstName: string,
  middleName: string
): Promise<any> {
  await initFirebaseClient();
  if (!firestoreDb) {
    throw new Error("Client Firestore DB is not initialized.");
  }
  
  const uLastName = String(lastName || '').trim().toUpperCase();
  const uFirstName = String(firstName || '').trim().toUpperCase();
  const uMiddleName = String(cleanOptionalName(middleName)).trim().toUpperCase();

  const q = query(
    collection(firestoreDb, "users"),
    where("last_name", "==", uLastName)
  );
  
  const querySnapshot = await withTimeout(getDocs(q));
  const matchDoc = querySnapshot.docs.find(docSnap => {
    const d = docSnap.data();
    const storedFirst = String(d.first_name || d.firstName || '').trim().toUpperCase();
    const storedMiddle = String(cleanOptionalName(d.middle_name || d.middleName || '')).trim().toUpperCase();
    return storedFirst === uFirstName && storedMiddle === uMiddleName;
  });
  
  if (matchDoc) {
    const existing = matchDoc.data();
    return {
      exists: true,
      seqId: existing.seq_id,
      last_name: existing.last_name,
      first_name: existing.first_name,
      middle_name: cleanOptionalName(existing.middle_name),
      school_name: existing.school_name,
      timestamp: existing.created_at,
      pin: existing.pin
    };
  }
  
  return { exists: false };
}

export async function clientVerifyPin(
  lastName: string,
  firstName: string,
  middleName: string,
  pin: string
): Promise<any> {
  await initFirebaseClient();
  if (!firestoreDb) {
    throw new Error("Client Firestore DB is not initialized.");
  }
  
  const uLastName = String(lastName || '').trim().toUpperCase();
  const uFirstName = String(firstName || '').trim().toUpperCase();
  const uMiddleName = String(cleanOptionalName(middleName)).trim().toUpperCase();
  const uPin = String(pin || '').trim();

  const q = query(
    collection(firestoreDb, "users"),
    where("last_name", "==", uLastName)
  );
  
  const querySnapshot = await withTimeout(getDocs(q));
  const matchDoc = querySnapshot.docs.find(docSnap => {
    const d = docSnap.data();
    const storedFirst = String(d.first_name || d.firstName || '').trim().toUpperCase();
    const storedMiddle = String(cleanOptionalName(d.middle_name || d.middleName || '')).trim().toUpperCase();
    return storedFirst === uFirstName && storedMiddle === uMiddleName;
  });
  
  if (matchDoc) {
    const existing = matchDoc.data();
    if (existing.pin === uPin) {
      return {
        success: true,
        seqId: existing.seq_id,
        last_name: existing.last_name,
        first_name: existing.first_name,
        middle_name: cleanOptionalName(existing.middle_name),
        school_name: existing.school_name,
        timestamp: existing.created_at,
        pin: existing.pin,
        role: existing.role || ""
      };
    } else {
      throw new Error("Incorrect PIN code.");
    }
  }
  
  throw new Error("Registration record not found.");
}

function parseSeqNum(seqIdStr: string): number | null {
  if (!seqIdStr) return null;
  const partBeforeDash = seqIdStr.split('-')[0];
  const cleaned = partBeforeDash.toUpperCase().replace(/^SRC\s*/, '').trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 3) {
    const numPart = digits.slice(0, -2);
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export async function clientEnroll(
  lastName: string,
  firstName: string,
  middleName: string,
  schoolName: string,
  pin: string
): Promise<any> {
  await initFirebaseClient();
  if (!firestoreDb) {
    throw new Error("Client Firestore DB is not initialized.");
  }

  const uLastName = String(lastName || '').trim().toUpperCase();
  const uFirstName = String(firstName || '').trim().toUpperCase();
  const uMiddleName = String(cleanOptionalName(middleName)).trim().toUpperCase();
  let uSchoolName = String(schoolName || '').trim().toUpperCase();
  const uPin = String(pin || '').trim();

  // Apply school mappings
  try {
    const mappingsDoc = await withTimeout(getDoc(doc(firestoreDb, "config", "school_mappings")));
    if (mappingsDoc.exists()) {
      const { mappings } = mappingsDoc.data();
      if (mappings && mappings[uSchoolName]) {
        uSchoolName = mappings[uSchoolName];
      }
    }
  } catch (err) {
    console.warn("Failed to fetch school mappings during direct client fallback enrollment:", err);
  }

  // Check duplicate first
  const q = query(
    collection(firestoreDb, "users"),
    where("last_name", "==", uLastName)
  );
  const querySnapshot = await withTimeout(getDocs(q));
  const matchDoc = querySnapshot.docs.find(docSnap => {
    const d = docSnap.data();
    const storedFirst = String(d.first_name || d.firstName || '').trim().toUpperCase();
    const storedMiddle = String(cleanOptionalName(d.middle_name || d.middleName || '')).trim().toUpperCase();
    return storedFirst === uFirstName && storedMiddle === uMiddleName;
  });

  if (matchDoc) {
    throw new Error("A registration record with this name already exists. Duplicate enrollment is not allowed.");
  }

  let seqId = "";
  const timestamp = new Date().toISOString();
  const currentFullYear = new Date().getFullYear();
  const currentYearSuffix = String(currentFullYear).slice(-2);
  const counterId = `reviewee_sequence_${currentFullYear}`;

  let nextAvailableNumber = 1001;
  try {
    const counterRef = doc(firestoreDb, "counters", counterId);
    const counterDoc = await getDoc(counterRef);
    if (counterDoc.exists() && counterDoc.data().count) {
      nextAvailableNumber = (counterDoc.data().count || 1000) + 1;
    } else {
      // If counter document does not exist, query only the 10 most recent registrations to find max ID (extremely fast)
      const qRecent = query(
        collection(firestoreDb, "users"),
        orderBy("created_at", "desc"),
        limit(10)
      );
      const snap = await withTimeout(getDocs(qRecent));
      if (!snap.empty) {
        let maxNum = 1000;
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (d.seq_id) {
            const parsed = parseSeqNum(d.seq_id);
            if (parsed !== null && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        });
        nextAvailableNumber = maxNum + 1;
      }
    }
  } catch (e) {
    console.warn("Could not determine dynamic next sequence number on client:", e);
  }

  let assignedRole = "Reviewee";
  if (uLastName === "PESALVER" && uFirstName === "ARIEL") {
    assignedRole = "Admin";
  }

  await withTimeout(runTransaction(firestoreDb, async (transaction) => {
    const counterRef = doc(firestoreDb, "counters", counterId);
    const counterDoc = await transaction.get(counterRef);
    
    const nextCount = nextAvailableNumber;
    const seqNum = String(nextCount).padStart(4, '0');
    seqId = `SRC ${seqNum}${currentYearSuffix}`;
    
    // Save maximum count to counters
    const prevCount = counterDoc.exists() ? (counterDoc.data().count || 0) : 0;
    const newMaxCount = Math.max(prevCount, nextCount);
    
    transaction.set(counterRef, { count: newMaxCount, year: currentFullYear });
    
    const newDocRef = doc(collection(firestoreDb!, "users"));

    const recordData = {
      id: newDocRef.id,
      last_name: uLastName,
      first_name: uFirstName,
      middle_name: uMiddleName,
      school_name: uSchoolName,
      pin: uPin,
      seq_id: seqId,
      created_at: timestamp,
      role: assignedRole
    };
    
    transaction.set(newDocRef, recordData);
  }), 5000);

  return {
    success: true,
    seqId,
    last_name: uLastName,
    first_name: uFirstName,
    middle_name: uMiddleName,
    school_name: uSchoolName,
    timestamp,
    pin: uPin,
    role: assignedRole
  };
}

export async function clientUpdateUser(docId: string, data: any) {
  await initFirebaseClient();
  const userRef = doc(firestoreDb, "users", docId);
  
  const updateData = { ...data };

  // Synchronize ID Number variations across all alias keys
  const rawSeq = updateData.seqId ?? updateData.seq_id ?? updateData.id_number ?? updateData.idNumber ?? updateData.srcId;
  if (rawSeq !== undefined && rawSeq !== null) {
    const seqVal = String(rawSeq).trim();
    updateData.seqId = seqVal;
    updateData.seq_id = seqVal;
    updateData.id_number = seqVal;
    updateData.idNumber = seqVal;
    updateData.srcId = seqVal;
  }

  // Synchronize First Name
  const fn = updateData.firstName ?? updateData.first_name;
  if (fn !== undefined && fn !== null) {
    const fnVal = String(fn).trim();
    updateData.firstName = fnVal;
    updateData.first_name = fnVal;
  }

  // Synchronize Middle Name
  const mn = updateData.middleName !== undefined ? updateData.middleName : updateData.middle_name;
  if (mn !== undefined && mn !== null) {
    const mnVal = String(mn || '').trim();
    updateData.middleName = mnVal;
    updateData.middle_name = mnVal;
  }

  // Synchronize Last Name
  const ln = updateData.lastName ?? updateData.last_name;
  if (ln !== undefined && ln !== null) {
    const lnVal = String(ln).trim();
    updateData.lastName = lnVal;
    updateData.last_name = lnVal;
  }

  // Synchronize School Name
  const sn = updateData.schoolName ?? updateData.school_name;
  if (sn !== undefined && sn !== null) {
    const snVal = String(sn).trim();
    updateData.schoolName = snVal;
    updateData.school_name = snVal;
  }

  // Synchronize Review Branch
  const rb = updateData.reviewBranch !== undefined ? updateData.reviewBranch : updateData.review_branch;
  if (rb !== undefined && rb !== null) {
    const rbVal = String(rb || '').trim();
    updateData.reviewBranch = rbVal;
    updateData.review_branch = rbVal;
  }

  // Synchronize Email and lower-case email
  if (updateData.email) {
    const cleanEmail = String(updateData.email).trim().toLowerCase();
    
    // Check duplicates
    const q = query(
      collection(firestoreDb, "users"),
      where("email_lower", "==", cleanEmail),
      limit(2)
    );
    
    const snap = await getDocs(q);
    const duplicate = snap.docs.find((d) => d.id !== docId);
    
    if (duplicate) {
      throw new Error("This email is already assigned to another account.");
    }
    
    updateData.email = cleanEmail;
    updateData.email_lower = cleanEmail;
  }

  // Synchronize Role
  if (updateData.role || updateData.role_name) {
    const rVal = updateData.role || updateData.role_name;
    updateData.role = rVal;
    updateData.role_name = rVal;
  }
  
  updateData.updatedAt = serverTimestamp();
  updateData.updated_at = new Date().toISOString();

  await updateDoc(userRef, updateData);
  return { success: true };
}

export async function clientDeleteUser(docId: string, options?: { authUid?: string; targetUser?: any }) {
  await initFirebaseClient();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  let idToken = "";
  if (currentUser) {
    idToken = await currentUser.getIdToken(true);
  }

  const targetId = options?.authUid || docId;
  const response = await fetch(`/api/admin/users/${encodeURIComponent(targetId)}`, {
    method: "DELETE",
    headers: {
      "Authorization": idToken ? `Bearer ${idToken}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profileDocumentId: docId,
      authUid: options?.authUid || docId,
      displayName: options?.targetUser ? `${options.targetUser.first_name || ''} ${options.targetUser.last_name || ''}`.trim() : undefined,
      email: options?.targetUser?.email,
      role: options?.targetUser?.role,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to delete user account.");
  }

  return data;
}
