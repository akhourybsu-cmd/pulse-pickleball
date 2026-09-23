// Run with Node 24+: node --experimental-strip-types scripts/skill-assessment-audit.ts
// Synthetic checks only: this is not an empirical validation dataset.
import { QUESTION_BANK_V2 } from '../src/lib/skill/questionBankV2.ts';
import { selectNextV2 } from '../src/lib/skill/adaptiveV2.ts';
import { scoreAssessment, type Responses } from '../src/lib/skill/scoring.ts';
import { RESPONSE_KEYS, ESSENTIAL_SUBSKILLS, type Subskill } from '../src/lib/skill/model.ts';
const scale = RESPONSE_KEYS.filter(k => k !== 'not_sure');
const profiles: { name: string; ability: (skill: Subskill) => number }[] = [2, 2.5, 3, 3.5, 4, 4.5].map(level => ({ name: `Uniform ${level.toFixed(1)}`, ability: () => level }));
profiles.push({ name: 'Power 4.5 / essentials 2.5', ability: skill => ESSENTIAL_SUBSKILLS.includes(skill) ? 2.5 : 4.5 });
const rows = profiles.map(profile => {
  const responses: Responses = {};
  for (let step = 0; step < 64; step++) {
    const key = selectNextV2(QUESTION_BANK_V2, responses);
    if (!key) break;
    const item = QUESTION_BANK_V2.find(i => i.itemKey === key)!;
    const frequency = 1 / (1 + Math.exp(-((profile.ability(item.subskill) - item.anchorLevel) / .45 + Math.log(4))));
    responses[key] = scale[Math.round(frequency * 5)];
  }
  const snapshot = scoreAssessment(QUESTION_BANK_V2, responses);
  return { profile: profile.name, questions: Object.keys(responses).length, estimate: snapshot.estimatedLevelDisplay,
    range: `${snapshot.lowerBound}–${snapshot.upperBound}`, support: snapshot.confidence.total, ready: snapshot.meta.evidence!.sufficient };
});
console.table(rows);
