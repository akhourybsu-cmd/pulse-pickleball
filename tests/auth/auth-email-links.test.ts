import { describe, expect, it } from 'vitest';
import { buildAuthActionUrl } from '../../supabase/functions/_shared/auth-email-links';

describe('PULSE auth email verification links', () => {
  it.each(['signup', 'recovery', 'magiclink', 'invite', 'email_change'])('verifies %s at its issuing backend before returning to the assessment', (type) => {
    const redirect = 'http://localhost:5199/auth?redirect=%2Fskill-assessment%3Fsave%3D8d180419-e822-4f44-a0ce-387c3d066488';
    const url = new URL(buildAuthActionUrl('https://svdpujbstxiaunoeqlee.supabase.co', type, 'hashed-token+with/characters=', redirect));
    expect(url.origin).toBe('https://svdpujbstxiaunoeqlee.supabase.co');
    expect(url.pathname).toBe('/auth/v1/verify');
    expect(url.searchParams.get('token')).toBe('hashed-token+with/characters=');
    expect(url.searchParams.get('type')).toBe(type);
    expect(url.searchParams.get('redirect_to')).toBe(redirect);
  });
  it.each(['', 'optional-hash'])('does not require a confirmation URL for code-only reauthentication (%s)', (hash) => {
    expect(buildAuthActionUrl('https://svdpujbstxiaunoeqlee.supabase.co', 'reauthentication', hash, '')).toBe('');
  });
  it('uses the configured production Auth API too, without a hardcoded staging origin', () => {
    const url = new URL(buildAuthActionUrl('https://rqfqwavhtfwwtmfjnxkx.supabase.co', 'signup', 'token-hash', 'https://pulsepb.com/auth'));
    expect(url.origin).toBe('https://rqfqwavhtfwwtmfjnxkx.supabase.co');
    expect(url.searchParams.get('redirect_to')).toBe('https://pulsepb.com/auth');
  });
  it('lets Auth choose its configured return URL when none is supplied', () => {
    expect(new URL(buildAuthActionUrl('https://svdpujbstxiaunoeqlee.supabase.co', 'signup', 'token-hash', '')).searchParams.has('redirect_to')).toBe(false);
  });
  it('rejects a missing token instead of emailing a link that cannot confirm the account', () => {
    expect(() => buildAuthActionUrl('https://svdpujbstxiaunoeqlee.supabase.co', 'signup', '', 'https://pulsepb.com')).toThrow('Missing email verification token');
  });
});
