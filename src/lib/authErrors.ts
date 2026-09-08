/** Only transport/service failures are retryable; invalid/revoked sessions are not. */
export function isTransientAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; status?: number; message?: string };
  return e.name === 'AuthRetryableFetchError' || e.name === 'AbortError'
    || e.status === 0 || e.status === 429 || (e.status != null && e.status >= 500)
    || (e.name === 'TypeError' && /fetch|network/i.test(e.message ?? ''));
}
