import { useId, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import type { AssessmentItem, Subskill } from '@/lib/skill/model';
import './assessment.css';

type Scene = { path: string; from: [number, number]; to: [number, number]; caption: string; movement?: boolean; you?: [number, number] };
const scenes: Record<Subskill, Scene> = {
  serve: { path: 'M 38 126 Q 158 114 279 76', from: [38, 126], to: [279, 76], caption: 'Serve diagonally beyond the kitchen.' },
  return: { path: 'M 64 126 Q 175 68 285 76', from: [64, 126], to: [285, 76], caption: 'Let the serve bounce, then return into the court.' },
  forehand: { path: 'M 70 127 Q 185 112 277 76', from: [70, 127], to: [277, 76], caption: 'A forehand from the baseline into the opposite court.' },
  backhand: { path: 'M 70 73 Q 185 100 277 125', from: [70, 73], to: [277, 125], caption: 'A backhand from the baseline into the opposite court.' },
  drive: { path: 'M 70 126 L 228 79', from: [70, 126], to: [228, 79], caption: 'A firm, low drive toward an opponent at the kitchen.' },
  third_shot_drop: { path: 'M 64 124 Q 124 44 201 80', from: [64, 124], to: [201, 80], caption: 'A soft third shot from the baseline into the kitchen.' },
  dinking: { path: 'M 132 128 Q 171 76 201 78', from: [132, 128], to: [201, 78], caption: 'A soft dink from near the kitchen line.' },
  dink_strategy: { path: 'M 132 125 Q 172 94 208 65', from: [132, 125], to: [208, 65], caption: 'Use soft placement to move the opponent before attacking.' },
  speedups: { path: 'M 132 123 L 230 83', from: [132, 123], to: [230, 83], caption: 'Attack an available high ball; prepare for the reply.' },
  counters: { path: 'M 132 124 L 245 72', from: [132, 124], to: [245, 72], caption: 'Use a compact reply to redirect an incoming fast ball.' },
  volleys: { path: 'M 132 124 L 248 77', from: [132, 124], to: [248, 77], caption: 'Contact before the bounce, staying outside the kitchen.' },
  resets_defense: { path: 'M 132 124 Q 168 69 204 79', from: [132, 124], to: [204, 79], caption: 'Soften the incoming ball into the kitchen.' },
  transition_play: { path: 'M 68 124 L 131 124', from: [68, 124], to: [131, 124], caption: 'Move toward the kitchen when the ball gives you time.', movement: true },
  overheads_lobs: { path: 'M 130 124 Q 235 24 285 80', from: [130, 124], to: [285, 80], caption: 'A lob travels over the opponents toward the baseline.' },
  positioning: { path: 'M 130 125 L 130 103', from: [130, 125], to: [130, 103], caption: 'Shift with your partner to cover the middle.', movement: true },
  strategy: { path: 'M 109 123 Q 160 72 207 80', from: [109, 123], to: [207, 80], caption: 'Choose controlled placement when attacking is risky.' },
};

/** Top-down schematic: exact court proportions, static route always visible,
 * text equivalent and pause control. Trajectory curves show direction only;
 * they do not represent ball height, speed, spin or a real player demonstration.
 */
export function CourtScenario({ item }: { item: AssessmentItem }) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const titleId = useId();
  let scene = scenes[item.subskill];
  if (item.subskill === 'overheads_lobs' && item.dimension !== 'application' && item.dimension !== 'pressure') {
    scene = { path: 'M 110 122 L 278 74', from: [110, 122], to: [278, 74], caption: 'Finish a reachable overhead inside the court.' };
  }
  if (item.subskill === 'overheads_lobs' && item.dimension === 'pressure') {
    scene = { path: 'M 128 124 Q 88 113 71 70', from: [128, 124], to: [71, 70], caption: 'Call the switch and cover the lob together.', movement: true };
  }
  if (item.subskill === 'positioning' && item.dimension === 'execution') {
    scene = { path: 'M 280 74 Q 180 102 68 127', from: [280, 74], to: [68, 127], you: [58, 138], caption: 'The serving team waits for the return to bounce.' };
  }
  if (item.subskill === 'resets_defense' && (item.dimension === 'application' || item.dimension === 'pressure')) {
    scene = { path: 'M 104 124 Q 160 55 204 79', from: [104, 124], to: [204, 79], caption: 'From midcourt, soften the ball into the kitchen.' };
  }
  if (item.subskill === 'transition_play' && item.dimension === 'application') {
    scene = { path: 'M 106 124 L 106 124', from: [106, 124], to: [106, 124], caption: 'Hold in midcourt and get balanced when your drop sits high.', movement: true };
  }
  const you = scene.you ?? [scene.from[0] >= 128 && scene.from[0] <= 132 ? 128 : scene.from[0], scene.from[1]];
  const serving = item.subskill === 'serve' || (item.subskill === 'positioning' && item.dimension === 'execution');
  const partner = serving ? [65, 65] : [130, 67];
  const opponents = item.subskill === 'serve' ? [[300, 66], [232, 130]] : item.subskill === 'return' ? [[285, 66], [285, 130]] : [[232, 66], [232, 130]];
  const animationStyle = {
    offsetPath: `path('${scene.path}')`, offsetDistance: playing && !reduced ? undefined : '100%',
    animationPlayState: playing ? 'running' : 'paused',
  } as CSSProperties;
  return (
    <figure className="assessment-court">
      <div className="flex items-center justify-between px-3 pt-2 text-[10px] font-semibold uppercase tracking-widest">
        <span>Picture the situation</span>
        <button type="button" aria-label={playing ? 'Pause court animation' : 'Play court animation'} aria-pressed={playing}
          disabled={!!reduced} onClick={() => setPlaying(v => !v)} className="flex min-h-10 items-center gap-1 rounded-md px-2 focus-visible:outline focus-visible:outline-2 disabled:opacity-50">
          {playing ? <Pause size={13} /> : <Play size={13} />} {reduced ? 'Still diagram' : playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <svg viewBox="0 0 360 197" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`${scene.caption} Top-down court. Yellow is you, white is your partner; blue players are opponents. Dashed line shows ${scene.movement ? 'player movement' : 'ball direction'}.`}</title>
        <rect x="48" y="40" width="264" height="120" rx="2" fill="#174b45" stroke="#d2e8e2" strokeWidth="1.5" />
        <rect x="138" y="40" width="84" height="120" fill="#34776b" />
        <path d="M138 40V160 M222 40V160 M48 100H138 M222 100H312" stroke="#c6e0d8" strokeWidth="1" />
        <path d="M180 31V169" stroke="#f3faf7" strokeWidth="2.5" strokeDasharray="3 2" />
        <text x="92" y="26" textAnchor="middle" fill="#e0eee9" fontSize="10">YOUR TEAM</text>
        <text x="270" y="26" textAnchor="middle" fill="#e0eee9" fontSize="10">OPPONENTS</text>
        <text x="180" y="185" textAnchor="middle" fill="#bcd7d0" fontSize="10">SHADED = KITCHEN · NET AT CENTER</text>
        <ellipse cx={scene.to[0]} cy={scene.to[1]} rx="15" ry="12" fill="#f3d574" fillOpacity="0.18" stroke="#f3d574" strokeDasharray="3 3" />
        <circle cx={partner[0]} cy={partner[1]} r="7" fill="#e9f2ee" stroke="#133f39" strokeWidth="2" />
        {opponents.map(([x, y]) => <circle key={y} cx={x} cy={y} r="7" fill="#7fc1fa" stroke="#123f46" strokeWidth="2" />)}
        <path d={scene.path} fill="none" stroke="#f3d574" strokeWidth="2" strokeDasharray="5 4" />
        <circle cx={you[0]} cy={you[1]} r="8" fill="#f3d574" stroke="#183d35" strokeWidth="2" />
        <text x={you[0]} y={you[1] + 22} fill="#fff4c7" fontSize="10" textAnchor="middle">YOU</text>
        {playing && !reduced ? <circle r={scene.movement ? 6 : 4} fill="#fffbd4" className="assessment-moving-ball" style={animationStyle} />
          : <circle cx={scene.to[0]} cy={scene.to[1]} r="4" fill="#fffbd4" />}
      </svg>
      <figcaption className="px-3 pb-3 text-xs leading-relaxed text-emerald-50/85">{scene.caption} <span className="text-emerald-50/60">Placement sketch; ball height is described in the question.</span></figcaption>
    </figure>
  );
}
