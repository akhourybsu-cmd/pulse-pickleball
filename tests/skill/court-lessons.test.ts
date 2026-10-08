import { describe, expect, it } from 'vitest';
import { QUESTION_BANK_V3 } from '../../src/lib/skill/questionBankV3';
import { QUESTION_BANK_V2 } from '../../src/lib/skill/questionBankV2';
import { ballOnFlight, getCourtLesson, lessonDuration, lessonFrame } from '../../src/components/skill/courtLessons';
const lesson = (key: string) => getCourtLesson(QUESTION_BANK_V3.find(i => i.itemKey === `v3_${key}`)!);

describe('question-specific court and height lessons', () => {
  it('serves diagonally beyond the kitchen and narrows the deep target', () => {
    const basic = lesson('serve_0'), deep = lesson('serve_1');
    expect(basic.steps[0].from.you[0]).toBeLessThan(48);
    expect(basic.target.x).toBeGreaterThan(222);
    expect(basic.target.y + basic.target.height).toBeLessThan(100);
    expect(deep.target.x).toBeGreaterThan(basic.target.x);
    expect(deep.target.width).toBeLessThan(basic.target.width);
    for (const scene of [basic, deep, lesson('serve_2'), lesson('serve_3')]) {
      const [x, y] = scene.steps[0].ball.to;
      expect(x).toBeGreaterThan(scene.target.x); expect(x).toBeLessThan(scene.target.x + scene.target.width);
      expect(y).toBeGreaterThan(scene.target.y); expect(y).toBeLessThan(scene.target.y + scene.target.height);
    }
  });
  it('shows continuous flights, real bounces, net clearance and continuous player positions in all 128 current/legacy scenes', () => {
    for (const item of [...QUESTION_BANK_V3, ...QUESTION_BANK_V2]) {
      const scene = getCourtLesson(item);
      expect(scene.steps.length, item.itemKey).toBeGreaterThan(0);
      for (let n = 0; n < scene.steps.length; n++) {
        const step = scene.steps[n];
        if (n) { expect(step.ball.from, item.itemKey).toEqual(scene.steps[n - 1].ball.to); expect(step.from, item.itemKey).toEqual(scene.steps[n - 1].to); }
        expect(step.ball.bounce, item.itemKey).toBe(step.ball.to[2] === 0);
        for (const [x, y] of [...Object.values(step.from), ...Object.values(step.to)]) {
          expect(x, item.itemKey).toBeGreaterThanOrEqual(8); expect(x, item.itemKey).toBeLessThanOrEqual(352);
          expect(y, item.itemKey).toBeGreaterThanOrEqual(8); expect(y, item.itemKey).toBeLessThanOrEqual(180);
        }
        for (let t = 0; t <= 1; t += .05) { const [x, y, z] = ballOnFlight(step.ball, t); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(360); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(204); expect(z).toBeGreaterThanOrEqual(0); expect(z).toBeLessThan(17.5); }
        if ((step.ball.from[0] - 180) * (step.ball.to[0] - 180) < 0) {
          const t = (180 - step.ball.from[0]) / (step.ball.to[0] - step.ball.from[0]);
          expect(ballOnFlight(step.ball, t)[2], item.itemKey).toBeGreaterThan(3);
        }
      }
      expect(lessonFrame(scene, 0).ball).toEqual(scene.steps[0].ball.from);
      expect(lessonFrame(scene, lessonDuration(scene)).ball).toEqual(scene.steps.at(-1)!.ball.to);
    }
  });
  it('shows forehand and backhand contacts on opposite sides of the body', () => {
    const fore = lesson('forehand_0').steps.find(s => s.ball.contact === 'you')!;
    const back = lesson('backhand_0').steps.find(s => s.ball.contact === 'you')!;
    expect(fore.ball.to[1]).toBeGreaterThan(fore.to.you[1]); expect(back.ball.to[1]).toBeLessThan(back.to.you[1]);
  });
  it('shows exactly three replies with intervening incoming balls for every sequence question', () => {
    for (const item of QUESTION_BANK_V3.filter(i => i.observation?.contacts === 3)) {
      const steps = getCourtLesson(item).steps;
      expect(steps.filter(s => /of 3$/.test(s.label)), item.itemKey).toHaveLength(3);
      expect(steps.filter(s => s.ball.contact === 'you'), item.itemKey).toHaveLength(3);
    }
  });
  it('shows both mandatory bounces before the serving team contacts the third shot', () => {
    const steps = lesson('positioning_0').steps;
    const contact = steps.findIndex(s => s.ball.contact === 'you');
    expect(steps.slice(0, contact).filter(s => s.ball.bounce)).toHaveLength(2);
  });
  it('makes low drops/resets visibly below the net and lobs above defenders’ reach', () => {
    for (const key of ['third_shot_drop_1', 'third_shot_drop_3', 'dinking_1', 'resets_defense_2']) expect(lesson(key).steps.at(-1)!.ball.to[2], key).toBeLessThan(3);
    const lob = lesson('overheads_lobs_2').steps.at(-1)!.ball;
    expect(ballOnFlight(lob, (234 - lob.from[0]) / (lob.to[0] - lob.from[0]))[2]).toBeGreaterThan(8.5);
    expect(lob.to[0]).toBeLessThan(312); expect(lob.to[2]).toBe(0);
  });
  it('shows the fifth shot, leaves the out ball untouched, and actually recovers from wide positions', () => {
    expect(lesson('drive_3').steps.filter(s => s.ball.shot).map(s => s.ball.shot)).toEqual([3, 4, 5]);
    const leave = lesson('counters_2'); expect(leave.steps.every(s => !s.ball.contact)).toBe(true); expect(leave.steps.at(-1)!.ball.to[0]).toBeLessThan(48);
    const dink = lesson('dinking_2').steps.at(-1)!; expect(dink.to.you[1]).toBeLessThan(dink.from.you[1]);
    const recover = lesson('positioning_3').steps.at(-1)!; expect(recover.to.partner[1]).toBeGreaterThan(recover.from.partner[1]);
    const hold = lesson('transition_play_2'); expect(hold.steps.every(s => s.from.you[0] === s.to.you[0])).toBe(true);
  });
});
