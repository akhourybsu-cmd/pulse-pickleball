import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it } from 'vitest';
import { FUNDAMENTALS, KNOWLEDGE_SOURCES, SKILL_KNOWLEDGE, getLevelContext } from '../../src/lib/skill/knowledge';
import { LEVEL_BANDS, SUBSKILLS } from '../../src/lib/skill/model';
import PickleballGuide from '../../src/pages/PickleballGuide';

describe('pickleball learning context', () => {
  it('covers every assessed skill with observable evidence, misconceptions, practice and traceable sources', () => {
    expect(Object.keys(SKILL_KNOWLEDGE).sort()).toEqual([...SUBSKILLS].sort());
    for (const guide of Object.values(SKILL_KNOWLEDGE)) {
      for (const text of [guide.definition, guide.purpose, guide.lookFor, guide.misconception, guide.practice]) expect(text.length).toBeGreaterThan(30);
      expect(guide.sources.length).toBeGreaterThan(0);
      for (const source of guide.sources) expect(new URL(KNOWLEDGE_SOURCES[source].url).hostname).toBe('usapickleball.org');
    }
    for (const fundamental of FUNDAMENTALS) expect(KNOWLEDGE_SOURCES[fundamental.source]).toBeDefined();
  });
  it('uses the unrounded score for context and does not certify expert status at the model ceiling', () => {
    for (const band of LEVEL_BANDS) { expect(getLevelContext(band.min).key).toBe(band.key); expect(getLevelContext(band.min).next).toBeTruthy(); }
    expect(getLevelContext(3.249).key).toBe('low_intermediate');
    expect(getLevelContext(3.25).key).toBe('intermediate');
    expect(getLevelContext(4.5).meaning).toContain('cannot establish a higher level or confirm expert status');
  });
  it('provides public definitions and distinguishes self-report from performance and external ratings', () => {
    const html = renderToStaticMarkup(<HelmetProvider><StaticRouter location="/pickleball-guide#skill-serve"><PickleballGuide /></StaticRouter></HelmetProvider>);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('no account needed');
    expect(html).toContain('id="skill-serve" open=""');
    expect(html).toContain('not a 55% chance');
    expect(html).toContain('not a conversion');
    expect(html).toContain('calibration remains necessary');
    expect(html).toContain('Search pickleball skills');
    for (const skill of SUBSKILLS) expect(html).toContain(`id="skill-${skill}"`);
  });
});
