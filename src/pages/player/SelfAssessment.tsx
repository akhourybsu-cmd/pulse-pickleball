import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Loader2, History, ChevronRight, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponseScalePicker } from "@/components/skill/ResponseScalePicker";
import { SkillIntro } from "@/components/skill/SkillIntro";
import { SkillFingerprint } from "@/components/skill/SkillFingerprint";
import { useSkillAssessment, type CompletedAttempt } from "@/hooks/useSkillAssessment";
import { itemByKey } from "@/lib/skill/questionBank";
import { SUBSKILL_LABELS, clamp, type ResponseKey } from "@/lib/skill/model";
import { cn } from "@/lib/utils";

/**
 * Dedicated player route: /player/self-assessment. Renders inside
 * PlayerShell (header + bottom nav preserved). Drives the whole flow:
 * intro → adaptive wizard (save-and-resume) → finalize → Skill Fingerprint,
 * plus assessment history. Mobile-first.
 */
export default function SelfAssessment() {
  const navigate = useNavigate();
  const a = useSkillAssessment();
  const [showHistory, setShowHistory] = useState(false);

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
      ) : a.phase === "intro" ? (
        <SkillIntro
          onStart={a.start}
          hasDraft={!!a.attemptId}
          minItems={a.minItems}
          maxItems={a.maxItems}
        />
      ) : a.phase === "finalizing" ? (
        <Centered>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Building your Skill Fingerprint…</p>
        </Centered>
      ) : a.phase === "result" && a.latest?.scoring_snapshot ? (
        <SkillFingerprint
          snapshot={a.latest.scoring_snapshot}
          completedAt={a.latest.completed_at}
          onRetake={a.showIntro}
          canRetake
        />
      ) : a.phase === "in_progress" ? (
        <WizardStep a={a} onExit={() => navigate("/player/profile")} />
      ) : (
        <SkillIntro onStart={a.start} minItems={a.minItems} maxItems={a.maxItems} />
      )}
    </div>
  );
}

/* ---------------- adaptive wizard step ---------------- */

function WizardStep({
  a,
  onExit,
}: {
  a: ReturnType<typeof useSkillAssessment>;
  onExit: () => void;
}) {
  const reduced = useReducedMotion();
  const item = a.nextItemKey ? itemByKey(a.nextItemKey) : null;
  const answered = a.answeredCount;
  const softTotal = Math.max(a.minItems, answered + 1);
  const pct = a.complete ? 100 : Math.round(clamp((answered / softTotal) * 100, 4, 96));

  // Complete (or no eligible item left) → offer results.
  if (!item || a.complete) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Gauge className="h-7 w-7" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">You're all set</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            You answered {answered} questions. Generate your PULSE Self-Assessed Level and Skill Fingerprint.
          </p>
        </div>
        <Button onClick={a.finalize} className="w-full h-12 font-semibold gap-2">
          See my results <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={onExit} className="w-full text-muted-foreground">
          Save &amp; finish later
        </Button>
      </div>
    );
  }

  // Dense, single-viewport layout: slim progress + inline exit, then a compact
  // card whose question + all response options fit without scrolling.
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Question {answered + 1}</span>
          <div className="flex items-center gap-3">
            {a.saving && (
              <span className="inline-flex items-center gap-1 text-muted-foreground" aria-live="polite">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving
              </span>
            )}
            <button
              type="button"
              onClick={onExit}
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Save &amp; exit
            </button>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${answered} answered`}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.itemKey}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 28 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -28 }}
          transition={reduced ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 36, mass: 0.7 }}
          className="rounded-2xl border border-border/60 p-4 shadow-[0_4px_20px_-6px_hsl(var(--foreground)/0.07)]"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card)) 62%, hsl(var(--primary) / 0.045) 100%)",
          }}
        >
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {SUBSKILL_LABELS[item.subskill]}
          </div>
          <p className="mb-3.5 text-[15px] font-semibold leading-snug text-balance">{item.text}</p>
          <ResponseScalePicker
            value={(a.responses[item.itemKey] as ResponseKey | undefined) ?? null}
            onSelect={(key) => void a.answer(item.itemKey, key)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
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
