import { User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  limit, 
  query, 
  runTransaction, 
  serverTimestamp, 
  setDoc, 
  where, 
  writeBatch 
} from 'firebase/firestore';
import { initFirebaseClient } from '../utils/firebaseClient';
import { normalizeEmail } from '../utils/stringUtils';

export { normalizeEmail };

export interface AccountResolutionResult {
  status: 'found' | 'conflict' | 'not_found';
  account?: any;
  accounts?: any[];
  message?: string;
}

export function encodeEmailForIndex(email: string): string {
  const clean = normalizeEmail(email);
  if (!clean) return "";
  return encodeURIComponent(clean);
}

export function normalizeRole(role: any): string {
  const r = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]/g, "");

  if (r === "admin" || r === "superadmin" || r === "owner") return "Admin";
  if (r === "staff" || r === "coadmin" || r === "instructor") return "Staff";
  return "Reviewee";
}

/**
 * Searches Firestore for all user accounts matching a normalized email address.
 * Inspects normalizedEmail, email_lower, and email fields.
 */
export async function findAccountsByEmail(email: string): Promise<any[]> {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return [];

  const { db } = await initFirebaseClient();
  if (!db) throw new Error("Firestore database is not initialized.");

  const accountsMap = new Map<string, any>();

  const queries = [
    query(collection(db, "users"), where("normalizedEmail", "==", cleanEmail), limit(10)),
    query(collection(db, "users"), where("email_lower", "==", cleanEmail), limit(10)),
    query(collection(db, "users"), where("email", "==", cleanEmail), limit(10))
  ];

  for (const q of queries) {
    try {
      const snap = await getDocs(q);
      snap.docs.forEach(docSnap => {
        if (!accountsMap.has(docSnap.id)) {
          accountsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data(), _ref: docSnap.ref });
        }
      });
    } catch (err) {
      console.warn("[AccountResolver] Query error finding accounts by email:", err);
    }
  }

  return Array.from(accountsMap.values());
}

/**
 * Searches Firestore for a single user document by Firebase UID.
 */
export async function findAccountByUid(uid: string): Promise<any | null> {
  if (!uid) return null;

  const { db } = await initFirebaseClient();
  if (!db) throw new Error("Firestore database is not initialized.");

  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data(), _ref: userRef };
  }
  return null;
}

/**
 * Resolves an authenticated Firebase User to a single canonical Firestore account.
 * - Checks users/{uid} first.
 * - If not found, searches by normalized email.
 * - If exactly 1 account exists, links the UID to that account without overwriting existing data.
 * - If multiple accounts share the same email, flags as conflict for Admin review.
 * - If 0 accounts exist, returns not_found so new account setup can be initiated.
 */
export async function resolveAuthenticatedAccount(firebaseUser: User): Promise<AccountResolutionResult> {
  if (!firebaseUser?.uid) {
    return { status: 'not_found' };
  }

  const { db } = await initFirebaseClient();
  if (!db) throw new Error("Firestore database is not initialized.");

  // 1. Direct UID match
  const uidAccount = await findAccountByUid(firebaseUser.uid);
  if (uidAccount) {
    // Refresh login metadata
    const cleanEmail = normalizeEmail(uidAccount.email || firebaseUser.email);
    const updatedPayload: Record<string, any> = {
      uid: firebaseUser.uid,
      authUid: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: cleanEmail,
      email_lower: cleanEmail,
      normalizedEmail: cleanEmail,
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (firebaseUser.providerData?.some(p => p.providerId === 'google.com')) {
      updatedPayload.googleLinked = true;
      updatedPayload.googleProvider = true;
    }

    await setDoc(doc(db, "users", firebaseUser.uid), updatedPayload, { merge: true });

    return {
      status: 'found',
      account: { ...uidAccount, ...updatedPayload }
    };
  }

  // 2. Search by normalized email
  const cleanEmail = normalizeEmail(firebaseUser.email);
  if (!cleanEmail) {
    return { status: 'not_found' };
  }

  const emailAccounts = await findAccountsByEmail(cleanEmail);

  if (emailAccounts.length > 1) {
    return {
      status: 'conflict',
      accounts: emailAccounts,
      message: `Multiple accounts share the normalized email address '${cleanEmail}'. Please contact an administrator to resolve this conflict.`
    };
  }

  if (emailAccounts.length === 1) {
    const existingAccount = emailAccounts[0];
    const existingDocId = existingAccount.id;
    const existingRole = normalizeRole(existingAccount.role || existingAccount.userRole);

    const isGoogle = firebaseUser.providerData?.some(p => p.providerId === 'google.com');

    const updatePayload: Record<string, any> = {
      uid: firebaseUser.uid,
      authUid: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: cleanEmail,
      email_lower: cleanEmail,
      normalizedEmail: cleanEmail,
      role: existingAccount.role || existingRole, // Preserve role
      linkedAuthUid: firebaseUser.uid,
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isGoogle) {
      updatePayload.googleLinked = true;
      updatePayload.googleProvider = true;
    }

    const batch = writeBatch(db);

    // Update existing document
    const existingRef = doc(db, "users", existingDocId);
    batch.set(existingRef, updatePayload, { merge: true });

    // Also mirror to users/{firebaseUser.uid} if different doc ID
    if (existingDocId !== firebaseUser.uid) {
      const authUserRef = doc(db, "users", firebaseUser.uid);
      const mergedFullDoc = {
        ...existingAccount,
        ...updatePayload,
        canonicalDocId: existingDocId
      };
      delete mergedFullDoc._ref;
      batch.set(authUserRef, mergedFullDoc, { merge: true });
    }

    await batch.commit();

    const finalAccount = {
      ...existingAccount,
      ...updatePayload,
      id: existingDocId
    };

    return {
      status: 'found',
      account: finalAccount
    };
  }

  return { status: 'not_found' };
}

/**
 * Creates a unique email index entry and user document inside a Firestore transaction to prevent duplicate accounts.
 */
export async function createAccountWithUniqueIndex(
  uid: string,
  email: string,
  userData: Record<string, any>
): Promise<any> {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) {
    throw new Error("A valid email address is required.");
  }

  const { db } = await initFirebaseClient();
  if (!db) throw new Error("Firestore database is not initialized.");

  const encodedEmail = encodeEmailForIndex(cleanEmail);
  const indexRef = doc(db, "email_index", encodedEmail);
  const userRef = doc(db, "users", uid);

  const timestamp = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    // 1. Read index
    const indexSnap = await transaction.get(indexRef);
    if (indexSnap.exists()) {
      const existingData = indexSnap.data();
      if (existingData.userDocId && existingData.userDocId !== uid) {
        throw new Error("EMAIL_ALREADY_EXISTS: An account already exists for this email address.");
      }
    }

    // 2. Double check users collection query
    const existingAccounts = await findAccountsByEmail(cleanEmail);
    const nonMatchingAccount = existingAccounts.find(a => a.id !== uid);
    if (nonMatchingAccount) {
      throw new Error("EMAIL_ALREADY_EXISTS: An account already exists for this email address.");
    }

    // 3. Write user document and index document
    const fullUserData = {
      ...userData,
      uid,
      authUid: uid,
      firebaseUid: uid,
      email: cleanEmail,
      email_lower: cleanEmail,
      normalizedEmail: cleanEmail,
      role: userData.role || "Reviewee",
      accountStatus: userData.accountStatus || "active",
      createdAt: userData.createdAt || timestamp,
      created_at: userData.created_at || timestamp,
      updatedAt: timestamp,
      updated_at: timestamp
    };

    transaction.set(userRef, fullUserData, { merge: true });
    transaction.set(indexRef, {
      userDocId: uid,
      normalizedEmail: cleanEmail,
      role: userData.role || "Reviewee",
      createdAt: timestamp
    }, { merge: true });
  });

  const finalSnap = await getDoc(userRef);
  return { id: finalSnap.id, ...finalSnap.data() };
}
