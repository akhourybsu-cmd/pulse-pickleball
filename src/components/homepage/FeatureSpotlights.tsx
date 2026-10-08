import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SIGNUP_URL } from './marketingContent';
import { FeatureTour } from './FeatureTour';

export const FeatureSpotlights = () => <section id="organizers" className="mkt-organizers mkt-section mkt-chapter" aria-labelledby="organizers-heading"><div className="mkt-container mkt-chapter-grid">
  <div className="mkt-chapter-copy"><p className="mkt-eyebrow"><span>03</span> YOUR NEXT EVENT</p><h2 id="organizers-heading">Less organizing.<br /><span>More playing.</span></h2><p>A Saturday round robin or a season together. Bring the players. Keep the details in PULSE.</p>
    <ul className="mkt-feature-list"><li>Round robins & guest players</li><li>Live scores & court assignments</li><li>Leagues, schedules & standings</li></ul>
    <Link className="mkt-text-link" to={SIGNUP_URL}>Start organizing <ArrowRight aria-hidden="true" /></Link>
  </div>
  <FeatureTour group="organizers" />
</div></section>;
