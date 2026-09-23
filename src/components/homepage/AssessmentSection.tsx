import { Link } from 'react-router-dom';
import { ArrowRight, Gauge } from 'lucide-react';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';

export function AssessmentSection() {
  if (!isSkillAssessmentEnabled()) return null;
  return <section id="assessment" className="mkt-assessment" aria-labelledby="assessment-heading"><div className="mkt-container mkt-assessment-inner">
    <Gauge className="mkt-assessment-icon" aria-hidden="true" />
    <div><p className="mkt-eyebrow">YOUR FIRST MOVE IS FREE</p><h2 id="assessment-heading">Find your next focus.</h2><p>Take the assessment. Read your full analysis. Create an account to keep it.</p><Link className="mkt-text-link" to="/pickleball-guide">Pickleball fundamentals <ArrowRight aria-hidden="true" /></Link></div>
    <Link className="mkt-button mkt-button-gold" to="/skill-assessment?source=homepage">Discover my skill profile <ArrowRight aria-hidden="true" /></Link>
  </div></section>;
}
