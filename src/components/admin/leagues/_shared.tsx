/**
 * Shared primitives used across the League Management tabs.
 * Extract so every tab looks and behaves the same.
 */
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      {icon && (
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
      {action && (
        <Button
          size="sm"
          variant="outline"
          onClick={action.onClick}
          className="mt-3"
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
