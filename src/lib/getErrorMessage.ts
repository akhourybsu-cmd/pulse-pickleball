/**
 * Safely extract a human-readable message from an unknown thrown value.
 *
 * Lets call sites type their catch/onError parameters as `unknown` (instead of
 * `any`) while still surfacing a useful message. Handles the common shapes:
 * Error instances, Supabase/PostgREST error objects ({ message }), and plain
 * strings — falling back to a caller-supplied default otherwise.
 */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}

/**
 * Extract a PostgREST/Postgres error code (e.g. "22P02" for invalid text
 * representation) from an unknown thrown value, or undefined if absent.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}
