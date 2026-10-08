import { forwardRef, useId } from 'react';
import { Logo } from '@/components/Logo';
import { ASSESSMENT_CARD_SIZE, assessmentCardName, assessmentShareSummary, type AssessmentCardFormat } from '@/lib/skill/assessmentShare';
import type { ScoringSnapshot } from '@/lib/skill/scoring';

/** Wrap at word boundaries, including names or labels with one long unbroken word. */
function cardLines(text: string, limit: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && Array.from(`${line} ${word}`).length > limit) { lines.push(line); line = ''; }
    const letters = Array.from(word);
    while (letters.length > limit) { lines.push(letters.splice(0, limit).join('')); }
    line = line ? `${line} ${letters.join('')}` : letters.join('');
  }
  if (line) lines.push(line);
  return lines;
}

// Conservative glyph widths keep long names inside the frame without stretching letters.
function nameFontSize(text: string) {
  const units = Array.from(text).reduce((sum, character) => sum + (/[^\x20-\x7e]|[MWmw@]/.test(character) ? 1 : /[ilIjtfr .,'-]/.test(character) ? .38 : /[A-Z]/.test(character) ? .78 : .64), 0);
  return Math.min(48, 920 / Math.max(1, units));
}

/** Inline vector artwork: preview and PNG use the same fonts, lighting and linework. */
export const AssessmentShareCard = forwardRef<SVGSVGElement, {
  snapshot: ScoringSnapshot; completedAt?: string | null; name: string; format: AssessmentCardFormat;
}>(function AssessmentShareCard({ snapshot, completedAt, name, format }, ref) {
  const id = useId().replace(/:/g, '');
  const { height } = ASSESSMENT_CARD_SIZE[format];
  const summary = assessmentShareSummary(snapshot, completedAt);
  const player = assessmentCardName(name);
  const portrait = format === 'portrait';
  const names = cardLines(player || 'My skill fingerprint', 27);
  const nameSize = Math.min(...names.map(nameFontSize));
  const cx = portrait ? 540 : 307, cy = portrait ? 604 : names.length > 1 ? 521 : 493, radius = portrait ? 216 : 174;
  const bands = cardLines(summary.band, portrait ? 22 : 14);
  const bx = portrait ? 540 : 548, by = portrait ? 886 : bands.length > 1 ? 457 : 487;
  const strengthsY = height - 330;
  const paint = (part: string) => `url(#${id}-${part})`;
  return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 1080 ${height}`} width="1080" height={height}
    role="img" aria-label={`${player || 'My game'}: PULSE self-assessed level ${summary.level}, ${summary.band}. Provisional estimate.`}
    style={{ display: 'block', width: '100%', height: 'auto' }} fontFamily="Arial, Helvetica, sans-serif" color="#f8f2e6">
    <defs>
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#192a3c" /><stop offset=".52" stopColor="#0b1522" /><stop offset="1" stopColor="#111b28" /></linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2=".85" y2="1"><stop stopColor="#99703a" /><stop offset=".18" stopColor="#f9d797" /><stop offset=".32" stopColor="#fff5d6" /><stop offset=".48" stopColor="#b58c4c" /><stop offset=".7" stopColor="#735122" /><stop offset=".87" stopColor="#efc877" /><stop offset="1" stopColor="#fff0bc" /></linearGradient>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#263c4a" /><stop offset=".5" stopColor="#121f2e" /><stop offset="1" stopColor="#09121e" /></linearGradient>
      <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fffbed" /><stop offset=".52" stopColor="#ffe8b0" /><stop offset="1" stopColor="#dca958" /></linearGradient>
      <linearGradient id={`${id}-line`}><stop stopColor="#ffd893" stopOpacity="0" /><stop offset=".45" stopColor="#ffd893" /><stop offset="1" stopColor="#ffd893" stopOpacity="0" /></linearGradient>
      <radialGradient id={`${id}-warm`}><stop stopColor="#d29639" stopOpacity=".24" /><stop offset="1" stopColor="#d29639" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-cool`}><stop stopColor="#559eac" stopOpacity=".2" /><stop offset="1" stopColor="#559eac" stopOpacity="0" /></radialGradient>
      <pattern id={`${id}-weave`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#b3c4d7" strokeOpacity=".035" strokeWidth=".6" /></pattern>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#000610" floodOpacity=".65" /></filter>
      <filter id={`${id}-light`} x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="6" /></filter>
    </defs>
    <rect width="1080" height={height} fill={paint('bg')} />
    <rect width="1080" height={height} fill={paint('weave')} />
    <ellipse cx="80" cy="180" rx="690" ry="620" fill={paint('warm')} />
    <ellipse cx="1010" cy={height * .58} rx="510" ry="760" fill={paint('cool')} />
    <rect x="26" y="26" width="1028" height={height - 52} rx="28" fill="none" stroke={paint('metal')} strokeOpacity=".55" />
    <rect x="34" y="34" width="1012" height={height - 68} rx="22" fill="none" stroke="#c7d8ee" strokeOpacity=".06" />
    <path d="M54 100V72a18 18 0 0 1 18 -18H132 M948 54H1008a18 18 0 0 1 18 18V100" stroke="#f9d797" strokeWidth="2" strokeOpacity=".65" fill="none" />
    <svg x="70" y="68" width="218" height="82"><Logo compact /></svg>
    <rect x="748" y="82" width="260" height="44" rx="22" fill="#f0ca7d" fillOpacity=".06" stroke="#e4c080" strokeOpacity=".3" />
    <circle cx="775" cy="104" r="4" fill="#f3cf89" /><text x="796" y="110" fill="#e4cfaa" fontSize="16" letterSpacing="2">SELF-ASSESSMENT</text>
    {names.map((line, index) => <text key={index} x="72" y={214 + index * 58} fill="#f9f6ef" fontSize={nameSize} fontWeight="700" letterSpacing="-1.4">{line}</text>)}
    <text x="74" y={names.length > 1 ? 309 : 259} fill="#abbacc" fontSize="20" letterSpacing=".3">{summary.date ? `Assessed ${summary.date}` : 'A snapshot of my game'}</text>
    <g transform={`translate(${portrait ? 766 : 790} ${portrait ? 355 : 325}) rotate(19)`} fill="none" stroke="#82a7b5" strokeWidth="1.5" opacity=".12" aria-hidden="true">
      <rect width="230" height="440" rx="3" /><path d="M0 150H230M0 220H230M0 290H230M115 0V150M115 290V440" /><path d="M-18 220H248" strokeDasharray="3 5" />
    </g>
    {/* A complete decorative medallion, not a progress arc or a percentile. */}
    <g aria-hidden="true">
      <circle cx={cx} cy={cy} r={radius + 80} fill={paint('warm')} />
      <circle cx={cx} cy={cy} r={radius + 34} fill="none" stroke="#d8bd83" strokeOpacity=".1" />
      {Array.from({ length: 72 }, (_, i) => <path key={i} d={`M${cx} ${cy - radius - 16}v${i % 6 === 0 ? -11 : -4}`} transform={`rotate(${i * 5} ${cx} ${cy})`} stroke={i % 6 === 0 ? '#ebca8f' : '#78909d'} strokeWidth={i % 6 === 0 ? 2 : 1} opacity={i % 6 === 0 ? .75 : .38} />)}
      <circle cx={cx} cy={cy} r={radius + 5} fill={paint('face')} stroke={paint('metal')} strokeWidth="7" filter={paint('shadow')} />
      <circle cx={cx} cy={cy} r={radius - 3} fill="none" stroke="#fbe8bc" strokeOpacity=".45" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={radius - 14} fill="none" stroke="#91a7b8" strokeOpacity=".1" />
      <path d={`M${cx - radius * .65} ${cy - radius * .55}Q${cx} ${cy - radius * 1.08} ${cx + radius * .65} ${cy - radius * .55}`} stroke="#fff0c5" strokeOpacity=".2" strokeWidth="2" fill="none" />
    </g>
    <text x={cx} y={cy - (portrait ? 140 : 111)} textAnchor="middle" fill="#abc2cc" fontSize="15" letterSpacing="4">MY PULSE</text>
    <text x={cx - 4} y={cy + (portrait ? 44 : 34)} fill={paint('ink')} fontSize={portrait ? 188 : 154} fontWeight="700" letterSpacing="-10" textAnchor="middle">{summary.level}</text>
    <text x={cx} y={cy + (portrait ? 109 : 90)} fill="#e3cd9d" fontSize={portrait ? 19 : 18} letterSpacing="2" textAnchor="middle">SELF-ASSESSED LEVEL</text>
    <path d={`M${cx - 50} ${cy + (portrait ? 131 : 116)}h24l9 -8 10 15 9 -22 10 23 8 -8h22`} fill="none" stroke="#d9b774" strokeWidth="2" />
    <g textAnchor={portrait ? 'middle' : 'start'}>
      {!portrait && <text x={bx} y={by - 52} fill="#89cfc8" fontSize="16" letterSpacing="3">YOUR GAME, IN FOCUS</text>}
      {bands.map((line, index) => <text key={index} x={bx} y={by + index * 55} fill="#f8f2e6" fontSize={portrait ? 52 : 49} fontWeight="700" letterSpacing="-1.5">{line}</text>)}
      <text x={bx} y={by + (bands.length - 1) * 55 + 38} fill="#aabcc9" fontSize="21">Based on your reported play</text>
      {!portrait && <><path d={`M${bx} ${by + 122}h355`} stroke="#b8d4df" strokeOpacity=".18" /><text x={bx} y={by + 160} fill="#d3be93" fontSize="17" letterSpacing="1.5">KNOW YOUR GAME. KEEP GROWING.</text></>}
    </g>
    <g transform={`translate(0 ${strengthsY})`}>
      <text x="74" y="0" fill="#8dd8cc" fontSize="17" letterSpacing="2.8">{summary.strengths.length ? 'MY SUPPORTED STRENGTHS' : 'KEEP PLAYING. KEEP GROWING.'}</text>
      <path d="M450 -6H1006" stroke="#93c5c9" strokeOpacity=".2" />
      {summary.strengths.length ? summary.strengths.map((strength, index) => {
        const width = 940 / summary.strengths.length;
        const x = 70 + width * index;
        const lines = cardLines(strength, summary.strengths.length > 2 ? 21 : 32);
        return <g key={strength}>
          <rect x={x + 4} y="24" width={width - 12} height="104" rx="17" fill="#172b37" fillOpacity=".8" stroke="#a1d8d3" strokeOpacity=".18" />
          <path d={`M${x + 22} 25h${width - 50}`} stroke="#93dacf" strokeOpacity=".32" />
          <path d={`M${x + 25} 49l5 5 10 -11`} stroke="#86dccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {lines.map((line, lineIndex) => <text key={lineIndex} x={x + 24} y={lines.length > 1 ? 79 + lineIndex * 27 : 91} fill="#e0eee9" fontSize="23" fontWeight="500">{line}</text>)}
        </g>;
      }) : <text x="74" y="82" fill="#d2e4e4" fontSize="26">Building a clearer picture of my game.</text>}
    </g>
    <g aria-hidden="true"><path d={`M72 ${height - 151}H415l25 -16 23 29 31 -52 29 68 26 -37 18 8H1008`} stroke={paint('line')} strokeWidth="9" filter={paint('light')} fill="none" opacity=".55" /><path d={`M72 ${height - 151}H415l25 -16 23 29 31 -52 29 68 26 -37 18 8H1008`} stroke={paint('line')} strokeWidth="2" strokeLinejoin="round" fill="none" /></g>
    <text x="74" y={height - 102} fill="#a9b6c5" fontSize="18">Provisional self-report · Not a match rating or DUPR rating</text>
    <text x="74" y={height - 62} fill="#f4d9a1" fontSize="22" fontWeight="600">Find your game at pulsepb.com/skill-assessment</text>
  </svg>;
});
