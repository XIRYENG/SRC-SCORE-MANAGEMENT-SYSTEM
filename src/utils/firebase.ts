/// <reference types="vite/client" />
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  memoryLocalCache,
  type Firestore 
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import configJson from "../../firebase-applet-config.json";
import { 
  validateFirebaseConfig, 
  mergeNonEmptyConfig, 
  FirebasePublicConfig 
} from "./firebaseShared";

export const getFirebaseConfig = () => {
  const getEnvVar = (key: string): string | undefined => {
    // Try import.meta.env first (for Vite client-side builds)
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
    // Try process.env next (for Node, custom servers, Next.js, or Vercel fallbacks)
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key];
    }
    return undefined;
  };

  const envConfig: FirebasePublicConfig = {
    apiKey: getEnvVar("VITE_FIREBASE_API_KEY") || getEnvVar("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: getEnvVar("VITE_FIREBASE_AUTH_DOMAIN") || getEnvVar("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: getEnvVar("VITE_FIREBASE_PROJECT_ID") || getEnvVar("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: getEnvVar("VITE_FIREBASE_STORAGE_BUCKET") || getEnvVar("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID") || getEnvVar("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnvVar("VITE_FIREBASE_APP_ID") || getEnvVar("NEXT_PUBLIC_FIREBASE_APP_ID"),
    measurementId: getEnvVar("VITE_FIREBASE_MEASUREMENT_ID") || getEnvVar("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"),
  };

  const rawMergedConfig = mergeNonEmptyConfig(envConfig, configJson);
  const validation = validateFirebaseConfig(rawMergedConfig);

  return validation;
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let analyticsInstance: any = null;

const { valid, config, missingFields } = getFirebaseConfig();

export const firebaseConfigured = valid;

try {
  // Quick diagnostic console.log right before initialization
  console.log("[Firebase Diagnostic] Inspecting configuration loading:", {
    apiKeyIsDefined: config.apiKey !== undefined && config.apiKey !== "",
    apiKeyPreview: config.apiKey ? `${config.apiKey.substring(0, 5)}...` : "undefined",
    projectId: config.projectId || "undefined",
    isValid: firebaseConfigured,
    missingRequiredFields: missingFields
  });

  if (firebaseConfigured) {
    app = getApps().length > 0 ? getApp() : initializeApp(config);
    auth = getAuth(app);
    
    // Initialize Firestore once with recommended settings
    const forceLongPolling = import.meta.env.VITE_FIRESTORE_FORCE_LONG_POLLING === "true";
    
    try {
      db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        ignoreUndefinedProperties: true,
        ...(forceLongPolling 
          ? { experimentalForceLongPolling: true } 
          : { experimentalAutoDetectLongPolling: true })
      });
      console.info(`Firestore initialized with ${forceLongPolling ? 'force' : 'auto-detect'} long polling.`);
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        db = getFirestore(app);
        console.warn("Firestore already initialized, reusing instance.");
      } else {
        console.error("Firestore initialization failed:", error);
      }
    }
    
    // Safely init analytics
    isSupported().then(supported => {
        if (supported && config.measurementId) {
            analyticsInstance = getAnalytics(app as FirebaseApp);
        }
    }).catch(e => console.warn("Analytics not supported", e));

    console.info("Firebase initialized safely.");
  } else {
    console.warn(`Firebase initialization skipped. Missing: ${missingFields.join(", ")}`);
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { app, auth, analyticsInstance as analytics };

export function getDb(): Firestore | null {
  if (!db && app) {
    db = getFirestore(app);
  }
  return db;
}

export { db };

export function requireFirestore(): Firestore {
  const instance = db || getDb();
  if (!instance) {
    throw new Error("Firestore is currently unavailable.");
  }
  return instance;
}
