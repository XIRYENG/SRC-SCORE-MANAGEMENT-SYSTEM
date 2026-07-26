/**
 * Shared String Utility Functions
 */

/**
 * Normalizes an email address by converting it to lowercase and trimming leading/trailing whitespace.
 * Preserves all valid email characters including '.', '_', '+', and '-'.
 */
export function normalizeEmail(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}
