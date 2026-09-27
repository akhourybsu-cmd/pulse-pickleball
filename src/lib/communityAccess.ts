import { sanitizeRedirectPath } from './authRedirect';
import { RESERVED_VENUE_HOSTS } from './venues/address';

export function communityAuthUrl(path: string, mode: 'signup' | 'signin' = 'signup'): string {
  return `/auth?${new URLSearchParams({ mode, redirect: sanitizeRedirectPath(path) })}`;
}

export const venuePublicPath = (slug: string) => `/venues/${encodeURIComponent(slug)}`;
export const venuePublicUrl = (slug: string) => `https://pulsepb.com${venuePublicPath(slug)}`;


// Venue domains are entry links. Keep auth and storage on the primary origin,
// so visiting another club never creates another sign-in session.
export function venueHostDestination(url: URL): string | null {
  const match = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.pulsepb\.com$/.exec(url.hostname.toLowerCase());
  if (!match || RESERVED_VENUE_HOSTS.has(match[1])) return null;
  const path = url.pathname === '/' ? venuePublicPath(match[1]) : url.pathname;
  return `https://pulsepb.com${path}${url.search}${url.hash}`;
}

export function publicWebsiteUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL(value || '');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
