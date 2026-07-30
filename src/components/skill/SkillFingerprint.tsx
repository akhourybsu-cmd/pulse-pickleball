import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, TrendingUp, Target, Sparkles, Info, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DOMAIN_LABELS,
  SUBSKILL_LABELS,
  SUBSKILL_GROUPS,
  type Domain,
  type Subskill,
} from "@/lib/skill/model";
import type { ScoringSnapshot } from "@/lib/skill/scoring";
import { staggerContainer, staggerItem } from "@/lib/motion";

/**
 * PULSE Skill Fingerprint result screen. Hierarchy follows the product
 * spec: overall → confidence/source → domains → strengths → priorities →
 * subskills (progressive disclosure) → style → details. Uses the app's
 * default (gold/ink) design system, restrained motion, and text values
 * alongside every bar (never color-only). Clearly labels the SOURCE as
 * Self-Assessed so it's never confused with the Performance Rating.
 */
export function SkillFingerprint({
  snapshot,
  completedAt,
  onRetake,
  canRetake,
  nextRetakeLabel,
}: {
  snapshot: ScoringSnapshot;
  completedAt?: string | null;
  onRetake?: () => void;
  canRetake?: boolean;
  nextRetakeLabel?: string | null;
}) {
  const reduced = useReducedMotion();
  const motionProps = reduced
    ? {}
    : { variants: staggerContainer, initial: "hidden" as const, animate: "show" as const };
  const itemProps = reduced ? {} : { variants: staggerItem };

  return (
    <motion.div className="space-y-5" {...motionProps}>
      {/* 1–2. Overall + confidence + source (radial gauge hero) */}
      <motion.section {...itemProps} className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          PULSE Self-Assessed Level
        </div>
        <LevelGauge
          level={snapshot.estimatedLevelDisplay}
          lower={snapshot.lowerBound}
          upper={snapshot.upperBound}
        />
        <div className="mt-1 text-lg font-semibold">{snapshot.displayBand}</div>
        <ConfidenceMeter
          lower={snapshot.lowerBound}
          upper={snapshot.upperBound}
          total={snapshot.confidence.total}
          label={snapshot.confidence.label}
        />
        <p className="mt-4 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          This is your self-assessment. It is separate from your PULSE Performance Rating,
          which comes from verified match results.
        </p>
      </motion.section>

      {/* Style identity */}
      {snapshot.primaryStyle && (
        <motion.section {...itemProps} className="rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Your style
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StyleBadge label={snapshot.primaryStyle.label} stage={snapshot.primaryStyle.stage} primary />
            {snapshot.secondaryStyle && (
              <StyleBadge label={snapshot.secondaryStyle.label} stage={snapshot.secondaryStyle.stage} />
            )}
          </div>
        </motion.section>
      )}

      {/* 4. Strengths */}
      {snapshot.strengths.length > 0 && (
        <motion.div {...itemProps}>
          <FingerprintList
            icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
            title="Strongest skills"
            items={snapshot.strengths.map((s) => ({
              label: SUBSKILL_LABELS[s.subskill], value: s.displayLevel, reason: s.reason,
            }))}
            tone="emerald"
          />
        </motion.div>
      )}

      {/* 5. Development priorities */}
      {snapshot.developmentPriorities.length > 0 && (
        <motion.div {...itemProps}>
          <FingerprintList
            icon={<Target className="w-3.5 h-3.5 text-amber-600" />}
            title="Development priorities"
            items={snapshot.developmentPriorities.map((s) => ({
              label: SUBSKILL_LABELS[s.subskill], value: s.displayLevel, reason: s.reason,
            }))}
            tone="amber"
          />
        </motion.div>
      )}

      {/* 6. Broad domains */}
      <motion.section {...itemProps} className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Broad domains
        </div>
        <div className="space-y-2.5">
          {snapshot.domains.map((d) => (
            <SkillBar
              key={d.domain}
              label={DOMAIN_LABELS[d.domain as Domain]}
              level={d.displayLevel}
              insufficient={d.insufficientEvidence}
            />
          ))}
        </div>
      </motion.section>

      {/* 7. Individual skills — progressive disclosure by group */}
      <motion.section {...itemProps} className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
          Individual skills
        </div>
        {SUBSKILL_GROUPS.map((g) => (
          <SubskillGroup
            key={g.key}
            title={g.label}
            subskills={g.subskills}
            snapshot={snapshot}
          />
        ))}
      </motion.section>

      {/* 9. Assessment details */}
      <motion.section {...itemProps} className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Info className="w-3.5 h-3.5" /> Assessment details
        </div>
        <div>Source: Self-Assessed · Confidence {snapshot.confidence.total}/100 ({snapshot.confidence.label})</div>
        {completedAt && <div>Completed {new Date(completedAt).toLocaleDateString()}</div>}
        <div>Scoring model v{snapshot.scoringModelVersion} · {snapshot.meta.answeredCount} questions answered</div>
        {snapshot.contradictions.length > 0 && (
          <div>{snapshot.contradictions.length} response(s) flagged for a closer look — this lowers confidence, not your level.</div>
        )}
      </motion.section>

      {/* 10. Retake */}
      {onRetake && (
        <motion.div {...itemProps} className="space-y-2">
          <Button onClick={onRetake} disabled={!canRetake} variant="outline" className="w-full h-11 gap-2">
            <RotateCcw className="w-4 h-4" /> Retake assessment
          </Button>
          {!canRetake && nextRetakeLabel && (
            <p className="text-center text-xs text-muted-foreground">{nextRetakeLabel}</p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/* ---------------- hero gauge ---------------- */

/**
 * Animated radial gauge for the overall level. Full-ring progress (starts at
 * 12 o'clock) with a translucent "likely range" band behind the solid value
 * arc. SVG stroke + opacity only — no layout shift; reduced-motion users get
 * the final state with no sweep.
 */
function LevelGauge({ level, lower, upper }: { level: number; lower: number; upper: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(!!reduced);
  useEffect(() => {
    if (reduced) { setShown(true); return; }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const MIN = 1, MAX = 5, P = 100;
  const frac = (v: number) => Math.max(0, Math.min(1, (v - MIN) / (MAX - MIN)));
  const vFrac = frac(level), lFrac = frac(lower), uFrac = frac(upper);
  const valueOffset = shown ? P - P * vFrac : P;
  const bandLen = Math.max(0, uFrac - lFrac) * P;

  return (
    <div className="relative mx-auto mt-3 h-40 w-40">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        {bandLen > 0 && (
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="hsl(var(--primary) / 0.22)" strokeWidth="8" strokeLinecap="round"
            pathLength={P} strokeDasharray={`${bandLen} ${P}`} strokeDashoffset={-lFrac * P}
          />
        )}
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
          pathLength={P} strokeDasharray={P} strokeDashoffset={valueOffset}
          style={reduced ? undefined : { transition: "stroke-dashoffset 900ms cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-bold leading-none tabular-nums">
          {level.toFixed(1)}
        </span>
        <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          of {MAX.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function ConfidenceMeter({ lower, upper, total, label }: { lower: number; upper: number; total: number; label: string }) {
  const pct = Math.max(0, Math.min(100, total));
  return (
    <div className="mx-auto mt-3 max-w-[15rem] space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Likely {lower.toFixed(1)}–{upper.toFixed(1)}</span>
        <span className="font-medium text-foreground/80">{label}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Confidence ${total} of 100 (${label})`}>
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function SkillBar({ label, level, insufficient }: { label: string; level: number; insufficient?: boolean }) {
  const pct = Math.max(0, Math.min(100, ((level - 1.0) / (4.7 - 1.0)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-sm font-medium min-w-0 break-words">{label}</span>
        <span className="text-sm font-semibold tabular-nums shrink-0">
          {insufficient ? <span className="text-muted-foreground text-xs font-normal">Not enough info</span> : level.toFixed(1)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${insufficient ? "not enough information" : level.toFixed(1)}`}>
        {!insufficient && (
          <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}

function SubskillGroup({ title, subskills, snapshot }: { title: string; subskills: Subskill[]; snapshot: ScoringSnapshot }) {
  const [open, setOpen] = useState(false);
  const rows = subskills
    .map((s) => snapshot.subskills.find((x) => x.subskill === s))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const shown = rows.filter((r) => !r.insufficientEvidence);
  const avg = shown.length ? shown.reduce((a, b) => a + b.displayLevel, 0) / shown.length : null;
  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <span className="text-sm font-semibold">{title}</span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="text-sm font-medium tabular-nums text-foreground">{avg != null ? avg.toFixed(1) : "—"}</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform motion-safe:duration-200", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 space-y-2.5 border-t border-border/40">
          <div className="pt-3" />
          {rows.map((r) => (
            <SkillBar
              key={r.subskill}
              label={SUBSKILL_LABELS[r.subskill]}
              level={r.displayLevel}
              insufficient={r.insufficientEvidence}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FingerprintList({
  icon, title, items, tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: { label: string; value: number; reason: string }[];
  tone: "emerald" | "amber";
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2 mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className={cn(
              "mt-0.5 inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums shrink-0",
              tone === "emerald" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
            )}>
              {it.value.toFixed(1)}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{it.label}</div>
              <div className="text-xs text-muted-foreground leading-snug">{it.reason}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StyleBadge({ label, stage, primary }: { label: string; stage: string; primary?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
      primary ? "bg-primary/12 text-primary ring-1 ring-primary/25" : "bg-muted text-foreground/80 ring-1 ring-border",
    )}>
      {label}
      <span className={cn("text-[10px] font-bold uppercase tracking-wide", primary ? "text-primary/70" : "text-muted-foreground")}>
        {stage}
      </span>
    </span>
  );
}
