import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { ScoreFolder } from '../types';

export function useScoreFolders() {
  const [folders, setFolders] = useState<ScoreFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    }, (error) => {
      console.error('Error fetching score folders:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { folders, loading };
}
