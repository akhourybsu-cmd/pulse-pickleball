import { describe, expect, it } from 'vitest';
import { createGuestAssessment, parseGuestAssessment, readGuestAssessment, writeGuestAssessment, clearGuestAssessment, GUEST_ASSESSMENT_KEY, GUEST_RETENTION_MS, canAutoSaveGuest, guestSaveReturnPath } from '../../src/lib/skill/guestAssessment';
import { QUESTION_BANK_V2 } from '../../src/lib/skill/questionBankV2';
import { selectNextV2 } from '../../src/lib/skill/adaptiveV2';
import { scoreAssessment, type Responses } from '../../src/lib/skill/scoring';
import { computeGuestClaim } from '../../supabase/functions/_shared/skill/claim';
const memory = () => { const values = new Map<string, string>(); return {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
}; };
export function completedGuest() {
  const draft = createGuestAssessment();
  const responses: Responses = {};
  while (Object.keys(responses).length < 64) {
    const key = selectNextV2(QUESTION_BANK_V2, responses);
    if (!key) break;
    responses[key] = 'usually';
  }
  return { ...draft, responses, completedAt: Date.now() };
}

describe('anonymous assessment retention and explicit save intent', () => {
  it('resumes raw answers, discards injected derived scores and preserves the idempotency key', () => {
    const storage = memory();
    const draft = completedGuest();
    expect(writeGuestAssessment(storage, draft)).toBe(true);
    expect(readGuestAssessment(storage)).toEqual(draft);
    expect(parseGuestAssessment(JSON.stringify({ ...draft, snapshot: { estimatedLevelRaw: 9 } }))).toEqual(draft);
    expect(guestSaveReturnPath(draft.id)).not.toContain('responses');
  });
  it('clears expired drafts and rejects forged retention periods', () => {
    const storage = memory(); const draft = createGuestAssessment(1000);
    writeGuestAssessment(storage, draft);
    expect(readGuestAssessment(storage, 1000 + GUEST_RETENTION_MS)).toBeNull();
    expect(storage.getItem(GUEST_ASSESSMENT_KEY)).toBeNull();
    expect(parseGuestAssessment(JSON.stringify({ ...draft, expiresAt: 9e15 }), 2000)).toBeNull();
  });
  it('handles corruption, unknown questions, unsupported versions and invalid response keys', () => {
    const draft = createGuestAssessment();
    for (const raw of ['{', JSON.stringify({ ...draft, version: 1 }), JSON.stringify({ ...draft, responses: { bad: 'usually' } }), JSON.stringify({ ...draft, responses: { [QUESTION_BANK_V2[0].itemKey]: '__proto__' } })]) {
      expect(parseGuestAssessment(raw)).toBeNull();
    }
  });
  it('reports unavailable storage without throwing or pretending the handoff is durable', () => {
    const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
    expect(readGuestAssessment(blocked)).toBeNull();
    expect(writeGuestAssessment(blocked, createGuestAssessment())).toBe(false);
    expect(writeGuestAssessment(null, createGuestAssessment())).toBe(false);
  });
  it('requires both explicit intent and a matching completed report for automatic transfer', () => {
    const draft = completedGuest();
    expect(canAutoSaveGuest(draft, draft.id)).toBe(false);
    const requested = { ...draft, saveRequested: true };
    expect(canAutoSaveGuest(requested, draft.id)).toBe(true);
    expect(canAutoSaveGuest(requested, null)).toBe(false);
    expect(canAutoSaveGuest(requested, createGuestAssessment().id)).toBe(false);
    expect(canAutoSaveGuest({ ...requested, completedAt: null }, draft.id)).toBe(false);
  });
  it('does not let an old save response delete a newer browser assessment', () => {
    const storage = memory(); const old = createGuestAssessment(); const next = createGuestAssessment();
    writeGuestAssessment(storage, next); clearGuestAssessment(storage, old.id);
    expect(readGuestAssessment(storage)?.id).toBe(next.id);
    clearGuestAssessment(storage, next.id); expect(readGuestAssessment(storage)).toBeNull();
  });
});

describe('server guest import validation', () => {
  it('independently recomputes the same full report while ignoring supplied scores and owner IDs', () => {
    const draft = completedGuest();
    const result = computeGuestClaim({ attemptId: draft.id, assessmentVersion: 2, responses: draft.responses, snapshot: { estimatedLevelRaw: 9 }, playerId: 'forged' });
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.snapshot).toEqual(scoreAssessment(QUESTION_BANK_V2, draft.responses)); expect(result).not.toHaveProperty('playerId'); }
  });
  it('rejects partial evidence, fabricated questions and invalid payload shapes', () => {
    const draft = completedGuest();
    const base = { attemptId: draft.id, assessmentVersion: 2, responses: draft.responses };
    for (const body of [null, [], { ...base, attemptId: 'bad' }, { ...base, assessmentVersion: 1 }, { ...base, responses: {} }, { ...base, responses: { ...draft.responses, forged: 'usually' } }, { ...base, responses: { [QUESTION_BANK_V2[0].itemKey]: 10 } }]) expect(computeGuestClaim(body).ok).toBe(false);
  });
});
