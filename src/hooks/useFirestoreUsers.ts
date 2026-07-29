import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { logFirestoreError } from '../utils/firestoreErrorHandling';

export function useFirestoreUsers() {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!firestoreDb) return;

    const q = query(collection(firestoreDb, "users"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const users = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }));

        setAllUsers(users);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const issue = logFirestoreError("users-hook", err);
        setError(issue);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { allUsers, loading, error };
}
