import { ESSENTIAL_SUBSKILLS, SUBSKILL_LABELS, clamp } from './model';
import type { ScoringSnapshot } from './scoring';

/** Presentation of v2's published calculation, using the stored skill estimates.
 * This never sets a score. Parity tests bind the explanation to the scorer.
 */
export function explainScore(snapshot: ScoringSnapshot) {
  if (snapshot.scoringModelVersion !== 2) return null;
  const available = snapshot.subskills.filter(s => s.evidenceCount > 0);
  if (!available.length) return null;
  const average = available.reduce((sum, s) => sum + s.rawLevel, 0) / available.length;
  const weakest = available.filter(s => ESSENTIAL_SUBSKILLS.includes(s.subskill)).sort((a, b) => a.rawLevel - b.rawLevel)[0];
  const floor = weakest?.rawLevel ?? 1.5;
  const strategy = available.find(s => s.subskill === 'strategy');
  const factors = [
    { label: 'Overall skill balance', detail: `Equal average of ${available.length} skills with an answer`, weight: 65, level: average, tone: 'gold' },
    { label: 'Essential doubles foundation', detail: weakest ? `Lowest essential estimate: ${SUBSKILL_LABELS[weakest.subskill]}` : 'No essential estimate available', weight: 20, level: floor, tone: 'teal' },
    { label: 'Game strategy', detail: strategy ? 'Your strategy skill estimate' : 'Uses overall average when strategy is unanswered', weight: 15, level: strategy?.rawLevel ?? average, tone: 'violet' },
  ];
  const blended = factors.reduce((sum, f) => sum + f.level * f.weight / 100, 0);
  const ceiling = Math.min(4.5, floor + 0.5);
  return { factors, blended, ceiling, foundationLimitApplied: blended > floor + 0.5,
    expectedRaw: Math.round(clamp(Math.min(blended, ceiling), 1.5, 4.5) * 1000) / 1000 };
}
