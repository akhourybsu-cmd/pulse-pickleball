import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, Check, CalendarDays, MessageCircle, Activity } from "lucide-react";
import { SIGNUP_URL } from "./marketingContent";
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import { AssessmentPreview } from './AssessmentPreview';

export const HeroSection = () => (
  <section className="mkt-hero" aria-labelledby="hero-heading">
    <div className="mkt-container mkt-hero-grid">
      <div className="mkt-hero-copy">
        <p className="mkt-eyebrow"><span className="mkt-eyebrow-line" /> {isSkillAssessmentEnabled() ? 'FREE PICKLEBALL SKILL ASSESSMENT' : 'THE PICKLEBALL APP FOR YOUR EVERYDAY GAME'}</p>
        <h1 id="hero-heading">{isSkillAssessmentEnabled() ? <>Know your game.<br /><span>Find your<br />next focus.</span></> : <>Your game.<br />Your people.<br /><span>All in PULSE.</span></>}</h1>
        <p className="mkt-hero-description">{isSkillAssessmentEnabled() ? 'Discover your strengths, understand your pickleball fundamentals, and get a clear practice direction. Take the visual PULSE assessment and read your full analysis before signing up.' : 'Find your next game, bring your crew together, and make every match part of your story. PULSE connects the playing, planning, and people behind your pickleball life.'}</p>
        <div className="mkt-actions">
          {isSkillAssessmentEnabled()
            ? <><Link className="mkt-button mkt-button-gold" to="/skill-assessment?source=hero">Take my free assessment <ArrowRight aria-hidden="true" /></Link><Link className="mkt-hero-explore" to={SIGNUP_URL}>Create your free account <ArrowRight aria-hidden="true" /></Link></>
            : <><Link className="mkt-button mkt-button-gold" to={SIGNUP_URL}>Create your free account <ArrowRight aria-hidden="true" /></Link><a className="mkt-hero-explore" href="#features">Explore PULSE <ArrowDown aria-hidden="true" /></a></>}
        </div>
        <ul className="mkt-hero-notes" aria-label="Getting started">
          <li><Check aria-hidden="true" /> {isSkillAssessmentEnabled() ? 'No signup to see results' : 'Free to start'}</li>
          <li><Check aria-hidden="true" /> {isSkillAssessmentEnabled() ? 'Account to save your analysis' : 'No credit card to join'}</li>
          <li><Check aria-hidden="true" /> Mobile & desktop</li>
        </ul>
      </div>
      {isSkillAssessmentEnabled() ? <AssessmentPreview /> : <figure className="mkt-hero-preview">
        <div className="mkt-preview-header"><span>PULSE / YOUR GAME PLAN</span><span className="mkt-preview-dot" aria-hidden="true" /></div>
        <div className="mkt-preview-body">
          <div className="mkt-preview-greeting"><span>A little less planning.</span><strong>A lot more pickleball.</strong></div>
          <div className="mkt-next-game">
            <div className="mkt-preview-label"><CalendarDays aria-hidden="true" /> NEXT ON COURT <span>ROUND ROBIN</span></div>
            <h2>Saturday with the crew</h2>
            <p>9:00 AM · Doubles · 2 courts</p>
            <div className="mkt-next-game-footer"><div className="mkt-avatar-stack" aria-hidden="true"><span>AJ</span><span>MK</span><span>RS</span><span>+5</span></div><span>8 players. One plan.</span></div>
          </div>
          <div className="mkt-preview-pair">
            <div className="mkt-score-preview"><span className="mkt-preview-label"><Activity aria-hidden="true" /> LAST MATCH</span><strong>11 <span>—</span> 7</strong><span>Doubles · Score confirmed</span></div>
            <div className="mkt-chat-preview"><span className="mkt-preview-label"><MessageCircle aria-hidden="true" /> YOUR CREW</span><p>Same time next week?</p><span>I'm in. See you on court!</span></div>
          </div>
          <div className="mkt-preview-bottom"><span>Play together.</span><span>Keep the story going. <ArrowRight aria-hidden="true" /></span></div>
        </div>
        <figcaption>Illustrative preview · Sample players, matches, and events</figcaption>
      </figure>}
    </div>
    <div className="mkt-container mkt-hero-foot"><span>FROM YOUR FIRST GAME TO YOUR NEXT SEASON</span><p>Matches <span>/</span> Round robins <span>/</span> Leagues <span>/</span> Community</p></div>
  </section>
);
