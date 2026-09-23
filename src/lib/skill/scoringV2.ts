import { DIMENSIONS, DIMENSION_WEIGHTS, DOMAINS, ESSENTIAL_SUBSKILLS, RESPONSE_MASTERY, SUBSKILLS, SUBSKILL_DOMAIN, bandForLevel, clamp, displayLevel, type AssessmentItem, type Dimension } from './model.ts';
import type { Responses, ScoringSnapshot, SubskillScore } from './scoring.ts';

export interface AssessmentEvidence {
  dimensions: { dimension: Dimension; answered: number; scored: number; successRate: number | null }[];
  essentialSkillsCovered: number;
  skillsCovered: number;
  sufficient: boolean;
  limitations: string[];
}
type Observation = { item: AssessmentItem; frequency: number };
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Criterion fit, NOT a trained psychometric model. The curve reaches 80%
 * at the authored anchor. Saturated easy items cannot establish harder skills:
 * the estimate is capped at the highest directly observed anchor (one answer)
 * or half a level above it (multiple answers). Both the
 * curve width (0.45) and anchors require prospective player/coach validation.
 */
function estimate(observations: Observation[]): number {
  if (!observations.length) return 1.5;
  const ceiling = Math.min(4.5, Math.max(...observations.map(o => o.item.anchorLevel)) + (observations.length >= 2 ? 0.5 : 0));
  let best = 1.5;
  let loss = Infinity;
  for (let step = 150; step <= Math.round(ceiling * 100); step++) {
    const level = step / 100;
    let candidateLoss = 0;
    for (const { item, frequency } of observations) {
      const expected = 1 / (1 + Math.exp(-((level - item.anchorLevel) / 0.45 + Math.log(4))));
      const weight = item.weight * (item.dimension ? DIMENSION_WEIGHTS[item.dimension] : 0.25);
      candidateLoss -= weight * (frequency * Math.log(expected) + (1 - frequency) * Math.log(1 - expected));
    }
    if (candidateLoss < loss) { loss = candidateLoss; best = level; }
  }
  return best;
}

export function scoreAssessmentV2(items: readonly AssessmentItem[], responses: Responses): ScoringSnapshot {
  const answered = items.filter(i => i.active && Object.prototype.hasOwnProperty.call(RESPONSE_MASTERY, responses[i.itemKey]));
  const scored: Observation[] = answered.flatMap(item => {
    const frequency = RESPONSE_MASTERY[responses[item.itemKey]];
    return frequency === null ? [] : [{ item, frequency }];
  });
  const contradictions: ScoringSnapshot['contradictions'] = [];
  const subskills: SubskillScore[] = SUBSKILLS.map(subskill => {
    const evidence = scored.filter(o => o.item.subskill === subskill);
    const attempts = answered.filter(i => i.subskill === subskill);
    const conflict = evidence.find(hi => evidence.some(lo => hi.item.anchorLevel > lo.item.anchorLevel && hi.frequency - lo.frequency >= 0.4 - 1e-9));
    if (conflict) {
      const low = evidence.find(lo => conflict.item.anchorLevel > lo.item.anchorLevel && conflict.frequency - lo.frequency >= 0.4 - 1e-9)!;
      contradictions.push({ group: subskill, highItemKey: conflict.item.itemKey, lowItemKey: low.item.itemKey,
        note: 'Success is reported more often in a harder situation. Review whether the situations were comparable.' });
    }
    const rawLevel = estimate(evidence);
    return { subskill, domain: SUBSKILL_DOMAIN[subskill], rawLevel, displayLevel: displayLevel(rawLevel),
      confidence: Math.round(60 * Math.min(evidence.length / 3, 1) * (conflict ? 0.65 : 1) * (attempts.length ? evidence.length / attempts.length : 0)),
      evidenceCount: evidence.length, insufficientEvidence: evidence.length < 2 };
  });
  const domains = DOMAINS.filter(domain => items.some(i => i.domain === domain)).map(domain => {
    const skills = subskills.filter(s => s.domain === domain && s.evidenceCount > 0);
    const rawLevel = mean(skills.map(s => s.rawLevel)) || 1.5;
    return { domain, rawLevel, displayLevel: displayLevel(rawLevel),
      evidenceCount: skills.reduce((sum, s) => sum + s.evidenceCount, 0),
      insufficientEvidence: !skills.length || skills.some(s => s.insufficientEvidence) };
  });
  const available = subskills.filter(s => s.evidenceCount > 0);
  const essentials = subskills.filter(s => ESSENTIAL_SUBSKILLS.includes(s.subskill) && s.evidenceCount > 0);
  const essentialFloor = essentials.length ? Math.min(...essentials.map(s => s.rawLevel)) : 1.5;
  const average = mean(available.map(s => s.rawLevel)) || 1.5;
  const strategy = available.find(s => s.subskill === 'strategy')?.rawLevel ?? average;
  // Equal weighting across skills prevents extra adaptive probes from giving
  // their domain extra voting power. Essential weaknesses cannot be averaged away.
  const raw = round(clamp(Math.min(0.65 * average + 0.2 * essentialFloor + 0.15 * strategy, essentialFloor + 0.5), 1.5, 4.5));
  const dimensions = DIMENSIONS.map(dimension => {
    const evidence = scored.filter(o => o.item.dimension === dimension);
    return { dimension, answered: answered.filter(i => i.dimension === dimension).length,
      scored: evidence.length, successRate: evidence.length ? round(mean(evidence.map(o => o.frequency))) : null };
  });
  const skillsCovered = subskills.filter(s => !s.insufficientEvidence).length;
  const essentialSkillsCovered = essentials.filter(s => !s.insufficientEvidence).length;
  const dimensionCoverage = dimensions.filter(d => d.scored > 0).length / 4;
  const coverage = (skillsCovered / 16 + essentialSkillsCovered / 6 + dimensionCoverage) / 3;
  const knownFraction = answered.length ? scored.length / answered.length : 0;
  const completionCoverage = round(40 * coverage * knownFraction);
  // Agreement is worth nothing without evidence; all-unknown no longer earns confidence.
  const internalConsistency = round(20 * coverage * knownFraction * Math.max(0, 1 - contradictions.length / 6));
  const total = Math.round(completionCoverage + internalConsistency);
  const confidence = { completionCoverage, internalConsistency, recentActivity: 0, recentMatchVolume: 0,
    externalCorroboration: 0, total, label: total < 35 ? 'Low confidence' as const : total < 50 ? 'Developing confidence' as const : 'Moderate confidence' as const };
  const sufficient = scored.length >= 20 && skillsCovered >= 8 && essentialSkillsCovered === 6 && dimensionCoverage >= 0.75;
  const limitations = ['Based on your reported game situations; no coach observation or match results were used.'];
  if (essentialSkillsCovered < 6) limitations.push('Some essential doubles skills need more answers.');
  if (dimensions.some(d => !d.scored)) limitations.push('Some measures, including pressure if untested, have limited evidence.');
  if (contradictions.length) limitations.push('Some harder situations were rated above their foundations; review those answers.');
  const width = 0.35 + (1 - total / 60) * 0.4;
  const evaluated = subskills.filter(s => !s.insufficientEvidence);
  return {
    scoringModelVersion: 2, estimatedLevelRaw: raw, estimatedLevelDisplay: displayLevel(raw), displayBand: bandForLevel(raw).label,
    lowerBound: displayLevel(Math.max(1.5, raw - width)), upperBound: displayLevel(Math.min(4.5, raw + width)), confidence,
    subskills, domains, contradictions, primaryStyle: null, secondaryStyle: null,
    strengths: evaluated.filter(s => s.rawLevel >= 3 && s.rawLevel >= raw + 0.25 && s.confidence >= 40)
      .sort((a, b) => b.rawLevel - a.rawLevel).slice(0, 3)
      .map(s => ({ subskill: s.subskill, displayLevel: s.displayLevel, reason: `${s.evidenceCount} game-situation answers suggest a relative strength. Confirm it in play.` })),
    developmentPriorities: evaluated.filter(s => s.rawLevel < raw - 0.15)
      .sort((a, b) => (ESSENTIAL_SUBSKILLS.includes(b.subskill) ? 1 : 0) - (ESSENTIAL_SUBSKILLS.includes(a.subskill) ? 1 : 0) || a.rawLevel - b.rawLevel).slice(0, 3)
      .map(s => ({ subskill: s.subskill, displayLevel: s.displayLevel, reason: 'Practise the pictured success criteria, then count successful attempts in games.' })),
    meta: { evidence: { dimensions, essentialSkillsCovered, skillsCovered, sufficient, limitations },
      answeredCount: answered.length, scoredCount: scored.length, notSureCount: answered.length - scored.length,
      contradictionSeverity: contradictions.length, highestPassedAnchor: null, overallMasteryByAnchor: {} },
  };
}
