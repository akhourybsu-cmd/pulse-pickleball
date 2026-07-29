import { useState } from "react";
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
  return (
    <div className="space-y-5">
      {/* 1–2. Overall + confidence + source */}
      <section className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          PULSE Self-Assessed Level
        </div>
        <div className="mt-2 flex items-end justify-center gap-2">
          <span className="font-display text-6xl font-bold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
            {snapshot.estimatedLevelDisplay.toFixed(1)}
          </span>
        </div>
        <div className="mt-1 text-lg font-semibold">{snapshot.displayBand}</div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>Likely range {snapshot.lowerBound.toFixed(1)}–{snapshot.upperBound.toFixed(1)}</span>
          <span aria-hidden>·</span>
          <span>{snapshot.confidence.label}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          This is your self-assessment. It is separate from your PULSE Performance Rating,
          which comes from verified match results.
        </p>
      </section>

      {/* Style identity */}
      {snapshot.primaryStyle && (
        <section className="rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Your style
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StyleBadge label={snapshot.primaryStyle.label} stage={snapshot.primaryStyle.stage} primary />
            {snapshot.secondaryStyle && (
              <StyleBadge label={snapshot.secondaryStyle.label} stage={snapshot.secondaryStyle.stage} />
            )}
          </div>
        </section>
      )}

      {/* 4. Strengths */}
      {snapshot.strengths.length > 0 && (
        <FingerprintList
          icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
          title="Strongest skills"
          items={snapshot.strengths.map((s) => ({
            label: SUBSKILL_LABELS[s.subskill], value: s.displayLevel, reason: s.reason,
          }))}
          tone="emerald"
        />
      )}

      {/* 5. Development priorities */}
      {snapshot.developmentPriorities.length > 0 && (
        <FingerprintList
          icon={<Target className="w-3.5 h-3.5 text-amber-600" />}
          title="Development priorities"
          items={snapshot.developmentPriorities.map((s) => ({
            label: SUBSKILL_LABELS[s.subskill], value: s.displayLevel, reason: s.reason,
          }))}
          tone="amber"
        />
      )}

      {/* 6. Broad domains */}
      <section className="rounded-2xl border border-border/70 bg-card p-4">
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
      </section>

      {/* 7. Individual skills — progressive disclosure by group */}
      <section className="space-y-2">
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
      </section>

      {/* 9. Assessment details */}
      <section className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Info className="w-3.5 h-3.5" /> Assessment details
        </div>
        <div>Source: Self-Assessed · Confidence {snapshot.confidence.total}/100 ({snapshot.confidence.label})</div>
        {completedAt && <div>Completed {new Date(completedAt).toLocaleDateString()}</div>}
        <div>Scoring model v{snapshot.scoringModelVersion} · {snapshot.meta.answeredCount} questions answered</div>
        {snapshot.contradictions.length > 0 && (
          <div>{snapshot.contradictions.length} response(s) flagged for a closer look — this lowers confidence, not your level.</div>
        )}
      </section>

      {/* 10. Retake */}
      {onRetake && (
        <div className="space-y-2">
          <Button onClick={onRetake} disabled={!canRetake} variant="outline" className="w-full h-11 gap-2">
            <RotateCcw className="w-4 h-4" /> Retake assessment
          </Button>
          {!canRetake && nextRetakeLabel && (
            <p className="text-center text-xs text-muted-foreground">{nextRetakeLabel}</p>
          )}
        </div>
      )}
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
