import { describe, expect, it } from 'vitest';
import { createSafeAuthStorage } from '../../src/lib/supabaseAuthStorage';
import { PRODUCTION_SUPABASE_PROJECT, validateStagingSupabase } from '../../scripts/validate-supabase-config.mjs';
class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
describe('auth storage during guest-to-account handoff', () => {
  it('keeps public pages usable when browser storage getters throw', () => {
    const blocked = () => { throw new Error('storage blocked'); };
    const store = createSafeAuthStorage({ local: blocked, session: blocked });
    expect(store.getItem('auth')).toBeNull();
    store.setItem('auth', 'memory-only'); expect(store.getItem('auth')).toBe('memory-only');
    store.removeItem('auth'); expect(store.getItem('auth')).toBeNull();
    expect(createSafeAuthStorage({ local: blocked, session: blocked }).getItem('auth')).toBeNull();
  });
  it('honors changes to stay signed in and removes the stale session copy', () => {
    const local = new MemoryStorage(); const session = new MemoryStorage();
    const store = createSafeAuthStorage({ local: () => local, session: () => session });
    store.setItem('auth', 'persisted'); expect(local.getItem('auth')).toBe('persisted');
    local.setItem('pulse_persist_session', 'false');
    store.setItem('auth', 'session-only');
    expect(session.getItem('auth')).toBe('session-only'); expect(local.getItem('auth')).toBeNull();
    store.removeItem('auth'); expect(store.getItem('auth')).toBeNull();
    expect(local.getItem('pulse_persist_session')).toBe('false');
  });
  it('falls back to memory on quota errors and clears it on sign-out', () => {
    const local = new MemoryStorage(); const session = new MemoryStorage();
    local.setItem = () => { throw new Error('quota'); };
    const store = createSafeAuthStorage({ local: () => local, session: () => session });
    store.setItem('auth', 'temporary'); expect(store.getItem('auth')).toBe('temporary');
    store.removeItem('auth'); expect(store.getItem('auth')).toBeNull();
  });
});
describe('separate staging configuration', () => {
  const project = 'abcdefghijklmnopqrst';
  const env = { VITE_SUPABASE_PROJECT_ID: project, VITE_SUPABASE_URL: `https://${project}.supabase.co`, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_testfixture' };
  it('accepts a dedicated project and public key', () => { expect(() => validateStagingSupabase(env)).not.toThrow(); });
  it('blocks accidental production fallback and incomplete setup', () => {
    expect(() => validateStagingSupabase({ ...env, VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_PROJECT, VITE_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT}.supabase.co` })).toThrow('separate test project');
    expect(() => validateStagingSupabase({})).toThrow('separate test project');
  });
  it('rejects server secrets and another project’s legacy key without echoing either', () => {
    for (const key of ['sb_secret_do-not-expose', 'header.' + Buffer.from(JSON.stringify({ role: 'anon', ref: PRODUCTION_SUPABASE_PROJECT })).toString('base64url') + '.signature']) {
      expect(() => validateStagingSupabase({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key })).toThrow('public client key');
      try { validateStagingSupabase({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }); } catch (error) { expect(String(error)).not.toContain(key); }
    }
  });
});
