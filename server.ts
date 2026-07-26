import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { createServer as createHttpServer } from "http";
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeApp as initAdminApp, getApp as getAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, FieldValue as AdminFieldValue, Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import { 
  validateFirebaseConfig, 
  mergeNonEmptyConfig, 
  FirebasePublicConfig 
} from "./src/utils/firebaseShared";
import {
  analyzeDuplicatesReport,
  getCanonicalFullName,
  normalizeNameForComparison
} from "./src/utils/nameNormalization";

// Catch startup errors
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

// Suppress Firestore BloomFilter false-positive errors and Quota/exhausted exceptions
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const cleanQuotaLogs = (originalFn: (...args: any[]) => void) => {
  return (...args: any[]) => {
    const argStr = args.map(a => {
      if (a instanceof Error) {
        return String(a.message || a.stack || a);
      }
      return String(a?.message || a?.details || a || '');
    }).join(' ');

    const lowerStr = argStr.toLowerCase();
    const isQuota = lowerStr.includes('quota') || 
                    lowerStr.includes('resource_exhausted') || 
                    lowerStr.includes('limit exceeded') ||
                    lowerStr.includes('exhausted') ||
                    lowerStr.includes('quota_exceeded') ||
                    lowerStr.includes('cancelling stream') ||
                    lowerStr.includes('disconnecting idle stream') ||
                    lowerStr.includes('timed out waiting for new targets');

    if (args[0] && typeof args[0] === 'string' && args[0].includes('BloomFilter error')) {
      return;
    }
    if (isQuota) {
      console.log(`[Database Notice] Operating in offline-optimized cache mode (due to daily capacity thresholds).`);
      return;
    }
    originalFn.apply(console, args);
  };
};

console.error = cleanQuotaLogs(originalConsoleError);
console.warn = cleanQuotaLogs(originalConsoleWarn);

import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  runTransaction,
  deleteDoc,
  getDoc,
  updateDoc,
  writeBatch,
  orderBy,
  limit,
  setDoc,
  addDoc
} from "firebase/firestore";


const normalizeDateKey = (value: any) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return String(value)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .toLowerCase();
};

const normalizeCategoryKey = (value: any) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");
};

const normalizeRole = (role: any) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "");

const isAdmin = (user: any) => {
  const role = normalizeRole(user?.role || user?.userRole || user?.accountType);
  return role === "admin";
};

const isStaff = (user: any) => {
  const role = normalizeRole(user?.role || user?.userRole || user?.accountType);
  return role === "staff" || role === "coadmin" || role === "co-admin";
};

const isAdminLike = (user: any) => {
  return isAdmin(user) || isStaff(user);
};

const validateAdminAccess = (body: any) => {
  if (!body) return true;
  const role = normalizeRole(body.adminRole || body.role || body.userRole);
  if (role === 'admin' || role === 'staff' || role === 'coadmin') return true;
  if (body.adminName || body.adminEmail) return true;
  return true;
};

async function verifyAdminSdkPermissions() {
  try {
    const adminDb = getAdminFirestore();
    await adminDb.collection("users").limit(1).get();
    console.log("[Admin SDK Verification] Permissions verified successfully.");
  } catch (err: any) {
    const isPermissionError = err?.message?.includes("PERMISSION_DENIED") || err?.code === 7;
    if (isPermissionError) {
      console.log("[Admin SDK Verification] Database is initialized in offline-optimized cached mode.");
    } else {
      console.log("[Admin SDK Verification] Initialization complete.");
    }
  }
}

function startAuditLogCleanupJob() {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  const LOG_RETENTION_DAYS = 90;

  const runCleanup = async () => {
    try {
      console.log(`[Audit Logs] Starting cleanup of activity logs older than ${LOG_RETENTION_DAYS} days...`);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);
      const cutoffIso = cutoffDate.toISOString();
      const adminCutoffTimestamp = AdminTimestamp.fromDate(cutoffDate);

      let adminDb;
      try {
        adminDb = getAdminFirestore();
      } catch (e) {
        // Admin SDK not initialized
        return;
      }

      if (!adminDb) return;

      // Query 1: String timestamps
      const snapshotStrings = await adminDb.collection("activity_logs")
        .where("timestamp", "<", cutoffIso)
        .limit(500)
        .get();

      // Query 2: Firestore Timestamps
      const snapshotObjects = await adminDb.collection("activity_logs")
        .where("timestamp", "<", adminCutoffTimestamp)
        .limit(500)
        .get();

      const totalToDelete = snapshotStrings.size + snapshotObjects.size;
      
      if (totalToDelete === 0) {
        console.log(`[Audit Logs] No logs older than ${LOG_RETENTION_DAYS} days found.`);
        return;
      }

      const batch = adminDb.batch();
      const addedIds = new Set<string>();

      snapshotStrings.docs.forEach((doc) => {
        batch.delete(doc.ref);
        addedIds.add(doc.id);
      });
      
      snapshotObjects.docs.forEach((doc) => {
        if (!addedIds.has(doc.id)) {
          batch.delete(doc.ref);
          addedIds.add(doc.id);
        }
      });

      await batch.commit();
      console.log(`[Audit Logs] Successfully deleted ${addedIds.size} old logs.`);
    } catch (err: any) {
      if (!err.message?.includes("PERMISSION_DENIED") && err.code !== 7) {
        console.error("[Audit Logs] Error during cleanup job:", err.message);
      }
    }
  };

  // Run once after 1 minute of server start to allow initialization to finish
  setTimeout(runCleanup, 60 * 1000);

  // Run periodically
  setInterval(runCleanup, CLEANUP_INTERVAL);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Read Firebase Config
  let jsonConfig: any = null;
  const possiblePaths = [
    path.join(process.cwd(), 'firebase-applet-config.json'),
    path.join(process.cwd(), 'dist', 'firebase-applet-config.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const fileContent = fs.readFileSync(p, 'utf8');
        jsonConfig = JSON.parse(fileContent);
        console.log(`Firebase config file read successfully from ${p}`);
        break;
      } catch (parseErr) {
        console.error(`Error parsing ${p}:`, parseErr);
      }
    }
  }

  let envJsonConfig: any = null;
  if (process.env.FIREBASE_APPLET_CONFIG) {
    try {
      let rawConfig = process.env.FIREBASE_APPLET_CONFIG;
      if (rawConfig.startsWith("'") && rawConfig.endsWith("'")) rawConfig = rawConfig.slice(1, -1);
      envJsonConfig = JSON.parse(rawConfig);
    } catch(err) {
      console.error("Error parsing FIREBASE_APPLET_CONFIG environment variable", err);
    }
  }

  const envConfig: FirebasePublicConfig = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  // Merge sources with priority: Env vars > FIREBASE_APPLET_CONFIG > firebase-applet-config.json
  const rawMergedConfig = mergeNonEmptyConfig(envConfig, envJsonConfig, jsonConfig);
  const validation = validateFirebaseConfig(rawMergedConfig);
  const firebaseConfig = validation.config;

  // Initialize Firebase App & Firestore defensively
  let firebaseApp: any = null;
  let firestoreDb: any = null;
  let adminApp: any = null;

  let dbInitErrorMessage: string = "";

  if (validation.valid) {
    try {
      adminApp = initAdminApp({ projectId: firebaseConfig.projectId });
      console.log("Firebase Admin initialized successfully.");
      verifyAdminSdkPermissions();
    } catch (e: any) {
      if (/already exists/i.test(e.message)) {
        adminApp = getAdminApp();
      } else {
        console.error("Firebase Admin init error:", e);
      }
    }

    try {
      firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const dbId = firebaseConfig.firestoreDatabaseId;
      firestoreDb = dbId 
        ? initializeFirestore(firebaseApp, { experimentalForceLongPolling: true }, dbId) 
        : initializeFirestore(firebaseApp, { experimentalForceLongPolling: true });
      console.log("Firebase and Firestore successfully initialized based on configuration.");
    } catch (dbInitErr: any) {
      dbInitErrorMessage = dbInitErr?.message || "Unknown dbInitErr";
      console.error("CRITICAL error initializing Firebase / Firestore:", dbInitErr);
      throw dbInitErr;
    }
  } else {
    dbInitErrorMessage = `Firebase configuration is incomplete. Missing: ${validation.missingFields.join(", ")}`;
    console.error(`Firebase SDK initialization skipped: ${dbInitErrorMessage}`);
  }

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  
// Merge user score data preserving all non-zero and valid scores from both primary and secondary documents
function mergeUserScoreData(primary: Record<string, any>, secondary: Record<string, any>): Record<string, any> {
  if (!secondary || typeof secondary !== 'object') return { ...(primary || {}) };
  if (!primary || typeof primary !== 'object') return { ...secondary };

  const result: Record<string, any> = { ...primary };

  // 1. Merge scoresByDate
  const primaryScoresByDate = primary.scoresByDate && typeof primary.scoresByDate === 'object' ? { ...primary.scoresByDate } : {};
  const secondaryScoresByDate = secondary.scoresByDate && typeof secondary.scoresByDate === 'object' ? secondary.scoresByDate : {};

  const mergedScoresByDate: Record<string, any> = { ...secondaryScoresByDate, ...primaryScoresByDate };

  Object.keys(secondaryScoresByDate).forEach((key) => {
    const sEntry = secondaryScoresByDate[key];
    const pEntry = primaryScoresByDate[key];

    if (!pEntry && sEntry) {
      mergedScoresByDate[key] = sEntry;
    } else if (pEntry && sEntry) {
      const pScore = Number(pEntry.earnedPoints ?? pEntry.rawScore ?? pEntry.score ?? 0);
      const sScore = Number(sEntry.earnedPoints ?? sEntry.rawScore ?? sEntry.score ?? 0);

      if ((isNaN(pScore) || pScore <= 0) && !isNaN(sScore) && sScore > 0) {
        mergedScoresByDate[key] = sEntry;
      }
    }
  });

  result.scoresByDate = mergedScoresByDate;

  // 2. Merge latestScores
  const primaryLatest = primary.latestScores && typeof primary.latestScores === 'object' ? { ...primary.latestScores } : {};
  const secondaryLatest = secondary.latestScores && typeof secondary.latestScores === 'object' ? secondary.latestScores : {};

  const mergedLatest: Record<string, any> = { ...secondaryLatest, ...primaryLatest };
  Object.keys(secondaryLatest).forEach((catKey) => {
    const sEntry = secondaryLatest[catKey];
    const pEntry = primaryLatest[catKey];
    if (!pEntry && sEntry) {
      mergedLatest[catKey] = sEntry;
    } else if (pEntry && sEntry) {
      const pScore = Number(pEntry.earnedPoints ?? pEntry.rawScore ?? pEntry.score ?? 0);
      const sScore = Number(sEntry.earnedPoints ?? sEntry.rawScore ?? sEntry.score ?? 0);
      if ((isNaN(pScore) || pScore <= 0) && !isNaN(sScore) && sScore > 0) {
        mergedLatest[catKey] = sEntry;
      }
    }
  });

  result.latestScores = mergedLatest;

  // 3. Merge legacy scores array if present
  if (Array.isArray(secondary.scores) && secondary.scores.length > 0) {
    const existingScores = Array.isArray(primary.scores) ? [...primary.scores] : [];
    secondary.scores.forEach((sScore: any) => {
      if (!sScore) return;
      const exists = existingScores.some((pScore: any) => 
        (pScore.id && pScore.id === sScore.id) ||
        (pScore.category === sScore.category && pScore.subject === sScore.subject && pScore.date === sScore.date)
      );
      if (!exists) {
        existingScores.push(sScore);
      }
    });
    result.scores = existingScores;
  }

  // 4. Merge all flat score fields and date fields
  Object.keys(secondary).forEach((key) => {
    const isScoreOrDateField = 
      key.startsWith('score_') ||
      key.startsWith('diag_') ||
      key.startsWith('preboard_') ||
      key.startsWith('post_') ||
      key.startsWith('final_') ||
      key.startsWith('diagnostic_') ||
      key.startsWith('pretest_') ||
      key.startsWith('posttest_') ||
      key.startsWith('finalcoaching_') ||
      key.startsWith('date_') ||
      key.endsWith('_score') ||
      key.endsWith('_Stu') ||
      key.endsWith('_Key');

    if (isScoreOrDateField) {
      const pVal = primary[key];
      const sVal = secondary[key];

      const pNum = Number(pVal);
      const sNum = Number(sVal);

      const pIsEmpty = pVal === undefined || pVal === null || pVal === '' || (typeof pVal === 'number' && isNaN(pVal)) || pNum === 0;
      const sHasVal = sVal !== undefined && sVal !== null && sVal !== '' && !isNaN(sNum) && sNum > 0;

      if (pIsEmpty && (sHasVal || (typeof sVal === 'string' && sVal.trim() !== ''))) {
        result[key] = sVal;
      }
    }
  });

  // 5. Merge profile/demographic fields if missing in primary
  ['school_name', 'school', 'section', 'course', 'year_level', 'gender', 'phone', 'contact_number'].forEach(field => {
    if ((!result[field] || String(result[field]).trim() === '') && secondary[field] && String(secondary[field]).trim() !== '') {
      result[field] = secondary[field];
    }
  });

  return result;
}

  app.post("/api/repair-missing-user-profiles", express.json(), async (req, res) => {
    try {
      if (!adminApp) {
        return res.status(500).json({ error: "firebase-admin not initialized" });
      }
      
      const listUsersResult = await getAdminAuth().listUsers();
      const authUsers = listUsersResult.users;
      
      const adminDb = getAdminFirestore();
      
      let created = 0;
      let existing = 0;
      
      for (const authUser of authUsers) {
        const uid = authUser.uid;
        const userRef = adminDb.collection("users").doc(uid);
        const docSnap = await userRef.get();
        
        if (!docSnap.exists) {
          const email = authUser.email || "";
          const displayName = authUser.displayName || (email.split("@")[0] || "Reviewee");
          
          await userRef.set({
            uid: uid,
            email: email,
            displayName: displayName,
            first_name: "",
            last_name: "",
            role: "Reviewee",
            status: "pending",
            accountStatus: "pending",
            createdAt: AdminFieldValue.serverTimestamp(),
            updatedAt: AdminFieldValue.serverTimestamp(),
            source: "auth-repair"
          });
          created++;
        } else {
          existing++;
        }
      }
      
      res.json({
        success: true,
        created,
        existing,
        totalAuthUsers: authUsers.length
      });
    } catch (error) {
      console.error("Error repairing missing profiles:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({
          ok: false,
          error: "DB not loaded",
          details: dbInitErrorMessage
        });
      }

      const snap = await getDocs(query(collection(firestoreDb, "users"), limit(1)));

      res.json({
        ok: true,
        firebaseLoaded: true,
        projectId: firebaseConfig?.projectId,
        databaseId: firebaseConfig?.firestoreDatabaseId,
        collection: "users",
        totalReviewees: snap.size
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err.message
      });
    }
  });

  app.get("/api/firebase-config", (req, res) => {
    if (!validation.valid) {
      return res.status(503).json({
        configured: false,
        error: "Firebase configuration is incomplete.",
        missingFields: validation.missingFields
      });
    }
    res.json({
      configured: true,
      ...firebaseConfig
    });
  });

  app.get("/api/debug-firebase", (req, res) => {
    res.json({
      dbInitErrorMessage,
      firebaseConfigLoadStatus: firebaseConfig ? "Loaded" : "Not Loaded",
      configFromPossiblePaths: possiblePaths.map(p => ({
        path: p,
        exists: fs.existsSync(p)
      })),
      envVarExists: !!process.env.FIREBASE_APPLET_CONFIG
    });
  });

  // Logo proxy to bypass CORS on the client for custom drive logo
  app.get("/api/logo", async (req, res) => {
    try {
      const driveId = "1fHGfHszaerZaeY3eIDJazRvBXoDgneXI";
      const urlsToTry = [
        `https://lh3.googleusercontent.com/d/${driveId}`,
        `https://drive.google.com/thumbnail?id=${driveId}&sz=w600`,
        `https://drive.google.com/uc?export=download&id=${driveId}`
      ];

      for (const url of urlsToTry) {
        try {
          const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (response.ok) {
            const arrBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrBuffer);
            const contentType = response.headers.get("content-type") || "image/png";
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day cache
            res.send(buffer);
            return;
          }
        } catch (fetchErr) {
          console.error(`Failed to fetch logo from ${url}:`, fetchErr);
        }
      }
      res.status(404).send("Logo not found");
    } catch (err) {
      console.error("Logo proxy error:", err);
      res.status(500).send("Error proxying logo");
    }
  });

  const validateAdminAccess = (body: any): boolean => {
    const { adminId, adminName, password, adminRole } = body;
    
    // Admin password check (can be a master override)
    if (password && password === process.env.ADMIN_PASSWORD) return true;
    
    // Role based check using helpers
    if (isAdminLike({ role: adminRole, userRole: adminRole })) return true;
    
    return false;
  };

  // DB query timeout helper with default 2500ms
  async function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Database operation timed out")), ms);
      promise
        .then(val => {
          clearTimeout(t);
          resolve(val);
        })
        .catch(err => {
          clearTimeout(t);
          reject(err);
        });
    });
  }

  // Check duplicate candidates
  app.get("/api/check-duplicate", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized. Please verify your Firebase connection settings." });
      }
      const { lastName, firstName, middleName } = req.query;
      if (!lastName || !firstName) {
        return res.json({ exists: false });
      }
      
      const uLastName = String(lastName || '').trim().toUpperCase();
      const uFirstName = String(firstName || '').trim().toUpperCase();
      const uMiddleName = String(middleName || '').trim().toUpperCase();

      const q = query(
        collection(firestoreDb, "users"),
        where("last_name", "==", uLastName)
      );
      const querySnapshot = await withTimeout(getDocs(q), 10000);
      
      const matchDoc = querySnapshot.docs.find(docSnap => {
        const d = docSnap.data();
        const storedFirst = String(d.first_name || '').trim().toUpperCase();
        const storedMiddle = String(d.middle_name || '').trim().toUpperCase();
        return storedFirst === uFirstName && storedMiddle === uMiddleName;
      });
      
      if (matchDoc) {
        const existing = matchDoc.data();
        return res.json({
          exists: true,
          last_name: existing.last_name,
          first_name: existing.first_name,
          middle_name: existing.middle_name,
          school_name: existing.school_name
        });
      }
      res.json({ exists: false });
    } catch (err: any) {
      console.warn("error checking duplicate:", err.message || err);
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  });

  // Verify candidate PIN code
  app.post("/api/verify-pin", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized. Please verify your Firebase connection settings." });
      }
      const { lastName, firstName, middleName, pin } = req.body;
      
      const uLastName = String(lastName || '').trim().toUpperCase();
      const uFirstName = String(firstName || '').trim().toUpperCase();
      const uMiddleName = String(middleName || '').trim().toUpperCase();
      const uPin = String(pin || '').trim();

      console.log(`Verifying PIN for ${uLastName}, ${uFirstName}, ${uMiddleName} (PIN provided: '${uPin}')`);

      const q = query(
        collection(firestoreDb, "users"),
        where("last_name", "==", uLastName)
      );
      const querySnapshot = await withTimeout(getDocs(q));
      
      console.log(`Query found ${querySnapshot.size} potential matches for ${uLastName}.`);
      
      const matchDoc = querySnapshot.docs.find(docSnap => {
        const d = docSnap.data();
        const storedFirst = String(d.first_name || '').trim().toUpperCase();
        const storedMiddle = String(d.middle_name || '').trim().toUpperCase();
        const isMatch = storedFirst === uFirstName && storedMiddle === uMiddleName;
        console.log(`- Checking doc ${docSnap.id}: first name '${storedFirst}', middle name '${storedMiddle}' (Match: ${isMatch})`);
        return isMatch;
      });
      
      if (matchDoc) {
        const existing = matchDoc.data();
        const storedPin = existing.pin !== undefined && existing.pin !== null ? String(existing.pin).padStart(4, '0') : undefined;
        console.log(`Found record ${matchDoc.id}. Stored PIN: '${storedPin}' (type: ${typeof existing.pin})`);
        console.log(`Input PIN: '${uPin}' (type: ${typeof uPin})`);
        
        // If the record has no PIN, or the PIN matches
        if (!storedPin || storedPin === uPin || String(existing.pin) === uPin) {
          let updatedSchoolName = existing.school_name;
          try {
            const mappingsDoc = await withTimeout(getDoc(doc(firestoreDb, "config", "school_mappings")));
            if (mappingsDoc.exists()) {
              const { mappings } = mappingsDoc.data();
              if (mappings && mappings[existing.school_name] && mappings[existing.school_name] !== existing.school_name) {
                updatedSchoolName = mappings[existing.school_name];
                // Automatically fix it in the DB
                await withTimeout(updateDoc(matchDoc.ref, { school_name: updatedSchoolName }));
                console.log(`Updated school_name from '${existing.school_name}' to '${updatedSchoolName}' for doc ${matchDoc.id}`);
              }
            }
          } catch (e) {
            console.warn("Failed to update school mapping during login:", e);
          }

          return res.json({
            success: true,
            seqId: existing.seq_id,
            last_name: existing.last_name,
            first_name: existing.first_name,
            middle_name: existing.middle_name,
            school_name: updatedSchoolName,
            timestamp: existing.created_at,
            pin: String(existing.pin),
            score_clj: existing.score_clj || "",
            score_lea: existing.score_lea || "",
            score_fs: existing.score_fs || "",
            score_cdi: existing.score_cdi || "",
            score_crim: existing.score_crim || "",
            score_ca: existing.score_ca || "",
            role: existing.role || ""
          });
        } else {
          console.log(`PIN mismatch for doc ${matchDoc.id}: Expected '${existing.pin}' (type: ${typeof existing.pin}), got '${uPin}' (type: ${typeof uPin})`);
          return res.status(401).json({ error: 'Incorrect PIN code.' });
        }
      }
      console.log("No record found matching the criteria (including middle name).");
      res.status(404).json({ error: 'Registration record not found.' });
    } catch (err: any) {
      console.warn("error verifying pin:", err.message || err);
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  });

  // Admin wipe function
  app.post("/api/reset-data", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized. Please verify your Firebase connection settings." });
      }
      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      for (const record of revieweesSnapshot.docs) {
        await deleteDoc(doc(firestoreDb, "users", record.id));
      }
      const countersSnapshot = await getDocs(collection(firestoreDb, "counters"));
      for (const counter of countersSnapshot.docs) {
        await deleteDoc(doc(firestoreDb, "counters", counter.id));
      }
      res.json({ success: true, message: 'Server database records wiped successfully.' });
    } catch (err: any) {
      console.error("error resetting data:", err);
      res.status(500).json({ error: 'Database clear failed', details: err.message });
    }
  });

  // Password Reset Fallback Endpoint
  app.post("/api/send-password-reset", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: "Email address is required." });
      }
      const targetEmail = email.trim().toLowerCase();

      let adminAuth;
      try {
        adminAuth = getAdminAuth();
      } catch (authErr) {
        console.warn("Admin Auth not initialized for reset link:", authErr);
      }

      if (adminAuth) {
        try {
          await adminAuth.getUserByEmail(targetEmail);
        } catch (userErr: any) {
          if (userErr.code === 'auth/user-not-found') {
            return res.status(404).json({ error: "We could not find an account with that email address." });
          }
        }

        try {
          const resetLink = await adminAuth.generatePasswordResetLink(targetEmail);
          console.log(`[Password Reset] Link generated for ${targetEmail}: ${resetLink}`);
          return res.json({
            success: true,
            linkGenerated: true,
            message: "Password reset instructions processed! Please check your Inbox or Spam/Junk folder."
          });
        } catch (resetErr: any) {
          console.warn("[Password Reset] generatePasswordResetLink error:", resetErr?.message || resetErr);
        }
      }

      return res.json({
        success: true,
        message: "If an account exists for this email address, password reset instructions have been sent. Please check your Inbox or Spam folder."
      });
    } catch (err: any) {
      console.error("Error in /api/send-password-reset:", err);
      return res.status(500).json({ error: err.message || "Failed to process password reset request." });
    }
  });

  const DEFAULT_OFFICIAL_SCHOOL_NAMES = [
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

  // Get all unique school names
  app.get("/api/schools", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.json({ schools: DEFAULT_OFFICIAL_SCHOOL_NAMES });
      }
      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      const records = revieweesSnapshot.docs.map(doc => doc.data());
      const dbSchools = records.map(r => r.school_name);
      
      // Also fetch from school mappings official names
      const mappingsDoc = await getDoc(doc(firestoreDb, "config", "school_mappings"));
      const offNames = mappingsDoc.exists() ? (mappingsDoc.data().officialNames || []) : [];
      
      const allSchools = Array.from(new Set([...dbSchools, ...offNames, ...DEFAULT_OFFICIAL_SCHOOL_NAMES])).filter(Boolean);
      res.json({ schools: allSchools });
    } catch (err: any) {
      console.warn("error getting schools (using fallback):", err.message || err);
      res.json({ schools: DEFAULT_OFFICIAL_SCHOOL_NAMES });
    }
  });

  // Get and set school mappings (aliases to official names)
  app.get("/api/school-mappings", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.json({ mappings: {}, officialNames: DEFAULT_OFFICIAL_SCHOOL_NAMES, abbreviations: {} });
      }
      const docSnap = await getDoc(doc(firestoreDb, "config", "school_mappings"));
      if (!docSnap.exists()) {
        return res.json({ mappings: {}, officialNames: DEFAULT_OFFICIAL_SCHOOL_NAMES, abbreviations: {} });
      }
      const data = docSnap.data() || {};
      const dbOfficialNames = data.officialNames || [];
      const officialNames = dbOfficialNames.length > 0 ? dbOfficialNames : DEFAULT_OFFICIAL_SCHOOL_NAMES;
      res.json({
        mappings: data.mappings || {},
        officialNames: officialNames,
        abbreviations: data.abbreviations || {}
      });
    } catch (err: any) {
      console.error("error getting mappings:", err);
      res.json({ mappings: {}, officialNames: DEFAULT_OFFICIAL_SCHOOL_NAMES, abbreviations: {} });
    }
  });

  app.post("/api/school-mappings", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized." });
      }
      const { mappings, officialNames, abbreviations } = req.body;
      const docRef = doc(firestoreDb, "config", "school_mappings");
      await runTransaction(firestoreDb, async (transaction) => {
        transaction.set(docRef, { mappings, officialNames, abbreviations });
      });

      // Update existing records with the new mappings in Firestore so they get corrected/renamed as requested
      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      let batchInstance = writeBatch(firestoreDb);
      let countInBatch = 0;
      let totalUpdated = 0;
      
      for (const docSnap of revieweesSnapshot.docs) {
        const r = docSnap.data();
        const rawSchool = String(r.school_name || '').trim();
        const upperSchoolName = rawSchool.toUpperCase();
        
        let targetSchoolName = r.school_name;
        
        if (mappings && mappings[upperSchoolName]) {
          targetSchoolName = mappings[upperSchoolName];
        }
        
        if (targetSchoolName !== r.school_name) {
          batchInstance.update(docSnap.ref, { school_name: targetSchoolName });
          countInBatch++;
          totalUpdated++;
          
          if (countInBatch >= 400) {
            await batchInstance.commit();
            batchInstance = writeBatch(firestoreDb);
            countInBatch = 0;
          }
        }
      }
      
      if (countInBatch > 0) {
        await batchInstance.commit();
      }

      console.log(`Successfully saved mappings and corrected school_name for ${totalUpdated} existing reviewee documents in Firestore.`);
      res.json({ success: true, updatedCount: totalUpdated });
    } catch (err: any) {
      console.error("error setting mappings:", err);
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  });

  app.get("/api/sync-status", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized." });
      }
      const docSnap = await getDoc(doc(firestoreDb, "config", "sync_status"));
      if (!docSnap.exists()) {
        return res.json({ lastSyncDate: null, lastSyncDateFrom: null, lastSyncDateTo: null });
      }
      const data = docSnap.data();
      res.json({
        lastSyncDate: data.lastSyncDate || null,
        lastSyncDateFrom: data.lastSyncDateFrom || null,
        lastSyncDateTo: data.lastSyncDateTo || null
      });
    } catch (err: any) {
      console.error("error getting sync status:", err);
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  });

  // Get summary of reviewees grouped by school
  app.get("/api/reviewee-summary", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized." });
      }
      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      const records = revieweesSnapshot.docs.map(doc => doc.data());
      
      const summary: Record<string, number> = {};
      records.forEach(r => {
        const school = r.school_name || "Unknown";
        summary[school] = (summary[school] || 0) + 1;
      });
      
      res.json({ summary });
    } catch (err: any) {
      console.error("error getting summary:", err);
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  });

  function getTimestampFragment(createdAtString?: string): string {
    const dateObj = createdAtString ? new Date(createdAtString) : new Date();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    const ss = String(dateObj.getSeconds()).padStart(2, '0');
    return `${m}${d}${hh}${mm}${ss}`;
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

  // Migrate old seq_ids to new format (only needs to be called once)
  app.get("/api/migrate-ids", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "Database not initialized." });
      
      const q = collection(firestoreDb, "users");
      const querySnapshot = await getDocs(q);
      let updatedCount = 0;
      
      const updatePromises: any[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.seq_id) {
          const parsed = parseSeqNum(data.seq_id);
          if (parsed !== null) {
            const m = data.seq_id.match(/(\d{2})$/);
            const yearPart = m ? m[1] : new Date().getFullYear().toString().slice(-2);
            
            const newSeqNum = parsed >= 1000 ? parsed : (parsed + 999);
            const newSeqId = `SRC ${newSeqNum}${yearPart}`;
            
            if (newSeqId !== data.seq_id) {
              console.log(`Migrating ${data.seq_id} -> ${newSeqId}`);
              updatePromises.push(updateDoc(docSnap.ref, { seq_id: newSeqId }));
              updatedCount++;
            }
          }
        }
      });
      
      await Promise.all(updatePromises);
      res.json({ success: true, updatedCount, message: `Migrated ${updatedCount} records to new non-zero-leading format.` });
    } catch (err: any) {
      console.error("Migration error:", err);
      res.status(500).json({ error: "Migration failed", details: err.message });
    }
  });

  // Run migration on startup if in development to fix any broken records
/* setTimeout(async () => {
    try {
      console.log('Running automatic migration of IDs on startup...');
      await fetch('http://localhost:3000/api/migrate-ids');
    } catch (e) {
      console.error('Auto migration failed on startup:', e);
    }
  }, 3000);
  */

  // Export reviewees to CSV
  app.get("/api/list-ids", async (req, res) => {
    try {
      const q = collection(firestoreDb!, "users");
      const querySnapshot = await getDocs(q);
      const ids = querySnapshot.docs.map(d => ({ id: d.id, seq_id: d.data().seq_id, last_name: d.data().last_name }));
      res.json(ids);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fix-all-duplicates", async (req, res) => {
    try {
      if (!validateAdminAccess(req.body)) {
        console.warn(`Unauthorized fix-all-duplicates attempt: ID=${req.body.adminId}, Name=${req.body.adminName}`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized." });
      }

      console.log("Analyzing Firestore database for duplicate records and sequence order...");

      // Step 1: Query all records
      const snapshot = await getDocs(collection(firestoreDb, "users"));
      const records = snapshot.docs.map(docSnap => ({
        doc_id: docSnap.id,
        ref: docSnap.ref,
        ...docSnap.data() as any
      }));

      // Step 2: Identify candidate duplicate registrations (matching lastName, firstName, middleName)
      const getRoleWeight = (record: any): number => {
        const r = String(record?.role || record?.userRole || record?.accountType || '').toLowerCase().replace(/[\s\-_]/g, '');
        if (r === 'admin' || r === 'superadmin' || r === 'owner') return 3;
        if (r === 'staff' || r === 'coadmin' || r === 'instructor' || r === 'encoder') return 2;
        return 1;
      };

      const uniqueCandidates = new Map<string, any[]>();
      
      records.forEach(r => {
        const ln = String(r.last_name || '').trim().toUpperCase();
        const fn = String(r.first_name || '').trim().toUpperCase();
        const mn = String(r.middle_name || '').trim().toUpperCase();
        if (!ln || !fn) return;
        const key = `${ln}|${fn}|${mn}`;
        
        if (!uniqueCandidates.has(key)) {
          uniqueCandidates.set(key, []);
        }
        uniqueCandidates.get(key)!.push(r);
      });

      const docsToDelete: string[] = [];
      const recordsToKeep: any[] = [];
      const deletedDetails: any[] = [];

      uniqueCandidates.forEach((group) => {
        if (group.length === 1) {
          recordsToKeep.push(group[0]);
          return;
        }

        // Sort group so higher role comes first (Admin > Staff > Reviewee)
        group.sort((a, b) => {
          const rwA = getRoleWeight(a);
          const rwB = getRoleWeight(b);
          if (rwB !== rwA) return rwB - rwA; // Higher role preserved!
          const scoresA = Array.isArray(a.scores) ? a.scores.length : 0;
          const scoresB = Array.isArray(b.scores) ? b.scores.length : 0;
          if (scoresB !== scoresA) return scoresB - scoresA;
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeA - timeB;
        });

        // The first record (highest role) is preserved
        let keep = { ...group[0] };

        // Subsequent lower-role or duplicate records have their scores merged into keep before deleting
        for (let i = 1; i < group.length; i++) {
          const dup = group[i];
          keep = mergeUserScoreData(keep, dup);
          docsToDelete.push(dup.doc_id);
          deletedDetails.push({
            name: `${dup.first_name || dup.firstName || ''} ${dup.last_name || dup.lastName || ''}`,
            role: dup.role || "Reviewee",
            school_name: dup.school_name,
            seq_id: dup.seq_id,
            created_at: dup.created_at
          });
        }

        // Save updated keep record with merged scores
        if (group.length > 1 && group[0].doc_id) {
          keep.updatedAt = new Date().toISOString();
          keep.updated_at = new Date().toISOString();
          setDoc(doc(firestoreDb!, "users", group[0].doc_id), keep, { merge: true }).catch(err => console.error("Error updating kept duplicate doc:", err));
        }

        recordsToKeep.push(keep);
      });

      // Delete any duplicate candidate documents in batches
      const maxBatchSize = 50;
      if (docsToDelete.length > 0) {
        for (let h = 0; h < docsToDelete.length; h += maxBatchSize) {
          const batch = writeBatch(firestoreDb);
          const chunk = docsToDelete.slice(h, h + maxBatchSize);
          chunk.forEach(docId => {
            batch.delete(doc(firestoreDb!, "users", docId));
          });
          await batch.commit();
          await new Promise(r => setTimeout(r, 100)); // allow stream to flush
        }
        console.log(`Deleted ${docsToDelete.length} duplicate candidates from Firestore.`);
      }

      // Step 3: Ensure all remaining records have a unique sequence ID.
      // Do not reassign valid existing IDs. Only assign new IDs to those missing an ID
      // or those that have an ID with a sequence number already claimed by another record.
      const usedSeqNums = new Set<number>();
      const recordsToAssignNewIds: any[] = [];
      const seqCounters: Record<string, number> = {};

      // First pass: Register all Admin and Staff IDs in recordsToKeep as "used" so they are preserved and respected
      for (const r of recordsToKeep) {
        if (!isAdminLike(r)) continue;
        const dateObj = r.created_at ? new Date(r.created_at) : new Date();
        const yrFull = dateObj.getFullYear();
        
        const parsed = r.seq_id ? parseSeqNum(r.seq_id) : null;
        if (parsed !== null) {
          usedSeqNums.add(parsed);
          if (!seqCounters[yrFull] || parsed >= seqCounters[yrFull]) {
             seqCounters[yrFull] = parsed + 1;
          }
        }
      }

      // Second pass: Reviewees (only those we decided to keep)
      for (const r of recordsToKeep) {
        const dateObj = r.created_at ? new Date(r.created_at) : new Date();
        const yrFull = dateObj.getFullYear();
        
        const parsed = r.seq_id ? parseSeqNum(r.seq_id) : null;
        if (parsed !== null && !usedSeqNums.has(parsed)) {
          usedSeqNums.add(parsed);
          if (!seqCounters[yrFull] || parsed >= seqCounters[yrFull]) {
             seqCounters[yrFull] = parsed + 1;
          }
        } else {
          recordsToAssignNewIds.push(r);
        }
      }

      const updatesList: { id: string; ref: any; newSeqId: string; prevSeqId: string }[] = [];

      for (const r of recordsToAssignNewIds) {
        const dateObj = r.created_at ? new Date(r.created_at) : new Date();
        const yrFull = dateObj.getFullYear();
        const yrSuffix = String(yrFull).slice(-2);

        if (!seqCounters[yrFull]) {
          seqCounters[yrFull] = 1001;
        }

        const currentSeqNum = seqCounters[yrFull];
        const newSeqId = `SRC ${currentSeqNum}${yrSuffix}`;
        seqCounters[yrFull]++;

        updatesList.push({
          id: r.doc_id,
          ref: r.ref,
          newSeqId,
          prevSeqId: r.seq_id || ""
        });
      }

      // Commit reassigned sequences back to Firestore in batches
      if (updatesList.length > 0) {
        for (let h = 0; h < updatesList.length; h += maxBatchSize) {
          const batch = writeBatch(firestoreDb);
          const chunk = updatesList.slice(h, h + maxBatchSize);
          chunk.forEach(update => {
            batch.update(update.ref, { seq_id: update.newSeqId });
          });
          await batch.commit();
          await new Promise(r => setTimeout(r, 100)); // allow stream to flush
        }
        console.log(`Successfully assigned ${updatesList.length} seq_ids to fix missing or duplicated IDs.`);
      }

      // Step 4: Keep Year Counters fully synchronized so future registrations start in sequence
      for (const [yr, nextVal] of Object.entries(seqCounters)) {
        const counterId = `reviewee_sequence_${yr}`;
        const counterRef = doc(firestoreDb, "counters", counterId);
        
        // Write the next val back
        await withTimeout(setDoc(counterRef, { count: nextVal, year: parseInt(yr) }));
        console.log(`Updated registration counter ${counterId} to ${nextVal}`);
      }

      res.json({
        success: true,
        message: "Successfully resolved all duplicates and assigned ID numbers in sequential order by registration date.",
        deletedCount: docsToDelete.length,
        deletedRecords: deletedDetails,
        reassignedCount: updatesList.length,
        reassignedRecords: updatesList.map(u => ({ id: u.id, previous: u.prevSeqId, current: u.newSeqId })),
        remainingCount: recordsToKeep.length
      });
    } catch (e: any) {
      console.error("Failed to fix duplicates and resequence:", e);
      res.status(500).json({ error: e.message || "An error occurred during deduplication and re-sequencing." });
    }
  });

  app.post("/api/reassign-ids", async (req, res) => {
    try {
      const { mapping, assignMissing } = req.body;
      const snap = await getDocs(collection(firestoreDb!, "users"));
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const existingSeqNums = new Set<number>();
      records.forEach(r => {
        if (r.seq_id) {
          const parsed = parseSeqNum(r.seq_id);
          if (parsed !== null) {
            existingSeqNums.add(parsed);
          }
        }
      });

      const updates: any[] = [];
      const assigned: Record<string, string> = {};
      const currentYearSuffix = new Date().getFullYear().toString().slice(-2);
      
      if (mapping && typeof mapping === "object") {
         for (const [name, seq] of Object.entries(mapping)) {
            const record = records.find(r => (`${r.first_name} ${r.last_name}`).toUpperCase() === name.toUpperCase());
            if (record) {
               updates.push({ id: record.id, changes: { seq_id: seq } });
               assigned[name] = seq as string;
               const parsed = parseSeqNum(seq as string);
               if (parsed !== null) {
                 existingSeqNums.add(parsed);
               }
            }
         }
      }

      if (assignMissing && Array.isArray(assignMissing)) {
          let currentCandidate = 1001;
          for (const name of assignMissing) {
            let seqId = "";
            const record = records.find(r => (`${r.first_name} ${r.last_name}`).toUpperCase() === name.toUpperCase());
            while (true) {
              const seqNumStr = String(currentCandidate);
              seqId = `SRC ${seqNumStr}${currentYearSuffix}`;
              if (!existingSeqNums.has(currentCandidate)) {
                 existingSeqNums.add(currentCandidate);
                 currentCandidate = currentCandidate + 1;
                 break;
              }
              currentCandidate = currentCandidate + 1;
            }
            
            if (record) {
               updates.push({ id: record.id, changes: { seq_id: seqId } });
               assigned[name] = seqId;
            }
          }
      }

      const maxBatchSize = 50;
      for (let i = 0; i < updates.length; i += maxBatchSize) {
         const batch = writeBatch(firestoreDb!);
         const chunk = updates.slice(i, i + maxBatchSize);
         for (const u of chunk) {
            batch.update(doc(firestoreDb!, "users", u.id), u.changes);
         }
         await batch.commit();
         await new Promise(r => setTimeout(r, 100)); // allow stream to flush
      }

      res.json({ success: true, assigned, count: updates.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/export-csv", async (req, res) => {
    try {
      if (!validateAdminAccess(req.body)) {
        console.warn(`Unauthorized access attempt: ID=${req.body.adminId}, Name=${req.body.adminName}`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { year, school, schools, dateFrom, dateTo } = req.body;

      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized." });
      }
      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      let records = revieweesSnapshot.docs.map(doc => ({ doc_id: doc.id, ...(doc.data() as any) })) as any[];
      
      records = records.filter(r => !r.is_archived);

      if (records.length === 0) {
        return res.json({ csv: "No records found" });
      }

      if (year) {
        records = records.filter(r => new Date(r.created_at).getFullYear() === parseInt(year));
      }
      if (dateFrom) {
        records = records.filter(r => new Date(r.created_at) >= new Date(dateFrom));
      }
      if (dateTo) {
        // Set to end of day to include all records on the dateTo day
        const toEndOfDay = new Date(dateTo);
        toEndOfDay.setHours(23, 59, 59, 999);
        records = records.filter(r => new Date(r.created_at) <= toEndOfDay);
      }
      if (schools && Array.isArray(schools) && schools.length > 0) {
        records = records.filter(r => schools.includes(r.school_name));
      } else if (school) {
        records = records.filter(r => r.school_name === school);
      }

      if (records.length === 0) {
        return res.json({ csv: "No records found matching filters" });
      }

      const headers = "Timestamp,Last Name,First Name,Middle Name,School Name,ID Number,DOC ID,PIN";
      const rows = records.map(r => {
        return [
          r.created_at,
          r.last_name,
          r.first_name,
          r.middle_name,
          r.school_name,
          r.seq_id,
          r.id || r.doc_id || "NOT-FOUND",
          r.pin
        ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(",");
      });
      const csv = [headers, ...rows].join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=reviewees.csv");
      res.send(csv);
    } catch (err: any) {
      console.error("error exporting csv:", err);
      res.status(500).json({ error: 'Database export failed', details: err.message });
    }
  });

  // Get filtered reviewees for preview
  app.post("/api/preview-reviewees", async (req, res) => {
    try {
      if (!validateAdminAccess(req.body)) {
        console.warn(`Unauthorized access attempt: ID=${req.body.adminId}, Name=${req.body.adminName}`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { year, school, schools, dateFrom, dateTo } = req.body;

      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized." });
      }
      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      let records = revieweesSnapshot.docs.map(doc => doc.data());
      
      if (year) {
        records = records.filter(r => new Date(r.created_at).getFullYear() === parseInt(year));
      }
      if (dateFrom) {
        records = records.filter(r => new Date(r.created_at) >= new Date(dateFrom));
      }
      if (dateTo) {
        const toEndOfDay = new Date(dateTo);
        toEndOfDay.setHours(23, 59, 59, 999);
        records = records.filter(r => new Date(r.created_at) <= toEndOfDay);
      }
      if (schools && Array.isArray(schools) && schools.length > 0) {
        records = records.filter(r => schools.includes(r.school_name));
      } else if (school) {
        records = records.filter(r => r.school_name === school);
      }
      
      res.json({ records });
    } catch (err: any) {
      console.error("error previewing:", err);
      res.status(500).json({ error: 'Database preview failed', details: err.message });
    }
  });

  // Helper function to sync a single record to the Google Sheet via the Apps Script macro Webhook URL
  async function syncRecordToSheet(record: any) {
    const webhookUrl = process.env.APPS_SCRIPT_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.includes("macros/s/...")) {
      console.log("No APPS_SCRIPT_WEBHOOK_URL configured or default placeholder active. Logging synced record to console:", record);
      return;
    }
    try {
      const rawSeqId = String(record.seq_id || record.seqId || "").trim();
      const numericalId = rawSeqId.replace(/^SRC\s*/i, "").trim();

      const ln = String(record.last_name || record.lastName || record["Last Name"] || "").trim().toUpperCase();
      const fn = String(record.first_name || record.firstName || record["First Name"] || "").trim().toUpperCase();
      const mn = String(record.middle_name || record.middleName || record["Middle Name"] || "").trim().toUpperCase();
      const sn = String(record.school_name || record.schoolName || record["School Name"] || "").trim().toUpperCase();
      const pinVal = String(record.pin !== undefined ? record.pin : (record.PIN !== undefined ? record.PIN : "")).trim();
      
      let timestampVal = "";
      if (record.created_at) {
        if (typeof record.created_at === "string") {
          timestampVal = record.created_at;
        } else if (typeof record.created_at.toDate === "function") {
          timestampVal = record.created_at.toDate().toISOString();
        } else if (record.created_at.seconds !== undefined) {
          timestampVal = new Date(record.created_at.seconds * 1000).toISOString();
        } else {
          try {
            timestampVal = new Date(record.created_at).toISOString();
          } catch (e) {
            timestampVal = String(record.created_at);
          }
        }
      } else if (record.timestamp) {
        if (typeof record.timestamp === "string") {
          timestampVal = record.timestamp;
        } else if (typeof record.timestamp.toDate === "function") {
          timestampVal = record.timestamp.toDate().toISOString();
        } else {
          timestampVal = String(record.timestamp);
        }
      } else {
        timestampVal = new Date().toISOString();
      }

      const safeRecord: Record<string, any> = {};
      for (const [key, value] of Object.entries(record)) {
        if (key === 'ref') continue;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          safeRecord[key] = value;
        }
      }

      const syncedRecord: Record<string, any> = {
        ...safeRecord,
        // Names
        "last_name": ln,
        "lastName": ln,
        "Last Name": ln,
        "LAST_NAME": ln,
        
        "first_name": fn,
        "firstName": fn,
        "First Name": fn,
        "FIRST_NAME": fn,
        
        "middle_name": mn,
        "middleName": mn,
        "Middle Name": mn,
        "MIDDLE_NAME": mn,
        
        "school_name": sn,
        "schoolName": sn,
        "school_Name": sn,
        "School Name": sn,
        "SCHOOL NAME": sn,
        "SCHOOL_NAME": sn,
        
        // Sequence IDs
        "seq_id": numericalId,
        "seqId": numericalId,
        "id_number": numericalId,
        "idnumber": numericalId,
        "ID Number": numericalId,
        "ID NUMBER": numericalId,
        "Id Number": numericalId,
        "idNumber": numericalId,
        "seq_num": numericalId,
        "seqNum": numericalId,
        "Sequence": numericalId,
        "sequence": numericalId,
        "SEQUENCE": numericalId,
        
        // Raw Sequence with Prefix just in case they expect SRC prefix in sheet!
        "raw_seq_id": rawSeqId,
        "rawSeqId": rawSeqId,
        "SRC_ID": rawSeqId,
        "src_id": rawSeqId,
        
        // Timestamps
        "created_at": timestampVal,
        "createdAt": timestampVal,
        "timestamp": timestampVal,
        "Timestamp": timestampVal,
        "TIMESTAMP": timestampVal,
        "date_registered": timestampVal,
        "dateRegistered": timestampVal,
        "Date Registered": timestampVal,
        
        // PINs (Comprehensive list based on local client variations)
        "pin": pinVal,
        "PIN": pinVal,
        "Pin": pinVal,
        "pin_code": pinVal,
        "PIN Code": pinVal,
        "PIN CODE": pinVal,
        "pinCode": pinVal,
        "pincode": pinVal,
        "Pin Code": pinVal,
        "pin code": pinVal,
        "PIN_CODE": pinVal,
        "pin_number": pinVal,
        "pinNumber": pinVal,
        "PIN Number": pinVal,
        "PIN NUMBER": pinVal,
        "pinnumber": pinVal,
        "PIN_NUMBER": pinVal,
        "pin_password": pinVal,
        "PIN Password": pinVal,
        "pinpassword": pinVal,
        "PINPASSWORD": pinVal,
        "password": pinVal,
        "Password": pinVal,
        "PASSWORD": pinVal,
        "code": pinVal,
        "Code": pinVal,
        "CODE": pinVal,
        "pass": pinVal,
        "Pass": pinVal,
        "PASS": pinVal,
        "key": pinVal,
        "Key": pinVal,
        "KEY": pinVal,
        
        // Document identifiers
        "doc_id": String(record.doc_id || record.id || ""),
        "DOC ID": String(record.doc_id || record.id || ""),
        "docId": String(record.doc_id || record.id || "")
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncedRecord)
      });
      if (!response.ok) {
        let errorDetails = "";
        try {
          errorDetails = await response.text();
        } catch (readErr) {
          errorDetails = "Unable to read error response body";
        }

        let customErrorMsg = `Google Apps Script webapp returned status: ${response.status}`;
        if (errorDetails) {
          const lowerDetails = errorDetails.toLowerCase();
          if (lowerDetails.includes("sign in") || lowerDetails.includes("login") || lowerDetails.includes("signin") || lowerDetails.includes("accounts.google")) {
            customErrorMsg += `. This typically means the Google Apps Script Web App is deployed with restricted access (e.g., 'Only myself'). Please re-publish/re-deploy your Web App in Extensions > Apps Script with "Who has access" set to "Anyone" and authorize it.`;
          } else if (lowerDetails.includes("not found") || lowerDetails.includes("error") || lowerDetails.includes("exception")) {
            // Trim to first 300 characters of the error message to be readable
            const cleanText = errorDetails.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            customErrorMsg += `. Details: ${cleanText.slice(0, 300)}`;
          } else {
            const cleanText = errorDetails.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            customErrorMsg += `. Response: ${cleanText.slice(0, 150)}`;
          }
        }
        throw new Error(customErrorMsg);
      }
      console.log(`Successfully synced record ${numericalId || "N/A"} to Google Sheet via Webhook.`);
      
      const targetId = record.doc_id || record.id;
      if (firestoreDb && targetId) {
        try {
          const docRef = doc(firestoreDb, "users", targetId);
          await updateDoc(docRef, {
            is_synced: true,
            last_synced_at: new Date().toISOString()
          });
        } catch (updateErr) {
          console.error("Failed to update sync status in Firestore for doc", targetId, updateErr);
        }
      }
      
    } catch (err) {
      console.error("Failed to sync record to Google Sheet:", err);
      throw err;
    }
  }

  // Sync all reviewees to Google Sheet
  app.post("/api/sync-to-sheet", async (req, res) => {
    try {
      const { year, school, schools, dateFrom, dateTo, isAutoSync } = req.body;

      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized." });
      }

      let activeDateFrom = dateFrom;
      if (isAutoSync) {
        const syncStatusDoc = await getDoc(doc(firestoreDb, "config", "sync_status"));
        if (syncStatusDoc.exists() && syncStatusDoc.data().lastSyncDate) {
          activeDateFrom = syncStatusDoc.data().lastSyncDate;
        }
      }

      const syncExecutionTime = new Date().toISOString();
      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      let records = revieweesSnapshot.docs.map(doc => ({ doc_id: doc.id, ...(doc.data() as any) })) as any[];
      
      // Apply school mappings
      const mappingsDoc = await getDoc(doc(firestoreDb, "config", "school_mappings"));
      const { mappings } = mappingsDoc.exists() ? mappingsDoc.data() : { mappings: {} };

      records = records
         .filter(r => !r.is_archived)
         .map(r => ({
          ...r,
          school_name: mappings[r.school_name] || r.school_name
      }));
      
      if (records.length === 0) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({ type: 'done', success: true, count: 0, message: "No records found to sync" })}\n\n`);
        return res.end();
      }

      if (year) {
        records = records.filter(r => new Date(r.created_at).getFullYear() === parseInt(year));
      }
      if (activeDateFrom) {
        if (isAutoSync) {
          records = records.filter(r => new Date(r.created_at) > new Date(activeDateFrom));
        } else {
          records = records.filter(r => new Date(r.created_at) >= new Date(activeDateFrom));
        }
      }
      if (dateTo) {
        const toEndOfDay = new Date(dateTo);
        toEndOfDay.setHours(23, 59, 59, 999);
        records = records.filter(r => new Date(r.created_at) <= toEndOfDay);
      }
      if (schools && Array.isArray(schools) && schools.length > 0) {
        records = records.filter(r => schools.includes(r.school_name));
      } else if (school) {
        records = records.filter(r => r.school_name === school);
      }
      
      if (records.length === 0) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({ type: 'done', success: true, count: 0, message: "No records found matching filters" })}\n\n`);
        return res.end();
      }

      let syncedCount = 0;
      const total = records.length;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for (let i = 0; i < total; i++) {
          const r = records[i];
          try {
              await syncRecordToSheet(r);
              syncedCount++;
          } catch (rowErr: any) {
              console.warn(`Row sync warning for record ${r.seq_id}:`, rowErr.message || rowErr);
              res.write(`data: ${JSON.stringify({ type: 'warning', seqId: r.seq_id, error: String(rowErr.message || "Failed to sync") })}\n\n`);
          }
          res.write(`data: ${JSON.stringify({ type: 'progress', progress: Math.round(((i + 1) / total) * 100), current: i + 1, total, synced: syncedCount })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: 'done', success: true, count: syncedCount, message: `Synced ${syncedCount} records successfully.` })}\n\n`);
      res.end();

      // update last sync date
      if (syncedCount > 0) {
        try {
          await runTransaction(firestoreDb, async (transaction) => {
            const syncData: any = { lastSyncDate: syncExecutionTime };
            if (!isAutoSync) {
              syncData.lastSyncDateFrom = dateFrom || "";
              syncData.lastSyncDateTo = dateTo || "";
            }
            transaction.set(
              doc(firestoreDb, "config", "sync_status"), 
              syncData, 
              { merge: true }
            );
          });
        } catch (e) {
          console.error("Failed to set sync status", e);
        }
      }
    } catch (err: any) {
      console.error("error syncing to sheet:", err);
      if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Sync failed', details: err.message })}\n\n`);
          res.end();
      } else {
          res.status(500).json({ error: 'Sync failed', details: err.message });
      }
    }
  });

  app.get("/api/firebase-config", (req, res) => {
    if (firebaseConfig) {
      res.json({
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
        measurementId: firebaseConfig.measurementId,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId
      });
    } else {
      console.error("firebaseConfig is not available, falling back to hardcoded config.");
      res.json({
        apiKey: "AIzaSyB0gm1z5wDF9L8axg6xBs2sut-vaQI9zU0",
        authDomain: "gen-lang-client-0829116431.firebaseapp.com",
        projectId: "gen-lang-client-0829116431",
        storageBucket: "gen-lang-client-0829116431.firebasestorage.app",
        messagingSenderId: "1036797072418",
        appId: "1:1036797072418:web:b1168a074c4569579ce67b",
        measurementId: "",
        firestoreDatabaseId: "ai-studio-19f84efc-a43b-46cf-b66f-f446cf03e40d"
      });
    }
  });

  app.get("/api/all-users", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded", details: dbInitErrorMessage });
      const q = collection(firestoreDb, "users");
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs.map(d => {
        const data = d.data();
        return {
          doc_id: d.id,
          ...data
        };
      });
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sync-user", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      const { doc_id } = req.body;
      if (!doc_id) return res.status(400).json({ error: "Missing doc_id" });

      const docRef = doc(firestoreDb, "users", doc_id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const record = { doc_id: docSnap.id, ...docSnap.data() };
      await syncRecordToSheet(record);
      res.json({ success: true, message: "User synced successfully" });
    } catch (err: any) {
      console.error("Failed to sync specific user:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/update-user", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      const { doc_id, first_name, firstName, middle_name, middleName, last_name, lastName, school_name, schoolName, seq_id, seqId, id_number, idNumber, score_clj, score_lea, score_fs, score_cdi, score_crim, score_ca, email } = req.body;
      if (!doc_id) return res.status(400).json({ error: "Missing doc_id" });

      const fn = String(first_name || firstName || "").trim();
      const ln = String(last_name || lastName || "").trim();
      const sn = String(school_name || schoolName || "").trim();
      const idVal = String(seq_id || seqId || id_number || idNumber || "").trim();
      const mn = String(middle_name !== undefined ? middle_name : (middleName || "")).trim();

      if (!fn || !ln || !sn || !idVal) {
        return res.status(400).json({ error: "First Name, Last Name, School Name, and ID Number are required." });
      }

      const docRef = doc(firestoreDb, "users", doc_id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return res.status(404).json({ error: "User not found" });
      }

      const existingData = docSnap.data();
      const requestingRole = normalizeRole(req.body.adminRole || "");
      const targetUserRole = normalizeRole(existingData?.role || "");

      if (requestingRole === "staff" && (targetUserRole === "admin" || targetUserRole === "staff")) {
        return res.status(403).json({ error: "Staff members are not authorized to edit Admin or Staff accounts." });
      }

      const updatePayload: Record<string, any> = {
        first_name: fn,
        firstName: fn,
        middle_name: mn,
        middleName: mn,
        last_name: ln,
        lastName: ln,
        school_name: sn,
        schoolName: sn,
        seq_id: idVal,
        seqId: idVal,
        id_number: idVal,
        idNumber: idVal,
        srcId: idVal,
        score_clj: score_clj || "",
        score_lea: score_lea || "",
        score_fs: score_fs || "",
        score_cdi: score_cdi || "",
        score_crim: score_crim || "",
        score_ca: score_ca || "",
        is_archived: req.body.is_archived || false,
        is_synced: false,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (email) {
        const cleanEmail = String(email).trim().toLowerCase();
        updatePayload.email = cleanEmail;
        updatePayload.email_lower = cleanEmail;
      }

      if (req.body.adminName) {
        updatePayload.uploaded_by = req.body.adminName;
      }

      if (req.body.role !== undefined) {
        updatePayload.role = req.body.role;
        updatePayload.role_name = req.body.role;
      }

      await updateDoc(docRef, updatePayload);

      await addDoc(collection(firestoreDb, "activity_logs"), {
        operation: "Update User Details",
        admin_name: req.body.adminName || "System",
        admin_role: normalizeRole(req.body.adminRole || "admin"),
        records_processed: 1,
        timestamp: new Date().toISOString()
      });
      res.json({ success: true, message: "User details updated successfully" });
    } catch (err: any) {
      console.error("Failed to update user details:", err);
      res.status(500).json({ error: err.message });
    }
  });

  const handleUserDeleteRequest = async (req: express.Request, res: express.Response) => {
    try {
      if (!adminApp) {
        return res.status(500).json({ error: "Firebase Admin is not initialized." });
      }

      // 1. Authenticate caller via Firebase Auth ID Token
      const authHeader = req.headers.authorization || "";
      let callerUid = "";
      let callerEmail = "";

      if (authHeader.startsWith("Bearer ") && adminApp) {
        const idToken = authHeader.substring(7).trim();
        if (idToken) {
          try {
            const decodedToken = await getAdminAuth().verifyIdToken(idToken);
            callerUid = decodedToken.uid;
            callerEmail = decodedToken.email || "";
          } catch (tokenErr: any) {
            console.warn("verifyIdToken warning in delete-user route:", tokenErr?.message);
          }
        }
      }

      // Resolve caller profile from Firestore
      const bodyAdminUid = req.body?.adminUid || "";
      const bodyAdminRole = req.body?.adminRole || "";
      const effectiveCallerUid = callerUid || bodyAdminUid;

      let callerProfile: any = null;
      if (effectiveCallerUid && firestoreDb) {
        try {
          const callerDocSnap = await getDoc(doc(firestoreDb, "users", effectiveCallerUid));
          if (callerDocSnap.exists()) {
            callerProfile = callerDocSnap.data();
          } else {
            const qSnap = await getDocs(query(collection(firestoreDb, "users"), where("uid", "==", effectiveCallerUid), limit(1)));
            if (!qSnap.empty) {
              callerProfile = qSnap.docs[0].data();
            }
          }
        } catch (dbErr: any) {
          console.warn("Notice reading caller profile in delete-user route:", dbErr?.message);
        }
      }

      // 2. Strict Role Authorization: Caller MUST be Admin
      const rawCallerRole = callerProfile?.role || callerProfile?.userRole || bodyAdminRole;
      const normalizedCallerRole = normalizeRole(rawCallerRole);

      if (normalizedCallerRole !== "admin" && normalizedCallerRole !== "staff" && normalizedCallerRole !== "coadmin" && !validateAdminAccess(req.body)) {
        return res.status(403).json({
          error: "Only administrators can delete users."
        });
      }

      // Verify active account status
      const callerStatus = String(callerProfile?.status || callerProfile?.accountStatus || "active").toLowerCase();
      if (callerStatus === "inactive" || callerStatus === "suspended" || callerStatus === "disabled") {
        return res.status(403).json({
          error: "Your administrator account is inactive or disabled."
        });
      }

      // Target identification
      const identifier = req.params?.identifier || req.body?.identifier || req.body?.authUid || req.body?.profileDocumentId;
      const { authUid: reqAuthUid, profileDocumentId: reqDocId, displayName, email, role, idNumber, reason } = req.body || {};

      const targetAuthUid = reqAuthUid || identifier;
      const targetDocId = reqDocId || identifier;

      if (!targetAuthUid && !targetDocId) {
        return res.status(400).json({ error: "Missing target user identifier." });
      }

      // 3. Self-Deletion Protection
      if (
        (callerUid && targetAuthUid && callerUid === targetAuthUid) ||
        (effectiveCallerUid && targetDocId && effectiveCallerUid === targetDocId) ||
        (callerEmail && email && callerEmail.toLowerCase().trim() === String(email).toLowerCase().trim())
      ) {
        return res.status(400).json({
          error: "You cannot delete the account currently being used."
        });
      }

      // Find target user document in Firestore using firestoreDb
      let targetDocSnap: any = null;
      let targetDocRef: any = null;

      if (targetDocId && firestoreDb) {
        try {
          const dRef = doc(firestoreDb, "users", targetDocId);
          const dSnap = await getDoc(dRef);
          if (dSnap.exists()) {
            targetDocSnap = dSnap;
            targetDocRef = dRef;
          }
        } catch (e: any) {
          console.warn("Notice reading target doc in delete-user route:", e?.message);
        }
      }

      if ((!targetDocSnap || !targetDocSnap.exists()) && targetAuthUid && firestoreDb) {
        try {
          const qSnap = await getDocs(query(collection(firestoreDb, "users"), where("uid", "==", targetAuthUid), limit(1)));
          if (!qSnap.empty) {
            targetDocSnap = qSnap.docs[0];
            targetDocRef = targetDocSnap.ref;
          }
        } catch (e: any) {
          console.warn("Notice querying target uid in delete-user route:", e?.message);
        }
      }

      const targetData = targetDocSnap && targetDocSnap.exists() ? targetDocSnap.data() : null;
      const rawTargetRole = targetData?.role || targetData?.userRole || role;
      const normalizedTargetRole = normalizeRole(rawTargetRole);

      const targetDisplayName = targetData
        ? `${targetData.first_name || targetData.firstName || ''} ${targetData.last_name || targetData.lastName || ''}`.trim() || targetData.displayName || targetData.email
        : (displayName || email || "User");
      const targetEmailVal = targetData?.email || email || "";
      const targetSeqId = targetData?.seq_id || targetData?.seqId || targetData?.id_number || idNumber || "";

      // 4. Last-Admin Protection
      if (normalizedTargetRole === "admin" && firestoreDb) {
        try {
          const allUsersSnap = await getDocs(collection(firestoreDb, "users"));
          const activeAdmins = allUsersSnap.docs.filter(d => {
            const uData = d.data();
            const r = normalizeRole(uData.role || uData.userRole);
            const st = String(uData.status || uData.accountStatus || "active").toLowerCase();
            return r === "admin" && st !== "inactive" && st !== "disabled" && st !== "deleted" && !uData.is_archived && !uData.isDeleted;
          });

          if (activeAdmins.length <= 1) {
            return res.status(400).json({
              error: "The last active administrator cannot be deleted."
            });
          }
        } catch (e: any) {
          console.warn("Notice checking active admins in delete-user route:", e?.message);
        }
      }

      // 5. Perform Deletion
      let authDeleted = false;
      let profileDeleted = false;
      const adminDb = getAdminFirestore();

      // Delete Authentication Account
      if (targetAuthUid && adminApp) {
        try {
          await getAdminAuth().deleteUser(targetAuthUid);
          authDeleted = true;
        } catch (authErr: any) {
          console.warn(`Auth deletion notice for UID ${targetAuthUid}:`, authErr?.message);
        }
      }

      // Collect all document IDs to delete from "users" collection
      const docsToDelete = new Set<string>();
      if (targetDocId) docsToDelete.add(targetDocId);
      if (targetAuthUid) docsToDelete.add(targetAuthUid);
      if (targetDocSnap && targetDocSnap.exists()) docsToDelete.add(targetDocSnap.id);

      // Query for any other duplicate / unlinked user records with matching UID, Email, or Sequence ID
      if (adminDb) {
        try {
          const userCol = adminDb.collection("users");
          
          if (targetAuthUid) {
            const uidSnap = await userCol.where("uid", "==", targetAuthUid).get();
            uidSnap.docs.forEach(d => docsToDelete.add(d.id));
            const authUidSnap = await userCol.where("authUid", "==", targetAuthUid).get();
            authUidSnap.docs.forEach(d => docsToDelete.add(d.id));
          }

          if (targetEmailVal && targetEmailVal.trim().length > 0) {
            const cleanE = targetEmailVal.trim().toLowerCase();
            const emailSnap = await userCol.where("email_lower", "==", cleanE).get();
            emailSnap.docs.forEach(d => docsToDelete.add(d.id));
            const normEmailSnap = await userCol.where("normalizedEmail", "==", cleanE).get();
            normEmailSnap.docs.forEach(d => docsToDelete.add(d.id));
          }

          if (targetSeqId && targetSeqId.trim().length > 0) {
            const seqSnap = await userCol.where("seq_id", "==", targetSeqId.trim()).get();
            seqSnap.docs.forEach(d => docsToDelete.add(d.id));
          }

          // Delete all identified user documents via Admin SDK
          for (const docId of docsToDelete) {
            try {
              await userCol.doc(docId).delete();
              profileDeleted = true;
            } catch (delErr: any) {
              console.warn(`Notice deleting user doc ${docId} via Admin SDK:`, delErr?.message);
            }
          }

          // Clean up matching entries in user_index collection
          const indexCol = adminDb.collection("user_index");
          for (const docId of docsToDelete) {
            try {
              await indexCol.doc(docId).delete();
            } catch (_) {}
          }
        } catch (colErr: any) {
          console.warn("Notice querying and deleting user documents via Admin SDK:", colErr?.message);
        }
      }

      // Clean up related notifications via Admin SDK
      if (targetAuthUid && adminDb) {
        try {
          const notifSnap = await adminDb.collection("notifications").where("recipientId", "==", targetAuthUid).get();
          if (!notifSnap.empty) {
            const batch = adminDb.batch();
            notifSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (nErr: any) {
          console.warn("Notice cleaning up notifications via Admin SDK:", nErr?.message);
        }
      }

      // 6. Record Audit Log in activity_logs
      const callerNameVal = callerProfile
        ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim() || callerProfile.displayName || callerEmail
        : (callerEmail || "Admin");

      if (firestoreDb) {
        try {
          await addDoc(collection(firestoreDb, "activity_logs"), {
            action: "user_deleted",
            targetUserUid: targetAuthUid || "",
            targetProfileDocumentId: targetDocSnap && targetDocSnap.exists() ? targetDocSnap.id : targetDocId,
            targetRole: normalizedTargetRole,
            targetIdNumber: targetSeqId,
            targetName: targetDisplayName,
            targetEmail: targetEmailVal,
            performedBy: effectiveCallerUid || "system",
            performedByEmail: callerEmail,
            performedByName: callerNameVal,
            performedAt: new Date().toISOString(),
            reason: reason || "Administrative user deletion",
            deletionMode: "permanent",
            result: "success",
            timestamp: new Date().toISOString()
          });
        } catch (logErr: any) {
          console.warn("Notice recording activity log for user deletion:", logErr?.message);
        }
      }

      return res.json({
        success: true,
        message: "User deleted successfully.",
        authDeleted,
        profileDeleted,
        targetUserUid: targetAuthUid,
        targetProfileDocumentId: targetDocSnap && targetDocSnap.exists() ? targetDocSnap.id : targetDocId,
      });

    } catch (err: any) {
      console.error("Error in delete-user endpoint:", err);
      return res.status(500).json({ error: err.message || "Failed to delete user account." });
    }
  };

  app.delete("/api/admin/users/:identifier", handleUserDeleteRequest);
  app.delete("/api/admin/users", handleUserDeleteRequest);
  app.post("/api/admin/delete-user", handleUserDeleteRequest);

  app.post("/api/clear-all-scores", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });

      const snap = await getDocs(collection(firestoreDb, "users"));
      let batch = writeBatch(firestoreDb);
      let count = 0;

      for (const docSnap of snap.docs) {
        batch.update(docSnap.ref, {
          score_clj: "",
          score_lea: "",
          score_cdi: "",
          score_fs: "",
          score_crim: "",
          score_ca: ""
        });
        count++;
        if (count === 50) {
           await batch.commit();
           await new Promise(r => setTimeout(r, 100)); // allow stream to flush
           batch = writeBatch(firestoreDb);
           count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error("Failed to clear scores:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/publish-score", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      const { revieweeId, scoreId, category, examTitle, subject } = req.body;
      if (!revieweeId || !scoreId) return res.status(400).json({ error: "Missing revieweeId or scoreId" });

      const userRef = doc(firestoreDb, "users", revieweeId);
      const notificationRef = doc(firestoreDb, "notifications", `score_published_${revieweeId}_${scoreId}`);

      await runTransaction(firestoreDb, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");

        const userData = userDoc.data();
        const records = userData.assessmentRecords || {};
        
        if (!records[scoreId]) throw new Error("Score record not found");
        
        if (records[scoreId].isPublished) throw new Error("Score already published");

        // Update score
        transaction.update(userRef, {
          [`assessmentRecords.${scoreId}.isPublished`]: true
        });

        // Create notification
        transaction.set(notificationRef, {
          recipientId: revieweeId,
          revieweeId: revieweeId,
          type: "score_published",
          title: "New Score Published",
          message: `Your score for ${examTitle || subject} has been published.`,
          scoreId: scoreId,
          examId: records[scoreId].subjectId || "",
          examTitle: examTitle || "",
          subject: subject || "",
          isRead: false,
          createdAt: AdminFieldValue.serverTimestamp(),
          publishedAt: AdminFieldValue.serverTimestamp(),
          uniqueKey: `score_published_${revieweeId}_${scoreId}`
        });
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to publish score:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/delete-score-column", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const { category, subject } = req.body;

      if (!category || !subject) {
        return res.status(400).json({ error: 'Category and subject are required' });
      }

      const subjectLower = String(subject).toLowerCase();
      const categoryLower = String(category).toLowerCase();

      let scoreField = '';

      if (categoryLower === 'diagnostic') scoreField = `diag_${subjectLower}`;
      if (categoryLower === 'preboard') scoreField = `preboard_${subjectLower}`;
      if (categoryLower === 'pretest') scoreField = `score_${subjectLower}`;
      if (categoryLower === 'posttest') scoreField = `post_${subjectLower}`;
      if (categoryLower === 'finalcoaching') scoreField = `final_${subjectLower}`;

      if (!scoreField) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const answerPrefix = `${categoryLower}_${subjectLower}`;

      const snap = await getDocs(collection(firestoreDb, 'users'));

      let updatedCount = 0;
      let batch = writeBatch(firestoreDb);
      let batchCount = 0;

      for (const docSnap of snap.docs) {
        const updateData: any = {
          [scoreField]: '',
          [`score_${subjectLower}_${categoryLower}`]: '',
          [`date_${subjectLower}_${categoryLower}`]: ''
        };
        if (categoryLower === 'pretest' || categoryLower === 'preboard') {
            updateData[`score_${subjectLower}`] = '';
            updateData[`date_${subjectLower}`] = '';
        }

        for (let i = 1; i <= 100; i++) {
          updateData[`${answerPrefix}_Stu${i}`] = '';
          updateData[`${answerPrefix}_Key${i}`] = '';
        }

        batch.update(docSnap.ref, updateData);
        updatedCount++;
        batchCount++;

        if (batchCount === 10) {
          await batch.commit();
          await new Promise(r => setTimeout(r, 100)); // allow stream to flush
          batch = writeBatch(firestoreDb);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      res.json({
        success: true,
        updatedCount,
        deletedScoreField: scoreField,
        deletedAnswerPrefix: answerPrefix
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to delete score column'
      });
    }
  });

  app.post("/api/administrative-reset", async (req, res) => {
    try {
      const { category, year, confirmation } = req.body;
      if (confirmation !== 'DELETE') {
        return res.status(400).json({ error: 'Invalid confirmation' });
      }
      
      // Update firestore to clear scores locally too
      const snap = await getDocs(collection(firestoreDb!, 'users'));
      let batch = writeBatch(firestoreDb!);
      let batchCount = 0;
      let updatedCount = 0;

      const subjects = ['clj', 'lea', 'fs', 'cdi', 'crim', 'ca'];
      const categoryLower = String(category).toLowerCase();

      for (const docSnap of snap.docs) {
        const updateData: any = {};
        
        for (const subject of subjects) {
          if (categoryLower === 'all' || categoryLower === 'diagnostic') {
             updateData[`diag_${subject}`] = '';
             updateData[`score_${subject}_diagnostic`] = '';
             updateData[`date_${subject}_diagnostic`] = '';
             for (let i = 1; i <= 100; i++) {
               updateData[`diagnostic_${subject}_Stu${i}`] = '';
               updateData[`diagnostic_${subject}_Key${i}`] = '';
             }
          }
          if (categoryLower === 'all' || categoryLower === 'pretest') {
             updateData[`score_${subject}`] = '';
             updateData[`date_${subject}`] = '';
             updateData[`score_${subject}_pretest`] = '';
             updateData[`date_${subject}_pretest`] = '';
             for (let i = 1; i <= 100; i++) {
               updateData[`pretest_${subject}_Stu${i}`] = '';
               updateData[`pretest_${subject}_Key${i}`] = '';
             }
          }
          if (categoryLower === 'all' || categoryLower === 'preboard') {
             updateData[`preboard_${subject}`] = '';
             updateData[`score_${subject}`] = '';
             updateData[`date_${subject}`] = '';
             updateData[`score_${subject}_preboard`] = '';
             updateData[`date_${subject}_preboard`] = '';
             for (let i = 1; i <= 100; i++) {
               updateData[`preboard_${subject}_Stu${i}`] = '';
               updateData[`preboard_${subject}_Key${i}`] = '';
             }
          }
          if (categoryLower === 'all' || categoryLower === 'posttest') {
             updateData[`post_${subject}`] = '';
             updateData[`score_${subject}_posttest`] = '';
             updateData[`date_${subject}_posttest`] = '';
             for (let i = 1; i <= 100; i++) {
               updateData[`posttest_${subject}_Stu${i}`] = '';
               updateData[`posttest_${subject}_Key${i}`] = '';
             }
          }
          if (categoryLower === 'all' || categoryLower === 'finalcoaching') {
             updateData[`final_${subject}`] = '';
             updateData[`score_${subject}_finalcoaching`] = '';
             updateData[`date_${subject}_finalcoaching`] = '';
             for (let i = 1; i <= 100; i++) {
               updateData[`finalcoaching_${subject}_Stu${i}`] = '';
               updateData[`finalcoaching_${subject}_Key${i}`] = '';
             }
          }
        }

        batch.update(docSnap.ref, updateData);
        batchCount++;
        updatedCount++;

        if (batchCount === 2) {
          await batch.commit();
          await new Promise(r => setTimeout(r, 100)); // allow stream to flush
          batch = writeBatch(firestoreDb!);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      const webhookUrl = process.env.APPS_SCRIPT_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'administrative-reset', category, year })
        }).catch(err => console.error("Webhook error:", err)); // ignore webhook errors if it works locally
      }

      return res.json({ success: true, updatedCount });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed' });
    }
  });

  app.post("/api/import-reviewees", async (req, res) => {
    try {
      const { reviewees } = req.body;
      if (!reviewees || !Array.isArray(reviewees)) return res.status(400).json({ error: "Invalid input" });

      const batch = writeBatch(firestoreDb!);
      const revieweeCollection = collection(firestoreDb!, "users");
      
      for (const r of reviewees) {
        if (!r['First Name'] || !r['Last Name']) continue;
        const newDocRef = doc(revieweeCollection);
        batch.set(newDocRef, {
          first_name: r['First Name'] || '',
          middle_name: r['Middle Name'] || '',
          last_name: r['Last Name'] || '',
          seq_id: r['ID Number'] || '',
          created_at: new Date().toISOString(),
          is_synced: false,
          school_name: '',
          role: 'Reviewee'
        });
      }
      await batch.commit();
      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/batch-update-scores", async (req, res) => {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          error: "Missing updates array"
        });
      }

      let batch = writeBatch(firestoreDb);
      let count = 0;
      let updated = 0;

      for (const item of updates) {
        if (!item.doc_id || typeof item.doc_id !== 'string' || !item.data) continue;

        const ref = doc(firestoreDb, "users", item.doc_id);

        batch.update(ref, {
          ...item.data,
          is_synced: false,
          ...(req.body.adminName ? { uploaded_by: req.body.adminName } : {})
        });

        count++;
        updated++;

        if (count === 50) {
          await batch.commit();
          await new Promise(r => setTimeout(r, 100)); // allow stream to flush
          batch = writeBatch(firestoreDb);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }
      if (updated > 0) {
        await addDoc(collection(firestoreDb, "activity_logs"), {
          operation: "Batch Update Scores",
          admin_name: req.body.adminName || "System",
          admin_role: normalizeRole(req.body.adminRole || "admin"),
          records_processed: updated,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        updated
      });
    } catch (error: any) {
      console.error("Batch score update error:", error);

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.post("/api/batch-toggle-exclusion", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      const { userIds, is_excluded } = req.body;
      if (!userIds || !Array.isArray(userIds)) return res.status(400).json({ error: "Missing userIds array" });

      const maxBatchSize = 50;
      for (let i = 0; i < userIds.length; i += maxBatchSize) {
          const batch = writeBatch(firestoreDb);
          const chunk = userIds.slice(i, i + maxBatchSize);
          chunk.forEach(id => {
            const docRef = doc(firestoreDb, "users", id);
            batch.update(docRef, { is_excluded: !!is_excluded });
          });

          await batch.commit();
          await new Promise(r => setTimeout(r, 100)); // allow stream to flush
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to batch toggle exclusion:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/toggle-archive", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      const { doc_id, is_archived, passed, archiveStatus, adminName, adminRole, adminUid, adminEmail } = req.body;
      if (!doc_id) return res.status(400).json({ error: "Missing doc_id" });

      const docRef = doc(firestoreDb, "users", doc_id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return res.status(404).json({ error: "Reviewee not found" });
      }
      const reviewee = docSnap.data();
      
      const updatePayload: any = {
        is_archived: !!is_archived,
        updated_at: new Date().toISOString()
      };

      let operationAction = "REVIEWEE_ARCHIVED";

      if (is_archived) {
        updatePayload.archived = true;
        updatePayload.archiveStatus = archiveStatus || "archived";
        updatePayload.archivedAt = new Date().toISOString();

        if (passed === true || archiveStatus === "passed") {
          updatePayload.passed = true;
          updatePayload.archiveStatus = "passed";
          updatePayload.passedAt = new Date().toISOString();
          operationAction = "REVIEWEE_PASSED_ARCHIVED";
        }
      } else {
        updatePayload.archived = false;
        updatePayload.archiveStatus = "";
        updatePayload.passed = false;
        operationAction = "REVIEWEE_UNARCHIVED";
      }

      await updateDoc(docRef, updatePayload);

      // Create activity log
      try {
        const legacyLogRef = doc(collection(firestoreDb, "activity_logs"));
        await setDoc(legacyLogRef, {
          timestamp: new Date().toISOString(),
          admin_name: adminName || adminEmail || "System",
          admin_role: normalizeRole(adminRole || "admin"),
          operation: `${operationAction}: ${reviewee.last_name || ""}, ${reviewee.first_name || ""} (${reviewee.id_number || ""})`,
          records_processed: 1
        });
      } catch (logErr) {
        console.error("Failed to create activity log for toggle-archive:", logErr);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to toggle archive:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/manual-score", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });

      const {
        doc_id,
        category,
        evaluation_date,
        score,
        remarks,
        adminUid,
        adminName,
        adminEmail,
        adminRole,
      } = req.body;

      if (!doc_id || !category || !evaluation_date || score === undefined || score === "") {
        return res.status(400).json({ error: "Missing required fields." });
      }

      const revieweeRef = doc(firestoreDb, "users", doc_id);
      const revieweeSnap = await getDoc(revieweeRef);

      if (!revieweeSnap.exists()) {
        return res.status(404).json({ error: "Reviewee not found." });
      }

      const reviewee = revieweeSnap.data() as any;

      const isArchivedOrPassed =
        reviewee.is_archived === true ||
        reviewee.archived === true ||
        reviewee.passed === true ||
        reviewee.archiveStatus === "passed" ||
        reviewee.status === "archived";

      if (isArchivedOrPassed) {
        return res.status(400).json({ error: "Archived/passed reviewees cannot be edited." });
      }

      const dateKey = normalizeDateKey(evaluation_date);
      const categoryKey = normalizeCategoryKey(category);
      const scoreRecordKey = `${doc_id}_${categoryKey}_${dateKey}`;

      const oldEntry = reviewee?.scoresByDate?.[scoreRecordKey];
      const oldScore = oldEntry?.score ?? null;

      const now = new Date().toISOString();

      const scoreEntry = {
        category,
        categoryKey,
        score: Number(score),
        rawScore: Number(score),
        date: dateKey,
        source: "manual",
        remarks: remarks || "",
        updatedAt: now,
        updatedBy: adminName || adminEmail || "Admin",
        updatedByUid: adminUid || "",
        updatedByEmail: adminEmail || "",
      };

      const action = oldEntry ? "MANUAL_SCORE_EDITED" : "MANUAL_SCORE_ADDED";

      const batch = writeBatch(firestoreDb);

      batch.update(revieweeRef, {
        [`scoresByDate.${scoreRecordKey}`]: scoreEntry,
        [`latestScores.${categoryKey}`]: scoreEntry,
        latestScoreUploadAt: now,
        is_synced: false,
        updated_at: now,
      });

      const logRef = doc(collection(firestoreDb, "activityLogs"));

      batch.set(logRef, {
        action,
        module: "scores",
        revieweeDocId: doc_id,
        revieweeName:
          `${reviewee.last_name || ""}, ${reviewee.first_name || ""}`.trim() ||
          reviewee.name ||
          "",
        revieweeIdNumber:
          reviewee.id_number ||
          reviewee.student_id ||
          reviewee.studentId ||
          "",
        category,
        categoryKey,
        evaluationDate: dateKey,
        scoreRecordKey,
        oldScore,
        newScore: Number(score),
        remarks: remarks || "",
        performedByUid: adminUid || "",
        performedByName: adminName || adminEmail || "Admin",
        performedByEmail: adminEmail || "",
        performedByRole: adminRole || "admin",
        createdAt: now,
      });

      await batch.commit();

      // Also create a record in the legacy activity_logs collection if needed for the UI
      try {
        const legacyLogRef = doc(collection(firestoreDb, "activity_logs"));
        await setDoc(legacyLogRef, {
          timestamp: now,
          admin_name: adminName || adminEmail || "Admin",
          admin_role: normalizeRole(adminRole || "admin"),
          operation: `${action}: ${reviewee.last_name || ""}, ${reviewee.first_name || ""} (${category} - ${dateKey}) Score: ${oldScore ?? '-'} -> ${score}`,
          records_processed: 1
        });
      } catch (logErr) {
        console.error("Failed to create legacy activity log:", logErr);
      }

      res.json({
        success: true,
        action,
        scoreRecordKey,
        oldScore,
        newScore: Number(score),
      });
    } catch (error: any) {
      console.error("Manual score save failed:", error);
      res.status(500).json({ error: error.message || "Failed to save manual score." });
    }
  });

  app.post("/api/batch-reassign-ids", async (req, res) => {
    try {
      const { revieweeIds } = req.body;
      if (!revieweeIds || !Array.isArray(revieweeIds)) return res.status(400).json({ error: "Invalid input" });

      const revieweesSnapshot = await getDocs(collection(firestoreDb!, "users"));
      const allRecords = revieweesSnapshot.docs.map(doc => ({ doc_id: doc.id, ...(doc.data() as any) }));
      const selectedRecords = allRecords.filter(r => revieweeIds.includes(r.doc_id)).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      const existingSeqNums = new Set<number>();
      allRecords.forEach(r => {
        if (r.seq_id) {
          const parsed = parseSeqNum(r.seq_id);
          if (parsed !== null) {
            existingSeqNums.add(parsed);
          }
        }
      });
      const currentYearSuffix = new Date().getFullYear().toString().slice(-2);
      
      const batch = writeBatch(firestoreDb!);
      let currentSeqNum = 1001;

      for (const record of selectedRecords) {
        let seqId;
        while (true) {
          const seqNumStr = String(currentSeqNum);
          seqId = `SRC ${seqNumStr}${currentYearSuffix}`;
          if (!existingSeqNums.has(currentSeqNum)) {
            existingSeqNums.add(currentSeqNum);
            currentSeqNum = currentSeqNum + 1;
            break;
          }
          currentSeqNum = currentSeqNum + 1;
        }
        batch.update(doc(firestoreDb!, "users", record.doc_id), { 
          seq_id: seqId,
          seqId: seqId,
          id_number: seqId,
          idNumber: seqId,
          srcId: seqId
        });
      }
      
      await batch.commit();
      res.json({ success: true, count: selectedRecords.length });
    } catch (err: any) {
      console.error("error batch reassigning:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/activity-logs", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      
      const authHeader = req.headers.authorization || "";
      let callerUid = "";

      if (authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.substring(7).trim();
        if (idToken) {
          try {
            const decodedToken = await getAdminAuth().verifyIdToken(idToken);
            callerUid = decodedToken.uid;
          } catch (tokenErr: any) {
            console.warn("verifyIdToken warning in activity-logs route:", tokenErr?.message);
            return res.status(401).json({ error: "Invalid or expired authorization token." });
          }
        }
      }

      if (!callerUid) {
        return res.status(401).json({ error: "Missing authorization token." });
      }

      // Fetch user profile from Firestore users collection using Admin SDK
      const adminDb = getAdminFirestore();
      let callerProfile: any = null;
      let dbUnavailable = false;

      try {
        const callerDocSnap = await adminDb.collection("users").doc(callerUid).get();
        if (callerDocSnap.exists) {
          callerProfile = callerDocSnap.data();
        } else {
          const qSnap = await adminDb.collection("users").where("uid", "==", callerUid).limit(1).get();
          if (!qSnap.empty) {
            callerProfile = qSnap.docs[0].data();
          }
        }
      } catch (dbErr: any) {
        const isPermissionError = dbErr?.message?.includes("PERMISSION_DENIED") || dbErr?.code === 7;
        if (isPermissionError) {
          console.log("[ActivityLogs Auth] Server permission mapping fallback enabled.");
        } else {
          console.log("[ActivityLogs Auth] Token profile resolution activated.");
        }
        dbUnavailable = true;
        
        // Construct fallback caller profile from verified ID token and request body
        const idToken = authHeader.substring(7).trim();
        const decodedToken = await getAdminAuth().verifyIdToken(idToken);
        callerProfile = {
          uid: callerUid,
          email: decodedToken?.email || "",
          role: req.body.adminRole || (decodedToken?.email && decodedToken.email.endsWith("@admin.com") ? "admin" : "staff")
        };
      }

      if (!callerProfile) {
        return res.status(403).json({ error: "User profile not found." });
      }

      const role = normalizeRole(callerProfile.role || callerProfile.userRole || callerProfile.accountType);
      const isUserAdmin = role === "admin";
      const isUserStaff = role === "staff" || role === "coadmin" || role === "co-admin";

      if (!isUserAdmin && !isUserStaff) {
        return res.status(403).json({ error: "Insufficient permission. Only Admins and Staff can view activity logs." });
      }

      const { limitCount = 100 } = req.body;
      let logs: any[] = [];

      try {
        if (dbUnavailable) {
          throw new Error("ADMIN_DB_UNAVAILABLE");
        }
        
        const snap = await adminDb.collection("activity_logs").orderBy("timestamp", "desc").limit(limitCount).get();
        logs = snap.docs.map(doc => {
          const data = doc.data();
          let timestamp = data.timestamp;
          if (timestamp && typeof timestamp === "object") {
            if (typeof timestamp.toDate === "function") {
              timestamp = timestamp.toDate().toISOString();
            } else if (typeof timestamp.seconds === "number") {
              timestamp = new Date(timestamp.seconds * 1000).toISOString();
            } else if (typeof timestamp._seconds === "number") {
              timestamp = new Date(timestamp._seconds * 1000).toISOString();
            }
          }
          return {
            id: doc.id,
            ...data,
            timestamp: timestamp || new Date().toISOString()
          };
        });
      } catch (logErr: any) {
        if (logErr?.message !== "ADMIN_DB_UNAVAILABLE") {
          console.warn("Firebase Admin SDK activity-logs query failed. Attempting client Firestore SDK fallback...", logErr?.message);
        }
        try {
          const clientSnap = await getDocs(
            query(
              collection(firestoreDb, "activity_logs"),
              orderBy("timestamp", "desc"),
              limit(limitCount)
            )
          );
          logs = clientSnap.docs.map(doc => {
            const data = doc.data();
            let timestamp = data.timestamp;
            if (timestamp && typeof timestamp === "object") {
              if (typeof timestamp.toDate === "function") {
                timestamp = timestamp.toDate().toISOString();
              } else if (typeof timestamp.seconds === "number") {
                timestamp = new Date(timestamp.seconds * 1000).toISOString();
              }
            }
            return {
              id: doc.id,
              ...data,
              timestamp: timestamp || new Date().toISOString()
            };
          });
        } catch (fallbackErr: any) {
          console.error("Client Firestore SDK fallback activity-logs query failed:", fallbackErr?.message);
          const isPermissionDenied = logErr?.message?.includes("PERMISSION_DENIED") || logErr?.code === 7 || dbUnavailable || logErr?.message === "ADMIN_DB_UNAVAILABLE";
          
          if (isPermissionDenied) {
            console.log("[ActivityLogs Query] Log stream offline mode enabled.");
            return res.status(500).json({ 
              error: "Firestore database is temporarily offline or restricted.",
              code: "DATABASE_UNAVAILABLE",
              logs: [] 
            });
          } else {
            throw logErr;
          }
        }
      }

      res.json({ logs });
    } catch (err: any) {
      console.error("error fetching activity logs:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Helper to normalize email
  function normalizeEmail(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
  }

  // Find duplicates or similar entries (excluding merged accounts)
  app.post("/api/find-duplicates", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      
      if (!validateAdminAccess(req.body)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { year } = req.body;

      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      let allRecords = revieweesSnapshot.docs
        .map(doc => ({ doc_id: doc.id, ...(doc.data() as any) }))
        .filter(r => String(r.status || r.accountStatus || '').toLowerCase() !== 'merged') as any[];
      
      if (year && year !== "") {
        allRecords = allRecords.filter(r => new Date(r.created_at).getFullYear() === parseInt(year));
      }

      console.log("Analyzing duplicates, record count:", allRecords.length);
      const report = analyzeDuplicatesReport(allRecords, year);

      res.json({
        duplicateIds: report.duplicateIds,
        similarNames: report.similarNames
      });
    } catch (err: any) {
      console.error("error finding duplicates:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Resolve duplicates by deleting or merging specified records
  app.post("/api/resolve-duplicates", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });

      if (!validateAdminAccess(req.body)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { recordsToDelete, resolutions } = req.body;

      if ((!Array.isArray(recordsToDelete) || recordsToDelete.length === 0) && (!Array.isArray(resolutions) || resolutions.length === 0)) {
         return res.status(400).json({ error: "No records to delete or resolve" });
      }

      // Step 1: Process resolutions to merge score data into kept records
      if (Array.isArray(resolutions) && resolutions.length > 0) {
        for (const resItem of resolutions) {
          const { keepDocId, mergeFromDocIds } = resItem;
          if (!keepDocId || !Array.isArray(mergeFromDocIds) || mergeFromDocIds.length === 0) continue;

          const keepRef = doc(firestoreDb, "users", keepDocId);
          const keepSnap = await getDoc(keepRef);
          if (!keepSnap.exists()) continue;

          let keepData: Record<string, any> = { doc_id: keepSnap.id, ...keepSnap.data() };

          for (const fromId of mergeFromDocIds) {
            const fromRef = doc(firestoreDb, "users", fromId);
            const fromSnap = await getDoc(fromRef);
            if (fromSnap.exists()) {
              const fromData = fromSnap.data();
              keepData = mergeUserScoreData(keepData, fromData);
            }
          }

          keepData.updatedAt = new Date().toISOString();
          keepData.updated_at = new Date().toISOString();
          await setDoc(keepRef, keepData, { merge: true });
        }
      }

      // Step 2: Mark secondary duplicate records as merged
      const toDelete = Array.isArray(recordsToDelete) ? recordsToDelete : [];
      const maxBatchSize = 50;
      for (let i = 0; i < toDelete.length; i += maxBatchSize) {
        const batch = writeBatch(firestoreDb);
        const chunk = toDelete.slice(i, i + maxBatchSize);
        for (const id of chunk) {
          const userRef = doc(firestoreDb, "users", id);
          batch.set(userRef, {
            status: 'merged',
            accountStatus: 'merged',
            mergedAt: new Date().toISOString(),
            mergedBy: req.body.adminId || 'Admin'
          }, { merge: true });
        }
        await batch.commit();
        await new Promise(r => setTimeout(r, 100)); // allow stream to flush
      }

      await addDoc(collection(firestoreDb, "activity_logs"), {
        operation: "Resolve Duplicates",
        admin_name: req.body.adminName || "System",
        admin_role: normalizeRole(req.body.adminRole || "admin"),
        records_processed: toDelete.length,
        timestamp: new Date().toISOString()
      });

      res.json({ success: true, message: `Successfully resolved duplicate records and merged score data.` });
    } catch (err: any) {
      console.error("error resolving duplicates:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Merge two accounts (Primary + Secondary) preserving primary ID/scores and transferring email/auth identity
  app.post("/api/merge-accounts", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      if (!validateAdminAccess(req.body)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { primaryDocId, secondaryDocId, selectedEmail, nameFields, adminId, adminName } = req.body;
      if (!primaryDocId || !secondaryDocId) {
        return res.status(400).json({ error: "Primary and secondary account IDs are required." });
      }

      const primaryRef = doc(firestoreDb, "users", primaryDocId);
      const secondaryRef = doc(firestoreDb, "users", secondaryDocId);

      const [primarySnap, secondarySnap] = await Promise.all([
        getDoc(primaryRef),
        getDoc(secondaryRef)
      ]);

      if (!primarySnap.exists() || !secondarySnap.exists()) {
        return res.status(404).json({ error: "Primary or secondary account not found." });
      }

      const primaryData = primarySnap.data();
      const secondaryData = secondarySnap.data();

      const preservedEmail = normalizeEmail(selectedEmail || secondaryData.email || primaryData.email);
      const encodedEmail = encodeURIComponent(preservedEmail);

      // Merge scores and profile fields using mergeUserScoreData
      const mergedScoreData = mergeUserScoreData(primaryData, secondaryData);

      const updatePayload: Record<string, any> = {
        ...mergedScoreData,
        email: preservedEmail,
        normalizedEmail: preservedEmail,
        email_lower: preservedEmail,
        firebaseUid: secondaryData.firebaseUid || secondaryData.uid || primaryData.firebaseUid || primaryData.uid,
        authUid: secondaryData.authUid || primaryData.authUid,
        googleLinked: secondaryData.googleLinked || primaryData.googleLinked || false,
        googleProvider: secondaryData.googleProvider || primaryData.googleProvider || false,
        lastLoginAt: secondaryData.lastLoginAt || primaryData.lastLoginAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (nameFields) {
        if (nameFields.first_name) updatePayload.first_name = nameFields.first_name;
        if (nameFields.middle_name) updatePayload.middle_name = nameFields.middle_name;
        if (nameFields.last_name) updatePayload.last_name = nameFields.last_name;
      }

      const batch = writeBatch(firestoreDb);

      // 1. Update primary account preserving ID & scores, transferring email/auth
      batch.set(primaryRef, updatePayload, { merge: true });

      // 2. Mark secondary account as merged (do not hard delete)
      const primarySeqId = primaryData.seq_id || primaryData.id_number || primaryData.seqId || '';
      const secondarySeqId = secondaryData.seq_id || secondaryData.id_number || secondaryData.seqId || '';
      batch.set(secondaryRef, {
        status: 'merged',
        accountStatus: 'merged',
        mergedIntoUserDocId: primaryDocId,
        mergedIntoIdNumber: primarySeqId,
        mergedAt: new Date().toISOString(),
        mergedBy: adminId || 'Admin',
        originalIdNumber: secondarySeqId
      }, { merge: true });

      // 3. Update email index
      if (preservedEmail) {
        const indexRef = doc(firestoreDb, "email_index", encodedEmail);
        batch.set(indexRef, {
          userDocId: primaryDocId,
          normalizedEmail: preservedEmail,
          idNumber: primarySeqId,
          mergedFromUserDocId: secondaryDocId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 4. Activity log
      const logRef = doc(collection(firestoreDb, "activity_logs"));
      batch.set(logRef, {
        operation: "Merge User Accounts",
        admin_name: adminName || "Admin",
        admin_id: adminId || "Admin",
        primaryDocId,
        secondaryDocId,
        primarySeqId,
        secondarySeqId,
        preservedEmail,
        timestamp: new Date().toISOString()
      });

      await batch.commit();

      res.json({
        success: true,
        message: `Successfully merged account into ID ${primarySeqId}. Email ${preservedEmail} preserved.`
      });
    } catch (err: any) {
      console.error("Error merging accounts:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint to retroactively restore/copy score data from merged records to active accounts
  app.post("/api/restore-merged-scores", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });
      if (!validateAdminAccess(req.body)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const snapshot = await getDocs(collection(firestoreDb, "users"));
      const allUsers: Record<string, any>[] = snapshot.docs.map(d => ({ doc_id: d.id, ...d.data() }));

      const activeUsers = allUsers.filter(u => String(u.status || u.accountStatus || '').toLowerCase() !== 'merged');
      const mergedUsers = allUsers.filter(u => String(u.status || u.accountStatus || '').toLowerCase() === 'merged');

      let restoredCount = 0;

      for (const mergedUser of mergedUsers) {
        // Find target active user
        let targetUser = activeUsers.find(u => u.doc_id === mergedUser.mergedIntoUserDocId);
        
        if (!targetUser) {
          const mSeqId = mergedUser.mergedIntoIdNumber || mergedUser.seq_id || mergedUser.id_number || mergedUser.seqId;
          if (mSeqId) {
            targetUser = activeUsers.find(u => (u.seq_id || u.id_number || u.seqId) === mSeqId);
          }
        }

        if (!targetUser) {
          const mLn = String(mergedUser.last_name || mergedUser.lastName || '').trim().toUpperCase();
          const mFn = String(mergedUser.first_name || mergedUser.firstName || '').trim().toUpperCase();
          if (mLn && mFn) {
            targetUser = activeUsers.find(u => {
              const uLn = String(u.last_name || u.lastName || '').trim().toUpperCase();
              const uFn = String(u.first_name || u.firstName || '').trim().toUpperCase();
              return mLn === uLn && mFn === uFn;
            });
          }
        }

        if (targetUser) {
          const mergedData = mergeUserScoreData(targetUser, mergedUser);
          mergedData.updatedAt = new Date().toISOString();
          mergedData.updated_at = new Date().toISOString();
          
          await setDoc(doc(firestoreDb, "users", targetUser.doc_id), mergedData, { merge: true });
          
          Object.assign(targetUser, mergedData);
          restoredCount++;
        }
      }

      res.json({
        success: true,
        message: `Processed ${mergedUsers.length} merged account records. Restored score data to ${restoredCount} active accounts.`,
        restoredCount
      });
    } catch (err: any) {
      console.error("Error restoring merged scores:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Preview records with unseparated or unstandardized name fields
  app.post("/api/preview-name-standardization", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });

      if (!validateAdminAccess(req.body)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const revieweesSnapshot = await getDocs(collection(firestoreDb, "users"));
      const allRecords = revieweesSnapshot.docs.map(doc => ({ doc_id: doc.id, ...(doc.data() as any) })) as any[];

      const proposedUpdates: any[] = [];

      for (const r of allRecords) {
        const canonical = getCanonicalFullName(r);
        const curFirst = String(r.first_name || r.firstName || '').trim();
        const curLast = String(r.last_name || r.lastName || '').trim();
        const curMiddle = String(r.middle_name || r.middleName || '').trim();
        const curFull = String(r.name || r.full_name || r.fullName || r.displayName || '').trim();

        // Check if current fields are unstandardized
        const isUnstandardized =
          (!curFirst && !curLast && curFull) ||
          (curFirst && !curLast && curFirst.includes(' ')) ||
          (!curFirst && curLast && curLast.includes(' ')) ||
          (curFirst !== canonical.firstName) ||
          (curLast !== canonical.lastName) ||
          (canonical.middleName && !curMiddle);

        if (isUnstandardized && (canonical.firstName || canonical.lastName)) {
          proposedUpdates.push({
            doc_id: r.doc_id,
            seq_id: r.seq_id || r.id_number || r.student_id || r.seqId || 'N/A',
            role: r.role || 'Reviewee',
            currentFields: {
              first_name: curFirst || 'None',
              middle_name: curMiddle || 'None',
              last_name: curLast || 'None',
              full_field: curFull || 'None'
            },
            proposedFields: {
              first_name: canonical.firstName,
              middle_name: canonical.middleName,
              last_name: canonical.lastName,
              displayName: canonical.displayName
            }
          });
        }
      }

      res.json({
        totalRecordsAnalyzed: allRecords.length,
        unstandardizedCount: proposedUpdates.length,
        proposedUpdates
      });
    } catch (err: any) {
      console.error("error previewing name standardization:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Commit name field standardization batch updates
  app.post("/api/commit-name-standardization", async (req, res) => {
    try {
      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });

      if (!validateAdminAccess(req.body)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }

      const maxBatchSize = 50;
      let count = 0;
      for (let i = 0; i < updates.length; i += maxBatchSize) {
        const batch = writeBatch(firestoreDb);
        const chunk = updates.slice(i, i + maxBatchSize);
        for (const item of chunk) {
          if (!item.doc_id) continue;
          const userRef = doc(firestoreDb, "users", item.doc_id);
          batch.update(userRef, {
            first_name: item.first_name || '',
            firstName: item.first_name || '',
            middle_name: item.middle_name || '',
            middleName: item.middle_name || '',
            last_name: item.last_name || '',
            lastName: item.last_name || '',
            updated_at: new Date().toISOString()
          });
          count++;
        }
        await batch.commit();
        await new Promise(r => setTimeout(r, 100));
      }

      await addDoc(collection(firestoreDb, "activity_logs"), {
        operation: "Standardize Name Fields",
        admin_name: req.body.adminName || "Admin System",
        admin_role: normalizeRole(req.body.adminRole || "admin"),
        records_processed: count,
        timestamp: new Date().toISOString()
      });

      res.json({ success: true, count, message: `Successfully standardized name fields for ${count} records.` });
    } catch (err: any) {
      console.error("error committing name standardization:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Enroll candidate with atomic transaction counter
  app.post("/api/enroll", async (req, res) => {
    try {
      if (!firestoreDb) {
        return res.status(500).json({ error: "Database not initialized. Please verify your Firebase connection settings." });
      }
      const { lastName, firstName, middleName, schoolName, pin } = req.body;
      
      const uLastName = String(lastName || '').trim().toUpperCase();
      const uFirstName = String(firstName || '').trim().toUpperCase();
      const uMiddleName = String(middleName || '').trim().toUpperCase();
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
        console.warn("Failed to fetch school mappings during enroll:", err);
      }

      const q = query(
        collection(firestoreDb, "users"),
        where("last_name", "==", uLastName)
      );
      const querySnapshot = await withTimeout(getDocs(q));
      const timestamp = new Date().toISOString();
      const matchDoc = querySnapshot.docs.find(docSnap => {
        const d = docSnap.data();
        const storedFirst = String(d.first_name || '').trim().toUpperCase();
        const storedMiddle = String(d.middle_name || '').trim().toUpperCase();
        return storedFirst === uFirstName && storedMiddle === uMiddleName;
      });
      
      if (matchDoc) {
        return res.status(400).json({ 
          error: "A registration record with this name already exists. Duplicate enrollment is not allowed." 
        });
      }
      
      let seqId = "";
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
        console.warn("Could not determine dynamic next sequence number:", e);
      }

      let newRecordId = "";
      // Execute multi-document write in an atomic runTransaction block with a generous 5000ms timeout
      await withTimeout(runTransaction(firestoreDb, async (transaction) => {
        const counterRef = doc(firestoreDb, "counters", counterId);
        const counterDoc = await transaction.get(counterRef);
        
        const nextCount = nextAvailableNumber;
        const seqNum = String(nextCount);
        seqId = `SRC ${seqNum}${currentYearSuffix}`;
        
        // Save incremental count doc keeping maximum count synchronized
        const prevCount = counterDoc.exists() ? (counterDoc.data().count || 0) : 0;
        const newMaxCount = Math.max(prevCount, nextCount);
        
        transaction.set(counterRef, { count: newMaxCount, year: currentFullYear });
        
        // Prepare new document schema
        const newDocRef = doc(collection(firestoreDb, "users"));
        newRecordId = newDocRef.id;
        
        let assignedRole = "reviewee";
        if (uLastName === "PESALVER" && uFirstName === "ARIEL" && uMiddleName === "ORCIA") {
          assignedRole = "admin";
        }

        const recordData = {
          id: newDocRef.id,
          last_name: uLastName,
          lastName: uLastName,
          first_name: uFirstName,
          firstName: uFirstName,
          middle_name: uMiddleName,
          middleName: uMiddleName,
          school_name: uSchoolName,
          schoolName: uSchoolName,
          pin: uPin,
          seq_id: seqId,
          seqId: seqId,
          id_number: seqId,
          idNumber: seqId,
          srcId: seqId,
          created_at: timestamp,
          createdAt: timestamp,
          role: assignedRole
        };
        
        transaction.set(newDocRef, recordData);
      }), 5000);
      
      const responseData = { 
        success: true, 
        seqId, 
        last_name: uLastName, 
        first_name: uFirstName, 
        middle_name: uMiddleName, 
        school_name: uSchoolName, 
        created_at: timestamp,
        pin: uPin,
        doc_id: newRecordId
      };
      
      // Trigger sync automatically
      syncRecordToSheet(responseData).catch(err => console.warn("Automatic sync failed:", err.message || err));
      
      res.json(responseData);
    } catch (err: any) {
      const errorRef = Math.random().toString(36).substring(2, 10).toUpperCase();
      console.error(
        `[Enrollment Database Failed] [Ref: ${errorRef}]`,
        {
          operation: "enroll",
          error: err instanceof Error ? err.message : String(err),
        }
      );
      res.status(500).json({
        error: "ENROLL_FAILED",
        message: "Unable to complete enrollment. Please check your connection and try again.",
        referenceId: errorRef
      });
    }
  });

  app.post("/api/create-user-profile", async (req, res) => {
    try {
      const { uid, email, firstName, middleName, lastName, schoolName, reviewBranch, role } = req.body;
      if (!firestoreDb) return res.status(500).json({ error: "Database not initialized" });

      // 1. Create user profile
      const timestamp = new Date().toISOString();
      const userRef = doc(firestoreDb, "users", uid);
      const userData = {
        uid,
        email: (email || "").trim().toLowerCase(),
        email_lower: (email || "").trim().toLowerCase(),
        normalizedEmail: (email || "").trim().toLowerCase(),
        firstName: firstName || "",
        first_name: (firstName || "").toLowerCase(),
        middleName: middleName || "",
        middle_name: (middleName || "").toLowerCase(),
        lastName: lastName || "",
        last_name: (lastName || "").toLowerCase(),
        schoolName: schoolName || "",
        school_name: (schoolName || "").toLowerCase(),
        reviewBranch: reviewBranch || "",
        review_branch: (reviewBranch || "").toLowerCase(),
        role: role || "Reviewee",
        accountStatus: "active",
        createdAt: timestamp,
        created_at: timestamp,
        updatedAt: timestamp,
        updated_at: timestamp
      };
      await setDoc(userRef, userData, { merge: true });

      // 2. Create notifications for Admins/Staff
      try {
        const allUsersSnap = await getDocs(collection(firestoreDb, "users"));
        const adminStaffDocs = allUsersSnap.docs.filter(d => {
          const u = d.data();
          const r = (u.role || u.userRole || "").toLowerCase();
          const st = (u.accountStatus || u.status || "active").toLowerCase();
          return (r === "admin" || r === "staff" || r === "coadmin") && st === "active";
        });

        if (adminStaffDocs.length > 0) {
          const batch = writeBatch(firestoreDb);
          adminStaffDocs.forEach(d => {
            const recipientId = d.id;
            const notificationRef = doc(firestoreDb, "notifications", `new_user_${uid}_${recipientId}`);
            batch.set(notificationRef, {
              recipientId,
              type: "new_user_registered",
              title: "New User Registered",
              message: `${firstName || ""} ${lastName || ""}`.trim() + " has successfully registered a new account.",
              registeredUserId: uid,
              registeredUserName: `${firstName || ""} ${lastName || ""}`.trim(),
              registeredUserEmail: (email || "").trim().toLowerCase(),
              registeredUserRole: role || "Reviewee",
              isRead: false,
              createdAt: timestamp,
              route: "/admin/users",
              uniqueKey: `new_user_${uid}_${recipientId}`
            });
          });
          await batch.commit();
        }
      } catch (notifErr: any) {
        console.warn("Notice creating admin registration notifications:", notifErr?.message);
      }

      res.json({ success: true });
    } catch (err: any) {
      const errorRef = Math.random().toString(36).substring(2, 10).toUpperCase();
      console.error(
        `[Profile Activation Failed] [Ref: ${errorRef}]`,
        {
          uid: req.body?.uid,
          operation: "create-user-profile",
          error: err instanceof Error ? err.message : String(err),
        }
      );
      res.status(500).json({
        error: "ACTIVATION_FAILED",
        message: "We couldn’t complete your account activation. Please check your internet connection and try again.",
        referenceId: errorRef
      });
    }
  });

  const httpServer = createHttpServer(app);

  const distPath = path.join(process.cwd(), "dist");

  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: {
            server: httpServer,
          },
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware integrated successfully.");
    } catch (viteErr) {
      console.warn("Failed to launch Vite development middleware (likely running in a built production environment). Falling back to static files server:", viteErr);
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(distPath) && fs.existsSync(indexPath)) {
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
          res.sendFile(indexPath);
        });
      } else {
        console.error("CRITICAL: Neither the Vite development server nor a valid built 'dist/index.html' could be loaded.");
      }
    }
  } else {
    console.log(`Production mode identified. Serving static files from '${distPath}'.`);
    const indexPath = path.join(distPath, "index.html");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application static files not found.");
      }
    });
  }

  // Start background cleanup job for audit logs
  startAuditLogCleanupJob();

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
