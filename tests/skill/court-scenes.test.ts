import { describe, expect, it } from 'vitest';
import { getCourtScene, pointOnRoute } from '../../src/components/skill/courtScenes';
import { QUESTION_BANK_V2 } from '../../src/lib/skill/questionBankV2';
import type { Dimension, Subskill } from '../../src/lib/skill/model';

const sceneFor = (skill: Subskill, dimension: Dimension) => getCourtScene(QUESTION_BANK_V2.find(i => i.subskill === skill && i.dimension === dimension)!);

describe('court teaching diagrams', () => {
  it('keeps all 64 diagrams within the view and every playable route nonempty', () => {
    for (const item of QUESTION_BANK_V2) {
      const scene = getCourtScene(item);
      const points = [...scene.route, scene.you, scene.partner, ...scene.opponents, ...(scene.incoming ? [scene.incoming] : []), ...(scene.partnerTo ? [scene.partnerTo] : [])];
      for (const [x, y] of points) { expect(x).toBeGreaterThanOrEqual(8); expect(x).toBeLessThanOrEqual(352); expect(y).toBeGreaterThanOrEqual(8); expect(y).toBeLessThanOrEqual(180); }
      if (scene.kind !== 'hold') expect(pointOnRoute(scene.route, 0)).not.toEqual(pointOnRoute(scene.route, 1));
      if (scene.kind === 'move') expect(scene.route[0]).toEqual(scene.you);
    }
  });
  it('shows the legal diagonal serve box and narrows the deep target', () => {
    const basic = sceneFor('serve', 'execution');
    const deep = sceneFor('serve', 'consistency');
    expect(basic.you[0]).toBeLessThan(48); // Behind the baseline.
    expect(basic.target!.x).toBeGreaterThan(222); // Past the kitchen.
    expect(basic.target!.y + basic.target!.height).toBeLessThan(100); // Diagonal half.
    expect(deep.target!.x).toBeGreaterThan(basic.target!.x);
    expect(deep.target!.width).toBeLessThan(basic.target!.width);
    for (const scene of [basic, deep, sceneFor('serve', 'application')]) {
      const [x, y] = pointOnRoute(scene.route, 1);
      expect(x).toBeGreaterThan(scene.target!.x); expect(x).toBeLessThan(scene.target!.x + scene.target!.width);
      expect(y).toBeGreaterThan(scene.target!.y); expect(y).toBeLessThan(scene.target!.y + scene.target!.height);
    }
  });
  it('distinguishes stopping, moving together, and covering a lob', () => {
    expect(sceneFor('transition_play', 'application').kind).toBe('hold');
    const advance = sceneFor('transition_play', 'pressure');
    expect(advance.partnerTo![0]).toBeGreaterThan(advance.partner[0]);
    const lob = sceneFor('overheads_lobs', 'pressure');
    expect(lob.kind).toBe('move');
    expect(lob.partnerTo![0]).toBeLessThan(lob.partner[0]);
    expect(lob.route[1][1]).toBeLessThan(lob.you[1]);
  });
  it('shows the reply under pressure, and identifies whose return must bounce', () => {
    for (const skill of ['drive', 'speedups'] as const) expect(sceneFor(skill, 'pressure').incoming).toBeDefined();
    const bounce = sceneFor('positioning', 'execution');
    expect(bounce.opponentShot).toBe(true);
    expect(bounce.route[0][0]).toBeGreaterThan(180);
    expect(bounce.route[1][0]).toBeLessThan(138);
  });
  it('preserves the contact point between incoming and outgoing playback', () => {
    const scene = sceneFor('return', 'execution');
    const route = [scene.incoming!, ...scene.route];
    expect(pointOnRoute(route, 0)).toEqual(scene.incoming);
    expect(pointOnRoute(route, .5)).toEqual(scene.route[0]);
    expect(pointOnRoute(route, 1)).toEqual(scene.route[1]);
    expect(pointOnRoute(route, -1)).toEqual(scene.incoming);
    expect(pointOnRoute(route, 2)).toEqual(scene.route[1]);
    expect(pointOnRoute([[104, 126]], .75)).toEqual([104, 126]);
  });
});
