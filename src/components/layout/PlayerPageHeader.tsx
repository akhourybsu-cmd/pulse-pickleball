import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerPageHeaderProps {
  /** Lucide icon component shown in a tinted tile next to the title. */
  icon: LucideIcon;
  /** Page title (h1). */
  title: string;
  /** Optional one-line subtitle. */
  subtitle?: string;
  /** Optional action node shown at the right end (button, link, etc.). */
  action?: ReactNode;
  /**
   * When true, the gradient background extends down past the header content
   * (useful for pages that want a soft top wash). Default false (no gradient).
   */
  background?: "none" | "gradient";
  className?: string;
}

/**
 * Unified page header used by Home / Matches / Play / Profile.
 *
 * Visual contract:
 *  - Tinted icon tile (h-9 w-9) on the left
 *  - h1 with a thin animated accent line beneath
 *  - subtitle below
 *  - optional action on the right (button, link, etc.)
 *  - optional soft gradient backdrop
 *
 * Keeps the four player tabs feeling like siblings instead of distant
 * cousins. Replaces hand-rolled "Page header" blocks scattered across
 * Dashboard, MatchHistory, PlayHub, and PlayerProfile.
 */
export function PlayerPageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  background = "none",
  className,
}: PlayerPageHeaderProps) {
  return (
    <div
      className={cn(
        "border-b border-border/40",
        background === "gradient" &&
          "bg-gradient-to-b from-primary/[0.06] via-background to-background",
        className,
      )}
    >
      <div className="container mx-auto px-4 py-4 md:py-5 max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground leading-tight">
                {title}
              </h1>
              {/* Static accent line — uses the design-system primary token. */}
              <div className="h-[3px] w-10 mt-1.5 bg-primary rounded-full" />
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-2 leading-snug">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  );
}
