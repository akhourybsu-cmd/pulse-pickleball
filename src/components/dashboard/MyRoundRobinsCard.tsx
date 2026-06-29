import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ChevronRight, Repeat, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DashboardModuleSkeleton } from "@/components/layout/DashboardModuleSkeleton";
import { cn } from "@/lib/utils";

interface MyRoundRobinsCardProps {
  userId: string | undefined;
}

type Status = "draft" | "live";
type Role = "host" | "player";

interface RREntry {
  id: string;
  name: string;
  date: string;
  status: Status;
  currentRound: number | null;
  numRounds: number;
  role: Role;
}

interface RawEvent {
  id: string;
  name: string;
  date: string;
  status: Status;
  current_round: number | null;
  num_rounds: number;
  organizer_id?: string;
  voided?: boolean | null;
}

/**
 * Dashboard widget — lists the user's active + upcoming Round Robins
 * where they're EITHER the host OR a confirmed participant.
 *
 * Replaces both:
 *  • the standalone "Round Robins" tile that used to live in
 *    QuickActionsBar and routed to /round-robin (the catch-all hub)
 *  • the global RoundRobinBanner that flashed "Round Robin Match
 *    In Progress" above the player shell whenever a live event was
 *    detected
 *
 * Now the host AND the participants see the same surface on Home:
 *   • Live events first (with "LIVE · Round 3 of 5")
 *   • Drafts second (with "DRAFT · Jun 28")
 *   • A role pill (Hosting / Playing) so the user knows which hat
 *     they're wearing for each event
 *   • Tap any row → /round-robin/:id (no detour through the hub)
 *
 * Empty state hosts the create + browse affordances inline so the
 * dashboard never lands the user on a generic catch-all.
 */
export function MyRoundRobinsCard({ userId }: MyRoundRobinsCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<RREntry[]>([]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const run = async () => {
      try {
        // Events I'm hosting — active or upcoming, not voided.
        const { data: hostingData } = await supabase
          .from("round_robin_events")
          .select("id, name, date, status, current_round, num_rounds, voided")
          .eq("organizer_id", userId)
          .in("status", ["draft", "live"])
          .or("voided.is.null,voided.eq.false")
          .order("date", { ascending: true });

        // Events I'm participating in (active registration). Join through
        // the inner relation so we only get rows where the event is
        // draft/live (vs. completed events the player may still have a
        // row in).
        const { data: playingData } = await supabase
          .from("round_robin_players")
          .select(
            `event_id,
             round_robin_events!inner (
               id, name, date, status, current_round, num_rounds,
               organizer_id, voided
             )`,
          )
          .eq("player_id", userId)
          .eq("active", true)
          .in("round_robin_events.status", ["draft", "live"]);

        if (cancelled) return;

        const hostingMap = new Map<string, RawEvent>();
        (hostingData || []).forEach((e) => {
          if (e && !e.voided) hostingMap.set(e.id, e as RawEvent);
        });

        const playingMap = new Map<string, RawEvent>();
        (playingData || []).forEach((p) => {
          const e = (p as unknown as { round_robin_events: RawEvent }).round_robin_events;
          // Skip if the user is also the host (don't double-list).
          if (e && !e.voided && !hostingMap.has(e.id) && e.organizer_id !== userId) {
            playingMap.set(e.id, e);
          }
        });

        const collected: RREntry[] = [];
        hostingMap.forEach((e) =>
          collected.push({
            id: e.id,
            name: e.name,
            date: e.date,
            status: e.status,
            currentRound: e.current_round,
            numRounds: e.num_rounds,
            role: "host",
          }),
        );
        playingMap.forEach((e) =>
          collected.push({
            id: e.id,
            name: e.name,
            date: e.date,
            status: e.status,
            currentRound: e.current_round,
            numRounds: e.num_rounds,
            role: "player",
          }),
        );

        // Sort: live before draft, then by date ascending.
        collected.sort((a, b) => {
          if (a.status !== b.status) return a.status === "live" ? -1 : 1;
          return a.date.localeCompare(b.date);
        });

        setEntries(collected);
      } catch (err) {
        console.error("Failed to fetch my round robins", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <DashboardModuleSkeleton count={2} rowHeight="h-16" showHeader={false} />;
  }

  // Empty state — host + browse CTAs inline.
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card px-4 py-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Repeat className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          No round robins yet
        </p>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
          Host one with your group, or join one with an invite code.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-xs sm:max-w-none mx-auto">
          <Button
            size="sm"
            onClick={() => navigate("/round-robin/create")}
            className="gap-1.5 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
          >
            Host a Round Robin
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/player/play")}>
            Browse open events
          </Button>
        </div>
      </div>
    );
  }

  const visible = entries.slice(0, 4);

  return (
    <div className="space-y-2">
      {visible.map((entry) => {
        const statusLine =
          entry.status === "live" && entry.currentRound
            ? `Round ${entry.currentRound} of ${entry.numRounds}`
            : entry.status === "live"
              ? "Live now"
              : format(parseISO(entry.date + "T00:00:00"), "PP");

        return (
          <button
            key={entry.id}
            onClick={() => navigate(`/round-robin/${entry.id}`)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-xl border bg-card",
              entry.status === "live"
                ? "border-primary/40 bg-primary/[0.03]"
                : "border-border/60",
              "hover:bg-accent/40 hover:border-border active:scale-[0.99] transition-all text-left",
              "group",
            )}
          >
            <div className="relative flex-shrink-0">
              {/* Pulse halo — only present for live events to draw the
                  eye to the row that's actually happening right now. */}
              {entry.status === "live" && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-lg bg-primary/40 animate-ping"
                />
              )}
              <div
                className={cn(
                  "relative h-10 w-10 rounded-lg flex items-center justify-center",
                  entry.status === "live"
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Trophy className="h-5 w-5" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {entry.status === "live" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-bold tracking-wider uppercase">
                    <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                    Draft
                  </span>
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {entry.role === "host" ? "Hosting" : "Playing"}
                </span>
              </div>
              <div className="text-sm font-semibold text-foreground truncate leading-tight">
                {entry.name}
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {statusLine}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>
        );
      })}

      {entries.length > visible.length && (
        <button
          onClick={() => navigate("/player/round-robins")}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 text-center"
        >
          See all {entries.length} →
        </button>
      )}
    </div>
  );
}
