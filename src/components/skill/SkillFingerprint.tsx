import { useId, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, ArrowUpRight, CheckCheck, ChevronDown, Info, Layers3, RotateCcw, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { DOMAIN_LABELS, SUBSKILL_LABELS, SUBSKILL_GROUPS, type Subskill } from '@/lib/skill/model';
import type { ScoringSnapshot } from '@/lib/skill/scoring';
import { explainScore } from '@/lib/skill/scoreExplanation';
import { MEASURE_LABELS, QUESTION_BANK_V2 } from '@/lib/skill/questionBankV2';
import { PulseTrace } from './PulseTrace';
import './assessment-brand.css';

const TONES = ['gold', 'teal', 'blue', 'violet'] as const;

export function SkillFingerprint({ snapshot, completedAt, onRetake, canRetake, nextRetakeLabel }: {
  snapshot: ScoringSnapshot; completedAt?: string | null; onRetake?: () => void;
  canRetake?: boolean; nextRetakeLabel?: string | null;
}) {
  const reduced = useReducedMotion();
  const evidence = snapshot.meta.evidence;
  const practiceFocus = snapshot.developmentPriorities.length ? snapshot.developmentPriorities.slice(0, 3)
    : snapshot.subskills.filter(s => !s.insufficientEvidence).sort((a, b) => a.rawLevel - b.rawLevel).slice(0, 3);
  return <motion.div className="skill-studio skill-report-grid" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
    <ScoreHero snapshot={snapshot} />
    {evidence && <section className="skill-surface skill-wide" aria-labelledby="skill-measures-title">
      <SectionHeading id="skill-measures-title" icon={<Activity />} title="Four views of your game" subtitle="Your reported success in the situations you answered" />
      <div className="skill-dimension-grid">
        {evidence.dimensions.map((d, i) => <article className="skill-dimension" data-tone={TONES[i]} key={d.dimension}>
          <h3>{MEASURE_LABELS[d.dimension]}</h3>
          <div className="skill-dimension-value">{d.successRate === null ? '—' : `${Math.round(d.successRate * 100)}%`}<small>{d.successRate === null ? 'unmeasured' : 'reported success'}</small></div>
          <Track value={(d.successRate ?? 0) * 100} label={`${MEASURE_LABELS[d.dimension]}: ${d.successRate === null ? 'not enough evidence' : `${Math.round(d.successRate * 100)} percent reported success`}`} />
          <p>{d.scored} supporting answers{d.answered > d.scored ? ` · ${d.answered - d.scored} unsure` : ''}</p>
        </article>)}
      </div>
      <div className="skill-evidence-note"><Info size={14} /><p className="skill-help">These percentages summarize your own answers, not your percentile among players. Question difficulty and the number of answers vary, so compare the situations as well as the percentages.</p></div>
    </section>}
    <ScoreCalculation snapshot={snapshot} />
    <section className="skill-surface" data-tone="teal" aria-labelledby="skill-strengths-title">
      <SectionHeading id="skill-strengths-title" icon={<TrendingUp />} title="Where your game shines" subtitle="Relative strengths supported by your answers" />
      {snapshot.strengths.length ? <ul className="skill-insight-list">{snapshot.strengths.map(s => <li key={s.subskill}>
        <span className="skill-insight-number">{s.displayLevel.toFixed(1)}</span>
        <div><h3>{SUBSKILL_LABELS[s.subskill]}</h3><p className="skill-help">{s.reason}</p></div>
      </li>)}</ul> : <p className="skill-help">No clear relative strength stands out yet. Your skill breakdown below shows what is supported and where more game evidence would help.</p>}
      {snapshot.primaryStyle && <p className="skill-help mt-4">Playing style: <strong className="text-foreground">{snapshot.primaryStyle.label}</strong> · {snapshot.primaryStyle.stage}{snapshot.secondaryStyle ? ` / ${snapshot.secondaryStyle.label}` : ''}</p>}
    </section>
    <section className="skill-surface" aria-labelledby="skill-priorities-title">
      <SectionHeading id="skill-priorities-title" icon={<Target />} title="Your next-game focus" subtitle="Turn this analysis into something you can practise" />
      <p className="skill-help">{snapshot.developmentPriorities.length ? 'Choose one of these development priorities for your next few games.' : 'No clear relative weakness stood out. These are useful starting points among your lower supported skill estimates.'} Count successes across 10 relevant opportunities, then compare observations with a coach or experienced partner.</p>
      {practiceFocus.map((priority, index) => {
        const scenario = snapshot.scoringModelVersion === 2 ? QUESTION_BANK_V2.find(i => i.subskill === priority.subskill && i.dimension === (priority.displayLevel < 3 ? 'execution' : 'consistency')) : null;
        return <article className="skill-practice-card" key={priority.subskill}><span>0{index + 1}</span>
          <h3>{SUBSKILL_LABELS[priority.subskill]}</h3>
          {scenario ? <><p>{scenario.situation}</p><p><strong>Count a success when:</strong> {scenario.success}</p></> : <p>Observe this skill during games and discuss it with a coach or experienced partner.</p>}
        </article>;
      })}
    </section>
    <section className="skill-surface skill-wide" aria-labelledby="skill-domains-title">
      <SectionHeading id="skill-domains-title" icon={<Layers3 />} title="Your game, skill by skill" subtitle="Domain estimates on the same level scale · gaps stay visible" />
      <div className="skill-domain-grid">{snapshot.domains.map((d, i) => <SkillBar key={d.domain} label={DOMAIN_LABELS[d.domain]} level={d.displayLevel}
        insufficient={d.insufficientEvidence || snapshot.subskills.some(s => s.domain === d.domain && s.insufficientEvidence)} evidenceCount={d.evidenceCount} version={snapshot.scoringModelVersion} tone={TONES[i % 4]} />)}</div>
      <p className="skill-help mt-5">“Not enough information” means one or more skills in that domain need additional answers. It does not mean a low level.</p>
    </section>
    <section className="skill-surface" aria-labelledby="skill-evidence-title">
      <SectionHeading id="skill-evidence-title" icon={<CheckCheck />} title="How much supports this?" subtitle="Evidence confidence, separate from your skill level" />
      <div className="skill-confidence-label"><span>{snapshot.confidence.label}</span><strong>{snapshot.confidence.total}<small className="text-muted-foreground text-xs"> / 100</small></strong></div>
      <Track value={snapshot.confidence.total} label={`Evidence confidence ${snapshot.confidence.total} of 100`} tone="teal" />
      {snapshot.scoringModelVersion === 2 && <div className="space-y-4 mt-5">
        <EvidenceRow title="Answer coverage" value={snapshot.confidence.completionCoverage} max={40} />
        <EvidenceRow title="Agreement across answers" value={snapshot.confidence.internalConsistency} max={20} />
        <div className="skill-calculation"><p className="skill-help">Independent coach / match evidence<br /><span className="text-foreground">Not included in this assessment</span></p><span className="skill-tag">Self-report only</span></div>
        <p className="skill-help">Self-report can contribute at most 60 of 100 confidence points. Confidence reflects coverage and agreement, not the probability that your level is correct. The guide range is not a validated confidence interval.</p>
      </div>}
      {evidence?.limitations.map(note => <p key={note} className="skill-help mt-3">{note}</p>)}
      {snapshot.contradictions.length > 0 && <p className="skill-help mt-3">{snapshot.contradictions.length} answer pattern(s) need a closer look: success was reported more often in a harder situation than in a foundation situation. This reduces evidence confidence.</p>}
    </section>
    <section className="skill-surface" aria-labelledby="skill-detail-title">
      <SectionHeading id="skill-detail-title" icon={<Layers3 />} title="Explore all 16 skills" subtitle="Open a group for scores and supporting answer counts" />
      {SUBSKILL_GROUPS.map(group => <SubskillGroup key={group.key} title={group.label} subskills={group.subskills} snapshot={snapshot} />)}
    </section>
    <footer className="skill-wide skill-assessment-details">
      <p className="skill-help">Self-assessed · Scoring model v{snapshot.scoringModelVersion}{completedAt ? ` · ${new Date(completedAt).toLocaleDateString()}` : ''}<br />{snapshot.meta.answeredCount} answers · {snapshot.meta.scoredCount} scored · {snapshot.meta.notSureCount} unsure</p>
      {onRetake && <div><Button variant="outline" className="gap-2" onClick={onRetake} disabled={!canRetake}><RotateCcw size={14} /> Retake assessment</Button>{!canRetake && nextRetakeLabel && <p className="skill-help mt-2">{nextRetakeLabel}</p>}</div>}
      <p className="skill-help w-full">Retake after new game evidence. A higher self-assessment means a change in reported play; match results and observation help confirm improvement.</p>
    </footer>
  </motion.div>;
}

function ScoreHero({ snapshot }: { snapshot: ScoringSnapshot }) {
  const evidence = snapshot.meta.evidence;
  return <section className="skill-surface skill-report-hero skill-wide" aria-labelledby="skill-level-title">
    <div className="skill-hero-top"><Logo compact className="skill-report-logo" /><span className="skill-tag"><span className="skill-status-dot" /> Provisional · self-assessed</span></div>
    <div className="skill-hero-body">
      <LevelGauge snapshot={snapshot} />
      <div className="skill-hero-copy"><div className="skill-overline">Your PULSE Self-Assessed Level</div><h2 id="skill-level-title">{snapshot.displayBand}</h2>
        <p>A snapshot of the game you described. Use it to recognize your strengths and choose what to work on next.</p>
        <div className="skill-hero-range"><strong>{snapshot.lowerBound.toFixed(1)}–{snapshot.upperBound.toFixed(1)}</strong><span>Guide range, not a confirmed rating</span></div>
        <div className="skill-confidence-label"><span>Evidence support</span><strong>{snapshot.confidence.total}<small className="text-xs text-muted-foreground"> / 100</small></strong></div>
        <Track value={snapshot.confidence.total} label={`Evidence support ${snapshot.confidence.total} of 100`} tone="teal" />
        <p className="skill-help mt-3">{snapshot.confidence.label}. Confirm your estimate through games or a coach assessment. Separate from your match-based PULSE Performance Rating.</p>
      </div>
    </div>
    <PulseTrace className="skill-hero-pulse" />
    <div className="skill-hero-stats"><div><strong>{snapshot.meta.scoredCount}</strong><span>Supporting answers</span></div>
      <div><strong>{evidence ? `${evidence.skillsCovered}/16` : snapshot.subskills.filter(s => !s.insufficientEvidence).length}</strong><span>Skills with multiple answers</span></div>
      <div><strong>{evidence ? `${evidence.essentialSkillsCovered}/6` : snapshot.meta.notSureCount}</strong><span>{evidence ? 'Essential skills covered' : 'Unsure answers'}</span></div>
    </div>
  </section>;
}

function LevelGauge({ snapshot }: { snapshot: ScoringSnapshot }) {
  const gradient = `skill-gauge-${useId().replace(/:/g, '')}`;
  const min = snapshot.scoringModelVersion === 2 ? 1.5 : 1;
  const max = snapshot.scoringModelVersion === 2 ? 4.5 : 4.7;
  const percent = Math.max(0, Math.min(100, (snapshot.estimatedLevelDisplay - min) / (max - min) * 100));
  return <div className="skill-gauge">
    <svg viewBox="0 0 240 240" className="skill-gauge-svg" aria-hidden="true">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff0b6" /><stop offset=".55" stopColor="#ffd16a" /><stop offset="1" stopColor="#ca902e" /></linearGradient></defs>
      <circle className="skill-gauge-halo" cx="120" cy="120" r="111" stroke="#ffd16a" strokeWidth="1" fill="none" opacity=".16" />
      <circle cx="120" cy="120" r="108" stroke="#ffd16a35" strokeWidth="2" strokeDasharray="1 9" fill="none" />
      <circle cx="120" cy="120" r="95" fill="#121b24" stroke="#f3d89212" strokeWidth="9" />
      <circle className="skill-gauge-signal" cx="120" cy="120" r="95" fill="none" stroke={`url(#${gradient})`} strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - percent} transform="rotate(-90 120 120)" />
      <circle cx="120" cy="120" r="82" stroke="#ffffff09" strokeWidth="1" fill="none" />
    </svg>
    <div className="skill-gauge-value"><strong>{snapshot.estimatedLevelDisplay.toFixed(1)}</strong><span>Self-assessed level</span><small>Assessment scale {min.toFixed(1)}–{max.toFixed(1)}</small></div>
  </div>;
}

function ScoreCalculation({ snapshot }: { snapshot: ScoringSnapshot }) {
  const explanation = explainScore(snapshot);
  if (!explanation) return null;
  return <section className="skill-surface skill-wide" aria-labelledby="skill-calculation-title">
    <SectionHeading id="skill-calculation-title" icon={<Layers3 />} title="How your level comes together" subtitle="Skill estimates are blended, then checked against your essential doubles foundation" />
    <div className="skill-factor-list">{explanation.factors.map(f => <article className="skill-factor" data-tone={f.tone} key={f.label}>
      <div className="skill-factor-number"><strong>{f.weight}%</strong><span>{f.level.toFixed(2)} × {(f.weight / 100).toFixed(2)}</span></div><h3>{f.label}</h3><p>{f.detail}</p>
    </article>)}</div>
    <div className="skill-calculation"><div><p className="skill-help">Blended estimate <span className="text-foreground">{explanation.blended.toFixed(2)}</span> · Foundation ceiling <span className="text-foreground">{explanation.ceiling.toFixed(2)}</span></p>
      <p className="skill-help">{explanation.foundationLimitApplied ? 'The foundation check limits this estimate.' : 'The blend is within the foundation ceiling.'} Rounded to one decimal for display.</p></div><strong className="inline-flex items-center gap-2"><ArrowUpRight size={20} aria-hidden="true" /> {snapshot.estimatedLevelDisplay.toFixed(1)} final level</strong></div>
    <details className="skill-method-details"><summary>What shapes the individual skill estimates?</summary><div className="skill-help">
      <p>Your success frequencies are interpreted against the difficulty of the situations you answered. More demanding scenarios provide different evidence from routine ones. Each skill uses execution, repeatability, decisions and pressure where answers are available.</p>
      <p>The final level cannot exceed the lowest essential skill estimate by more than 0.5. The assessment range is 1.5–4.5. Extra follow-up questions improve evidence but do not give that skill more weight in the overall average.</p>
      <p>“Not enough game experience” is excluded from success scoring. This is an unvalidated self-report model; neither the level nor the guide range replaces observed play. Calculation values here are rounded for readability.</p>
    </div></details>
  </section>;
}

function SectionHeading({ id, title, subtitle, icon }: { id: string; title: string; subtitle: string; icon: ReactNode }) {
  return <div className="skill-section-head"><div><h2 id={id}>{title}</h2><small>{subtitle}</small></div><span className="skill-section-icon" aria-hidden="true">{icon}</span></div>;
}
function Track({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return <div className="skill-track" data-tone={tone} role="img" aria-label={label}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
function EvidenceRow({ title, value, max }: { title: string; value: number; max: number }) {
  return <div><div className="skill-confidence-label"><span>{title}</span><span className="tabular-nums">{value.toFixed(1)} / {max}</span></div><Track value={value / max * 100} label={`${title}: ${value.toFixed(1)} of ${max}`} tone="blue" /></div>;
}
function SkillBar({ label, level, insufficient, evidenceCount, version, tone = 'gold' }: { label: string; level: number; insufficient?: boolean; evidenceCount: number; version: number; tone?: string }) {
  const min = version === 2 ? 1.5 : 1, max = version === 2 ? 4.5 : 4.7;
  return <div className="skill-skill-row" data-tone={tone}>
    <div className="skill-skill-row-head"><span>{label}</span>{insufficient ? <small>Not enough information</small> : <strong>{level.toFixed(1)}</strong>}</div>
    <Track value={insufficient ? 0 : (level - min) / (max - min) * 100} label={`${label}: ${insufficient ? 'not enough information' : level.toFixed(1)}`} />
    <p className="skill-skill-evidence">{evidenceCount} supporting {evidenceCount === 1 ? 'answer' : 'answers'}</p>
  </div>;
}
function SubskillGroup({ title, subskills, snapshot }: { title: string; subskills: Subskill[]; snapshot: ScoringSnapshot }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rows = subskills.flatMap(key => snapshot.subskills.filter(s => s.subskill === key));
  const supported = rows.filter(s => !s.insufficientEvidence).length;
  return <div className="skill-group"><button type="button" className="skill-group-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls={id}>
    <strong>{title}</strong><span className="flex items-center gap-3"><small>{supported}/{rows.length} supported</small><ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : undefined }} /></span>
  </button><div id={id} hidden={!open} className="skill-group-rows">{open && rows.map(s => <SkillBar key={s.subskill} label={SUBSKILL_LABELS[s.subskill]} level={s.displayLevel} insufficient={s.insufficientEvidence} evidenceCount={s.evidenceCount} version={snapshot.scoringModelVersion} tone="teal" />)}</div></div>;
}
