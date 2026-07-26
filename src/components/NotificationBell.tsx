import React, { useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import type { Notification } from '../types';

interface NotificationBellProps {
  notifications: Notification[];
  db: Firestore;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, db }) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadNotifications = notifications.filter((n) => !n.isRead);

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <Bell size={20} className="text-gray-600" />
        {unreadNotifications.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadNotifications.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
              <button onClick={() => setIsOpen(false)}><X size={16} /></button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`p-4 border-b border-gray-50 ${n.isRead ? 'bg-gray-50' : 'bg-white'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-gray-900">{n.title}</h4>
                        <p className="text-xs text-gray-600 mt-1">{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="ml-2 p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Check size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
