import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import { FeatureTour } from './FeatureTour';
import { SIGNUP_URL } from './marketingContent';

export const PlayerFeaturesSection = () => {
  return <section id="features" className="mkt-section mkt-chapter mkt-features" aria-labelledby="features-heading"><div className="mkt-container mkt-chapter-grid">
    <div className="mkt-chapter-copy"><p className="mkt-eyebrow"><span>01</span> YOUR GAME</p><h2 id="features-heading">Every game.<br /><span>A little more you.</span></h2><p>Your matches, your PULSE rating, your progress. One place to see the player you’re becoming.</p>
      <ul className="mkt-feature-list"><li>Match history & results</li><li>Your personal player profile</li>{isSkillAssessmentEnabled() && <li>Skills, strengths & your next focus</li>}</ul>
      <Link className="mkt-text-link" to={SIGNUP_URL}>Make PULSE yours <ArrowRight aria-hidden="true" /></Link>
    </div>
    <FeatureTour group="game" />
  </div></section>;
};
