import { DIMENSIONS, ESSENTIAL_SUBSKILLS, RESPONSE_MASTERY, type AssessmentItem } from './model.ts';
import { scoreAssessmentV2 } from './scoringV2.ts';
import type { Responses } from './scoring.ts';

export const ADAPTIVE_CONFIG_V2 = { minItems: 32, maxItems: 44, essentialEvidenceTarget: 2 };

export function selectNextV2(bank: readonly AssessmentItem[], responses: Responses, config = ADAPTIVE_CONFIG_V2): string | null {
  const items = bank.filter(i => i.active);
  const answered = items.filter(i => Object.prototype.hasOwnProperty.call(RESPONSE_MASTERY, responses[i.itemKey]));
  if (answered.length >= config.maxItems) return null;
  const unasked = items.filter(i => !answered.includes(i));
  const foundation = unasked.find(i => i.phase === 'foundation');
  if (foundation) return foundation.itemKey;
  const snapshot = scoreAssessmentV2(bank, responses);
  // No game evidence in any foundation: offer review/practice guidance now
  // rather than asking another 28 increasingly difficult unknown situations.
  if (snapshot.meta.scoredCount === 0) return null;
  const measures = snapshot.meta.evidence!.dimensions;
  // Every completed flow probes all four dimensions. Unknown evidence may still
  // end at the cap; completion validation then offers answer review, not a rating.
  const needsChallenge = unasked.some(i => i.anchorLevel >= 4 && snapshot.subskills.some(s => s.subskill === i.subskill && s.evidenceCount >= 2 && s.rawLevel >= 3.8));
  if (answered.length >= config.minItems && snapshot.meta.evidence!.sufficient && measures.every(d => d.scored >= 2) && !needsChallenge) return null;
  const candidates = unasked.filter(i => !i.prerequisite?.itemKey || Object.prototype.hasOwnProperty.call(responses, i.prerequisite.itemKey));
  const score = (i: AssessmentItem) => {
    const skill = snapshot.subskills.find(s => s.subskill === i.subskill)!;
    const measure = measures.find(d => d.dimension === i.dimension)!;
    const essential = ESSENTIAL_SUBSKILLS.includes(i.subskill);
    const dimensionGap = DIMENSIONS.some(d => measures.find(m => m.dimension === d)!.scored < 2);
    return (essential && skill.evidenceCount < 2 ? 80 : 0)
      + (skill.evidenceCount < 2 ? 20 : 0)
      + (dimensionGap && measure.scored < 2 ? 35 : 0)
      + (snapshot.contradictions.some(c => c.group === i.subskill) ? 12 : 0)
      + (skill.rawLevel >= 3.8 && i.dimension === 'pressure' ? 10 : 0)
      + 8 - Math.abs(i.anchorLevel - (skill.rawLevel + 0.5)) * 4;
  };
  candidates.sort((a, b) => score(b) - score(a) || a.order - b.order);
  return candidates[0]?.itemKey ?? null;
}
