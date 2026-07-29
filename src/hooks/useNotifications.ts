import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, type Firestore } from 'firebase/firestore';
import type { Notification } from '../types';
import { logFirestoreError } from '../utils/firestoreErrorHandling';

export const useNotifications = (db: Firestore | null, userId: string | undefined) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!db || !userId) {
      setLoading(false);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Notification[];
        
        // Sort client-side to avoid index requirements
        notificationsData.sort((a, b) => {
          const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
          const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
          return timeB - timeA;
        });

        setNotifications(notificationsData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const issue = logFirestoreError("notifications-hook", err);
        setError(issue);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, userId]);

  return { notifications, loading, error };
};
