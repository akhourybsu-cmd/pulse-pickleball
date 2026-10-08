import { AssessmentShareCard } from '../../../src/components/skill/AssessmentShareCard';
import { LEVEL_BANDS } from '../../../src/lib/skill/model';
import { QUESTION_BANK_V3 } from '../../../src/lib/skill/questionBankV3';
import { scoreAssessment } from '../../../src/lib/skill/scoring';

const base = scoreAssessment(QUESTION_BANK_V3, Object.fromEntries(QUESTION_BANK_V3.map(item => [item.itemKey, 'usually'])));

/** Local visual fixtures only: deliberately exercise every band and the longest labels. */
export default function ShareCardGallery() {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 max-w-5xl mx-auto">
    {LEVEL_BANDS.flatMap((band, index) => (['square', 'portrait'] as const).map(format => {
      const snapshot = { ...base, estimatedLevelDisplay: band.min, displayBand: band.label,
        strengths: index === 0 ? [] : (['strategy', 'positioning', 'resets_defense'] as const).map(subskill => ({ subskill, displayLevel: 3, reason: 'Local visual fixture' })) };
      return <article key={`${band.key}-${format}`} data-card-case={`${band.label} ${format}`}><h2 className="mb-2 font-semibold">{band.label} · {format}</h2>
        <AssessmentShareCard snapshot={snapshot} completedAt="2026-10-08T16:00:00Z" name={index === 0 ? '' : index === 1 ? 'W'.repeat(40) : 'Alexandria Montgomery-Wellington'} format={format} />
      </article>;
    }))}
  </div>;
}
