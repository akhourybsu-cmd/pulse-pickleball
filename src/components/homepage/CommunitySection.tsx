import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FeatureTour } from './FeatureTour';
import { SIGNUP_URL } from './marketingContent';

export const CommunitySection = () => <section id="community" className="mkt-section mkt-chapter mkt-community" aria-labelledby="community-heading"><div className="mkt-container mkt-chapter-grid">
  <div className="mkt-chapter-copy"><p className="mkt-eyebrow"><span>02</span> YOUR PEOPLE</p><h2 id="community-heading">Good people.<br /><span>Great pickleball.</span></h2><p>Friends, chats, communities and open play. All the ways to turn “we should play” into plans.</p>
    <ul className="mkt-feature-list"><li>Friends & direct messages</li><li>Community groups & conversations</li><li>Open play & upcoming events</li></ul>
    <Link className="mkt-text-link" to={SIGNUP_URL}>Find your people <ArrowRight aria-hidden="true" /></Link>
  </div>
  <FeatureTour group="people" />
</div></section>;
