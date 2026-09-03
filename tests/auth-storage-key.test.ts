import { describe, expect, it } from 'vitest';
import { getSupabaseAuthStorageKey } from '@/lib/supabaseAuthStorage';

describe('getSupabaseAuthStorageKey', () => {
  it('scopes sessions to the configured project id', () => {
    expect(
      getSupabaseAuthStorageKey(
        'rqfqwavhtfwwtmfjnxkx',
        'https://rqfqwavhtfwwtmfjnxkx.supabase.co',
      ),
    ).toBe('pulse-auth:rqfqwavhtfwwtmfjnxkx');
  });

  it('falls back to the project id in the Supabase URL', () => {
    expect(
      getSupabaseAuthStorageKey(undefined, 'https://example-project.supabase.co'),
    ).toBe('pulse-auth:example-project');
  });

  it('never falls back to the legacy backend-independent key', () => {
    expect(getSupabaseAuthStorageKey(undefined, 'not a url')).toBe('pulse-auth:default');
    expect(getSupabaseAuthStorageKey(undefined, 'not a url')).not.toBe('pulse-auth');
  });
});
