import { Activity, CalendarDays, Gauge, MessagesSquare, RotateCcw, Trophy } from 'lucide-react';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';

export const PlayerFeaturesSection = () => {
  const features = [
    ...(isSkillAssessmentEnabled() ? [{ icon: Gauge, title: 'Understand your skills', text: 'A clear level and a next-game focus.' }] : []),
    { icon: Activity, title: 'Track your results', text: 'Record matches. Follow your PULSE rating.' },
    { icon: MessagesSquare, title: 'Find your people', text: 'Friends, group chats and communities.' },
    { icon: RotateCcw, title: 'Run round robins', text: 'Rotations, court assignments and scores.' },
    { icon: Trophy, title: 'Play a season', text: 'Leagues, schedules and live standings.' },
    { icon: CalendarDays, title: 'Get on court', text: 'Find open play and upcoming events.' },
  ];
  return <section id="features" className="mkt-section mkt-features" aria-labelledby="features-heading"><div className="mkt-container">
    <div className="mkt-section-heading"><p className="mkt-eyebrow">ONE APP. YOUR WHOLE GAME.</p><h2 id="features-heading">Pick your next move.</h2></div>
    <div className="mkt-feature-grid">{features.map(({icon: Icon, title, text}) => <article className="mkt-feature" key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div>
  </div></section>;
};
