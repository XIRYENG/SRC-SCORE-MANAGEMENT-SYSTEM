import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { ScoreFolder } from '../types';
import { logFirestoreError } from '../utils/firestoreErrorHandling';

export function useScoreFolders() {
  const [folders, setFolders] = useState<ScoreFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!firestoreDb) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(firestoreDb, 'scoreFolders'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const folderList: ScoreFolder[] = [];
      snapshot.forEach((doc) => {
        folderList.push({ id: doc.id, ...doc.data() } as ScoreFolder);
      });
      setFolders(folderList);
      setLoading(false);
      setError(null);
    }, (err) => {
      const issue = logFirestoreError("score-folders-hook", err);
      setError(issue);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { folders, loading, error };
}
