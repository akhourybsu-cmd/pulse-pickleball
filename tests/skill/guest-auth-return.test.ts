import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPostAuthRedirect, consumePostAuthRedirect, DEFAULT_AUTH_DESTINATION, isAssessmentSaveRedirect, peekPostAuthRedirect, stashPostAuthRedirect } from '../../src/lib/authRedirect';
import { guestSaveReturnPath } from '../../src/lib/skill/guestAssessment';
const memory = () => { const values = new Map<string, string>(); return {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
}; };
beforeEach(() => { vi.stubGlobal('sessionStorage', memory()); vi.stubGlobal('localStorage', memory()); });
afterEach(() => vi.unstubAllGlobals());
describe('assessment auth callback coordination', () => {
  it('keeps the return path stable across competing App, Index and Auth resolvers until arrival', () => {
    const target = guestSaveReturnPath('10000000-0000-4000-8000-000000000001');
    stashPostAuthRedirect(target);
    expect(consumePostAuthRedirect()).toBe(target);
    expect(consumePostAuthRedirect()).toBe(target);
    expect(peekPostAuthRedirect()).toBe(target);
    clearPostAuthRedirect();
    expect(consumePostAuthRedirect()).toBe(DEFAULT_AUTH_DESTINATION);
  });
  it('restores the handoff in a confirmation-email tab through local storage', () => {
    const target = guestSaveReturnPath('10000000-0000-4000-8000-000000000001');
    stashPostAuthRedirect(target);
    vi.stubGlobal('sessionStorage', memory());
    expect(consumePostAuthRedirect()).toBe(target);
  });
  it('preserves ordinary one-use redirects and rejects non-assessment/external return shapes', () => {
    stashPostAuthRedirect('/player/matches');
    expect(consumePostAuthRedirect()).toBe('/player/matches');
    expect(consumePostAuthRedirect()).toBe(DEFAULT_AUTH_DESTINATION);
    expect(isAssessmentSaveRedirect('https://example.com/skill-assessment?save=bad')).toBe(false);
    expect(isAssessmentSaveRedirect('/skill-assessment?save=bad')).toBe(false);
    stashPostAuthRedirect('//example.com');
    expect(consumePostAuthRedirect()).toBe(DEFAULT_AUTH_DESTINATION);
  });
  it('does not let arrival in an older tab remove a newer return destination', () => {
    const old = guestSaveReturnPath('10000000-0000-4000-8000-000000000001');
    const next = guestSaveReturnPath('10000000-0000-4000-8000-000000000002');
    stashPostAuthRedirect(next);
    clearPostAuthRedirect(old);
    expect(peekPostAuthRedirect()).toBe(next);
    clearPostAuthRedirect(next);
    expect(peekPostAuthRedirect()).toBeNull();
  });
  it('reports a failed handoff when storage is blocked and falls back when just one store works', () => {
    const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
    vi.stubGlobal('sessionStorage', blocked);
    const path = guestSaveReturnPath('10000000-0000-4000-8000-000000000001');
    expect(stashPostAuthRedirect(path)).toBe(true);
    vi.stubGlobal('localStorage', blocked);
    expect(stashPostAuthRedirect(path)).toBe(false);
    expect(consumePostAuthRedirect()).toBe(DEFAULT_AUTH_DESTINATION);
  });
  it('rejects browser-normalized external paths and control characters', () => {
    for (const path of ['/\\evil.example', '/\n/evil.example', '/\t/evil.example']) {
      stashPostAuthRedirect(path);
      expect(consumePostAuthRedirect()).toBe(DEFAULT_AUTH_DESTINATION);
    }
  });
});
