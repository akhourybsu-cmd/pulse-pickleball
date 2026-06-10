import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  /** Section label (rendered uppercase, tight tracking). */
  label: string;
  /** Optional count badge or pill rendered after the label. */
  count?: number;
  /** Optional right-side action (e.g., "View all →" link). */
  action?: ReactNode;
  className?: string;
}

/**
 * Standard section divider used inside the player tabs to introduce
 * stacked content groups. Replaces the various ad-hoc "h2" / "p" /
 * "<span className='text-xs font-medium text-muted-foreground'>" blocks
 * scattered across Dashboard / Matches / Play / Profile.
 *
 * Visual contract:
 *  - uppercase tracker label (text-xs font-semibold tracking-wider)
 *  - small count chip if provided
 *  - flex-row with optional right-side action link
 */
export function SectionHeader({
  label,
  count,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2 mb-3", className)}>
      <div className="flex items-baseline gap-2 min-w-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h2>
        {count != null && count > 0 && (
          <span className="text-[11px] font-medium text-muted-foreground/80 leading-none">
            ({count})
          </span>
        )}
      </div>
      {action && <div className="flex-shrink-0 text-xs">{action}</div>}
    </div>
  );
}
