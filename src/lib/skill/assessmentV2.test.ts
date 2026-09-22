import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { QUESTION_BANK_V1 } from './questionBank';
import { QUESTION_BANK_V2 as bank } from './questionBankV2';
import { scoreAssessment, type Responses } from './scoring';
import { selectNextV2 } from './adaptiveV2';
import { RESPONSE_KEYS, RESPONSE_MASTERY, ESSENTIAL_SUBSKILLS, type ResponseKey } from './model';
import { computeAuthoritativeResult } from '../../../supabase/functions/_shared/skill/complete';
import { scoreAssessment as serverScore } from '../../../supabase/functions/_shared/skill/scoring';

const scoredKeys = RESPONSE_KEYS.filter(k => k !== 'not_sure');
function run(answer: (key: string) => ResponseKey) {
  const responses: Responses = {};
  for (let step = 0; step < 65; step++) {
    const next = selectNextV2(bank, responses);
    if (!next) return responses;
    expect(responses[next]).toBeUndefined();
    responses[next] = answer(next);
  }
  throw new Error('Adaptive flow did not terminate');
}
const stored = (responses: Responses) => Object.entries(responses).map(([item_key, response_key]) => ({ item_key, response_key }));
const player = (level: number) => run(key => {
  const item = bank.find(i => i.itemKey === key)!;
  const frequency = 1 / (1 + Math.exp(-((level - item.anchorLevel) / .45 + Math.log(4))));
  return scoredKeys[Math.round(frequency * 5)];
});

describe('v2 evidence and adaptive regression', () => {
  it('does not promote a single reliable basic serve to expert', () => {
    expect(scoreAssessment(QUESTION_BANK_V1, { sv_legal: 'reliably' }).estimatedLevelRaw).toBe(4.7);
    const result = scoreAssessment(bank, { v2_serve_0: 'reliably' });
    expect(result.estimatedLevelRaw).toBeLessThanOrEqual(2);
    expect(result.meta.evidence!.sufficient).toBe(false);
  });
  it('does not treat missing responses as failed shots or agreement', () => {
    const missing = scoreAssessment(bank, {});
    const unknown = scoreAssessment(bank, Object.fromEntries(bank.map(i => [i.itemKey, 'not_sure'])));
    expect(unknown.confidence.total).toBe(0);
    expect(missing.confidence.total).toBe(0);
    expect(unknown.meta.scoredCount).toBe(0);
    expect(unknown.subskills.every(s => s.insufficientEvidence)).toBe(true);
    expect(unknown.meta.evidence!.sufficient).toBe(false);
  });
  it('ends all-unknown answers safely without offering an unsupported result', () => {
    const answers = run(() => 'not_sure');
    expect(Object.keys(answers)).toHaveLength(16);
    const result = computeAuthoritativeResult({ assessmentVersion: 2, responses: stored(answers) });
    expect(result.ok).toBe(false);
  });
  it('recovers synthetic ability across the scale in complete adaptive runs', () => {
    // This verifies the math against its own assumptions, NOT real-world validity.
    for (const level of [2, 2.5, 3, 3.5, 4, 4.5]) {
      const responses = player(level);
      const result = scoreAssessment(bank, responses);
      expect(Math.abs(result.estimatedLevelRaw - level), `synthetic level ${level}: ${result.estimatedLevelRaw}`).toBeLessThanOrEqual(.5);
      expect(Object.keys(responses).length).toBeGreaterThanOrEqual(32);
      expect(Object.keys(responses).length).toBeLessThanOrEqual(44);
      expect(result.meta.evidence!.dimensions.every(d => d.scored >= 2)).toBe(true);
      expect(result.meta.evidence!.essentialSkillsCovered).toBe(6);
      const server = computeAuthoritativeResult({ assessmentVersion: 2, responses: stored(responses) });
      expect(server.ok).toBe(true);
      if (server.ok) expect(server.snapshot).toEqual(result);
    }
  });
  it('raises estimates with stronger reported success under identical questions', () => {
    let previous = 0;
    for (const key of scoredKeys) {
      const result = scoreAssessment(bank, Object.fromEntries(bank.map(i => [i.itemKey, key])));
      expect(result.estimatedLevelRaw).toBeGreaterThanOrEqual(previous);
      expect(result.estimatedLevelRaw).toBeLessThanOrEqual(4.5);
      previous = result.estimatedLevelRaw;
    }
  });
  it('keeps power from hiding essential doubles weaknesses', () => {
    const responses: Responses = Object.fromEntries(bank.map(i => [i.itemKey, ESSENTIAL_SUBSKILLS.includes(i.subskill) ? 'occasionally' : 'reliably']));
    const result = scoreAssessment(bank, responses);
    const floor = Math.min(...result.subskills.filter(s => ESSENTIAL_SUBSKILLS.includes(s.subskill)).map(s => s.rawLevel));
    expect(result.estimatedLevelRaw).toBeLessThanOrEqual(floor + .501);
  });
  it('measures pressure separately and reduces support for conflicting claims', () => {
    const normal: Responses = Object.fromEntries(bank.map(i => [i.itemKey, 'usually']));
    const underPressure: Responses = Object.fromEntries(bank.map(i => [i.itemKey, i.dimension === 'pressure' ? 'not_yet' : 'usually']));
    expect(scoreAssessment(bank, underPressure).estimatedLevelRaw).toBeLessThan(scoreAssessment(bank, normal).estimatedLevelRaw);
    const contradiction: Responses = { ...normal, v2_serve_0: 'not_yet', v2_serve_3: 'reliably' };
    expect(scoreAssessment(bank, contradiction).confidence.total).toBeLessThan(scoreAssessment(bank, normal).confidence.total);
    expect(scoreAssessment(bank, contradiction).contradictions.some(c => c.group === 'serve')).toBe(true);
  });
  it('resumes deterministically and accepts an edited answer before completion', () => {
    const answers: Responses = {};
    for (let count = 0; count < 20; count++) answers[selectNextV2(bank, answers)!] = 'usually';
    const resumed = JSON.parse(JSON.stringify(answers));
    expect(selectNextV2(bank, resumed)).toBe(selectNextV2(bank, answers));
    resumed.v2_serve_0 = 'not_sure';
    expect(scoreAssessment(bank, resumed).meta.scoredCount).toBe(19);
    expect(selectNextV2(bank, resumed)).not.toBeNull();
  });
  it('rejects cherry-picked completion, mixed versions, and model mismatch', () => {
    const responses = player(3.5);
    const unfinished = stored(responses).slice(0, 20);
    expect(computeAuthoritativeResult({ assessmentVersion: 2, responses: unfinished }).ok).toBe(false);
    expect(computeAuthoritativeResult({ assessmentVersion: 2, responses: [...stored(responses), { item_key: 'sv_legal', response_key: 'reliably' }] }).ok).toBe(false);
    expect(computeAuthoritativeResult({ assessmentVersion: 2, scoringModelVersion: 1, responses: stored(responses) }).ok).toBe(false);
  });
  it('keeps four measures, observable criteria, unique keys, and exact server mirrors', () => {
    expect(new Set(bank.map(i => i.itemKey)).size).toBe(bank.length);
    expect(bank.every(i => i.situation && i.success && i.dimension && i.version === 2)).toBe(true);
    for (const file of ['model.ts', 'questionBank.ts', 'questionBankV2.ts', 'scoring.ts', 'scoringV2.ts', 'adaptiveV2.ts']) {
      expect(readFileSync(`supabase/functions/_shared/skill/${file}`, 'utf8'), file).toBe(readFileSync(`src/lib/skill/${file}`, 'utf8'));
    }
    expect(serverScore(bank, player(3.5))).toEqual(scoreAssessment(bank, player(3.5)));
    expect(RESPONSE_MASTERY.not_sure).toBeNull();
  });
});
