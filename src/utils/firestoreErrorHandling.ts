import type { FirestoreError } from 'firebase/firestore';

export type FirestoreListenerIssue = {
  code: string;
  message: string;
  recoverable: boolean;
  userMessage: string;
};

export function classifyFirestoreListenerError(
  error: FirestoreError
): FirestoreListenerIssue {
  switch (error.code) {
    case 'permission-denied':
      return {
        code: error.code,
        message: error.message,
        recoverable: false,
        userMessage:
          'You do not have permission to access this information.',
      };

    case 'unauthenticated':
      return {
        code: error.code,
        message: error.message,
        recoverable: false,
        userMessage:
          'Your session has expired. Please sign in again.',
      };

    case 'failed-precondition':
      return {
        code: error.code,
        message: error.message,
        recoverable: false,
        userMessage:
          'This query requires additional database configuration (index or limit).',
      };

    case 'unavailable':
    case 'deadline-exceeded':
    case 'cancelled':
      return {
        code: error.code,
        message: error.message,
        recoverable: true,
        userMessage:
          'The connection was interrupted. Reconnecting…',
      };

    default:
      return {
        code: error.code,
        message: error.message,
        recoverable: true,
        userMessage:
          'Unable to update this information right now.',
      };
  }
}

export function logFirestoreError(listenerName: string, error: FirestoreError) {
  const issue = classifyFirestoreListenerError(error);
  console.error(`[Firestore][${listenerName}]`, {
    code: error.code,
    message: error.message,
    userMessage: issue.userMessage,
    recoverable: issue.recoverable,
    online: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown'
  });
  return issue;
}
