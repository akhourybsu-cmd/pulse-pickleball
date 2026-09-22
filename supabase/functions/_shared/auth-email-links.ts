/** Auth verifies the token on the issuing backend before returning to PULSE.
 * The hook's site_url is the frontend, not the Auth API origin.
 */
export function buildAuthActionUrl(supabaseUrl: string, emailType: string, tokenHash: string, redirectTo: string): string {
  if (!tokenHash) throw new Error('Missing email verification token');
  const actionUrl = new URL('/auth/v1/verify', supabaseUrl);
  actionUrl.searchParams.set('token', tokenHash);
  actionUrl.searchParams.set('type', emailType);
  // Supabase validates this destination against the project's allowlist.
  if (redirectTo) actionUrl.searchParams.set('redirect_to', redirectTo);
  return actionUrl.toString();
}
