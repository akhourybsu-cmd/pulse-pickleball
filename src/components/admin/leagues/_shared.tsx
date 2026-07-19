/**
 * Shared primitives used across the League Management tabs.
 * Extract so every tab looks and behaves the same.
 */
import { ReactNode, useId } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { League } from "@/lib/leagues/types";

/**
 * Props every league tab receives from AdminLeagueDetail. The tab MUST:
 *   • include `dataVersion` in the dependency array of any reload effect
 *     so it re-fetches when sibling tabs mutate.
 *   • call `onMutated()` after any successful mutation so sibling tabs
 *     + hero counts refresh.
 */
export interface LeagueTabProps {
  league: League;
  dataVersion: number;
  onMutated: () => void;
}

export function EmptyState({
  icon, title, desc, action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
      {icon && (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold">{title}</p>
      {desc && <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">{desc}</p>}
      {action && (
        <Button
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

/** Cheap skeleton for tab loading — no shadcn Skeleton dep needed. */
export function TabSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-muted/50" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Form-shell primitives — shared visual language across every league
 *  editor dialog. Give every menu the same "official" feel: colored
 *  icon chip in the header, subtle top accent stripe, sensible field
 *  grouping, tall (h-11) inputs, sticky-feeling footer.
 *  Tone controls the accent color so each entity type has its own
 *  visual signature (season = primary, division = blue, team = amber,
 *  session = violet, league = gold).
 */
/* ------------------------------------------------------------------ */

export type FormTone = "primary" | "blue" | "amber" | "violet" | "gold" | "emerald";

/**
 * Per-entity accent. `chip`/`kicker` render on the DARK banner header,
 * so they use lighter tints; `glow` is the blurred bloom behind the
 * icon. Season = primary, division = blue, team = amber, session =
 * violet, league = gold, subs = emerald.
 */
const TONE_STYLES: Record<FormTone, { bar: string; chip: string; kicker: string; glow: string }> = {
  primary: { bar: "bg-primary",     chip: "bg-primary/15 text-primary",       kicker: "text-primary",       glow: "bg-primary/25" },
  blue:    { bar: "bg-blue-500",    chip: "bg-blue-500/15 text-blue-300",     kicker: "text-blue-300",      glow: "bg-blue-500/25" },
  amber:   { bar: "bg-amber-500",   chip: "bg-amber-500/15 text-amber-300",   kicker: "text-amber-300",     glow: "bg-amber-500/25" },
  violet:  { bar: "bg-violet-500",  chip: "bg-violet-500/15 text-violet-300", kicker: "text-violet-300",    glow: "bg-violet-500/25" },
  gold:    { bar: "bg-[#A6DB5A]",   chip: "bg-[#A6DB5A]/15 text-[#A6DB5A]",    kicker: "text-[#A6DB5A]",     glow: "bg-[#A6DB5A]/25" },
  emerald: { bar: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-300", kicker: "text-emerald-300", glow: "bg-emerald-500/25" },
};

/**
 * Full dialog shell for a league editor form. Renders inside an outer
 * <Dialog> so the caller controls open state and outer trigger.
 *
 * Composition:
 *   ┌──────────────────────┐
 *   │ ▬▬▬ (2-color accent) │  ← top stripe, entity-tinted
 *   │ ● Icon  Title        │  ← colored icon chip + big title
 *   │        Subtitle      │
 *   ├──────────────────────┤
 *   │  children (fields)   │
 *   ├──────────────────────┤
 *   │  [ primary CTA ]     │  ← h-12, shadowed
 *   └──────────────────────┘
 */
export function FormShell({
  icon, kicker, title, subtitle, tone = "primary", size = "md",
  primaryLabel, primaryDisabled, primaryLoading, onPrimary,
  secondary,
  children,
}: {
  icon: ReactNode;
  /** Small uppercase eyebrow above the title, e.g. "SEASON" or "MATCHUP". */
  kicker?: string;
  title: string;
  subtitle?: string;
  tone?: FormTone;
  size?: "md" | "lg";
  primaryLabel: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onPrimary: () => void | Promise<void>;
  /** Optional secondary action (e.g. Cancel/Delete) rendered left of the primary. */
  secondary?: ReactNode;
  children: ReactNode;
}) {
  const t = TONE_STYLES[tone];
  return (
    <DialogContent
      className={cn(
        "p-0 overflow-hidden gap-0",
        size === "lg" ? "sm:max-w-lg" : "sm:max-w-md",
      )}
    >
      {/* Stadium banner header — dark broadcast panel with an accent
          side-rail, diagonal court texture, and a glow behind the icon.
          Gives every league menu a "team sheet" feel instead of a plain
          form. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38]">
        <div className={cn("absolute top-0 bottom-0 left-0 w-1.5", t.bar)} aria-hidden />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0, transparent 10px, currentColor 10px, currentColor 11px)",
            color: "#A6DB5A",
          }}
        />
        <div aria-hidden className={cn("absolute -top-14 -right-10 h-40 w-40 rounded-full blur-3xl pointer-events-none", t.glow)} />

        <DialogHeader className="relative p-5 pb-4 space-y-0 text-left">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-white/10",
                t.chip,
              )}
              aria-hidden
            >
              {icon}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              {kicker && (
                <div className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-0.5", t.kicker)}>
                  {kicker}
                </div>
              )}
              <DialogTitle className="text-lg font-black tracking-tight leading-tight text-white">
                {title}
              </DialogTitle>
              {subtitle && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>
      </div>

      <div className="px-5 pb-4 pt-4 space-y-4 max-h-[65vh] overflow-y-auto">
        {children}
      </div>

      <DialogFooter className="p-4 pt-3 border-t border-border/60 bg-muted/20 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
        {secondary}
        <Button
          onClick={() => void onPrimary()}
          disabled={primaryDisabled || primaryLoading}
          className={cn(
            "h-12 font-bold uppercase tracking-wide text-[13px] shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.35)]",
            "active:scale-[0.98] transition-transform",
            secondary ? "flex-1" : "w-full",
          )}
        >
          {primaryLoading ? "Saving…" : primaryLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Section within a FormShell — group related fields under a small
 * uppercase eyebrow label with a divider hairline. Makes long forms
 * scannable instead of a flat wall of inputs.
 */
export function FormSection({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      {/* Chalk-line section header — accent tick + uppercase label +
          a fading rule, like a stat sheet heading. */}
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-full bg-primary shrink-0" aria-hidden />
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/75 shrink-0">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground/70 normal-case font-normal truncate">
            {hint}
          </span>
        )}
        <span className="flex-1 h-px bg-gradient-to-r from-border/70 to-transparent" aria-hidden />
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * Single labeled field row. Handles the label + help-text stacking so
 * editors don't repeat the same 4-line pattern for every input.
 * Pass `required` to add a subtle gold star to the label.
 */
export function FormRow({
  label, htmlFor, hint, required, children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
      >
        {label}
        {required && (
          <span className="text-[#A6DB5A] ml-0.5" aria-label="required">*</span>
        )}
      </Label>
      {children}
      {hint && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Standard input height class used by every FormRow input/select for
 * a consistent touch-target on mobile. Import + apply to `<Input>`,
 * `<SelectTrigger>`, `<Textarea>`.
 */
export const FIELD_H = "h-11 rounded-lg";

/* ------------------------------------------------------------------ */
/*  Sporty choice controls — replace plain dropdowns for small enum
 *  sets so league menus read like "pick a game mode", not a form.
 * ------------------------------------------------------------------ */

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Optional one-liner shown under the label in ChoiceGrid. */
  desc?: string;
  icon?: ReactNode;
}

/**
 * Segmented toggle for 2-3 mutually exclusive options. The active
 * segment slides via a shared layout animation. Great for on/off-style
 * choices (Active / Inactive, Player / Captain / Manager).
 */
export function SegmentedControl<T extends string>({
  value, onChange, options, ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ChoiceOption<T>[];
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-full rounded-xl bg-muted/60 p-1 gap-1 ring-1 ring-inset ring-border/50"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 rounded-lg px-2 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-primary shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.5)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                aria-hidden
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
              {o.icon}{o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tap-to-select tile grid for enum choices that benefit from a short
 * description (session status, member role). Feels like choosing a
 * mode on a sports app rather than opening a dropdown.
 */
export function ChoiceGrid<T extends string>({
  value, onChange, options, columns = 2,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ChoiceOption<T>[];
  columns?: 2 | 3;
}) {
  return (
    <div className={cn("grid gap-2", columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl border p-2.5 text-left transition-all active:scale-[0.98]",
              active
                ? "border-primary/50 bg-primary/10 ring-1 ring-primary/25 shadow-[0_2px_10px_-4px_hsl(var(--primary)/0.35)]"
                : "border-border/60 bg-card hover:border-border hover:bg-muted/40",
            )}
          >
            <div className="flex items-center gap-2">
              {o.icon && (
                <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")}>
                  {o.icon}
                </span>
              )}
              <span className={cn(
                "text-xs font-bold uppercase tracking-wide leading-tight",
                active ? "text-primary" : "text-foreground",
              )}>
                {o.label}
              </span>
            </div>
            {o.desc && (
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                {o.desc}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
