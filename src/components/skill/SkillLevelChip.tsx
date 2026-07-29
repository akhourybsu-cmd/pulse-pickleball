import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The PULSE Self-Assessed Level chip. Deliberately an OUTLINE treatment so
 * it never reads as, or competes with, the filled PULSE Performance Rating
 * pill — the two measurements must stay visually distinct.
 */
export function SkillLevelChip({
  level,
  band,
  className,
}: {
  level: number | null | undefined;
  band?: string | null;
  className?: string;
}) {
  if (level == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-transparent px-2.5 py-1 text-sm font-medium text-foreground",
        className,
      )}
    >
      <Gauge className="w-3.5 h-3.5 text-primary" />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{level.toFixed(1)}</span>
      {band && <span className="text-muted-foreground text-xs">· {band}</span>}
      <span className="sr-only">PULSE Self-Assessed Level</span>
    </span>
  );
}
