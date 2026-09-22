import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookmarkPlus, CheckCircle2, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { PulseTrace } from '@/components/skill/PulseTrace';
import '@/components/skill/assessment-brand.css';
import { PageSEO } from '@/components/seo/PageSEO';
import { AssessmentWizard } from '@/components/skill/AssessmentWizard';
import { SkillIntro } from '@/components/skill/SkillIntro';
import { SkillFingerprint } from '@/components/skill/SkillFingerprint';
import { useGuestSkillAssessment } from '@/hooks/useGuestSkillAssessment';
import { useAuthState } from '@/hooks/useAuthState';
import { supabase } from '@/integrations/supabase/client';
import { clearPostAuthRedirect, peekPostAuthRedirect, stashPostAuthRedirect } from '@/lib/authRedirect';
import { ASSESSMENT_PATH, canAutoSaveGuest, guestSaveReturnPath } from '@/lib/skill/guestAssessment';
import { trackAssessmentFunnel } from '@/lib/skill/assessmentFunnel';
import type { ScoringSnapshot } from '@/lib/skill/scoring';

export default function GuestSkillAssessment() {
  const a = useGuestSkillAssessment();
  const auth = useAuthState();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedReport, setSaved] = useState<{ id: string; snapshot: ScoringSnapshot } | null>(null);
  const saved = savedReport?.id === a.draft?.id ? savedReport?.snapshot : null;
  const inFlight = useRef(false);
  const autoTried = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [a.phase]);
  useEffect(() => {
    const saveId = params.get('save');
    // Acknowledge arrival only after the public destination has mounted with
    // a session. Other auth resolvers must retain this link until this point.
    if (auth.user && saveId && peekPostAuthRedirect() === guestSaveReturnPath(saveId)) clearPostAuthRedirect();
  }, [auth.user, params]);

  const saveToAccount = useCallback(async () => {
    if (!a.draft || !a.canFinalize || !auth.user || inFlight.current || saved) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const { data, error } = await supabase.functions.invoke('skill-claim', {
        body: { attemptId: a.draft.id, assessmentVersion: 2, responses: a.draft.responses },
      });
      if (error || !data?.authoritative || !data?.snapshot || data.attemptId !== a.draft.id) throw new Error('save_failed');
      setSaved({ id: a.draft.id, snapshot: data.snapshot as ScoringSnapshot });
      a.clearSaved(a.draft.id);
      setParams({}, { replace: true });
      trackAssessmentFunnel('saved');
    } catch {
      setSaveError(true);
      trackAssessmentFunnel('save_failed');
    } finally { setSaving(false); inFlight.current = false; }
  }, [a, auth.user, saved, setParams]);

  useEffect(() => {
    // Authentication alone never claims a cached report on a shared browser.
    // Require the explicit save intent AND its matching auth return URL.
    if (!auth.loading && auth.user && !autoTried.current && canAutoSaveGuest(a.draft, params.get('save'))) {
      autoTried.current = true;
      void saveToAccount();
    }
  }, [auth.loading, auth.user, a.draft, params, saveToAccount]);

  const save = (mode: 'signup' | 'login' = 'signup') => {
    trackAssessmentFunnel('save_requested');
    if (auth.user) { void saveToAccount(); return; }
    if (!a.draft || !a.requestSave()) {
      toast.error('Browser storage is unavailable. Allow site storage before leaving this page to keep your answers through sign-in.');
      return;
    }
    const returnTo = guestSaveReturnPath(a.draft.id);
    stashPostAuthRedirect(returnTo);
    trackAssessmentFunnel('auth_started');
    navigate(`/auth?mode=${mode}&redirect=${encodeURIComponent(returnTo)}`);
  };
  const inviteUrl = typeof window === 'undefined' ? ASSESSMENT_PATH : `${window.location.origin}${ASSESSMENT_PATH}?source=friend`;
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); trackAssessmentFunnel('invite_copied'); toast.success('Assessment invitation copied.'); }
    catch { toast.info('Copy the assessment link shown below.'); }
  };

  return <div className="skill-studio skill-public">
    <PageSEO title="Free Pickleball Self-Assessment | PULSE" description="Explore your pickleball skills with visual game situations. Get your full self-assessment analysis before signup; create a free account to save it." path={ASSESSMENT_PATH} />
    <header className="skill-public-nav">
      <div className="skill-public-nav-inner">
        <Link to="/" className="skill-brand-link" aria-label="PULSE home"><Logo compact /><span className="skill-brand-caption">Know your game.<br />Find your next level.</span></Link>
        {auth.user ? <Link className="text-sm text-muted-foreground underline underline-offset-4" to="/player/self-assessment?mode=view">My assessments</Link>
          : a.phase === 'result' ? <button type="button" disabled={auth.loading || saving} className="min-h-11 text-sm underline underline-offset-4" onClick={() => save('login')}>Sign in to save</button>
          : <span className="text-xs text-muted-foreground">Free assessment</span>}
      </div>
    </header>
    <main className={`skill-public-main space-y-6 ${a.phase === 'in_progress' ? 'is-question' : ''}`}>
      {a.phase === 'intro' ? <>
        <p className="skill-notice">Take it free. Read the full analysis. Create an account only when you want to save it.</p>
        <SkillIntro guest onStart={() => { setSaved(null); setSaveError(false); void a.start(); }} hasDraft={!!a.draft && !a.draft.completedAt} minItems={a.minItems} maxItems={a.maxItems} />
        {a.draft?.completedAt && !saved && <p className="text-sm text-muted-foreground">Starting again replaces your temporary browser copy. Return to your analysis first if you want to save it to an account.</p>}
        {a.draft?.completedAt && <Button variant="ghost" className="w-full" onClick={a.showResult}>Back to my analysis</Button>}
      </> : a.phase === 'in_progress' ? <>
        <h1 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">Your game, in real situations</h1>
        <p className="text-xs text-muted-foreground">Your answers stay in this browser until you choose to save them to an account.</p>
        <AssessmentWizard a={a} onExit={a.showIntro} />
      </> : <>
        <div className="skill-report-heading">
          <div className="skill-overline">The PULSE Skill Fingerprint</div>
          <h1 ref={heading} tabIndex={-1} className="outline-none">Your full self-assessment analysis</h1>
          <p className="text-sm text-muted-foreground">Explore your level, strengths and next steps below. <a className="text-primary underline underline-offset-4" href="#save-analysis">{saved ? 'Your analysis is saved.' : 'Keep this analysis with a free account.'}</a></p>
        </div>
        <SkillFingerprint snapshot={saved ?? a.runningSnapshot} completedAt={a.draft?.completedAt ? new Date(a.draft.completedAt).toISOString() : null} />
        <div className="skill-conversion-grid">
        <section id="save-analysis" className="skill-save-card scroll-mt-6 space-y-4" aria-labelledby="save-heading">
          {saved ? <>
            <CheckCircle2 className="h-7 w-7 text-primary" aria-hidden="true" />
            <h2 id="save-heading" className="text-xl font-semibold">Your analysis is saved</h2>
            <p role="status" className="text-sm text-muted-foreground">It’s now part of your assessment history. Revisit it on any device and use future assessments to check your progress.</p>
            <Button className="w-full" onClick={() => navigate('/player/self-assessment?mode=view')}>View my saved analysis</Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/player/dashboard')}>Explore PULSE</Button>
            <p className="text-xs text-muted-foreground">New skill profiles start private. Manage your skill-summary visibility in your profile settings.</p>
          </> : <>
            <BookmarkPlus className="h-7 w-7 text-primary" aria-hidden="true" />
            <h2 id="save-heading" className="text-xl font-semibold">Make this your starting point</h2>
            <p className="text-sm text-muted-foreground">Save your analysis to a free PULSE account. Come back to your strengths and practice priorities, then build a history as your game develops.</p>
            <ul className="space-y-1 text-sm"><li>• Keep your full skill breakdown</li><li>• Access it on your phone or computer</li><li>• Revisit past assessments after more games</li></ul>
            {saveError && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">Your analysis hasn’t been saved to your account yet. It’s still here. Check your connection and retry; you won’t create a duplicate.</p>}
            <Button disabled={saving || auth.loading} className="skill-primary-button min-h-12 w-full whitespace-normal" onClick={() => save()}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving your analysis…</> : saveError ? 'Retry saving my analysis' : auth.user ? 'Save my analysis to my account' : 'Create free account & save my analysis'}
            </Button>
            {!auth.user && <button type="button" disabled={saving || auth.loading} className="min-h-11 w-full text-sm underline underline-offset-4" onClick={() => save('login')}>Already a member? Sign in to save</button>}
            <p className="text-xs leading-relaxed text-muted-foreground">Your full analysis is already unlocked. Without an account, answers are kept temporarily in this browser for up to 7 days and can be lost if you clear site data. Finish sign-in in this browser to transfer them.</p>
          </>}
        </section>
        <section className="skill-surface space-y-5">
          <Share2 className="text-primary h-7 w-7" aria-hidden="true" />
          <div className="skill-overline">Better together</div>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">Give your playing partner a starting point, too</h2>
          <p className="text-sm text-muted-foreground">Invite them to take their own assessment. This link contains none of your answers or results.</p>
          <Button variant="outline" className="w-full gap-2" onClick={copyInvite}><Share2 className="h-4 w-4" /> Copy assessment invitation</Button>
          <input aria-label="Assessment invitation link" readOnly value={inviteUrl} className="w-full rounded border bg-muted p-2 text-xs" onFocus={e => e.target.select()} />
          <PulseTrace />
        </section>
        </div>
        <Button variant="ghost" className="w-full gap-2" disabled={saving} onClick={a.showIntro}><ArrowLeft className="h-4 w-4" /> Assessment introduction</Button>
      </>}
      {!a.durable && <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">This browser isn’t retaining your answers. You can still read your analysis here. Allow site storage before refreshing or leaving for signup.</p>}
      {a.draft && !saved && a.durable && <p className="text-center text-xs text-muted-foreground">Temporary browser copy · expires {new Date(a.draft.expiresAt).toLocaleDateString()}. Save a completed analysis to your account to keep it.</p>}
      {!a.draft && params.has('save') && <p role="status" className="rounded-xl border p-3 text-sm">Your guest answers aren’t available in this browser. Return to the browser where you took the assessment and sign in there to save them, or start a new assessment here.</p>}
    </main>
  </div>;
}
