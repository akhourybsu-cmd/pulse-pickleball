import type { SupabaseClient } from '@supabase/supabase-js';
import { isAuthEntryPath } from './authRedirect';
import { withAuthDeadline } from './authDeadline';

type CallbackAuth = Pick<SupabaseClient['auth'], 'initialize' | 'setSession' | 'getSession'>;
const authParameters = [
  'code', 'state', 'type', 'error', 'error_code', 'error_description',
  'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token',
  'expires_in', 'expires_at', 'token_type',
];
const invalidLink = () => new Error('This sign-in link could not be completed. Open it in the browser where you started, or sign in again.');

export function hasPendingAuthCallback(href: string): boolean {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const get = (key: string) => hash.get(key) || url.searchParams.get(key);
  if (get('type') === 'recovery' || url.pathname === '/reset-password') return false;
  return !!(get('error') || get('error_description') || get('error_code') || get('access_token') || get('refresh_token') ||
    (get('code') && (isAuthEntryPath(url.pathname) || url.searchParams.has('state') ||
      url.pathname.startsWith('/profile') || url.pathname.startsWith('/player/profile'))));
}

/** The SDK owns PKCE exchange. Re-exchanging its single-use code after
 * initialize() consumes the verifier causes a false error after a good login.
 * Explicit tokens still need setSession because our PKCE client rejects
 * admin-generated implicit links during initialization.
 */
export async function completeAuthCallback(
  auth: CallbackAuth,
  readUrl: () => string,
  replaceUrl: (path: string) => void,
  timeoutMs = 15_000,
): Promise<{ handled: boolean; entryPath: boolean }> {
  const url = new URL(readUrl());
  if (!hasPendingAuthCallback(url.href)) return { handled: false, entryPath: false };
  const hash = new URLSearchParams(url.hash.slice(1));
  const get = (key: string) => hash.get(key) || url.searchParams.get(key);
  try {
    await withAuthDeadline(async signal => {
      if (get('error') || get('error_code') || get('error_description')) throw invalidLink();
      const accessToken = get('access_token');
      const refreshToken = get('refresh_token');
      if (accessToken || refreshToken) {
        if (!accessToken || !refreshToken) throw invalidLink();
        const { data, error } = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error || !data.session) throw invalidLink();
        return;
      }
      const { error: initializationError } = await auth.initialize();
      if (signal.aborted) return;
      const remaining = new URL(readUrl());
      // Missing verifier / another browser: initialization leaves the code
      // untouched. Never substitute an unrelated existing session for it.
      if (initializationError || remaining.searchParams.has('code') ||
        new URLSearchParams(remaining.hash.slice(1)).has('code')) throw invalidLink();
      const { data, error } = await auth.getSession();
      if (error || !data.session) throw invalidLink();
    }, timeoutMs);
    return { handled: true, entryPath: isAuthEntryPath(url.pathname) };
  } finally {
    const current = new URL(readUrl());
    authParameters.forEach(key => current.searchParams.delete(key));
    const currentHash = new URLSearchParams(current.hash.slice(1));
    if (authParameters.some(key => currentHash.has(key))) current.hash = '';
    replaceUrl(`${current.pathname}${current.search}${current.hash}`);
  }
}
