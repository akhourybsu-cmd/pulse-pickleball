import type { AssessmentItem, Subskill } from '@/lib/skill/model';

type Point = readonly [number, number];
export type CourtScene = {
  kind: 'ball' | 'move' | 'hold';
  route: readonly Point[];
  caption: string;
  you: Point;
  partner: Point;
  opponents: readonly Point[];
  incoming?: Point;
  opponentShot?: boolean;
  partnerTo?: Point;
  target?: { x: number; y: number; width: number; height: number };
};
type Shot = { from: Point; to: Point; caption: string };
const shots: Record<Subskill, Shot> = {
  serve: { from: [38, 126], to: [279, 76], caption: 'Serve diagonally, beyond the kitchen.' },
  return: { from: [66, 126], to: [287, 135], caption: 'Let the serve bounce, then return it in court.' },
  forehand: { from: [70, 126], to: [277, 76], caption: 'Forehand: send the bounced ball into the opposite court.' },
  backhand: { from: [70, 126], to: [277, 76], caption: 'Backhand: send the bounced ball into the opposite court.' },
  drive: { from: [70, 126], to: [230, 80], caption: 'Drive: hit firmly and low over the net.' },
  third_shot_drop: { from: [64, 126], to: [202, 80], caption: 'Drop: hit softly from the baseline into the kitchen.' },
  dinking: { from: [132, 126], to: [202, 80], caption: 'Dink: a soft shot that bounces in the kitchen.' },
  dink_strategy: { from: [132, 126], to: [208, 64], caption: 'Keep a low ball soft; wait for a better ball to attack.' },
  speedups: { from: [132, 126], to: [243, 95], caption: 'Speedup: attack a high ball from the kitchen line.' },
  counters: { from: [132, 126], to: [254, 80], caption: 'Counter: block the fast ball back with a short swing.' },
  volleys: { from: [132, 126], to: [256, 80], caption: 'Volley: hit before the bounce, from outside the kitchen.' },
  resets_defense: { from: [132, 126], to: [204, 80], caption: 'Reset: soften a hard ball into the kitchen.' },
  transition_play: { from: [68, 126], to: [128, 126], caption: 'Move up, then get balanced before the next shot.' },
  overheads_lobs: { from: [118, 126], to: [278, 80], caption: 'Overhead: hit a reachable high ball into the court.' },
  positioning: { from: [128, 130], to: [128, 100], caption: 'Shift with your partner to cover the middle.' },
  strategy: { from: [104, 126], to: [204, 80], caption: 'Choose a controlled reply when a hard attack is risky.' },
};

/** Straight top-view routes intentionally encode placement, never ball height.
 * Variants show the action being assessed, including the reply AFTER an attack.
 */
export function getCourtScene(item: AssessmentItem): CourtScene {
  const { subskill: skill, dimension: measure } = item;
  const shot = shots[skill];
  const scene: CourtScene = {
    kind: 'ball', route: [shot.from, shot.to], caption: shot.caption,
    you: [shot.from[0] - 9, shot.from[1] + 3], partner: [128, 65], opponents: [[233, 62], [233, 135]],
  };
  if (skill === 'serve') {
    scene.you = [35, 134]; scene.partner = [64, 66]; scene.opponents = [[305, 63], [233, 135]];
    scene.target = { x: 223, y: 41, width: 88, height: 58 };
    if (measure === 'consistency' || measure === 'pressure') {
      scene.route = [shot.from, [295, 80]];
      scene.target = { x: 282, y: 41, width: 29, height: 58 };
      scene.caption = 'Aim for the back third of the diagonal service box.';
    }
    if (measure === 'application') {
      scene.opponents = [[305, 87], [233, 135]];
      scene.route = [shot.from, [280, 55]];
      scene.target = { x: 257, y: 42, width: 38, height: 27 };
      scene.caption = 'Aim into the open side of the service box.';
    }
  }
  if (skill === 'return') {
    scene.incoming = [323, 65]; scene.opponents = [[320, 65], [320, 135]];
    if (measure !== 'execution') {
      scene.target = { x: 269, y: 41, width: 42, height: 118 };
      scene.caption = 'After the bounce, aim deep to give yourself time to move up.';
    }
  }
  if ((skill === 'forehand' || skill === 'backhand') && measure === 'pressure') {
    scene.target = { x: 269, y: 41, width: 42, height: 118 };
    scene.caption = `Under pressure, send your ${skill} deep into their court.`;
  }
  if (skill === 'dink_strategy' && measure === 'application') scene.caption = 'Place the dink wide, into the space the opponent left.';
  if (skill === 'dinking' && measure === 'application') {
    scene.route = [[132, 146], [203, 65]]; scene.you = [124, 148];
    scene.caption = 'Reply softly from the sideline, then recover your position.';
  }
  if (skill === 'drive' && measure === 'application') {
    scene.route = [[96, 126], [232, 100]]; scene.you = [87, 129];
    scene.caption = 'From a short, high ball, drive toward feet or the middle gap.';
  }
  if (skill === 'counters' || skill === 'resets_defense' || skill === 'volleys') scene.incoming = [233, 110];
  if (skill === 'counters' && measure === 'application') scene.caption = 'Redirect the incoming attack into the open space.';
  if (skill === 'volleys' && measure === 'application') {
    scene.opponents = [[269, 80], [233, 135]]; scene.route = [shot.from, [269, 80]];
    scene.caption = 'Aim your high volley at the moving opponent’s feet.';
  }
  if ((skill === 'drive' || skill === 'speedups') && measure === 'pressure') {
    scene.incoming = [233, 85]; scene.route = [shot.from, [267, 113]];
    scene.caption = 'After your attack, stay balanced and control their reply.';
  }
  if (skill === 'resets_defense') {
    if (measure === 'execution') {
      scene.route = [shot.from, [259, 80]]; scene.caption = 'Block the incoming ball back inside the court.';
    } else if (measure === 'application' || measure === 'pressure') {
      scene.route = [[104, 126], shot.to]; scene.you = [95, 129];
      scene.caption = 'From midcourt, soften the ball into the kitchen.';
    }
  }
  if (skill === 'transition_play') {
    scene.kind = 'move'; scene.you = shot.from;
    if (measure === 'application') {
      scene.kind = 'hold'; scene.you = [104, 126]; scene.route = [scene.you];
      scene.caption = 'Your drop is too high. Stop here and prepare to defend.';
    } else if (measure === 'pressure') {
      scene.route = [[94, 126], [128, 126]]; scene.you = scene.route[0];
      scene.partner = [94, 65]; scene.partnerTo = [128, 65];
      scene.caption = 'After a low reset, advance together as a team.';
    } else if (measure === 'consistency') {
      scene.route = [[80, 126], [110, 126]]; scene.you = scene.route[0];
      scene.caption = 'After your drop, move forward and stop as they hit.';
    }
  }
  if (skill === 'overheads_lobs' && measure === 'application') {
    scene.route = [[132, 126], [287, 80]]; scene.you = [124, 129];
    scene.caption = 'Lob over their reach; land inside the baseline. Height is not shown.';
  }
  if (skill === 'overheads_lobs' && measure === 'pressure') {
    scene.kind = 'move'; scene.route = [[128, 126], [128, 76]]; scene.you = scene.route[0];
    scene.partner = [124, 65]; scene.partnerTo = [65, 130];
    scene.caption = 'Call “switch”: your partner chases the lob; you cover their side.';
  }
  if (skill === 'positioning') {
    if (measure === 'execution') {
      scene.route = [[279, 76], [68, 126]]; scene.you = [56, 138]; scene.partner = [65, 65];
      scene.opponents = [[282, 65], [233, 135]];
      scene.opponentShot = true;
      scene.caption = 'You served. Let their return bounce before hitting.';
    } else {
      scene.kind = 'move'; scene.you = shot.from; scene.partner = [128, 64]; scene.partnerTo = [128, 49];
      if (measure === 'application') {
        scene.route = [[128, 130], [128, 145]]; scene.partnerTo = [128, 100];
        scene.caption = 'Call who takes the middle ball; cover the space they leave.';
      }
      if (measure === 'pressure') scene.caption = 'Cover the middle while your partner recovers from a wide ball.';
    }
  }
  return scene;
}

export function routePath(route: readonly Point[]): string {
  return route.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ');
}

/** Equal time per leg makes the incoming ball and reply both easy to follow. */
export function pointOnRoute(route: readonly Point[], progress: number): Point {
  if (route.length === 1) return route[0];
  const position = Math.max(0, Math.min(progress, 1)) * (route.length - 1);
  const leg = Math.min(Math.floor(position), route.length - 2);
  const t = position - leg;
  return [route[leg][0] + (route[leg + 1][0] - route[leg][0]) * t, route[leg][1] + (route[leg + 1][1] - route[leg][1]) * t];
}
