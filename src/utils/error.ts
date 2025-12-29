/**
 * Error handling utilities
 */

/**
 * Extracts a clean error message from an unknown error value
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
