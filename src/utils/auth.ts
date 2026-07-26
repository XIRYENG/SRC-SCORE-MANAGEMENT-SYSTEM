import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { app, firebaseConfigured } from './firebase';
import { ensureUserDocument } from './userUtils';

export const auth = (firebaseConfigured && app) ? getAuth(app) : (null as unknown as Auth);

export const getAuthInstance = (): Auth => {
  if (!auth) {
    throw new Error("Auth is unavailable because Firebase configuration is incomplete.");
  }
  return auth;
};

const provider = new GoogleAuthProvider();

// Cache the access token in memory.
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!firebaseConfigured || !app) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  const auth = getAuthInstance();
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      try {
        await ensureUserDocument(user);
      } catch (err) {
        console.error("Failed to ensure user document:", err);
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const auth = getAuthInstance();
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    
    await ensureUserDocument(result.user);
    
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (firebaseConfigured && app) {
    const auth = getAuthInstance();
    await auth.signOut();
  }
  cachedAccessToken = null;
};

export async function fetchWithFirebaseAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  if (!firebaseConfigured || !app) {
    throw new Error("Firebase is not configured.");
  }
  const authInstance = getAuthInstance();
  const user = authInstance.currentUser;

  if (!user) {
    throw new Error("No authenticated user.");
  }

  const makeRequest = async (forceRefresh: boolean) => {
    const token = await user.getIdToken(forceRefresh);
    const existingHeaders = init.headers || {};
    return fetch(input, {
      ...init,
      headers: {
        ...existingHeaders,
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
  };

  let response = await makeRequest(false);

  if (response.status === 401) {
    response = await makeRequest(true);
  }

  return response;
}

