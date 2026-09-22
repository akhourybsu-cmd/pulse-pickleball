import { describe, expect, it } from 'vitest';
import { explainScore } from './scoreExplanation';
import { scoreAssessment, type Responses } from './scoring';
import { QUESTION_BANK_V1 } from './questionBank';
import { QUESTION_BANK_V2 as bank } from './questionBankV2';
import { ESSENTIAL_SUBSKILLS, RESPONSE_KEYS, type ResponseKey } from './model';
import { selectNextV2 } from './adaptiveV2';

describe('player-facing score explanation', () => {
  it('matches the scorer across weak foundations, mixed answers, and both scale limits', () => {
    const profiles: Responses[] = RESPONSE_KEYS.filter(k => k !== 'not_sure').map(key => Object.fromEntries(bank.map(i => [i.itemKey, key])));
    profiles.push(Object.fromEntries(bank.map(i => [i.itemKey, ESSENTIAL_SUBSKILLS.includes(i.subskill) ? 'not_yet' : 'reliably'])));
    // Reproducible varied profiles, including missing and unknown answers.
    let seed = 1701;
    for (let n = 0; n < 40; n++) {
      const answers: Responses = {};
      for (const item of bank) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const choice = (seed >>> 16) % 8;
        if (choice < 7) answers[item.itemKey] = RESPONSE_KEYS[choice];
      }
      profiles.push(answers);
    }
    for (const responses of profiles) {
      const snapshot = scoreAssessment(bank, responses);
      const original = JSON.stringify(snapshot);
      const explanation = explainScore(snapshot)!;
      expect(explanation.expectedRaw).toBe(snapshot.estimatedLevelRaw);
      expect(explanation.factors.reduce((sum, f) => sum + f.weight, 0)).toBe(100);
      expect(JSON.stringify(snapshot)).toBe(original);
    }
  });
  it('reconciles completed adaptive assessments with displayed levels', () => {
    for (const answer of ['occasionally', 'sometimes', 'usually', 'reliably'] as ResponseKey[]) {
      const responses: Responses = {};
      for (let n = 0; n < 64; n++) {
        const next = selectNextV2(bank, responses);
        if (!next) break;
        responses[next] = answer;
      }
      const snapshot = scoreAssessment(bank, responses);
      const explanation = explainScore(snapshot)!;
      expect(explanation.expectedRaw).toBe(snapshot.estimatedLevelRaw);
      expect(Math.round(explanation.expectedRaw * 10) / 10).toBe(snapshot.estimatedLevelDisplay);
    }
  });
  it('identifies an applied foundation ceiling and the unanswered strategy fallback', () => {
    const weakFoundation = scoreAssessment(bank, Object.fromEntries(bank.map(i => [i.itemKey, i.subskill === 'serve' ? 'not_yet' : 'reliably'])));
    const explanation = explainScore(weakFoundation)!;
    expect(explanation.foundationLimitApplied).toBe(true);
    expect(explanation.ceiling).toBe(weakFoundation.estimatedLevelRaw);
    const noStrategy = explainScore(scoreAssessment(bank, Object.fromEntries(bank.filter(i => i.subskill !== 'strategy').map(i => [i.itemKey, 'usually']))))!;
    expect(noStrategy.factors[2].level).toBe(noStrategy.factors[0].level);
    expect(noStrategy.factors[2].detail).toContain('strategy is unanswered');
  });
  it('does not apply the v2 calculation to legacy or unscored assessments', () => {
    expect(explainScore(scoreAssessment(QUESTION_BANK_V1, { sv_legal: 'usually' }))).toBeNull();
    expect(explainScore(scoreAssessment(bank, {}))).toBeNull();
    expect(explainScore(scoreAssessment(bank, Object.fromEntries(bank.map(i => [i.itemKey, 'not_sure']))))).toBeNull();
  });
});
