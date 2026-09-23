import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import { SIGNUP_URL } from './marketingContent';
import { FeatureTour } from './FeatureTour';

export function HeroSection() {
  const assessment = isSkillAssessmentEnabled();
  return <section className="mkt-hero" aria-labelledby="hero-heading">
    <div className="mkt-container mkt-hero-grid">
      <div className="mkt-hero-copy">
        <p className="mkt-eyebrow"><span className="mkt-eyebrow-line" /> YOUR PICKLEBALL LIFE, CONNECTED</p>
        <h1 id="hero-heading">More play.<br /><span>All in PULSE.</span></h1>
        <p className="mkt-hero-description">Know your game. Find your people. Make the next match happen.</p>
        <div className="mkt-actions">
          <Link className="mkt-button mkt-button-gold" to={assessment ? '/skill-assessment?source=hero' : SIGNUP_URL}>{assessment ? 'Take my free assessment' : 'Create your free account'}<ArrowRight aria-hidden="true" /></Link>
          {assessment
            ? <Link className="mkt-hero-explore" to={SIGNUP_URL}>Create your free account<ArrowRight aria-hidden="true" /></Link>
            : <a className="mkt-hero-explore" href="#features">Explore the features<ArrowRight aria-hidden="true" /></a>}
        </div>
        <ul className="mkt-hero-notes" aria-label="Getting started"><li><Check aria-hidden="true" />{assessment ? 'No signup to see results' : 'Free to join'}</li><li><Check aria-hidden="true" />{assessment ? 'Account to save your analysis' : 'Mobile & desktop'}</li></ul>
        <svg className="mkt-pulse-line" viewBox="0 0 320 32" fill="none" aria-hidden="true"><path d="M0 17H76L87 13L95 24L108 2L121 30L130 17H320" /></svg>
      </div>
      <FeatureTour />
    </div>
  </section>;
}
