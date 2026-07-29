import { useState } from "react";
import { Gauge, AlertTriangle, ChevronRight, ClipboardCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { SkillLevelChip } from "@/components/skill/SkillLevelChip";
import { DOMAIN_LABELS, SUBSKILL_LABELS, type Domain, type Subskill } from "@/lib/skill/model";
import { confidenceGuidance } from "@/lib/skill/organizerCard";
import type { SubskillScore } from "@/lib/skill/scoring";
import {
  useOrganizerSkillCard,
  type OrganizerCardData,
  type ReviewStatus,
} from "@/hooks/useOrganizerSkillCard";

/**
 * Authorized organizer view of a player's PULSE Self-Assessed Level +
 * Skill Fingerprint. Placement-useful only — never raw responses,
 * question-by-question answers, or contradiction details (the server RPC
 * sanitizes those out). Uses the app's default design system.
 *
 * `compact` renders an inline strip inside player-management lists that
 * opens the full card in a dialog. All required states are handled;
 * disabled / denied / no-assessment render nothing (or a faint hint) so
 * the surrounding organizer layout is untouched.
 */
export function OrganizerSkillCard({
  playerId,
  leagueId,
  playerName,
  variant = "compact",
}: {
  playerId: string;
  leagueId?: string | null;
  playerName?: string;
  variant?: "compact" | "expanded";
}) {
  const { state, recordReview } = useOrganizerSkillCard(playerId, leagueId);

  if (state.status === "disabled" || state.status === "denied") return null;
  if (state.status === "loading") {
    return variant === "compact"
      ? <div className="h-4 w-40 rounded bg-muted/60 animate-pulse mt-1.5" />
      : <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />;
  }
  if (state.status === "none") {
    return variant === "compact"
      ? <div className="text-[11px] text-muted-foreground mt-1.5">No self-assessment yet</div>
      : <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">This player hasn't taken the PULSE Skill Assessment.</div>;
  }

  const d = state.data;
  if (variant === "expanded") {
    return <ExpandedCard d={d} leagueId={leagueId} playerName={playerName} recordReview={recordReview} />;
  }

  // Compact: inline strip → opens the full card.
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mt-1.5 inline-flex items-center gap-2 rounded-md px-1 -mx-1 py-0.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <SkillLevelChip level={d.level} band={d.band} />
          {d.reviewRecommended && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
              <AlertTriangle className="w-3 h-3" /> Review
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{playerName ?? "Player"} · Skill self-assessment</DialogTitle>
        </DialogHeader>
        <ExpandedCard d={d} leagueId={leagueId} playerName={playerName} recordReview={recordReview} />
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- expanded body ---------------- */

function ExpandedCard({
  d, leagueId, recordReview,
}: {
  d: OrganizerCardData;
  leagueId?: string | null;
  playerName?: string;
  recordReview: (s: ReviewStatus, note: string | null) => Promise<boolean>;
}) {
  const guidance = confidenceGuidance(d.reviewRecommended, d.provisional);
  const strengths = d.card?.strengths ?? [];
  const priorities = d.card?.developmentPriorities ?? [];
  const domains = d.card?.domains ?? [];
  const subskills = d.card?.subskills ?? [];

  return (
    <div className="space-y-4">
      {/* headline */}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tabular-nums">{d.level?.toFixed(1) ?? "—"}</span>
            <span className="text-sm font-semibold">{d.band}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full border border-primary/40 px-2 py-0.5 text-primary">
            Self-Assessed
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          {d.lowerBound != null && d.upperBound != null && <span>Likely {d.lowerBound.toFixed(1)}–{d.upperBound.toFixed(1)}</span>}
          {d.confidenceLabel && <span>· {d.confidenceLabel} ({d.confidence}/100)</span>}
          {d.completedAt && <span>· {new Date(d.completedAt).toLocaleDateString()}</span>}
        </div>
        {(d.primaryStyle || d.preferredSide || d.handedness) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.primaryStyle && <Tag>{d.primaryStyle}</Tag>}
            {d.secondaryStyle && <Tag muted>{d.secondaryStyle}</Tag>}
            {d.preferredSide && d.preferredSide !== "no_preference" && <Tag muted>{sideLabel(d.preferredSide)} side</Tag>}
            {d.handedness && <Tag muted>{d.handedness}-handed</Tag>}
          </div>
        )}
        {guidance && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{guidance}</span>
          </div>
        )}
      </div>

      {/* strengths / priorities */}
      {strengths.length > 0 && (
        <MiniList title="Strengths" tone="emerald" items={strengths.map((s) => ({ label: SUBSKILL_LABELS[s.subskill as Subskill], value: s.displayLevel }))} />
      )}
      {priorities.length > 0 && (
        <MiniList title="Development priorities" tone="amber" items={priorities.map((s) => ({ label: SUBSKILL_LABELS[s.subskill as Subskill], value: s.displayLevel }))} />
      )}

      {/* domains */}
      {domains.length > 0 && (
        <section className="rounded-xl border border-border/70 bg-card p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Domains</div>
          <div className="space-y-2">
            {domains.map((dm) => (
              <Bar key={dm.domain} label={DOMAIN_LABELS[dm.domain as Domain]} level={dm.displayLevel} insufficient={dm.insufficientEvidence} />
            ))}
          </div>
        </section>
      )}

      {/* subskills — progressive disclosure */}
      {subskills.length > 0 && <SubskillDisclosure subskills={subskills} />}

      {/* organizer review (non-destructive; org-scoped) */}
      {leagueId && <ReviewControls latest={d.latestReviewStatus} onRecord={recordReview} />}

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        Self-assessment only — separate from the PULSE Performance Rating. Raw answers stay private to the player.
      </p>
    </div>
  );
}

/* ---------------- review controls ---------------- */

const REVIEW_OPTIONS: { key: ReviewStatus; label: string }[] = [
  { key: "reviewed", label: "Reviewed" },
  { key: "appropriate", label: "Looks right" },
  { key: "too_low", label: "May be too low" },
  { key: "too_high", label: "May be too high" },
  { key: "review_recommended", label: "Needs review" },
];

function ReviewControls({
  latest, onRecord,
}: {
  latest: ReviewStatus | null;
  onRecord: (s: ReviewStatus, note: string | null) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<ReviewStatus | null>(latest);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!status) return;
    setSaving(true);
    const ok = await onRecord(status, note.trim() || null);
    setSaving(false);
    if (ok) setNote("");
  };

  return (
    <section className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <ClipboardCheck className="w-3.5 h-3.5" /> Organizer review
      </div>
      {latest && <div className="text-xs text-muted-foreground">Latest: <span className="font-medium text-foreground">{labelFor(latest)}</span></div>}
      <div className="flex flex-wrap gap-1.5">
        {REVIEW_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setStatus(o.key)}
            aria-pressed={status === o.key}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              status === o.key ? "border-primary bg-primary/10 text-primary" : "border-border/70 hover:bg-muted/50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Private organizer note (optional)"
        rows={2}
        className="text-sm"
      />
      <Button size="sm" onClick={save} disabled={!status || saving} className="w-full">
        {saving ? "Saving…" : "Record review"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Organization-specific and auditable. Does not change the player's self-assessed level.
      </p>
    </section>
  );
}

/* ---------------- small bits ---------------- */

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
      muted ? "bg-muted text-foreground/70 ring-1 ring-border" : "bg-primary/12 text-primary ring-1 ring-primary/25",
    )}>
      {children}
    </span>
  );
}

function MiniList({
  title, tone, items,
}: {
  title: string;
  tone: "emerald" | "amber";
  items: { label: string; value: number }[];
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span>{it.label}</span>
            <span className={cn(
              "rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums",
              tone === "emerald" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
            )}>{it.value.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bar({ label, level, insufficient }: { label: string; level: number; insufficient?: boolean }) {
  const pct = Math.max(0, Math.min(100, ((level - 1.0) / (4.7 - 1.0)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-medium min-w-0 break-words">{label}</span>
        <span className="text-xs font-semibold tabular-nums shrink-0">
          {insufficient ? <span className="text-muted-foreground font-normal">n/a</span> : level.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${insufficient ? "not enough information" : level.toFixed(1)}`}>
        {!insufficient && <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}

function SubskillDisclosure({ subskills }: { subskills: SubskillScore[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Individual skills</span>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform motion-safe:duration-200", open && "rotate-90")} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-3">
          {subskills.map((s) => (
            <Bar key={s.subskill} label={SUBSKILL_LABELS[s.subskill as Subskill]} level={s.displayLevel} insufficient={s.insufficientEvidence} />
          ))}
        </div>
      )}
    </section>
  );
}

function sideLabel(s: string): string {
  return s === "left" ? "Left" : s === "right" ? "Right" : s === "either" ? "Either" : s;
}
function labelFor(s: ReviewStatus): string {
  return REVIEW_OPTIONS.find((o) => o.key === s)?.label ?? s.replace(/_/g, " ");
}
