import type { AssessmentItem } from '@/lib/skill/model';

export type Point = readonly [number, number];
/** x/y: six SVG units per foot. z: height in feet. */
export type BallPoint = readonly [number, number, number];
export type Player = 'you' | 'partner' | 'opponent' | 'other';
export type Players = Record<Player, Point>;
export type Flight = { from: BallPoint; to: BallPoint; arc: number; bounce: boolean; contact?: Player; shot?: number };
export type SceneStep = { label: string; detail: string; duration: number; ball: Flight; from: Players; to: Players; ready: boolean; stroke: 'forehand' | 'backhand' | 'ready' };
export type CourtLesson = {
  steps: SceneStep[]; caption: string; view: 'court' | 'height'; stroke: 'forehand' | 'backhand';
  target: { x: number; y: number; width: number; height: number }; pressure: boolean; count: 1 | 3;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function ballOnFlight(ball: Flight, progress: number): BallPoint {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return ball.from;
  if (p === 1) return ball.to;
  return [lerp(ball.from[0], ball.to[0], p), lerp(ball.from[1], ball.to[1], p), lerp(ball.from[2], ball.to[2], p) + 4 * ball.arc * p * (1 - p)];
}
export const lessonDuration = (scene: CourtLesson) => scene.steps.reduce((sum, step) => sum + step.duration, 0);
export function lessonFrame(scene: CourtLesson, elapsed: number) {
  let offset = 0, index = scene.steps.length - 1;
  for (let n = 0; n < scene.steps.length; n++) {
    if (elapsed < offset + scene.steps[n].duration) { index = n; break; }
    if (n < scene.steps.length - 1) offset += scene.steps[n].duration;
  }
  const step = scene.steps[index];
  const progress = Math.max(0, Math.min(1, (elapsed - offset) / step.duration));
  const players: Players = { ...step.from };
  for (const key of Object.keys(players) as Player[]) {
    const from = step.from[key], to = step.to[key];
    players[key] = [lerp(from[0], to[0], progress), lerp(from[1], to[1], progress)];
  }
  return { index, step, progress, players, ball: ballOnFlight(step.ball, progress) };
}
export function flightPath(ball: Flight, view: 'court' | 'height') {
  return Array.from({ length: 33 }, (_, i) => { const [x, y, z] = ballOnFlight(ball, i / 32); return `${i ? 'L' : 'M'}${x.toFixed(2)} ${(view === 'court' ? y : 142 - z * 8).toFixed(2)}`; }).join(' ');
}

/** Authored, synchronized teaching timelines, not a paddle-technique simulator.
 * Each flight begins at the previous endpoint. Bounces are explicit. Player
 * movement is independent of the ball and every crossing clears the net.
 * V2 variants keep their original question meaning for existing drafts.
 */
export function getCourtLesson(item: AssessmentItem): CourtLesson {
  const skill = item.subskill, stage = Number(item.itemKey.match(/_(\d)$/)?.[1] ?? 0), v3 = item.version >= 3;
  const backhand = skill === 'backhand' || stage === 3 && ['return', 'third_shot_drop', 'dinking', 'volleys'].includes(skill);
  const stroke = backhand ? 'backhand' : 'forehand';
  const count = item.observation?.contacts ?? (item.success?.includes('three consecutive') ? 3 : 1);
  const scene: CourtLesson = { steps: [], caption: item.visualCue ?? `${item.situation} ${item.success}`, stroke,
    view: ['drive', 'third_shot_drop', 'dinking', 'dink_strategy', 'speedups', 'counters', 'volleys', 'resets_defense', 'overheads_lobs', 'strategy'].includes(skill) ? 'height' : 'court',
    target: { x: 224, y: 42, width: 86, height: 116 }, pressure: item.dimension === 'pressure', count };
  let players: Players = { you: [122, backhand ? 138 : 114], partner: [128, 65], opponent: [234, 80], other: [234, 140] };
  let ball: BallPoint = [234, 80, 2];
  const pose = (x: number, y: number): Point => [x - 10, y + (backhand ? 12 : -12)];
  const start = (point: BallPoint, positions: Partial<Players> = {}) => { ball = point; players = { ...players, ...positions }; };
  const add = (to: BallPoint, label: string, detail: string, options: { arc?: number; duration?: number; players?: Partial<Players>; ready?: boolean; contact?: Player; shot?: number; stroke?: SceneStep['stroke'] } = {}) => {
    let arc = options.arc ?? 0;
    if ((ball[0] - 180) * (to[0] - 180) < 0) {
      const t = (180 - ball[0]) / (to[0] - ball[0]);
      // Clear 36 inches, including the higher net ends (34 inches at center).
      arc = Math.max(arc, (3.18 - lerp(ball[2], to[2], t)) / (4 * t * (1 - t)));
    }
    const next = { ...players, ...options.players };
    scene.steps.push({ label, detail, duration: options.duration ?? 1050, from: players, to: next, ready: options.ready ?? false, stroke: options.stroke ?? stroke,
      ball: { from: ball, to, arc, bounce: to[2] === 0, contact: options.contact, shot: options.shot } });
    ball = to; players = next;
  };
  const deep = () => { scene.target = { x: 269, y: 41, width: 42, height: 118 }; };
  const kitchen = () => { scene.target = { x: 188, y: 48, width: 30, height: 48 }; };
  const lowReply = (label = 'Soft reply', land = true, shot?: number) => {
    kitchen(); add(land ? [210, 80, 0] : [222, 80, 1.7], label, land ? 'Clear the net and descend to a kitchen bounce.' : 'The receiving-side contact is below net height.',
      { arc: ball[0] > 118 ? 1.7 : 3.6, duration: 1450, shot, contact: !land && count === 1 ? 'opponent' : undefined });
  };
  const bouncedFeed = (x = 132, y = 126) => {
    add([x + 16, y, 0], 'Incoming bounce', 'Let the incoming ball bounce before your groundstroke.', { arc: 2.8 });
    add([x, y, 1.6], backhand ? 'Backhand contact' : 'Forehand contact', 'Meet the bounced ball on the indicated side.', { arc: .25, duration: 650, players: { you: pose(x, y) }, contact: 'you' });
  };
  if (skill === 'serve' || skill === 'positioning' && stage === 0) {
    start([38, 126, 2], { you: [28, 114], partner: [38, 65], opponent: [322, stage === 2 ? 88 : 65], other: [234, 135] });
    scene.target = stage === 1 || stage === 3 ? { x: 282, y: 41, width: 29, height: 58 } : stage === 2 ? { x: 257, y: 41, width: 40, height: 28 } : { x: 223, y: 41, width: 88, height: 58 };
    add([stage === 1 || stage === 3 ? 295 : 280, stage === 2 ? 55 : 76, 0], '1 · Serve bounce', 'Serve from behind the baseline into the diagonal box, beyond the kitchen line.', { arc: 2.8, duration: 1450, shot: 1 });
    if (skill === 'positioning') {
      scene.target = { x: 49, y: 102, width: 45, height: 56 };
      add([306, 76, 1.8], 'Return contact', 'The receiver hits only after the serve bounces.', { duration: 500, contact: 'opponent' });
      add([66, 126, 0], '2 · Return bounce', 'The serving team also lets the return bounce.', { arc: 4.4, duration: 1400, shot: 2, players: { you: [47, 114], partner: [50, 65] } });
      add([52, 126, 1.7], 'Third-shot contact', 'Both required bounces have happened.', { duration: 600, contact: 'you', players: { you: [42, 114] } });
      lowReply('3 · Third shot', true, 3);
    }
    return scene;
  }
  if (skill === 'return') {
    const spin = v3 && stage === 2, y = backhand ? 90 : 126;
    start([324, 65, 2], { you: pose(58, y), opponent: [326, 65], other: [326, 135] });
    add([64, y, 0], spin ? 'Read the spinning serve' : 'Serve bounce', 'The serve must bounce before your return.', { arc: 4, duration: stage === 3 ? 750 : 1200, shot: 1 });
    add([50, spin ? y + 12 : y, 1.8], spin ? 'Adjust after the bounce' : 'Return contact', spin ? 'Respond to the changed bounce path.' : 'Contact after the bounce.', { duration: 650, arc: .2, players: { you: pose(50, spin ? y + 12 : y) }, contact: 'you' });
    if (stage !== 0 && !spin) deep();
    add([288, 80, 0], '2 · Return', stage === 0 || spin ? 'Keep your return in court.' : 'Land in the deep target.', { arc: 4.5, duration: 1400, shot: 2 });
    if (!v3 && stage >= 2) add([304, 80, 1.8], 'Approach and settle', 'Move toward the kitchen and get balanced as they hit.', { arc: .3, players: { you: [128, y] }, ready: true, contact: 'opponent', duration: 1100 });
    return scene;
  }
  if (['forehand', 'backhand', 'drive', 'third_shot_drop'].includes(skill)) {
    const y = backhand ? 90 : 126;
    const x = skill === 'drive' && stage === 2 ? 104 : stage === 3 && ['forehand', 'backhand'].includes(skill) ? 44 : 70;
    const gap = stage === 2 && ['forehand', 'backhand', 'drive'].includes(skill);
    start([286, 80, 2], { you: pose(Math.max(x, 70), y), partner: [52, 65], opponent: gap && skill !== 'drive' ? [290, 130] : ['forehand', 'backhand'].includes(skill) ? [304, 80] : [234, 65], other: gap && skill !== 'drive' ? [234, 150] : [234, 140] });
    for (let n = 0; n < count; n++) {
      add([x + 14, y, 0], n ? `Incoming ball ${n + 1}` : 'Incoming bounce', 'Wait for the bounce and prepare on the correct side.', { arc: 3.8, players: { you: pose(x, y) } });
      add([x, y, 2], backhand ? 'Backhand contact' : 'Forehand contact', 'Right-handed example; left-handed players mirror the paddle side.', { arc: .2, duration: 550, contact: 'you' });
      if (skill === 'third_shot_drop') lowReply(stage === 2 && v3 ? 'Choose the drop' : '3 · Drop', stage === 0 || stage === 2, 3);
      else if (skill === 'drive' && (stage === 1 || stage === 3)) {
        scene.target = { x: 222, y: 66, width: 18, height: 28 };
        add([232, 80, 2.5], '3 · Low drive', 'Arrive below net height at the defender.', { arc: .75, duration: 850, contact: 'opponent', shot: 3 });
        if (stage === 3) {
          add([116, y, 0], '4 · Short block', 'Their block bounces short, creating a closer drop opportunity.', { arc: 2.2, duration: 900, shot: 4, players: { you: pose(102, y), partner: [94, 65] } });
          add([102, y, 1.5], 'Fifth-shot contact', 'Get balanced behind the short bounce.', { duration: 500, contact: 'you' }); lowReply('5 · Drop', true, 5);
        }
      } else {
        if (stage === 3) deep();
        if (gap) scene.target = skill === 'drive' ? { x: 224, y: 92, width: 35, height: 24 } : { x: 256, y: 43, width: 52, height: 32 };
        add(skill === 'drive' && stage === 2 ? [249, 103, 0] : [282, stage === 2 ? 62 : 80, 0], count === 3 ? `Your reply ${n + 1} of 3` : skill === 'drive' ? 'Controlled drive' : `${backhand ? 'Backhand' : 'Forehand'} reply`, 'Land in the outlined target.', { arc: skill === 'drive' ? 1.6 : 2.2, duration: 1000 });
      }
      if (n < count - 1) add([298, 80, 1.8], 'Opponent prepares the next ball', 'An opponent’s contact separates your replies.', { duration: 500, contact: 'opponent' });
    }
    return scene;
  }
  if (skill === 'dinking' || skill === 'dink_strategy') {
    const y = backhand ? 90 : skill === 'dinking' && stage === 2 ? 148 : 126;
    const repeats = count === 3 ? 3 : skill === 'dink_strategy' && (stage === 1 || stage === 3) ? 2 : 1;
    start([230, 80, 1.7], { you: pose(132, y), opponent: [240, skill === 'dink_strategy' && stage === 2 ? 48 : 80] });
    for (let n = 0; n < repeats; n++) {
      if (skill === 'dink_strategy' && stage === 1 && n === 1) {
        add([132, y, 4.4], 'A comfortable high ball', 'This contact is above net height and within balanced reach.', { duration: 1000, contact: 'you' });
        add([270, 88, 0], 'Choose the downward attack', 'Attack the high ball with margin.', { arc: .6, duration: 750 }); break;
      }
      bouncedFeed(132, y);
      if (skill === 'dink_strategy' && stage === 2) {
        scene.steps[0].to = { ...scene.steps[0].to, opponent: [232, 100] };
        scene.steps[1].from = { ...scene.steps[1].from, opponent: [232, 100] }; scene.steps[1].to = { ...scene.steps[1].to, opponent: [232, 100] }; players = { ...players, opponent: [232, 100] };
        scene.target = { x: 190, y: 42, width: 29, height: 30 };
        add([209, 55, 0], 'Use the space they left', 'The opponent moves inward; target the vacated sideline.', { arc: 3.1, duration: 1300 });
      } else lowReply(count === 3 ? `Your dink ${n + 1} of 3` : 'Controlled dink', !(skill === 'dinking' && (stage === 1 || stage === 3)));
      if (skill === 'dinking' && stage === 2) add([232, 65, 1.6], 'Recover before their contact', 'Move back toward your ready position after the wide reply.', { arc: .2, duration: 1100, players: { you: [124, 120] }, ready: true, contact: 'opponent' });
      else if (n < repeats - 1) add([232, 80, 1.7], 'Opponent’s next contact', 'Prepare for the next ball in this same rally.', { arc: .15, duration: 500, contact: 'opponent', ready: true });
    }
    return scene;
  }
  if (['speedups', 'counters', 'volleys', 'resets_defense'].includes(skill)) {
    const midcourt = skill === 'resets_defense' && stage >= 2, x = midcourt ? 104 : 132, y = backhand ? 90 : 126;
    start([232, 80, skill === 'counters' && stage === 2 && v3 ? 5 : 3.4], { you: pose(x, y), opponent: skill === 'volleys' && stage === 2 ? [291, 80] : [234, 80] });
    if (skill === 'counters' && stage === 2 && v3) {
      scene.target = { x: 17, y: 109, width: 28, height: 38 };
      add([132, 126, 5], 'Recognize the high, long ball', 'Keep your paddle clear instead of contacting this ball.', { arc: .3, duration: 800, players: { you: [122, 143] }, ready: true });
      add([26, 132, 0], 'Leave it · out bounce', 'It lands beyond your baseline untouched.', { arc: .2, duration: 1000, ready: true }); return scene;
    }
    for (let n = 0; n < count; n++) {
      const high = skill === 'speedups' || skill === 'volleys' && stage === 2, low = midcourt || skill === 'volleys' && stage === 3;
      add([x, y, high ? 4.5 : low ? 1 : 3.2], high ? 'High contact' : low ? 'Low contact' : 'Incoming attack', high ? 'Above net height and within reach.' : 'Meet the ball in front, without a bounce.', { arc: high ? .5 : .2, duration: high ? 950 : 650, contact: 'you' });
      if (skill === 'resets_defense' && stage > 0 || skill === 'volleys' && stage === 3) lowReply('Soften the attack', !(stage === 2 || skill === 'volleys'));
      else if (skill === 'volleys' && stage === 2) {
        scene.target = { x: 252, y: 69, width: 27, height: 24 };
        add([266, 80, 0], 'Volley near the moving player’s feet', 'Direct the ball down as the opponent advances.', { arc: .4, duration: 850, players: { opponent: [276, 80] } });
      } else if (skill === 'speedups' && (stage === 3 || stage === 1 && v3)) {
        add([232, 80, 3.1], 'Your speedup', 'Attack from outside the kitchen, then recover the paddle.', { duration: 650, arc: .1 });
        add([232, 80, 3.1], 'Ready before their counter', 'Paddle in front, feet balanced, before their contact.', { duration: 600, ready: true, contact: 'opponent', stroke: 'ready' });
        add([132, y, 3.2], 'Their counter', 'Track the returning ball with your paddle ready.', { duration: 650, ready: true, contact: 'you' });
        if (stage === 3) add([264, 100, 0], 'Your controlled next reply', 'Keep the reply in court.', { arc: 1.2, duration: 800 });
      } else {
        if (stage === 2) scene.target = { x: 238, y: 43, width: 43, height: 30 };
        add(count === 3 && n < 2 ? [232, 80, 3.2] : [264, stage === 2 ? 60 : 95, 0], count === 3 ? `Your volley ${n + 1} of 3` : high ? 'Controlled attack' : 'Compact reply', 'Keep the ball in court and your feet outside the kitchen.', { arc: high ? .4 : 1.2, duration: 750, contact: count === 3 && n < 2 ? 'opponent' : undefined });
      }
    }
    return scene;
  }
  if (skill === 'overheads_lobs') {
    if (stage < 2) {
      start([232, 80, 2], { you: [108, 114] });
      add([118, 126, 8], 'Reachable overhead', 'The lob is within comfortable overhead reach.', { arc: 4, duration: 1500, contact: 'you' });
      if (stage === 1) scene.target = { x: 260, y: 42, width: 49, height: 33 };
      add([280, stage === 1 ? 58 : 90, 0], 'Overhead placement', 'Direct the reachable high ball down to the target.', { arc: .2, duration: 850 });
    } else if (stage === 2) {
      bouncedFeed(); deep(); add([288, 80, 0], 'Offensive lob', 'Clear the defenders’ reach, then land before the baseline.', { arc: 12, duration: 1900 });
    } else {
      scene.view = 'court'; start([232, 125, 2]);
      add([63, 128, 0], 'Call “switch” · turn and chase', 'Your partner turns to chase; you cover the vacated side.', { arc: 12, duration: 1800, players: { you: [128, 65], partner: [70, 116] } });
      add([47, 128, 1.7], 'Retrieve after the bounce', 'Stay clear of the retrieval path.', { arc: .2, duration: 700, contact: 'partner', players: { partner: [37, 116] } });
      deep(); add([286, 80, 0], 'Defensive lob example', 'A high return buys recovery time. This question counts your switch and coverage.', { arc: 12, duration: 1850, players: { partner: [67, 114] } });
    }
    return scene;
  }
  if (skill === 'transition_play') {
    scene.view = stage === 2 ? 'height' : 'court';
    start([78, 126, 1.8], { you: [68, 114], partner: stage === 3 ? [68, 65] : [128, 65] });
    if (stage === 2) {
      start([108, 126, 2], { you: [98, 114] });
      add([232, 80, 5], 'High, attackable drop', 'The opponent can hit downward. Stop advancing.', { arc: 2, duration: 1200, ready: true, contact: 'opponent' });
      add([110, 126, 1.2], 'Hold and defend', 'Stay balanced instead of running into the attack.', { duration: 700, ready: true, contact: 'you' });
    } else {
      if (stage === 0) deep(); else kitchen();
      add(stage === 0 ? [288, 80, 0] : [210, 80, 0], stage === 0 ? 'Deep return' : stage === 3 ? 'Low reset' : 'Low drop', 'Use the flight time to advance while watching the opponents.', { arc: stage === 0 ? 4.5 : 4, duration: 1500, players: { you: [106, 114], ...(stage === 3 ? { partner: [106, 65] as Point } : {}) } });
      add(stage === 0 ? [303, 80, 2] : [232, 80, 1.7], 'Settle as the opponent contacts', 'Stop balanced with the paddle ready, even if you have not reached the line.', { duration: 850, arc: .2, ready: true, contact: 'opponent', players: { you: [120, 114], ...(stage === 3 ? { partner: [120, 65] as Point } : {}) } });
      add([134, 126, 1.5], 'Receive from a stable position', 'Stay set through the incoming reply.', { arc: 1.4, duration: 900, ready: true, contact: 'you' });
    }
    return scene;
  }
  if (skill === 'positioning') {
    scene.view = 'court';
    if (stage === 2) {
      add([142, 100, 0], 'Call “mine” or “yours” early', 'Agree who takes the middle ball before either swing.', { arc: 2.8, players: { you: [128, 142], partner: [122, 88] } });
      add([132, 100, 1.6], 'One player takes it', 'Your partner contacts the ball while you keep the path clear.', { duration: 600, contact: 'partner' });
      add([208, 80, 0], 'Cover the next space', 'Maintain spacing for the next reply.', { arc: 3, players: { you: [128, 132] } });
    } else {
      add([145, 45, 0], 'Partner pulled wide', 'Shift with your partner to reduce the middle gap.', { arc: 2.7, players: { partner: [122, 33], you: [128, 94] } });
      add([132, 45, 1.6], 'Cover the middle', 'Leave room for their stroke and stay ready.', { duration: 600, ready: true, contact: 'partner' });
      add([212, 65, 0], 'Partner’s soft reply', 'Their soft reply creates time to recover.', { arc: 3, duration: 1200 });
      if (stage === 3) add([233, 65, 1.7], 'Recover spacing together', 'Your partner moves inward; you restore your spacing.', { arc: .2, duration: 1000, players: { partner: [128, 65], you: [128, 126] }, ready: true, contact: 'opponent' });
    }
    return scene;
  }
  start([234, 80, 3], { you: [94, 138], partner: stage === 2 ? [128, 43] : [128, 65] });
  add([104, 145, 1], stage === 2 ? 'Middle exposed after a wide attack' : 'Low, stretched contact', stage === 1 ? 'After two similar misses, judge the next decision shown here.' : 'There is little margin for a hard downward attack.', { duration: 950, contact: 'you', players: { you: [94, 133] } });
  lowReply('Choose the controlled reset');
  if (stage === 2) add([232, 80, 1.7], 'Restore team coverage', 'The soft ball gives your partner time to recover.', { duration: 800, arc: .2, players: { partner: [128, 65] }, ready: true, contact: 'opponent' });
  return scene;
}
