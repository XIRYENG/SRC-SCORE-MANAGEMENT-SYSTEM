import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { ScoreFolder, RevieweeData, ScoreManagementViewPreference } from '../types';

interface UseScoreManagementPreferencesOptions {
  currentUser?: RevieweeData | null;
  folders: ScoreFolder[];
}

export function useScoreManagementPreferences({
  currentUser,
  folders
}: UseScoreManagementPreferencesOptions) {
  const [isPreferencesReady, setIsPreferencesReady] = useState(false);
  const [preference, setPreference] = useState<ScoreManagementViewPreference>({
    folderId: null,
    categoryId: null,
    majorAreaId: null,
    subjectId: null,
    evaluationDate: null,
    schoolId: null,
    branchId: null,
    publicationStatus: null,
    viewMode: null,
  });

  const uid = currentUser?.uid || currentUser?.seqId || (currentUser as any)?.id || 'guest-user';
  const role = currentUser?.role || ((currentUser as any)?.isAdmin ? 'admin' : 'staff');
  const storageKey = `src-score-management-view:${uid}:${role}`;

  const isRestoringRef = useRef(true);
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const loadPrefs = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlFolder = urlParams.get('folder');
        const urlCategory = urlParams.get('category');
        const urlArea = urlParams.get('area') || urlParams.get('majorArea');
        const urlSubject = urlParams.get('subject');

        let loadedPref: ScoreManagementViewPreference = {
          folderId: urlFolder || null,
          categoryId: urlCategory || null,
          majorAreaId: urlArea || null,
          subjectId: urlSubject || null,
          evaluationDate: urlParams.get('date') || null,
          schoolId: urlParams.get('school') || null,
          branchId: urlParams.get('branch') || null,
          publicationStatus: urlParams.get('pub') || null,
          viewMode: urlParams.get('view') || null,
        };

        if (!loadedPref.folderId || !loadedPref.categoryId) {
          if (firestoreDb && uid && uid !== 'guest-user') {
            try {
              const prefDocRef = doc(firestoreDb, 'user_preferences', uid);
              const snap = await getDoc(prefDocRef);
              if (snap.exists()) {
                const data = snap.data();
                if (data.scoreManagement) {
                  loadedPref = {
                    ...loadedPref,
                    folderId: loadedPref.folderId || data.scoreManagement.folderId || null,
                    categoryId: loadedPref.categoryId || data.scoreManagement.categoryId || null,
                    majorAreaId: loadedPref.majorAreaId || data.scoreManagement.majorAreaId || null,
                    subjectId: loadedPref.subjectId || data.scoreManagement.subjectId || null,
                    evaluationDate: loadedPref.evaluationDate || data.scoreManagement.evaluationDate || null,
                    schoolId: loadedPref.schoolId || data.scoreManagement.schoolId || null,
                    branchId: loadedPref.branchId || data.scoreManagement.branchId || null,
                    publicationStatus: loadedPref.publicationStatus || data.scoreManagement.publicationStatus || null,
                    viewMode: loadedPref.viewMode || data.scoreManagement.viewMode || null,
                  };
                }
              }
            } catch (err) {
              console.warn("Could not load score management preferences from Firestore:", err);
            }
          }

          if (!loadedPref.folderId || !loadedPref.categoryId) {
            try {
              const localData = localStorage.getItem(storageKey);
              if (localData) {
                const parsed = JSON.parse(localData);
                loadedPref = {
                  ...loadedPref,
                  folderId: loadedPref.folderId || parsed.folderId || null,
                  categoryId: loadedPref.categoryId || parsed.categoryId || null,
                  majorAreaId: loadedPref.majorAreaId || parsed.majorAreaId || null,
                  subjectId: loadedPref.subjectId || parsed.subjectId || null,
                  evaluationDate: loadedPref.evaluationDate || parsed.evaluationDate || null,
                  schoolId: loadedPref.schoolId || parsed.schoolId || null,
                  branchId: loadedPref.branchId || parsed.branchId || null,
                  publicationStatus: loadedPref.publicationStatus || parsed.publicationStatus || null,
                  viewMode: loadedPref.viewMode || parsed.viewMode || null,
                };
              }
            } catch (err) {
              console.warn("Could not load score management preferences from localStorage:", err);
            }
          }
        }

        // Validate folder existence if folders are already loaded
        if (loadedPref.folderId && folders.length > 0) {
          const validFolder = folders.find(f => f.id === loadedPref.folderId && !f.isArchived && !f.isDeleted);
          if (!validFolder) {
            loadedPref.folderId = null;
          }
        }

        if (isMounted) {
          setPreference(loadedPref);
          setIsPreferencesReady(true);
          setTimeout(() => {
            isRestoringRef.current = false;
          }, 600);
        }
      } catch (err) {
        console.error("Error loading score management preferences:", err);
        if (isMounted) {
          setIsPreferencesReady(true);
          isRestoringRef.current = false;
        }
      }
    };

    loadPrefs();
    return () => {
      isMounted = false;
    };
  }, [uid, role, storageKey, folders.length]);

  const savePreference = useCallback((updates: Partial<ScoreManagementViewPreference>) => {
    if (isRestoringRef.current) return;

    setPreference(prev => {
      const next = { ...prev, ...updates };

      try {
        localStorage.setItem(storageKey, JSON.stringify({ ...next, savedAt: new Date().toISOString() }));
      } catch (err) {
        console.warn("Failed to save score preferences to localStorage:", err);
      }

      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (next.folderId) urlParams.set('folder', next.folderId);
        else urlParams.delete('folder');

        if (next.categoryId) urlParams.set('category', next.categoryId);
        else urlParams.delete('category');

        if (next.majorAreaId) urlParams.set('area', next.majorAreaId);
        else urlParams.delete('area');

        if (next.subjectId) urlParams.set('subject', next.subjectId);
        else urlParams.delete('subject');

        const newQuery = urlParams.toString();
        const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
      } catch (err) {
        // ignore
      }

      if (firestoreDb && uid && uid !== 'guest-user') {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const prefRef = doc(firestoreDb, 'user_preferences', uid);
            await setDoc(prefRef, {
              scoreManagement: {
                ...next,
                updatedAt: serverTimestamp()
              }
            }, { merge: true });
          } catch (err) {
            console.warn("Failed to sync score preferences to Firestore:", err);
          }
        }, 600);
      }

      return next;
    });
  }, [storageKey, uid]);

  return {
    preference,
    savePreference,
    isPreferencesReady
  };
}
