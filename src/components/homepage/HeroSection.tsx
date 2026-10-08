import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check } from 'lucide-react';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import { SIGNUP_URL } from './marketingContent';

export function HeroSection() {
  const assessment = isSkillAssessmentEnabled();
  return <section className="mkt-hero" aria-labelledby="hero-heading">
    <picture className="mkt-hero-photo">
      <source media="(max-width: 650px)" srcSet="/images/marketing/pickleball-court-mobile.jpg" />
      {/* React 18 forwards the lowercase HTML attribute without a DOM warning. */}
      <img src="/images/marketing/pickleball-court.jpg" width={1600} height={1067} alt="A pickleball paddle and yellow ball on a blue court, ready for the next game." {...{ fetchpriority: 'high' }} />
    </picture>
    <div className="mkt-container mkt-hero-grid">
      <div className="mkt-hero-copy">
        <p className="mkt-eyebrow"><span className="mkt-live-dot" /> YOUR PICKLEBALL LIFE, CONNECTED</p>
        <h1 id="hero-heading">For the love<br />of <span>the game.</span></h1>
        <p className="mkt-hero-description">Your game. Your people. Your next match.<br />Bring it all together with PULSE.</p>
        <div className="mkt-actions">
          <Link className="mkt-button mkt-button-gold" to={assessment ? '/skill-assessment?source=hero' : SIGNUP_URL}>{assessment ? 'Take my free assessment' : 'Create your free account'}<ArrowRight aria-hidden="true" /></Link>
          {assessment
            ? <Link className="mkt-hero-explore" to={SIGNUP_URL}>Create your free account<ArrowRight aria-hidden="true" /></Link>
            : <a className="mkt-hero-explore" href="#features">Explore the features<ArrowRight aria-hidden="true" /></a>}
        </div>
        <ul className="mkt-hero-notes" aria-label="Getting started"><li><Check aria-hidden="true" />{assessment ? 'No signup to see results' : 'Free to join'}</li><li><Check aria-hidden="true" />{assessment ? 'Account to save your analysis' : 'Mobile & desktop'}</li></ul>
      </div>
    </div>
    <div className="mkt-container mkt-hero-bottom"><a href="#features" className="mkt-scroll-cue"><ArrowDown aria-hidden="true" /> Scroll to discover PULSE</a><span>BUILT AROUND PICKLEBALL</span></div>
  </section>;
}
