import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { AssessmentItem } from '@/lib/skill/model';
import { getCourtScene, pointOnRoute, routePath } from './courtScenes';
import './assessment.css';

/** Placement diagrams, not demonstrations of stroke mechanics or ball height.
 * SVG coordinates keep playback aligned at every screen size. Pausing preserves
 * elapsed time; replay and a new question start at the beginning. No media host.
 */
export function CourtScenario({ item }: { item: AssessmentItem }) {
  return <ScenePlayer key={item.itemKey} item={item} />;
}

function ScenePlayer({ item }: { item: AssessmentItem }) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const id = useId();
  const scene = getCourtScene(item);
  const canPlay = scene.kind !== 'hold' && !reduced;

  useEffect(() => {
    if (!canPlay || !playing) return;
    let frame: number;
    let last: number | undefined;
    const tick = (now: number) => {
      // Do not fast-forward when a phone tab returns from the background.
      if (last !== undefined) elapsed.current += Math.min(now - last, 50);
      last = now;
      const next = Math.min(elapsed.current / 3600, 1);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [canPlay, playing]);

  // Reduced motion always shows the starting positions and full static arrows.
  const p = reduced ? 0 : progress;
  const route = scene.incoming ? [scene.incoming, ...scene.route] : scene.route;
  const moving = pointOnRoute(route, p);
  const you = scene.kind === 'move' ? moving : scene.you;
  const partner = scene.partnerTo ? pointOnRoute([scene.partner, scene.partnerTo], p) : scene.partner;
  const destination = scene.route[scene.route.length - 1];
  const replay = progress === 1;
  const toggle = () => {
    if (replay) { elapsed.current = 0; setProgress(0); }
    setPlaying(value => !value);
  };
  const action = playing ? 'Pause' : replay ? 'Replay' : progress > 0 ? 'Resume' : 'Play';

  return <figure className="assessment-court">
    <div className="assessment-court-toolbar">
      <span>Top view · {scene.kind === 'ball' ? 'shot placement' : 'player movement'}</span>
      {canPlay ? <button type="button" aria-label={`${action} court animation`} onClick={toggle}>
        {playing ? <Pause size={15} /> : replay ? <RotateCcw size={15} /> : <Play size={15} />}{action}
      </button> : <span className="assessment-still">Still diagram</span>}
    </div>
    <svg viewBox="0 0 360 208" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{scene.caption}</title>
      <desc id={`${id}-description`}>Court seen from above. You and your partner are on the left; opponents are on the right. The shaded strip is the kitchen. {scene.kind === 'hold' ? 'Hold your position.' : scene.kind === 'move' ? `Gold arrows show your movement.${scene.partnerTo ? ' A white arrow shows your partner’s movement.' : ''}` : scene.opponentShot ? 'The white arrow shows the opponent’s return. Let it bounce in the outlined area.' : `Gold arrows show your shot toward the outlined target.${scene.incoming ? ' The white dashed arrow is the incoming ball.' : ''} Height and paddle technique are not shown.`}</desc>
      <defs>
        <marker id={`${id}-gold`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#ffe08a" /></marker>
        <marker id={`${id}-white`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#e9f2ee" /></marker>
      </defs>
      <rect x="48" y="40" width="264" height="120" fill="#174b45" stroke="#d2e8e2" strokeWidth="1.5" />
      <rect x="138" y="40" width="84" height="120" fill="#34776b" />
      <path d="M138 40V160 M222 40V160 M48 100H138 M222 100H312" stroke="#c6e0d8" />
      <path d="M180 34V166" stroke="#f3faf7" strokeWidth="3" strokeDasharray="3 2" />
      <text x="88" y="23" textAnchor="middle">YOUR TEAM</text>
      <text x="180" y="23" textAnchor="middle">NET</text>
      <text x="275" y="23" textAnchor="middle">OPPONENTS</text>
      <path d="M138 173V179H222V173" fill="none" stroke="#bcd7d0" />
      <text x="180" y="197" textAnchor="middle">KITCHEN</text>
      {scene.kind === 'ball' && (scene.target
        ? <rect {...scene.target} fill="#ffe08a" fillOpacity=".16" stroke="#ffe08a" strokeWidth="1.5" strokeDasharray="4 3" />
        : <ellipse cx={destination[0]} cy={destination[1]} rx="14" ry="11" fill="#ffe08a" fillOpacity=".16" stroke="#ffe08a" strokeWidth="1.5" strokeDasharray="4 3" />)}
      {scene.incoming && <path d={routePath([scene.incoming, scene.route[0]])} fill="none" stroke="#e9f2ee" strokeWidth="1.5" strokeDasharray="3 4" markerEnd={`url(#${id}-white)`} />}
      {scene.kind !== 'hold' && <path d={routePath(scene.route)} fill="none" stroke={scene.opponentShot ? '#e9f2ee' : '#ffe08a'} strokeWidth="2.5" markerEnd={`url(#${id}-${scene.opponentShot ? 'white' : 'gold'})`} />}
      {scene.partnerTo && <path d={routePath([scene.partner, scene.partnerTo])} fill="none" stroke="#e9f2ee" strokeWidth="2" strokeDasharray="4 3" markerEnd={`url(#${id}-white)`} />}
      {scene.opponents.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="8" fill="#7fc1fa" stroke="#103f39" strokeWidth="2" />)}
      <g transform={`translate(${partner.join(' ')})`}>
        <circle r="8" fill="#e9f2ee" stroke="#103f39" strokeWidth="2" />
        <text y={partner[1] < 60 ? 23 : -15} textAnchor="middle">Partner</text>
      </g>
      <g className="assessment-you" transform={`translate(${you.join(' ')})`}>
        <rect x="-8" y="-8" width="16" height="16" rx="4" fill="#ffe08a" stroke="#103f39" strokeWidth="2" />
        <text y="24" textAnchor="middle" fill="#fff4c7">YOU</text>
      </g>
      {scene.kind === 'hold' && <text x={scene.you[0]} y={scene.you[1] - 18} textAnchor="middle" fill="#ffe08a">STOP</text>}
      {scene.kind === 'ball' && <circle className="assessment-ball" cx={moving[0]} cy={moving[1]} r="5" fill="#fff" stroke="#19362e" strokeWidth="1.5" />}
    </svg>
    <div className="assessment-court-key" aria-hidden="true">
      {scene.kind === 'ball' ? <><span><i className="assessment-ball-key" />Ball</span><span className={scene.opponentShot ? undefined : 'assessment-gold-key'}>→ {scene.opponentShot ? 'Their return' : 'Your shot'}</span><span><i className="assessment-target-key" />{scene.opponentShot ? 'Bounce here' : 'Target'}</span>{scene.incoming && <span>⇢ Incoming</span>}</> : <span className="assessment-gold-key">{scene.kind === 'hold' ? 'Stay balanced here' : '→ Move with the arrow'}</span>}
    </div>
    <figcaption>{scene.caption}</figcaption>
  </figure>;
}
