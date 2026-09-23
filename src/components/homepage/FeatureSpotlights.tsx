import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import { SIGNUP_URL } from './marketingContent';

export const FeatureSpotlights = () => <section id="organizers" className="mkt-organizers mkt-section" aria-labelledby="organizers-heading"><div className="mkt-container mkt-organizer-grid">
  <div className="mkt-section-heading"><p className="mkt-eyebrow">FOR THE ONE WHO GETS EVERYONE PLAYING</p><h2 id="organizers-heading">Bring the crew.<br />We’ll help with the rest.</h2><Link className="mkt-text-link" to={SIGNUP_URL}>Start organizing <ArrowRight aria-hidden="true" /></Link></div>
  <div className="mkt-organizer-options">
    <article><RotateCcw aria-hidden="true" /><div><h3>One great afternoon.</h3><p>Round robins with rotations, guest players and score entry.</p></div></article>
    <article><Trophy aria-hidden="true" /><div><h3>A whole season together.</h3><p>League invitations, scheduling and confirmed standings.</p></div></article>
  </div>
</div></section>;
