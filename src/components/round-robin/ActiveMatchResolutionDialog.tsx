import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Trash2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveMatchResolutionKind } from "@/lib/roundRobin/activeMatch";

interface ResolutionOption {
  kind: ActiveMatchResolutionKind;
  icon: typeof CheckCircle2;
  title: string;
  description: string;
  tone: "primary" | "destructive";
  recommended?: boolean;
}

interface ActiveMatchResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the player being removed from the roster. */
  participantName: string;
  /** Court the live match is on (1-indexed) for orientation. */
  courtNo: number;
  /** Whether the live match already has a final score entered. */
  isScored: boolean;
  /** Current scoreline, shown when scored so the host knows what "keep" means. */
  team1Score?: number | null;
  team2Score?: number | null;
  loading?: boolean;
  onResolve: (kind: ActiveMatchResolutionKind) => void;
}

/**
 * When an organizer removes a player who is currently ON COURT in the live
 * round, the transactional RPC won't touch that match without an explicit
 * decision. This dialog collects it in plain language, offering only the
 * resolutions that are actually valid for the match's state:
 *
 *   - Scored match      → keep the result, or discard it.
 *   - In-progress match → discard it ("keep the result" is hidden because
 *                          there's no score to keep yet).
 *
 * (Substitutions don't reach here: the planner swaps the outgoing seat to the
 * replacement in the current round directly, so a replace never dead-ends.)
 *
 * Select-then-confirm (not one-tap) so a stray tap never abandons a live game.
 */
export function ActiveMatchResolutionDialog({
  open,
  onOpenChange,
  participantName,
  courtNo,
  isScored,
  team1Score,
  team2Score,
  loading = false,
  onResolve,
}: ActiveMatchResolutionDialogProps) {
  const options = useMemo<ResolutionOption[]>(() => {
    const out: ResolutionOption[] = [];
    const scoreLabel =
      team1Score != null && team2Score != null ? ` (${team1Score}–${team2Score})` : "";

    if (isScored) {
      out.push({
        kind: "finish_and_record",
        icon: CheckCircle2,
        title: "Keep this match's result",
        description: `Lock in the score${scoreLabel} — it counts toward standings — then remove them from the next round on.`,
        tone: "primary",
        recommended: true,
      });
    }

    out.push({
      kind: "abandon",
      icon: Trash2,
      title: "Discard this match",
      description: "The in-progress game is voided and won't count toward anyone's standings.",
      tone: "destructive",
      recommended: !isScored,
    });

    return out;
  }, [isScored, team1Score, team2Score]);

  const [selected, setSelected] = useState<ActiveMatchResolutionKind | null>(null);

  // Default the selection to the recommended option each time the dialog opens
  // or its option set changes, so the safe path is one tap away.
  useEffect(() => {
    if (!open) return;
    const rec = options.find((o) => o.recommended) ?? options[0];
    setSelected(rec?.kind ?? null);
  }, [open, options]);

  const confirmTone = options.find((o) => o.kind === selected)?.tone ?? "primary";

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[480px]">
        <PremiumDialogHeader
          icon={AlertTriangle}
          eyebrow="Live match"
          title={`${participantName} is on court right now`}
          description={`They're in the live match on Court ${courtNo}. Choose what happens to that game before removing them.`}
        />

        <div className="space-y-2 py-1" role="radiogroup" aria-label="Resolve the live match">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.kind;
            const isDestructive = opt.tone === "destructive";
            return (
              <button
                key={opt.kind}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(opt.kind)}
                disabled={loading}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.99] disabled:opacity-60",
                  isSelected
                    ? isDestructive
                      ? "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/30"
                      : "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    isDestructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{opt.title}</span>
                    {opt.recommended && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{opt.description}</p>
                </div>
                <Radio
                  className={cn(
                    "h-4 w-4 flex-shrink-0 mt-0.5",
                    isSelected ? (isDestructive ? "text-destructive" : "text-primary") : "text-muted-foreground/40",
                  )}
                />
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => selected && onResolve(selected)}
            disabled={!selected || loading}
            variant={confirmTone === "destructive" ? "destructive" : "default"}
          >
            {loading ? "Applying…" : "Confirm & continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
