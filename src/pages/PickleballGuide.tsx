import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Search } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PageSEO } from '@/components/seo/PageSEO';
import { PulseTrace } from '@/components/skill/PulseTrace';
import { KnowledgeLinks } from '@/components/skill/SkillKnowledge';
import { FUNDAMENTALS, GLOSSARY, GUIDE_PATH, KNOWLEDGE_REVIEWED, KNOWLEDGE_SOURCES, SKILL_KNOWLEDGE, getLevelContext } from '@/lib/skill/knowledge';
import { LEVEL_BANDS, SUBSKILL_GROUPS, SUBSKILL_LABELS, type Subskill } from '@/lib/skill/model';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import '@/components/skill/assessment-brand.css';

export default function PickleballGuide() {
  const [query, setQuery] = useState('');
  const { hash } = useLocation();
  const focusSkill = hash.startsWith('#skill-') ? hash.slice(7) : '';
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  const matches = (skill: Subskill) => [SUBSKILL_LABELS[skill], ...Object.values(SKILL_KNOWLEDGE[skill])].join(' ').toLowerCase().includes(query.trim().toLowerCase());
  const count = Object.keys(SKILL_KNOWLEDGE).filter(s => matches(s as Subskill)).length;
  return <div className="skill-studio skill-public">
    <PageSEO title="Pickleball Fundamentals & PULSE Score Guide" description="Learn the rules, 16 pickleball skills, practice observations and the difference between a PULSE self-assessment and a match rating." path={GUIDE_PATH} />
    <header className="skill-public-nav"><div className="skill-public-nav-inner"><Link to="/" className="skill-brand-link" aria-label="PULSE home"><Logo compact /></Link><Link className="skill-quiet-link text-sm" to="/">Back to PULSE</Link></div></header>
    <main className="skill-public-main skill-guide space-y-6">
      <section className="skill-intro-hero"><div className="skill-overline">The PULSE learning library · no account needed</div><h1>Understand the play.<br /><em>Understand your score.</em></h1><p>Practical pickleball fundamentals, the meaning of each assessed skill, and a clear way to read your PULSE analysis.</p><PulseTrace /></section>
      <nav className="skill-guide-nav" aria-label="Guide sections"><Link to="#score-meaning">Your PULSE numbers</Link><Link to="#fundamentals">Rules & fundamentals</Link><Link to="#skills">16 skills</Link><Link to="#glossary">Terminology</Link><Link to="#sources">Sources</Link></nav>

      <section id="score-meaning" className="skill-surface space-y-5">
        <div className="skill-section-head"><div><h2>Three numbers with different meanings</h2><small>Use the right kind of evidence for the question you want to answer</small></div><BookOpen aria-hidden="true" /></div>
        <div className="skill-guide-columns">
          <article><h3>PULSE Self-Assessed Level</h3><p>A provisional estimate from your reported doubles situations. Version 2 ranges from 1.5 to 4.5. It describes the answers you gave and needs confirmation in play.</p></article>
          <article><h3>Evidence confidence</h3><p>How much answer coverage and agreement supports that estimate. Self-report contributes at most 60/100. A confidence of 55 is not a 55% chance your level is correct.</p></article>
          <article><h3>PULSE Performance Rating</h3><p>A separate match-based number influenced by eligible, verified results within PULSE. Completing or saving this assessment does not change it. It does not diagnose individual strokes.</p></article>
        </div>
        <p className="skill-guide-callout">PULSE’s numbers and band names are not a conversion to USA Pickleball skill levels, DUPR, or tournament eligibility. Similar-looking numbers do not establish equivalence. The sources below inform the teaching; they do not validate PULSE’s formula.</p>
        <details><summary>How the self-assessment calculation works</summary><div className="space-y-3">
          <p>Each question describes a situation and a success criterion. Report how many comparable opportunities succeeded in your recent games, using 0, 2, 4, 6, 8 or 10. “Not enough game experience” provides no success score; it is not a failed shot.</p>
          <p>Individual skill estimates consider question difficulty and four measures: execution (30%), repeatability (30%), decisions and placement (25%), and pressure (15%). These are fitting weights for available observations, not four percentages to average into a level.</p>
          <p>The overall blend uses the equal average of answered skills (65%), the lowest answered essential skill (20%), and strategy (15%). When strategy is unanswered, its term uses the overall skill average. The estimate is capped at 0.5 above the lowest essential estimate, and within 1.5–4.5.</p>
          <p>Essential skills are serve, return, dinking, third-shot drop, resets and positioning. Extra follow-up questions add evidence without giving a skill more votes in the overall average. At least two scored answers are needed to mark a skill as supported; full results require broader coverage.</p>
          <p>A reported success percentage is not a player percentile. A guide range is not a validated statistical confidence interval. Different questions and contexts can produce different estimates; a retake increase alone does not prove improvement.</p>
        </div></details>
        <details><summary>PULSE bands and useful practice directions</summary><p>These are PULSE learning suggestions, not official skill certifications or a claim that every skill in a band is present. Bands use the unrounded estimate; the headline number is rounded to one decimal.</p>
          <div className="skill-guide-bands">{LEVEL_BANDS.map(band => {
            const context = getLevelContext(band.min);
            return <article key={band.key}><h3>{band.label} <small>{Math.max(1.5, band.min)}{band.min < 4.5 ? ` to below ${band.max}` : ' · model ceiling'}</small></h3><p>{context.meaning}</p><p><strong>Useful next focus:</strong> {context.next}</p></article>;
          })}</div>
        </details>
      </section>

      <section id="fundamentals" className="skill-surface space-y-5"><div className="skill-section-head"><div><h2>Rules and fundamentals before technique</h2><small>Rules define legal play. Technique and strategy describe useful choices.</small></div></div>
        <div className="skill-guide-columns">{FUNDAMENTALS.map(f => <article key={f.id}><h3>{f.title}</h3><p>{f.text}</p><KnowledgeLinks sources={[f.source]} /></article>)}</div>
        <p>For exact procedures, exceptions and event formats, use the <a className="skill-quiet-link" href="https://usapickleball.org/rules/" target="_blank" rel="noopener noreferrer">current official rulebook</a>. These short explanations are not a referee certification.</p>
      </section>

      <section id="skills" className="skill-surface space-y-5"><div className="skill-section-head"><div><h2>The 16 skills in your fingerprint</h2><small>Definitions, purpose, observable evidence and common misunderstandings</small></div></div>
        <label className="skill-guide-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search pickleball skills</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a skill, shot or situation" /></label>
        <p role="status" className="skill-help">{count} skills found</p>
        {SUBSKILL_GROUPS.map(group => {
          const skills = group.subskills.filter(matches);
          return skills.length > 0 && <div key={group.key} className="skill-guide-group"><h3>{group.label}</h3>{skills.map(skill => {
            const guide = SKILL_KNOWLEDGE[skill];
            return <details id={`skill-${skill}`} key={skill} open={focusSkill === skill || query.trim().length > 0}>
              <summary>{SUBSKILL_LABELS[skill]}</summary><div className="space-y-3"><p>{guide.definition}</p><p><strong>Why it matters:</strong> {guide.purpose}</p><p><strong>Evidence to look for:</strong> {guide.lookFor}</p><p><strong>Common misunderstanding:</strong> {guide.misconception}</p><p><strong>Try observing:</strong> {guide.practice}</p><KnowledgeLinks sources={guide.sources} /></div>
            </details>;
          })}</div>;
        })}
        <p className="skill-guide-callout">Practice observations are suggestions, not pass/fail rating thresholds. Learn in drills, then answer the assessment from actual games. Record comparable opportunities across several games and partners; do not count only your best attempts.</p>
      </section>

      <section id="glossary" className="skill-surface space-y-5"><h2>Know the language</h2><dl className="skill-guide-glossary">{GLOSSARY.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl><KnowledgeLinks sources={['terms', 'reset']} /></section>
      <section className="skill-surface space-y-4"><h2>What this assessment cannot establish</h2><p>Self-report does not directly observe technique, rules knowledge, physical capacity, sportsmanship or mental health. Pressure questions sample reported game behavior. Singles, wheelchair/adaptive play and advanced specialist shots need their own evaluation; this doubles model is not validated for those contexts.</p><p>Use the breakdown to choose a learning conversation. Ask a coach or experienced partner to observe the same situations over several sessions. Tournament placement should follow the organizer’s requirements.</p></section>
      <section id="sources" className="skill-surface space-y-4"><h2>Sources and scope</h2><p>Teaching references reviewed {KNOWLEDGE_REVIEWED}. Explanations and practice prompts are written for PULSE. USA Pickleball does not endorse or certify the PULSE scoring model. Rules and source material can change.</p><KnowledgeLinks sources={Object.keys(KNOWLEDGE_SOURCES) as (keyof typeof KNOWLEDGE_SOURCES)[]} /><p className="skill-help">The numerical anchors, weights, confidence limits and band interpretations are PULSE design choices. Real-player and independent-coach calibration remains necessary.</p></section>
      <div className="flex flex-wrap items-center justify-between gap-4"><Link className="inline-flex items-center gap-2 skill-quiet-link" to="/"><ArrowLeft size={16} /> Back to PULSE</Link>{isSkillAssessmentEnabled() && <Link className="skill-primary-button rounded-xl px-5 py-3 inline-flex items-center gap-2" to="/skill-assessment?source=guide">Go to my assessment <ArrowRight size={16} /></Link>}</div>
    </main>
  </div>;
}
