import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { communityAuthUrl, publicWebsiteUrl, venueHostDestination, venuePublicPath } from '@/lib/communityAccess';
import { clearPostAuthRedirect, consumePostAuthRedirect, DEFAULT_AUTH_DESTINATION, isCommunityReturnPath, stashPostAuthRedirect } from '@/lib/authRedirect';

const memory = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }; };
beforeEach(() => { vi.stubGlobal('localStorage', memory()); vi.stubGlobal('sessionStorage', memory()); });
afterEach(() => vi.unstubAllGlobals());
describe('community account handoff', () => {
  const path = '/player/community/group/abc?tab=chat&view=community#latest';
  it('opens signup with the exact page, query and fragment; also supports sign in', () => {
    const url = new URL(communityAuthUrl(path), 'https://pulsepb.com');
    expect(url.searchParams.get('mode')).toBe('signup');
    expect(url.searchParams.get('redirect')).toBe(path);
    expect(new URL(communityAuthUrl(path, 'signin'), url.origin).searchParams.get('mode')).toBe('signin');
  });
  it('survives repeated auth resolvers and a fresh confirmation tab until arrival', () => {
    stashPostAuthRedirect(path);
    vi.stubGlobal('sessionStorage', memory());
    expect(consumePostAuthRedirect()).toBe(path);
    expect(consumePostAuthRedirect()).toBe(path);
    clearPostAuthRedirect(path);
    expect(consumePostAuthRedirect()).toBe(DEFAULT_AUTH_DESTINATION);
  });
  it('recognizes public routes without accidentally opening management pages', () => {
    for (const path of ['/player/community', '/player/community/join/ABCD', '/venues/palace?tab=book', '/player/community/group/abc?tab=chat']) expect(isCommunityReturnPath(path)).toBe(true);
    for (const path of ['/player/community/group/abc/manage', '/player/community/group/abc/ops', '/player/payments', '//evil.example']) expect(isCommunityReturnPath(path)).toBe(false);
    expect(new URL(communityAuthUrl('//evil.example'), 'https://pulsepb.com').searchParams.get('redirect')).toBe(DEFAULT_AUTH_DESTINATION);
  });
  it('uses subdomains as primary-origin entry links, preserving deep links', () => {
    expect(venueHostDestination(new URL('https://palace.pulsepb.com/?tab=chat#latest'))).toBe('https://pulsepb.com/venues/palace?tab=chat#latest');
    expect(venueHostDestination(new URL('https://palace.pulsepb.com/auth?redirect=%2Fvenues%2Fpalace'))).toBe('https://pulsepb.com/auth?redirect=%2Fvenues%2Fpalace');
    for (const host of ['pulsepb.com', 'www.pulsepb.com', 'auth.pulsepb.com', 'notify.pulsepb.com', 'palace.pulsepb.com.evil.com', 'a.b.pulsepb.com']) expect(venueHostDestination(new URL(`https://${host}/`))).toBeNull();
    expect(venuePublicPath('palace / #')).toBe('/venues/palace%20%2F%20%23');
  });
  it('rejects unsafe venue website links', () => {
    expect(publicWebsiteUrl('https://example.com')).toBe('https://example.com/');
    for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'bad-url']) expect(publicWebsiteUrl(value)).toBeNull();
  });
});
