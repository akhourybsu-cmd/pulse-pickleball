import { forwardRef, useId } from 'react';
import { Logo } from '@/components/Logo';
import { ASSESSMENT_CARD_SIZE, assessmentCardName, assessmentShareSummary, type AssessmentCardFormat } from '@/lib/skill/assessmentShare';
import type { ScoringSnapshot } from '@/lib/skill/scoring';

/** All visual attributes are inline SVG so the PNG matches the preview on every theme. */
export const AssessmentShareCard = forwardRef<SVGSVGElement, {
  snapshot: ScoringSnapshot; completedAt?: string | null; name: string; format: AssessmentCardFormat;
}>(function AssessmentShareCard({ snapshot, completedAt, name, format }, ref) {
  const id = useId().replace(/:/g, '');
  const { height } = ASSESSMENT_CARD_SIZE[format];
  const summary = assessmentShareSummary(snapshot, completedAt);
  const player = assessmentCardName(name);
  const extra = format === 'portrait' ? 135 : 0;
  const center = 467 + extra;
  return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 1080 ${height}`} width="1080" height={height}
    role="img" aria-label={`${player || 'My game'}: PULSE self-assessed level ${summary.level}, ${summary.band}. Provisional estimate.`}
    style={{ display: 'block', width: '100%', height: 'auto' }} fontFamily="Arial, Helvetica, sans-serif" color="#f8f2e6">
    <defs>
      <linearGradient id={`${id}-bg`} x2="1" y2="1"><stop stopColor="#203243" /><stop offset="1" stopColor="#0a101a" /></linearGradient>
      <linearGradient id={`${id}-gold`} x2="1" y2="1"><stop stopColor="#fff0bd" /><stop offset=".6" stopColor="#ffd16a" /><stop offset="1" stopColor="#b67c25" /></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#b8822d" stopOpacity=".22" /><stop offset="1" stopColor="#b8822d" stopOpacity="0" /></radialGradient>
    </defs>
    <rect width="1080" height={height} fill={`url(#${id}-bg)`} />
    <circle cx="540" cy={center} r="470" fill={`url(#${id}-glow)`} />
    <rect x="24" y="24" width="1032" height={height - 48} rx="24" fill="none" stroke="#ffd16a" strokeOpacity=".3" />
    <path d={`M760 0V${height} M900 0V${height} M0 ${height - 170}H1080`} stroke="#ffffff" strokeOpacity=".035" fill="none" />
    <svg x="66" y="60" width="205" height="78"><Logo compact /></svg>
    <text x="1008" y="91" fill="#c5d2df" fontSize="19" letterSpacing="3" textAnchor="end">MY GAME. MY PULSE.</text>
    <text x="72" y="204" fill="#f8f2e6" fontSize={player.length > 27 ? 32 : 42} fontWeight="600" textLength={player.length > 27 ? 936 : undefined} lengthAdjust="spacingAndGlyphs">{player || 'My skill fingerprint'}</text>
    <text x="72" y="244" fill="#abbacc" fontSize="21">{summary.date ? `Assessed ${summary.date}` : 'A snapshot of my game'}</text>
    <circle cx="540" cy={center} r="157" stroke="#ffd16a" strokeOpacity=".12" strokeWidth="2" fill="#0d1823" />
    <circle cx="540" cy={center} r="177" stroke="#ffd16a" strokeOpacity=".24" strokeWidth="2" strokeDasharray="2 13" fill="none" />
    <circle cx="540" cy={center} r="160" stroke={`url(#${id}-gold)`} strokeWidth="8" fill="none" strokeDasharray="775 231" strokeLinecap="round" transform={`rotate(-135 540 ${center})`} />
    <text x="540" y={center + 25} fill="#fff2cc" fontSize="138" fontWeight="700" letterSpacing="-8" textAnchor="middle">{summary.level}</text>
    <text x="540" y={center + 75} fill="#d6c18c" fontSize="19" letterSpacing="3" textAnchor="middle">SELF-ASSESSED LEVEL</text>
    <text x="540" y={center + 235} fill="#f8f2e6" fontSize="44" fontWeight="600" textAnchor="middle">{summary.band}</text>
    <text x="540" y={center + 275} fill="#a6b8cd" fontSize="20" letterSpacing="2" textAnchor="middle">PULSE SKILL ASSESSMENT</text>
    <g transform={`translate(0 ${height - 273})`}>
      <text x="540" y="0" fill="#73dfcb" fontSize="17" letterSpacing="3" textAnchor="middle">{summary.strengths.length ? 'MY SUPPORTED STRENGTHS' : 'KEEP PLAYING. KEEP GROWING.'}</text>
      {summary.strengths.length ? summary.strengths.map((strength, index) => {
        const width = 920 / summary.strengths.length;
        const x = 80 + width * index;
        return <g key={strength}><rect x={x + 6} y="22" width={width - 12} height="62" rx="16" fill="#172c35" stroke="#73dfcb" strokeOpacity=".2" />
          <text x={x + width / 2} y="61" fill="#d2f4eb" fontSize={strength.length > 20 ? 18 : 21} textAnchor="middle">{strength}</text></g>;
      }) : <text x="540" y="56" fill="#d2f4eb" fontSize="23" textAnchor="middle">Building a clearer picture of my game.</text>}
    </g>
    <path d={`M72 ${height - 150}H454l28 -24 29 45 29 -65 28 69 25 -25H1008`} fill="none" stroke="#ffd16a" strokeWidth="3" strokeLinejoin="round" />
    <text x="72" y={height - 101} fill="#c4cbd6" fontSize="18">Provisional self-report · Not a match rating or DUPR rating</text>
    <text x="72" y={height - 63} fill="#ffd16a" fontSize="21" fontWeight="600">Find your game at pulsepb.com/skill-assessment</text>
  </svg>;
});
