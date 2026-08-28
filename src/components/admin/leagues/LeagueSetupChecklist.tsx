import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, ChevronRight, ListChecks, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ManageTab } from "./leagueManageTabs";

const DISMISS_PREFIX = "pulse:league-setup-dismissed:";

/**
 * First-run order-of-operations for a ladder manager. The audit found the
 * /manage landing never tells a new organizer the required sequence (season →
 * roster → configure → generate) — they learned it only by hitting backward
 * empty-states. This lays the four steps out in order, auto-checks the two we
 * can detect from the hero counts, links each step to its tab, and is
 * dismissible (per-league, remembered) so it disappears once they've got it.
 */
export function LeagueSetupChecklist({
  leagueId, seasons, members, onGoToTab,
}: {
  leagueId: string;
  seasons: number;
  members: number;
  onGoToTab: (tab: ManageTab) => void;
}) {
  // Steps 3 & 4 are derived from real ladder state so the checklist can't sit
  // there claiming "not done" after the organizer has already started play.
  const [ladderConfigured, setLadderConfigured] = useState(false);
  const [ladderStarted, setLadderStarted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cfg, batches] = await Promise.all([
        supabase.from("ladder_settings" as never).select("id", { count: "exact", head: true })
          .eq("league_id", leagueId),
        supabase.from("ladder_batches" as never).select("id", { count: "exact", head: true })
          .eq("league_id", leagueId),
      ]);
      if (cancelled) return;
      setLadderConfigured((cfg.count ?? 0) > 0);
      setLadderStarted((batches.count ?? 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [leagueId]);

  const key = DISMISS_PREFIX + leagueId;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  });
  if (dismissed) return null;
  // Setup is over — stop occupying the top of the manage page.
  if (ladderStarted) return null;

  const steps: { label: string; hint: string; tab: ManageTab; done: boolean }[] = [
    { label: "Create a season", hint: "The container for play, standings, and the ladder.", tab: "seasons", done: seasons > 0 },
    { label: "Add your players", hint: "Individuals join the roster — you need at least 4, in multiples of 4.", tab: "members", done: members >= 4 && members % 4 === 0 },
    { label: "Configure the ladder & set the starting order", hint: "Pick batches and scoring, then seed the initial order.", tab: "ladder", done: ladderConfigured },
    { label: "Generate Week 1", hint: "Builds the first foursomes — play begins.", tab: "ladder", done: ladderStarted },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const dismiss = () => {
    try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="lg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--lg-gold)]/12 text-[color:var(--lg-accent-gold)]">
          <ListChecks className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[color:var(--lg-text)]">Set up your ladder</h3>
            <button
              type="button" onClick={dismiss} aria-label="Dismiss setup guide"
              className="text-[color:var(--lg-text-dim)] hover:text-[color:var(--lg-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-[color:var(--lg-text-dim)]">
            Four steps, in order — {doneCount} of {steps.length} done.
          </p>
        </div>
      </div>

      <ol className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onGoToTab(s.tab)}
              className="flex w-full items-center gap-3 rounded-lg border border-[color:var(--lg-border)] bg-[color:var(--lg-surface-2)] px-3 py-2 text-left transition-colors hover:border-[color:var(--lg-gold)]/40"
            >
              <span className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                s.done
                  ? "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)]"
                  : "bg-[color:var(--lg-surface)] text-[color:var(--lg-text-dim)] ring-1 ring-[color:var(--lg-border)]",
              )}>
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn(
                  "block text-sm font-medium",
                  s.done ? "text-[color:var(--lg-text-dim)] line-through" : "text-[color:var(--lg-text)]",
                )}>
                  {s.label}
                </span>
                <span className="block text-[11px] text-[color:var(--lg-text-dim)]">{s.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--lg-text-dim)]" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
