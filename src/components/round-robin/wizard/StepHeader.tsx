import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepHeaderProps {
  /** Lucide icon component (e.g. CalendarClock). Optional but recommended
   *  — every step should have one for visual rhythm across the wizard. */
  icon?: LucideIcon;
  /** Primary step question. Kept short — the form does the explaining. */
  title: string;
  /** One-line subtext. Keep concrete and action-oriented; avoid
   *  generic boilerplate like "Choose how you want to set up your event". */
  description?: string;
  /** Slot for a tiny right-aligned chip (e.g. "Optional", a step counter,
   *  a count badge). Use sparingly. */
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Shared header pattern for every step in the Round Robin wizard.
 *
 * Why this exists: pre-overhaul each step file rolled its own
 * `<h2 className="text-xl …"> + <p className="text-muted …">` block,
 * with different spacing, icon placement, and copy density. The result
 * felt utilitarian and inconsistent. This component locks in one rhythm
 * — primary-tinted icon disc, tight semi-bold title, single-line muted
 * description — so the wizard reads as one premium product instead of
 * thirteen different forms.
 */
export function StepHeader({
  icon: Icon,
  title,
  description,
  trailing,
  className,
}: StepHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3 mb-5", className)}>
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[17px] sm:text-lg font-semibold leading-tight tracking-tight">
            {title}
          </h2>
          {trailing && <div className="ml-auto flex-shrink-0">{trailing}</div>}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
