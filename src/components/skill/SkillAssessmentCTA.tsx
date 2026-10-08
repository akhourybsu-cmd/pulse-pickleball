import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Gauge, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { useSkillProfileSummary } from '@/hooks/useSkillProfileSummary';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import { PulseTrace } from './PulseTrace';
import './assessment-brand.css';

export function SkillAssessmentCTA({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const { row, loaded, error, retry } = useSkillProfileSummary(userId);
  if (!isSkillAssessmentEnabled()) return null;
  const hasResult = row?.self_assessed_level != null;
  return <section className="skill-studio skill-profile-card" aria-label="PULSE skill self-assessment">
    <div className="skill-profile-top"><Logo compact /><span className="skill-overline">Your skill fingerprint</span></div>
    {!loaded ? <div className="py-7 text-sm text-muted-foreground" role="status">Loading your assessment…</div> : error ? <div className="py-5"><p className="skill-help">Your assessment couldn’t load.</p><Button onClick={retry} variant="outline" className="mt-3">Retry</Button></div> : hasResult ? <>
      <div className="skill-profile-result"><strong>{row!.self_assessed_level!.toFixed(1)}</strong><div><span className="skill-overline">Self-assessed level</span><h2>{row!.self_assessed_band || 'Your current estimate'}</h2><p>Provisional · based on your reported play</p></div></div>
      <PulseTrace className="skill-profile-trace" />
      <p className="skill-help">See what’s working, find your next focus, and share a snapshot of your game.</p>
    </> : <div className="py-5"><h2 className="text-2xl font-semibold tracking-tight">Get to know your game.</h2><p className="skill-help mt-2">Explore visual game situations to discover your strengths and build your Skill Fingerprint.</p></div>}
    <div data-testid="profile-assessment-actions" className="relative mt-3 min-w-0">
      {loaded && !error && (hasResult ? <div className="skill-profile-actions">
        <Button onClick={() => navigate('/player/self-assessment?mode=view')} className="skill-primary-button h-auto min-h-11 gap-2 whitespace-normal py-2"><Gauge className="h-4 w-4 shrink-0" /><span className="min-w-0 break-words">View assessment</span><ArrowUpRight className="h-4 w-4 shrink-0" /></Button>
        <Button variant="outline" onClick={() => navigate('/player/self-assessment?mode=view&share=1')} className="h-auto min-h-11 gap-2 whitespace-normal py-2"><Share2 className="h-4 w-4 shrink-0" /><span className="min-w-0 break-words">Share card</span></Button>
      </div> : <Button className="skill-primary-button w-full h-auto min-h-11 gap-2 whitespace-normal" onClick={() => navigate('/player/self-assessment')}><Gauge className="h-4 w-4 shrink-0" /><span className="min-w-0 break-words">Take the Skill Assessment</span><ArrowUpRight className="h-4 w-4 shrink-0" /></Button>)}
    </div>
    {hasResult && <p className="skill-profile-footnote">Separate from your match-based PULSE Performance Rating.</p>}
  </section>;
}
