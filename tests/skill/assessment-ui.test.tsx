import React from 'react';
import { renderToStaticMarkup as renderMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AssessmentQuestion } from '../../src/components/skill/AssessmentQuestion';
import { CourtScenario } from '../../src/components/skill/CourtScenario';
import { QUESTION_BANK_V2 } from '../../src/lib/skill/questionBankV2';
import { scoreAssessment } from '../../src/lib/skill/scoring';
import { sanitizeForOrganizer } from '../../src/lib/skill/organizerCard';
import { SkillFingerprint } from '../../src/components/skill/SkillFingerprint';
import { selectNextV2 } from '../../src/lib/skill/adaptiveV2';
import type { Responses } from '../../src/lib/skill/scoring';
import { QUESTION_BANK_V1 } from '../../src/lib/skill/questionBank';
vi.mock('framer-motion', async importOriginal => ({ ...await importOriginal<typeof import('framer-motion')>(), useReducedMotion: () => true }));
const renderToStaticMarkup = (element: React.ReactElement) => renderMarkup(<StaticRouter location="/skill-assessment">{element}</StaticRouter>);

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
      expect(html).not.toContain('court animation');
      expect(html).not.toMatch(/<(video|iframe)\b/);
      expect(html).toContain('Partner');
      expect(html).toContain('KITCHEN');
    }
  });
  it('labels an incoming return honestly and makes holding still explicit', () => {
    const bounce = QUESTION_BANK_V2.find(i => i.itemKey === 'v2_positioning_0')!;
    const hold = QUESTION_BANK_V2.find(i => i.itemKey === 'v2_transition_play_2')!;
    expect(renderToStaticMarkup(<CourtScenario item={bounce} />)).toContain('Their return');
    expect(renderToStaticMarkup(<CourtScenario item={bounce} />)).not.toContain('Your shot');
    expect(renderToStaticMarkup(<CourtScenario item={hold} />)).toContain('STOP');
  });
  it('counts a three-shot sequence as one successful rally', () => {
    const item = QUESTION_BANK_V2.find(i => i.itemKey === 'v2_forehand_1')!;
    const html = renderToStaticMarkup(<AssessmentQuestion item={item} saving={false} onConfirm={() => undefined} />);
    expect(html).toContain('Count the full three-shot sequence as one success.');
    expect(html).toContain('three consecutive forehands');
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
  it('separates the level, confidence and unmeasured situations in the report', () => {
    const responses: Responses = Object.fromEntries(QUESTION_BANK_V2.map(i => [i.itemKey, i.dimension === 'pressure' ? 'not_sure' : 'usually']));
    const snapshot = scoreAssessment(QUESTION_BANK_V2, responses);
    const html = renderToStaticMarkup(<SkillFingerprint snapshot={snapshot} />);
    expect(html).toContain('Assessment scale 1.5–4.5');
    expect(html).toContain('Under pressure: not enough evidence');
    expect(html).toContain('unmeasured');
    expect(html).toContain('not your percentile');
    expect(html).toContain('65%');
    expect(html).toContain('20%');
    expect(html).toContain('15%');
    expect(html).toContain('Foundation ceiling');
    expect(html).toContain('Self-report can contribute at most 60');
    // A reduced-motion report must be visible immediately, without a reveal.
    expect(html).not.toContain('opacity:0');
  });
  it('does not present a domain as fully supported when a whole skill is unanswered', () => {
    const items = QUESTION_BANK_V2.filter(i => i.subskill === 'serve');
    const snapshot = scoreAssessment(QUESTION_BANK_V2, Object.fromEntries(items.map(i => [i.itemKey, 'usually'])));
    const html = renderToStaticMarkup(<SkillFingerprint snapshot={snapshot} />);
    expect(html).toContain('Serve &amp; return: not enough information');
  });
  it('keeps legacy reports readable without attributing the new formula to them', () => {
    const snapshot = scoreAssessment(QUESTION_BANK_V1, Object.fromEntries(QUESTION_BANK_V1.map(i => [i.itemKey, 'usually'])));
    const html = renderToStaticMarkup(<SkillFingerprint snapshot={snapshot} />);
    expect(html).toContain('Scoring model v1');
    expect(html).not.toContain('How your level comes together');
  });
});
