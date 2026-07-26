import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { firestoreDb, initFirebaseClient } from '../utils/firebaseClient';

export function useFirestoreUsers() {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { db } = await initFirebaseClient();
      if (!db) return;

      const q = query(collection(db, "users"));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const users = snapshot.docs.map((doc) => ({
            uid: doc.id,
            ...doc.data(),
          }));

          setAllUsers(users);
          setLoading(false);
        },
        (error) => {
          console.error("Failed to load users:", error);
          setLoading(false);
        }
      );
      return () => unsub();
    };

    init();
  }, []);

  return { allUsers, loading };
}
