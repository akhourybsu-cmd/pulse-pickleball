import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AssessmentQuestion } from '../../src/components/skill/AssessmentQuestion';
import { CourtScenario } from '../../src/components/skill/CourtScenario';
import { QUESTION_BANK_V2 } from '../../src/lib/skill/questionBankV2';
import { scoreAssessment } from '../../src/lib/skill/scoring';
import { sanitizeForOrganizer } from '../../src/lib/skill/organizerCard';
import { SkillFingerprint } from '../../src/components/skill/SkillFingerprint';
import { selectNextV2 } from '../../src/lib/skill/adaptiveV2';
import type { Responses } from '../../src/lib/skill/scoring';
vi.mock('framer-motion', async importOriginal => ({ ...await importOriginal<typeof import('framer-motion')>(), useReducedMotion: () => true }));

describe('assessment accessibility and privacy', () => {
  it('does not submit a silently preselected midpoint', () => {
    const html = renderToStaticMarkup(<AssessmentQuestion item={QUESTION_BANK_V2[0]} saving={false} onConfirm={() => undefined} />);
    expect(html).toContain('aria-valuetext="No frequency selected"');
    expect(html).toMatch(/<button[^>]+disabled=""[^>]*>Save &amp; continue/);
    expect(html).toContain('aria-label="0 of 10 opportunities"');
    expect(html).toContain('Not enough game experience');
  });
  it('provides text equivalents and a still view for every scenario with reduced motion', () => {
    for (const item of QUESTION_BANK_V2) {
      const html = renderToStaticMarkup(<CourtScenario item={item} />);
      expect(html).toContain('role="img"');
      expect(html).toContain('<title');
      expect(html).toContain('Still diagram');
      expect(html).not.toContain('class="assessment-moving-ball"');
    }
  });
  it('keeps the new private evidence out of organizer cards', () => {
    const snapshot = scoreAssessment(QUESTION_BANK_V2, {});
    expect(snapshot.meta.evidence).toBeDefined();
    const card = sanitizeForOrganizer(snapshot);
    expect(card).not.toHaveProperty('meta');
    expect(card).not.toHaveProperty('evidence');
    expect(card).not.toHaveProperty('contradictions');
  });
  it('gives a balanced profile actionable guidance without inventing a weakness', () => {
    const responses: Responses = {};
    for (let n = 0; n < 64; n++) { const key = selectNextV2(QUESTION_BANK_V2, responses); if (!key) break; responses[key] = 'usually'; }
    const snapshot = scoreAssessment(QUESTION_BANK_V2, responses);
    expect(snapshot.developmentPriorities).toHaveLength(0);
    const html = renderToStaticMarkup(<SkillFingerprint snapshot={snapshot} />);
    expect(html).toContain('Your next-game focus');
    expect(html).toContain('No clear relative weakness stood out');
    expect(html).toContain('Count a success when:');
  });
});
