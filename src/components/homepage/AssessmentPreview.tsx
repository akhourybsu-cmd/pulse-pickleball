import { Logo } from '@/components/Logo';
import { PulseTrace } from '@/components/skill/PulseTrace';
import '@/components/skill/assessment-brand.css';

export function AssessmentPreview() {
  return <figure className="mkt-hero-preview mkt-assessment-preview skill-studio">
    <div className="mkt-assessment-preview-head"><Logo compact /><span>YOUR SKILL FINGERPRINT</span></div>
    <div className="mkt-assessment-preview-body">
      <div className="mkt-assessment-preview-score"><strong>3.0</strong><div><span>Self-Assessed Level</span><small>Provisional · sample result</small></div></div>
      <PulseTrace />
      <div className="mkt-assessment-preview-measures">
        {['Shot execution', 'Repeatability', 'Decisions & placement', 'Under pressure'].map((label, i) => <div key={label} data-tone={['gold', 'teal', 'blue', 'violet'][i]}><span>{label}</span><div className="skill-track" aria-hidden="true"><span style={{ width: `${[80, 60, 60, 40][i]}%` }} /></div></div>)}
      </div>
      <p><strong>Understand the number.</strong> Explore 16 skills, the evidence behind your estimate, and what to practise next.</p>
      <small>Separate from your match-based PULSE Performance Rating.</small>
    </div>
    <figcaption>Illustrative assessment preview · Sample score and measures, not your results</figcaption>
  </figure>;
}
