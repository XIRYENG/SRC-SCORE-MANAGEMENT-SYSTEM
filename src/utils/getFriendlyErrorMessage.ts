export type FriendlyError = {
  title: string;
  message: string;
  secondaryMessage?: string;
  referenceId?: string;
};

/**
 * Safely parses any error object/string, checks for JSON-wrapped technical detail
 * objects (like FirestoreErrorInfo), and returns a production-safe user-friendly error details structure.
 */
export function getFriendlyErrorMessage(error: unknown): FriendlyError {
  const fallbackTitle = "Unable to Activate Account";
  const fallbackMessage = "We couldn’t complete your account activation. Please check your internet connection and try again.";
  const fallbackSecondary = "If the problem continues, please contact Samaritan Review Center support.";

  // Generate a random 8-character troubleshooting reference ID
  let referenceId = "";
  try {
    if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
      referenceId = window.crypto.randomUUID().slice(0, 8).toUpperCase();
    } else {
      referenceId = Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  } catch {
    referenceId = "ERR" + Math.floor(100000 + Math.random() * 900000);
  }

  if (!error) {
    return {
      title: fallbackTitle,
      message: fallbackMessage,
      secondaryMessage: fallbackSecondary,
      referenceId,
    };
  }

  // 1. Extract raw error string
  let raw = "";
  if (error instanceof Error) {
    raw = error.message;
  } else if (typeof error === "string") {
    raw = error;
  } else {
    try {
      raw = JSON.stringify(error);
    } catch {
      raw = String(error);
    }
  }

  // 2. Try parsing as FirestoreErrorInfo JSON
  let technicalMessage = raw;
  try {
    if (raw.trim().startsWith("{") && raw.trim().endsWith("}")) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === "string") {
        technicalMessage = parsed.error;
      } else if (parsed && typeof parsed.message === "string") {
        technicalMessage = parsed.message;
      }
    }
  } catch {
    // Not valid JSON, proceed with raw message
  }

  const value = technicalMessage.toLowerCase();

  // SPECIAL CASE: CONNECTION / OFFLINE / TIMEOUT
  if (
    value.includes("network") ||
    value.includes("connection failed") ||
    value.includes("failed to fetch") ||
    value.includes("offline") ||
    value.includes("vercel") ||
    value.includes("gateway") ||
    value.includes("timeout") ||
    value.includes("deadline-exceeded") ||
    value.includes("quota exceeded")
  ) {
    return {
      title: "Connection Problem",
      message: "Please check your internet connection and try again.",
      secondaryMessage: "Your entered information has been preserved.",
      referenceId,
    };
  }

  // SPECIAL CASE: EXISTING EMAIL / DUPLICATE
  if (
    value.includes("already exists") ||
    value.includes("already-in-use") ||
    value.includes("duplicate") ||
    value.includes("409") ||
    value.includes("email-already-in-use")
  ) {
    return {
      title: "Account Already Exists",
      message: "An account already exists for this email. Please sign in to continue.",
      referenceId,
    };
  }

  // SPECIAL CASE: AUTHENTICATION EXPIRED / REQUIRED
  if (
    value.includes("session") ||
    value.includes("expired") ||
    value.includes("auth") ||
    value.includes("unauthorized") ||
    value.includes("401") ||
    value.includes("token")
  ) {
    return {
      title: "Session Expired",
      message: "Your session has expired. Please sign in again.",
      referenceId,
    };
  }

  // SPECIAL CASE: PERMISSION / FORBIDDEN
  if (
    value.includes("permission-denied") ||
    value.includes("permission denied") ||
    value.includes("unauthorized") ||
    value.includes("forbidden") ||
    value.includes("403")
  ) {
    return {
      title: "Unable to Complete Activation",
      message: "Your account is not allowed to complete this action. Please contact support.",
      referenceId,
    };
  }

  // Fallback generic error structure
  return {
    title: fallbackTitle,
    message: fallbackMessage,
    secondaryMessage: fallbackSecondary,
    referenceId,
  };
}
