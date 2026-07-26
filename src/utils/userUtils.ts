import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { initFirebaseClient } from './firebaseClient';
import { normalizeEmail } from './stringUtils';
import { resolveAuthenticatedAccount } from '../services/accountResolver';

export { normalizeEmail };

export const ensureUserDocument = async (firebaseUser: User) => {
  if (!firebaseUser?.uid) return null;

  const resolution = await resolveAuthenticatedAccount(firebaseUser);

  if (resolution.status === 'found') {
    return resolution.account;
  }

  if (resolution.status === 'conflict') {
    throw new Error(resolution.message || "Multiple accounts share this email address. Please contact Admin.");
  }

  // CASE: No existing account found for this UID or email.
  // Create pending user record for ProfileSetup / complete registration.
  const { db } = await initFirebaseClient();
  if (!db) {
    throw new Error("Firestore database is not initialized.");
  }

  const authUid = firebaseUser.uid;
  const cleanEmail = normalizeEmail(firebaseUser.email);
  const displayName = firebaseUser.displayName || "";
  const emailName = cleanEmail ? cleanEmail.split("@")[0] : "Reviewee";

  let parsedFirst = "";
  let parsedMiddle = "";
  let parsedLast = "";

  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) {
      parsedFirst = parts[0];
    } else if (parts.length === 2) {
      parsedFirst = parts[0];
      parsedLast = parts[1];
    } else if (parts.length === 3) {
      parsedFirst = parts[0];
      parsedMiddle = parts[1];
      parsedLast = parts[2];
    } else if (parts.length >= 4) {
      parsedFirst = parts.slice(0, parts.length - 2).join(" ");
      parsedMiddle = parts[parts.length - 2];
      parsedLast = parts[parts.length - 1];
    }
  }

  const isGoogle = firebaseUser.providerData?.some(p => p.providerId === 'google.com');

  const authUserRef = doc(db, "users", authUid);
  const initialProfile = {
    uid: authUid,
    authUid,
    firebaseUid: authUid,
    email: cleanEmail,
    email_lower: cleanEmail,
    normalizedEmail: cleanEmail,
    displayName: displayName || emailName,
    firstName: parsedFirst,
    first_name: parsedFirst.toUpperCase(),
    middleName: parsedMiddle,
    middle_name: parsedMiddle.toUpperCase(),
    lastName: parsedLast,
    last_name: parsedLast.toUpperCase(),
    role: "Reviewee",
    status: "pending",
    accountStatus: "pending",
    googleLinked: isGoogle ? true : false,
    googleProvider: isGoogle ? true : false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    source: "auto-created-login-pending-setup"
  };

  await setDoc(authUserRef, initialProfile, { merge: true });

  const snap = await getDoc(authUserRef);
  return { id: snap.id, ...snap.data() };
};
