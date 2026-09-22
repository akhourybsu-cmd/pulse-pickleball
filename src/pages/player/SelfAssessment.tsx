import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Loader2, History, ChevronRight, Gauge, Check, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentQuestion } from "@/components/skill/AssessmentQuestion";
import { SkillIntro } from "@/components/skill/SkillIntro";
import { SkillFingerprint } from "@/components/skill/SkillFingerprint";
import { useSkillAssessment, type CompletedAttempt } from "@/hooks/useSkillAssessment";
import { SUBSKILL_LABELS, RESPONSE_MASTERY, RESPONSE_LABELS, clamp } from "@/lib/skill/model";
import { cn } from "@/lib/utils";

/**
 * Dedicated player route: /player/self-assessment. Renders inside
 * PlayerShell (header + bottom nav preserved). Drives the whole flow:
 * intro → adaptive wizard (save-and-resume) → finalize → Skill Fingerprint,
 * plus assessment history. Mobile-first.
 *
 * Intent is explicit via `?mode=view` (show the latest Skill Fingerprint) or
 * `?mode=retake` (start a fresh assessment), so "View Skill Fingerprint"
 * never drops the player into the questionnaire.
 */
export default function SelfAssessment() {
  const navigate = useNavigate();
  const a = useSkillAssessment();
  const reduced = useReducedMotion();
  const [showHistory, setShowHistory] = useState(false);
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "retake" ? "retake" : params.get("mode") === "view" ? "view" : null;
  const [mode, setMode] = useState<"view" | "retake" | null>(initialMode);
  const intentApplied = useRef(false);
  const { phase: assessmentPhase, showIntro } = a;
  useEffect(() => {
    if (intentApplied.current || assessmentPhase === 'loading' || assessmentPhase === 'error') return;
    intentApplied.current = true;
    if (initialMode === 'retake' && assessmentPhase === 'result') showIntro();
  }, [assessmentPhase, showIntro, initialMode]);

  if (a.phase === "loading") {
    return <Centered><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Centered>;
  }
  if (a.phase === "signed_out") {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Sign in to take the skill assessment.</p>
        <Button className="mt-4" onClick={() => navigate("/auth")}>Sign in</Button>
      </Centered>
    );
  }
  if (a.phase === 'error') {
    return <Centered><p>We couldn’t load your assessment.</p><Button className="mt-4" onClick={a.reload}>Retry</Button></Centered>;
  }

  const hasResult = !!a.latest?.scoring_snapshot;
  // Show the Skill Fingerprint whenever there's a freshly-finalized result
  // (`phase === "result"`, which finalize sets) OR the player explicitly chose
  // to view it. The `phase === "result"` case is what makes a RETAKE land on
  // its new result: previously a stuck `mode === "retake"` vetoed the result
  // even after finalize, dumping the player back on the intro screen. `mode`
  // only gates the in-progress wizard below, not a completed result.
  const showFingerprint =
    hasResult && (a.phase === "result" || mode === "view");

  return (
    <div className="container mx-auto max-w-lg px-4 py-5 pb-24">
      {/* In-page top row (global header/bottom nav are untouched). */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button variant="ghost" size="sm" className="-ml-2 group" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1.5 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" />
          Back
        </Button>
        {a.history.length > 0 && a.phase !== "in_progress" && (
          <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
            <History className="w-4 h-4 mr-1.5" /> {showHistory ? "Hide history" : "History"}
          </Button>
        )}
      </div>

      {showHistory && a.phase !== "in_progress" ? (
        <AssessmentHistory history={a.history} />
      ) : a.phase === "finalizing" ? (
        <Centered>
          <div className="relative flex h-20 w-20 items-center justify-center">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.2), transparent 70%)" }}
              animate={reduced ? undefined : { scale: [1, 1.18, 1], opacity: [0.55, 1, 0.55] }}
              transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <Gauge className="h-7 w-7" />
            </span>
          </div>
          <p className="mt-4 text-sm font-semibold">Building your Skill Fingerprint…</p>
          <p className="mt-1 text-xs text-muted-foreground">Scoring your answers securely on the server</p>
        </Centered>
      ) : showFingerprint ? (
        <div className="space-y-3">
          {/* An unfinished draft is still waiting — offer it without hijacking the view. */}
          {a.attemptId && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/35 bg-primary/10 p-3">
              <p className="text-xs text-muted-foreground">You have an assessment in progress.</p>
              <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => { setMode("retake"); void a.start(); }}>
                <PlayCircle className="h-3.5 w-3.5" /> Resume
              </Button>
            </div>
          )}
          <SkillFingerprint
            snapshot={a.latest!.scoring_snapshot!}
            completedAt={a.latest!.completed_at}
            onRetake={() => { setMode("retake"); a.showIntro(); }}
            canRetake
          />
        </div>
      ) : a.phase === "in_progress" && mode !== 'view' ? (
        <WizardStep a={a} onExit={() => navigate("/player/profile")} />
      ) : (
        <div className="space-y-3">
          <SkillIntro
            onStart={() => { setMode('retake'); void a.start(); }}
            starting={a.starting}
            hasDraft={!!a.attemptId}
            minItems={a.minItems}
            maxItems={a.maxItems}
          />
          {hasResult && (
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => { setMode("view"); a.showResult(); }}>
              View my current Skill Fingerprint
            </Button>
          )}
        </div>
      )}
    </div>
  );
}


/* ---------------- adaptive wizard step ---------------- */

function WizardStep({ a, onExit }: { a: ReturnType<typeof useSkillAssessment>; onExit: () => void }) {
  const [reviewing, setReviewing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const itemKey = editingKey ?? a.nextItemKey;
  const item = a.bank.find(i => i.itemKey === itemKey);
  const answered = a.answeredCount;
  const pct = a.complete ? 100 : Math.round(clamp(answered / a.maxItems * 100, 0, 99));
  const reviewList = a.bank.filter(i => a.responses[i.itemKey] !== undefined);
  const review = <div className="space-y-3">
    <h2 className="text-lg font-semibold">Review your answers</h2>
    <p className="text-xs text-muted-foreground">Tap an answer to change it. Updates may add a follow-up question.</p>
    {reviewList.map(i => {
      const response = a.responses[i.itemKey];
      const value = RESPONSE_MASTERY[response];
      return <button type="button" key={i.itemKey} disabled={a.saving} onClick={() => { setEditingKey(i.itemKey); setReviewing(false); }}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-primary">{SUBSKILL_LABELS[i.subskill]}</span>
          <span className="mt-1 block text-sm">{i.situation ?? i.text}</span></span>
        <span className="shrink-0 text-xs font-semibold">{i.version === 1 ? RESPONSE_LABELS[response] : value === null ? 'Unsure' : `${value * 10}/10`}</span>
      </button>;
    })}
  </div>;
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="font-semibold">{answered} saved · up to {a.maxItems}</span>
      <button type="button" disabled={a.saving} onClick={onExit} className="min-h-11 rounded-lg px-2 text-muted-foreground">Exit</button>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${answered} saved answers, maximum ${a.maxItems}`}>
      <div className="h-full bg-primary motion-safe:transition-[width]" style={{ width: `${pct}%` }} />
    </div>
    {a.assessmentVersion === 1 && <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">You’re finishing an earlier assessment with its original questions and scoring. Your next assessment will use the updated format.</p>}
    {reviewing ? review : editingKey || !a.complete ? item && <AssessmentQuestion key={item.itemKey} item={item} initialValue={a.responses[item.itemKey]} saving={a.saving} editing={!!editingKey}
      onConfirm={async value => { const saved = await a.answer(item.itemKey, value); if (saved && editingKey) { setEditingKey(null); setReviewing(true); } }} /> : <section className="space-y-4 rounded-2xl border bg-card p-5 text-center">
        <Check className="mx-auto h-9 w-9 text-primary" />
        <h2 className="text-xl font-semibold">{a.canFinalize ? 'Your skill picture is ready' : 'A little more game evidence is needed'}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{a.canFinalize ? 'Review your answers or generate your provisional level and skill breakdown.' : 'Review uncertain answers if you now have enough experience to answer. Otherwise, save this assessment and return after more games. We won’t turn missing experience into a low skill rating.'}</p>
        <Button disabled={!a.canFinalize || a.saving} onClick={a.finalize} className="h-12 w-full rounded-xl">See my results <ChevronRight className="ml-2 h-4 w-4" /></Button>
      </section>}
    {answered > 0 && <Button variant="outline" disabled={a.saving} className="min-h-11 w-full rounded-xl"
      onClick={() => { setEditingKey(null); setReviewing(v => !v); }}>{editingKey ? 'Cancel edit' : reviewing ? 'Back to assessment' : `Review ${answered} saved answers`}</Button>}
    {!reviewing && !editingKey && !a.complete && <p className="text-center text-[11px] text-muted-foreground">Question count adapts to the evidence in your answers.</p>}
  </div>;
}
/* ---------------- history ---------------- */

function AssessmentHistory({ history }: { history: CompletedAttempt[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No completed assessments yet.</p>;
  }
  return (
    <div className="space-y-2">
      <h2 className="font-display text-lg font-semibold mb-1">Assessment history</h2>
      {history.map((h) => (
        <div key={h.id} className={cn("rounded-xl border border-border/70 bg-card p-3 flex items-center justify-between gap-3")}>
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              {h.estimated_level_display?.toFixed(1) ?? "—"} · {h.display_band ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {h.completed_at ? new Date(h.completed_at).toLocaleDateString() : "—"}
              {h.confidence_label ? ` · ${h.confidence_label}` : ""}
              {` · v${h.assessment_version}`}
            </div>
          </div>
          {h.primary_style && (
            <span className="text-xs font-medium text-primary shrink-0">{h.primary_style}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-lg px-4 py-16 flex flex-col items-center justify-center text-center">
      {children}
    </div>
  );
}
