/**
 * Shared primitives used across the League Management tabs.
 * Extract so every tab looks and behaves the same.
 */
import { ReactNode } from "react";
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

const TONE_STYLES: Record<FormTone, { bar: string; chip: string; text: string }> = {
  primary: { bar: "bg-primary",       chip: "bg-primary/10",       text: "text-primary" },
  blue:    { bar: "bg-blue-500",      chip: "bg-blue-500/10",      text: "text-blue-500" },
  amber:   { bar: "bg-amber-500",     chip: "bg-amber-500/10",     text: "text-amber-500" },
  violet:  { bar: "bg-violet-500",    chip: "bg-violet-500/10",    text: "text-violet-500" },
  gold:    { bar: "bg-[#A6DB5A]",     chip: "bg-[#A6DB5A]/10",     text: "text-[#A6DB5A]" },
  emerald: { bar: "bg-emerald-500",   chip: "bg-emerald-500/10",   text: "text-emerald-500" },
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
  icon, title, subtitle, tone = "primary", size = "md",
  primaryLabel, primaryDisabled, primaryLoading, onPrimary,
  secondary,
  children,
}: {
  icon: ReactNode;
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
      {/* Accent stripe */}
      <div className={cn("h-1.5 w-full", t.bar)} aria-hidden />

      <DialogHeader className="p-5 pb-3 space-y-0">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              t.chip, t.text,
            )}
            aria-hidden
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <DialogTitle className="text-lg font-bold tracking-tight leading-tight">
              {title}
            </DialogTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </DialogHeader>

      <div className="px-5 pb-4 pt-1 space-y-4 max-h-[70vh] overflow-y-auto">
        {children}
      </div>

      <DialogFooter className="p-4 pt-3 border-t border-border/60 bg-muted/20 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
        {secondary}
        <Button
          onClick={() => void onPrimary()}
          disabled={primaryDisabled || primaryLoading}
          className={cn(
            "h-12 font-semibold shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.35)]",
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
      <div className="flex items-baseline gap-2 border-b border-border/40 pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground/70">{hint}</span>
        )}
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
        className="text-xs font-semibold text-foreground/80"
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
export const FIELD_H = "h-11";
