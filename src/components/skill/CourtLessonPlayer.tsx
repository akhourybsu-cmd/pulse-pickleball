import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import type { AssessmentItem } from '@/lib/skill/model';
import { ballOnFlight, flightPath, getCourtLesson, lessonDuration, lessonFrame, type Player } from './courtLessons';
import './assessment.css';

const colors: Record<Player, string> = { you: '#ffe08a', partner: '#edf6f3', opponent: '#83caff', other: '#83caff' };
const names: Record<Player, string> = { you: 'You', partner: 'Partner', opponent: 'Opponent', other: 'Opponent' };
const handPreference = () => { try { return localStorage.getItem('pulse.assessment.left-handed') === 'true'; } catch { return false; } };

export function CourtLessonPlayer({ item }: { item: AssessmentItem }) {
  const reduced = useReducedMotion();
  const scene = useMemo(() => getCourtLesson(item), [item]);
  const duration = lessonDuration(scene);
  const heightTop = useMemo(() => Math.max(0, Math.floor(142 - Math.max(7, ...scene.steps.flatMap(step => [0, .25, .5, .75, 1].map(p => ballOnFlight(step.ball, p)[2]))) * 8 - 12)), [scene]);
  const [view, setView] = useState(scene.view);
  const [left, setLeft] = useState(handPreference);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const elapsed = useRef(0);
  const id = useId();
  const frame = lessonFrame(scene, time);
  const replay = time >= duration;
  const seek = (next: number) => { setPlaying(false); elapsed.current = next; setTime(next); };
  const stepTime = (index: number) => scene.steps.slice(0, index).reduce((n, step) => n + step.duration, 0);
  const seekStep = (index: number) => seek(stepTime(index) + scene.steps[index].duration * .999);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (!playing || reduced) return;
    let request: number, last: number | undefined;
    const tick = (now: number) => {
      if (last !== undefined) elapsed.current = Math.min(duration, elapsed.current + Math.min(now - last, 50) * speed);
      last = now; setTime(elapsed.current);
      if (elapsed.current < duration) request = requestAnimationFrame(tick); else setPlaying(false);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, reduced, speed, duration]);
  const toggle = () => { if (replay) { elapsed.current = 0; setTime(0); } setPlaying(value => !value); };
  const y = (value: number) => left ? 200 - value : value;
  const ballX = frame.ball[0], ballY = view === 'court' ? y(frame.ball[1]) : 142 - frame.ball[2] * 8;
  const path = view === 'court' && left
    ? flightPath({ ...frame.step.ball, from: [frame.step.ball.from[0], y(frame.step.ball.from[1]), frame.step.ball.from[2]], to: [frame.step.ball.to[0], y(frame.step.ball.to[1]), frame.step.ball.to[2]] }, view)
    : flightPath(frame.step.ball, view);
  const action = playing ? 'Pause' : replay ? 'Replay' : time > 0 ? 'Resume' : 'Play';

  return <figure className="assessment-lesson" aria-labelledby={`${id}-caption`}>
    <div className="assessment-lesson-top">
      <div className="assessment-view-switch" role="group" aria-label="Diagram view">
        <button type="button" aria-pressed={view === 'court'} onClick={() => setView('court')}>Court</button>
        <button type="button" aria-pressed={view === 'height'} onClick={() => setView('height')}>Ball height</button>
      </div>
      <span className="assessment-lesson-context">{scene.pressure ? 'Important point' : scene.count === 3 ? '3-shot sequence' : 'Game situation'}</span>
    </div>
    <svg className="assessment-lesson-diagram" viewBox={view === 'court' ? '0 0 360 204' : `0 ${heightTop} 360 ${184 - heightTop}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{item.focus ?? item.situation}: {frame.step.label}</title>
      <desc id={`${id}-desc`}>{scene.caption} {view === 'court' ? 'Court seen from above. Your team is left, opponents right; the center strip is the kitchen.' : 'Height view. The ball arc shows bounce, net clearance and contact height. Player depths overlap in this view.'} {frame.step.detail}</desc>
      <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ffe08a" /></marker></defs>
      {view === 'court' ? <>
        <rect x="48" y="40" width="264" height="120" rx="1" fill="#143f3b" stroke="#cde8e0" strokeWidth="1.4" />
        <rect x="138" y="40" width="84" height="120" fill="#296b60" />
        <path d="M138 40V160 M222 40V160 M48 100H138 M222 100H312" stroke="#acd2c7" />
        <path d="M180 35V165" stroke="#edf6f3" strokeWidth="3" strokeDasharray="3 2" />
        <text x="77" y="22" textAnchor="middle">YOUR TEAM</text><text x="283" y="22" textAnchor="middle">OPPONENTS</text>
        <text x="180" y="186" textAnchor="middle">KITCHEN</text>
        <rect {...scene.target} y={left ? 200 - scene.target.y - scene.target.height : scene.target.y} fill="#ffe08a" fillOpacity=".1" stroke="#ffe08a" strokeDasharray="4 3" />
        {Object.entries(frame.players).map(([key, [px, py]]) => {
          const who = key as Player, from = frame.step.from[who], to = frame.step.to[who];
          return from[0] !== to[0] || from[1] !== to[1] ? <path key={key} d={`M${from[0]} ${y(from[1])} L${to[0]} ${y(to[1])}`} stroke={colors[who]} strokeWidth="2" strokeDasharray="3 3" fill="none" markerEnd={`url(#${id}-arrow)`} /> : null;
        })}
      </> : <>
        <rect x="48" y="142" width="264" height="9" rx="2" fill="#296b60" />
        <path d="M48 142H312" stroke="#cde8e0" strokeWidth="2" />
        <path d="M20 118H340" stroke="#cde8e0" strokeOpacity=".35" strokeDasharray="4 4" />
        <path d="M180 118V142" stroke="#edf6f3" strokeWidth="3" /><path d="M174 118H186" stroke="#edf6f3" strokeWidth="2" />
        <text x="180" y="109" textAnchor="middle">NET HEIGHT</text>
        <path d="M138 151V156H222V151" stroke="#acd2c7" fill="none" /><text x="180" y="173" textAnchor="middle">KITCHEN</text>
        {item.subskill === 'overheads_lobs' && <><path d="M225 74H252" stroke="#83caff" strokeDasharray="3 3" /><text x="257" y="77">Reach</text></>}
      </>}
      <path d={path} stroke="#ffe08a" strokeOpacity=".7" strokeWidth="2" strokeDasharray="4 3" fill="none" markerEnd={`url(#${id}-arrow)`} />
      {(Object.entries(frame.players) as [Player, readonly [number, number]][]).filter(([who]) => view === 'court' || who === (frame.step.ball.contact === 'partner' ? 'partner' : 'you') || who === 'opponent').map(([who, [px, py]]) => {
        const own = who === 'you' || who === 'partner';
        const active = frame.step.ball.contact === who;
        const tipX = active ? frame.step.ball.to[0] - px : own ? 11 : -11;
        const tipY = frame.step.ready || who !== 'you' ? 0 : (frame.step.stroke === 'backhand' ? -12 : 12) * (left ? -1 : 1);
        return view === 'court' ? <g key={who} className={`assessment-player assessment-${who}`} transform={`translate(${px} ${y(py)})`}>
          {who === 'you' ? <rect x="-7" y="-7" width="14" height="14" rx="4" fill={colors[who]} stroke="#0b2825" strokeWidth="1.5" /> : <circle r="7" fill={colors[who]} stroke="#0b2825" strokeWidth="1.5" />}
          <path d={`M0 0L${tipX} ${active ? y(frame.step.ball.to[1]) - y(py) : tipY}`} stroke={colors[who]} strokeWidth="2.2" />
          <ellipse cx={tipX} cy={active ? y(frame.step.ball.to[1]) - y(py) : tipY} rx="3.5" ry="5" fill="#183b37" stroke={colors[who]} strokeWidth="1.5" />
          {own && <text y={py < 50 ? 23 : -14} textAnchor="middle">{names[who]}</text>}
        </g> : <g key={who} className={`assessment-player assessment-${who}`} transform={`translate(${px} 142)`} stroke={colors[who]} strokeWidth="2" fill="none">
          <circle cy="-38" r="5" fill={colors[who]} stroke="none" /><path d="M0 -32V-15 M0 -15L-5 0 M0 -15L5 0" />
          <path d={`M0 -28L${active ? tipX : own ? 11 : -11} ${active ? -frame.step.ball.to[2] * 8 : -25}`} />
          <ellipse cx={active ? tipX : own ? 11 : -11} cy={active ? -frame.step.ball.to[2] * 8 : -25} rx="3" ry="5" />
          <text y="18" textAnchor="middle" stroke="none" fill={colors[who]}>{names[who]}</text>
        </g>;
      })}
      {frame.step.ball.bounce && <ellipse cx={frame.step.ball.to[0]} cy={view === 'court' ? y(frame.step.ball.to[1]) : 142} rx="7" ry="3" fill="none" stroke="#fff" strokeDasharray="2 2" />}
      <circle className="assessment-ball" cx={ballX} cy={ballY} r="4.5" fill="#fff" stroke="#102e29" strokeWidth="1.3" />
    </svg>
    <div className="assessment-lesson-controls">
      {!reduced && <button type="button" className="assessment-play" aria-label={`${action} court animation`} onClick={toggle}>{playing ? <Pause size={16} /> : replay ? <RotateCcw size={16} /> : <Play size={16} />}{action}</button>}
      {reduced && <span className="assessment-still">Still steps · reduced motion</span>}
      <button type="button" aria-label="Restart court animation" onClick={() => seek(0)}><RotateCcw size={16} /></button>
      <button type="button" aria-label="Previous scene step" disabled={frame.index === 0} onClick={() => seekStep(frame.index - 1)}><ChevronLeft size={18} /></button>
      <button type="button" aria-label="Next scene step" disabled={frame.index === scene.steps.length - 1} onClick={() => seekStep(frame.index + 1)}><ChevronRight size={18} /></button>
      {!reduced && <button type="button" aria-label={speed === 1 ? 'Use slow motion' : 'Use normal playback speed'} aria-pressed={speed === .5} onClick={() => setSpeed(value => value === 1 ? .5 : 1)}>{speed === .5 ? '0.5×' : '1×'}</button>}
    </div>
    <input type="range" className="assessment-timeline" aria-label="Diagram progress" aria-valuetext={`Step ${frame.index + 1} of ${scene.steps.length}: ${frame.step.label}`} min={0} max={duration} step={1} value={time} onChange={e => seek(Number(e.target.value))} />
    <div className="assessment-step-copy" aria-live={playing ? 'off' : 'polite'}><span>STEP {frame.index + 1} / {scene.steps.length}</span><strong>{frame.step.label}</strong><p>{frame.step.detail}</p></div>
    <details className="assessment-sequence"><summary>Sequence &amp; what to watch</summary><ol>{scene.steps.map((step, index) => <li key={index}><button type="button" aria-label={`Show step ${index + 1}: ${step.label}`} onClick={() => seekStep(index)}><strong>{index + 1}. {step.label}</strong><span>{step.detail}</span></button></li>)}</ol></details>
    <figcaption id={`${id}-caption`}>{scene.caption}</figcaption>
    <div className="assessment-lesson-foot"><label><input type="checkbox" checked={left} onChange={e => { setLeft(e.target.checked); try { localStorage.setItem('pulse.assessment.left-handed', String(e.target.checked)); } catch { /* Session-only when storage is unavailable. */ } }} /> Left-handed view</label><span>Placement &amp; timing illustration</span></div>
  </figure>;
}
