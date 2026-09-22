import { Link } from 'react-router-dom';
import { ArrowRight, ChartNoAxesCombined, SlidersHorizontal, BookmarkPlus } from 'lucide-react';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';

export function AssessmentSection() {
  if (!isSkillAssessmentEnabled()) return null;
  return <section id="assessment" className="mkt-section mkt-assessment" aria-labelledby="assessment-heading">
    <div className="mkt-container">
      <div className="mkt-section-heading mkt-heading-split">
        <div><p className="mkt-eyebrow">START WITH YOUR GAME</p><h2 id="assessment-heading">Know your strengths.<br />Find your next focus.</h2></div>
        <p>Get a fuller picture of your pickleball skills through visual game situations and simple sliders. Your full analysis is free to read before you create an account.</p>
      </div>
      <div className="mkt-assessment-steps">
        {[
          { icon: SlidersHorizontal, title: 'Picture the play', text: 'Use court visuals and optional animations to answer concrete questions about your recent doubles games.' },
          { icon: ChartNoAxesCombined, title: 'See the whole picture', text: 'Explore your provisional skill level, strengths, development priorities and the evidence behind your estimate.' },
          { icon: BookmarkPlus, title: 'Keep your starting point', text: 'Create a free account when you want to save the analysis and revisit it as your game develops.' },
        ].map(({ icon: Icon, title, text }, i) => <article key={title} className="mkt-feature">
          <div className="mkt-feature-top"><Icon aria-hidden="true" /><span>0{i + 1}</span></div><h3>{title}</h3><p>{text}</p>
        </article>)}
      </div>
      <div className="mkt-actions"><Link className="mkt-button mkt-button-gold" to="/skill-assessment?source=homepage">Discover my skill profile <ArrowRight aria-hidden="true" /></Link><p className="mkt-assessment-note">No signup to take it or read your analysis.<br />A self-assessment, separate from your match rating.</p></div>
      <p className="mt-5"><Link className="mkt-text-link" to="/pickleball-guide">Learn pickleball fundamentals and what PULSE scores mean <ArrowRight aria-hidden="true" /></Link></p>
    </div>
  </section>;
}
