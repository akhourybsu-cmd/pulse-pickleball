import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GUIDE_PATH, KNOWLEDGE_SOURCES, SKILL_KNOWLEDGE, getLevelContext, type KnowledgeSource } from '@/lib/skill/knowledge';
import { SUBSKILL_LABELS, type Subskill } from '@/lib/skill/model';
import type { ScoringSnapshot } from '@/lib/skill/scoring';

export function KnowledgeLinks({ sources }: { sources: KnowledgeSource[] }) {
  return <ul className="skill-source-links">{sources.map(key => <li key={key}><a href={KNOWLEDGE_SOURCES[key].url} target="_blank" rel="noopener noreferrer">{KNOWLEDGE_SOURCES[key].label}</a></li>)}</ul>;
}

export function QuestionSkillHelp({ skill }: { skill: Subskill }) {
  const guide = SKILL_KNOWLEDGE[skill];
  return <details className="skill-question-help"><summary><BookOpen size={15} aria-hidden="true" /> About {SUBSKILL_LABELS[skill].toLowerCase()}</summary><div className="space-y-3"><p>{guide.definition}</p><p>{guide.misconception}</p><Link to={`${GUIDE_PATH}#skill-${skill}`} className="skill-quiet-link">Read the skill guide</Link></div></details>;
}

export function ScoreMeaning({ snapshot }: { snapshot: ScoringSnapshot }) {
  if (snapshot.scoringModelVersion !== 2) return null;
  const context = getLevelContext(snapshot.estimatedLevelRaw);
  return <section className="skill-surface skill-wide space-y-4" aria-labelledby="skill-context-title"><div className="skill-section-head"><div><h2 id="skill-context-title">What this means on court</h2><small>A learning direction for your PULSE {context.label.toLowerCase()} band</small></div><BookOpen className="text-primary shrink-0" aria-hidden="true" /></div><p className="text-sm leading-relaxed">{context.meaning}</p><p className="text-sm leading-relaxed text-muted-foreground"><strong className="text-foreground">Useful next focus:</strong> {context.next}</p><p className="skill-help">Check your individual skills and evidence gaps before assuming every skill matches this band. This number does not change your PULSE Performance Rating or convert to a USA Pickleball or DUPR rating.</p><Link to={`${GUIDE_PATH}#score-meaning`} className="skill-quiet-link text-sm inline-flex items-center gap-2"><BookOpen size={15} /> Explore fundamentals and score meanings</Link></section>;
}
