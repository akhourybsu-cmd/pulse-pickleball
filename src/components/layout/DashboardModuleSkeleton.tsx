import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardModuleSkeletonProps {
  /** Number of card-shaped rows to render. Defaults to 2. */
  count?: number;
  /** Per-row height. Defaults to "h-16" — the standard hub-row height. */
  rowHeight?: string;
  /** Whether to render a small header bar above the rows. Defaults to true. */
  showHeader?: boolean;
  className?: string;
}

/**
 * Shared loading skeleton for the player Dashboard's modules.
 *
 * Replaces the previous one-off `animate-pulse + bg-muted` blocks
 * scattered across ActivityModule, PerformanceModule, and
 * StatsByCourtCard so every module loads with the same rhythm:
 *   • Optional 4px header bar (the SectionHeader label outline)
 *   • N rounded rows at a uniform height
 *
 * Uses the shared `Skeleton` primitive so the pulse animation matches
 * what the design system already ships elsewhere (UpcomingEventsPreview,
 * MatchHistory, etc.) instead of each module rolling its own.
 */
export function DashboardModuleSkeleton({
  count = 2,
  rowHeight = "h-16",
  showHeader = true,
  className,
}: DashboardModuleSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {showHeader && <Skeleton className="h-4 w-1/3" />}
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className={cn(rowHeight, "w-full rounded-xl")} />
        ))}
      </div>
    </div>
  );
}
