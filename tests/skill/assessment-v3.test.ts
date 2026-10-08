import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QUESTION_BANK_V3 as bank } from '../../src/lib/skill/questionBankV3';
import { QUESTION_BANK_V2 } from '../../src/lib/skill/questionBankV2';
import { assessmentBank } from '../../src/lib/skill/banks';
import { selectNextV2 } from '../../src/lib/skill/adaptiveV2';
import { scoreAssessment, type Responses } from '../../src/lib/skill/scoring';
import { createGuestAssessment, parseGuestAssessment } from '../../src/lib/skill/guestAssessment';
import { computeAuthoritativeResult } from '../../supabase/functions/_shared/skill/complete';
import { computeGuestClaim } from '../../supabase/functions/_shared/skill/claim';
import { RESPONSE_KEYS, type ResponseKey } from '../../src/lib/skill/model';

describe('assessment V3 versioning, coverage and scoring', () => {
  it('preserves old draft meaning and starts new drafts with V3', () => {
    const current = createGuestAssessment();
    expect(current.version).toBe(3);
    const old = { ...current, version: 2, responses: { v2_serve_0: 'usually' } };
    expect(parseGuestAssessment(JSON.stringify(old))).toEqual(old);
    expect(parseGuestAssessment(JSON.stringify({ ...current, responses: old.responses }))).toBeNull();
    expect(assessmentBank(2)).toBe(QUESTION_BANK_V2);
    expect(assessmentBank(3)).toBe(bank);
    expect(() => assessmentBank(4)).toThrow();
  });
  it('has explicit counting units, individual focus and scene cues for every question', () => {
    expect(bank).toHaveLength(64);
    expect(new Set(bank.map(i => i.itemKey)).size).toBe(64);
    for (const item of bank) {
      expect(item.version).toBe(3);
      expect(item.observation?.note).toBeTruthy(); expect(item.focus).toBeTruthy(); expect(item.visualCue).toBeTruthy();
      expect(item.observation?.contacts === 3).toBe(item.observation?.unit === 'rally');
    }
    expect(bank.find(i => i.itemKey === 'v3_strategy_0')?.dimension).toBe('application');
    expect(bank.find(i => i.itemKey === 'v3_drive_3')?.dimension).toBe('application');
  });
  it('never flags unlike overheads, lobs, counting units or rules/movement as contradictions', () => {
    const snapshot = scoreAssessment(bank, { v3_overheads_lobs_0: 'occasionally', v3_overheads_lobs_1: 'occasionally', v3_overheads_lobs_2: 'reliably', v3_positioning_0: 'occasionally', v3_positioning_1: 'reliably', v3_forehand_0: 'occasionally', v3_forehand_1: 'reliably' });
    expect(snapshot.contradictions).toEqual([]);
    expect(snapshot.subskills.find(s => s.subskill === 'overheads_lobs')?.confidence).toBe(60);
    expect(scoreAssessment(bank, { v3_serve_1: 'occasionally', v3_serve_3: 'reliably' }).contradictions).toHaveLength(1);
    expect(scoreAssessment(QUESTION_BANK_V2, { v2_overheads_lobs_0: 'sometimes', v2_overheads_lobs_2: 'reliably' }).contradictions).toHaveLength(1);
  });
  it('keeps all-unknown answers unscored and stops after the foundation', () => {
    const responses: Responses = {};
    for (let n = 0; n < 64; n++) { const key = selectNextV2(bank, responses); if (!key) break; responses[key] = 'not_sure'; }
    expect(Object.keys(responses)).toHaveLength(16);
    const result = scoreAssessment(bank, responses);
    expect(result.meta.scoredCount).toBe(0); expect(result.confidence.total).toBe(0); expect(result.meta.evidence?.sufficient).toBe(false);
  });
  it.each(['not_yet', 'occasionally', 'usually', 'reliably', 'mixed', 'unknown_pressure', 'unknown_backhand'] as const)('finishes %s within the cap with matching browser and server results', profile => {
    const responses: Responses = {};
    for (let n = 0; n < 65; n++) {
      const key = selectNextV2(bank, responses); if (!key) break;
      expect(responses[key]).toBeUndefined();
      responses[key] = profile === 'mixed' ? RESPONSE_KEYS[n % 6] : profile === 'unknown_pressure' ? key.endsWith('_3') ? 'not_sure' : 'usually' : profile === 'unknown_backhand' ? key.includes('backhand') ? 'not_sure' : 'usually' : profile as ResponseKey;
    }
    expect(Object.keys(responses).length).toBeGreaterThanOrEqual(32); expect(Object.keys(responses).length).toBeLessThanOrEqual(44);
    for (const key of ['v3_return_2', 'v3_counters_2', 'v3_drive_3']) expect(responses[key]).toBeDefined();
    const client = scoreAssessment(bank, responses);
    const result = computeAuthoritativeResult({ assessmentVersion: 3, responses: Object.entries(responses).map(([item_key, response_key]) => ({ item_key, response_key })) });
    expect(client.scoringModelVersion).toBe(3);
    expect(result.ok).toBe(client.meta.evidence?.sufficient);
    if (result.ok) {
      expect(result.snapshot).toEqual(client);
      const guest = computeGuestClaim({ attemptId: createGuestAssessment().id, assessmentVersion: 3, responses });
      expect(guest.ok).toBe(true); if (guest.ok) expect(guest.snapshot).toEqual(client);
    }
  });
  it('rejects cross-version answers and an incorrect scoring version', () => {
    expect(computeAuthoritativeResult({ assessmentVersion: 3, responses: [{ item_key: 'v2_serve_0', response_key: 'usually' }] })).toMatchObject({ ok: false, code: 'invalid_question_reference' });
    expect(computeAuthoritativeResult({ assessmentVersion: 3, scoringModelVersion: 2, responses: [] })).toMatchObject({ ok: false, code: 'unsupported_scoring_model_version' });
  });
  it('ships exactly the same question, version and scoring code to the backend', () => {
    for (const name of ['model.ts', 'banks.ts', 'questionBankV3.ts', 'scoringV2.ts', 'scoring.ts', 'adaptiveV2.ts']) expect(readFileSync(`supabase/functions/_shared/skill/${name}`, 'utf8')).toBe(readFileSync(`src/lib/skill/${name}`, 'utf8'));
  });
});
