import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ChevronRight, Repeat, Trophy, ListChecks, History as HistoryIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlayerPageHeader } from "@/components/layout/PlayerPageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Status = "draft" | "live" | "completed" | "voided";
type Role = "host" | "player";

interface RREntry {
  id: string;
  name: string;
  date: string;
  status: Status;
  voided: boolean;
  currentRound: number | null;
  numRounds: number;
  role: Role;
}

interface RawEvent {
  id: string;
  name: string;
  date: string;
  status: Status;
  voided?: boolean | null;
  current_round: number | null;
  num_rounds: number;
  organizer_id?: string;
}

/**
 * /player/round-robins — the full history surface for the user.
 *
 * Lists every Round Robin the player is involved in (either as host or
 * confirmed participant), grouped into Active and Past. Replaces the
 * public RoundRobinHub link that the dashboard's "Browse all" used to
 * point at — keeps the player inside their own player path instead of
 * dumping them into a catch-all surface.
 *
 * Active   = status IN ('draft','live')
 * Past     = status IN ('completed','voided')
 *
 * Both groups sorted: live > draft, then date asc for Active;
 * date desc for Past (most recent completion first).
 */
export default function MyRoundRobinsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<RREntry[]>([]);
  const [tab, setTab] = useState<"active" | "past">("active");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Hosting — all statuses, including voided so the host can
        // see the history of their cancellations.
        const { data: hostingData } = await supabase
          .from("round_robin_events")
          .select("id, name, date, status, voided, current_round, num_rounds")
          .eq("organizer_id", user.id)
          .order("date", { ascending: false });

        // Playing — every event the user is registered for.
        const { data: playingData } = await supabase
          .from("round_robin_players")
          .select(
            `event_id,
             round_robin_events!inner (
               id, name, date, status, voided, current_round, num_rounds,
               organizer_id
             )`,
          )
          .eq("player_id", user.id)
          .eq("active", true);

        if (cancelled) return;

        const hostingMap = new Map<string, RawEvent>();
        (hostingData || []).forEach((e) => hostingMap.set(e.id, e as RawEvent));

        const playingMap = new Map<string, RawEvent>();
        (playingData || []).forEach((p) => {
          const e = (p as unknown as { round_robin_events: RawEvent }).round_robin_events;
          if (e && !hostingMap.has(e.id) && e.organizer_id !== user.id) {
            playingMap.set(e.id, e);
          }
        });

        const all: RREntry[] = [];
        hostingMap.forEach((e) =>
          all.push({
            id: e.id,
            name: e.name,
            date: e.date,
            status: e.status,
            voided: !!e.voided,
            currentRound: e.current_round,
            numRounds: e.num_rounds,
            role: "host",
          }),
        );
        playingMap.forEach((e) =>
          all.push({
            id: e.id,
            name: e.name,
            date: e.date,
            status: e.status,
            voided: !!e.voided,
            currentRound: e.current_round,
            numRounds: e.num_rounds,
            role: "player",
          }),
        );

        setEntries(all);
      } catch (err) {
        console.error("Failed to fetch round-robin history", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = entries
    .filter((e) => e.status === "draft" || e.status === "live")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "live" ? -1 : 1;
      return a.date.localeCompare(b.date);
    });

  const past = entries
    .filter((e) => e.status === "completed" || e.status === "voided")
    .sort((a, b) => b.date.localeCompare(a.date));

  const visible = tab === "active" ? active : past;

  return (
    <div className="min-h-screen bg-background">
      <PlayerPageHeader
        icon={Repeat}
        title="My Round Robins"
        subtitle="Every event you're hosting or playing in — past, present, and upcoming."
        background="gradient"
        action={
          <Button
            size="sm"
            onClick={() => navigate("/round-robin/create")}
            className="gap-1.5 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
          >
            <span className="hidden sm:inline">Host one</span>
            <span className="sm:hidden">+ Host</span>
          </Button>
        }
      />

      <main className="container max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Tab toggle — sliding underline matches MatchHistory's pattern. */}
        <TabToggle
          tab={tab}
          onChange={setTab}
          activeCount={active.length}
          pastCount={past.length}
        />

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState tab={tab} onHost={() => navigate("/round-robin/create")} />
        ) : (
          <div className="space-y-2 animate-fade-up">
            {visible.map((entry) => (
              <RREventRow
                key={entry.id}
                entry={entry}
                onClick={() => navigate(`/round-robin/${entry.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

interface TabToggleProps {
  tab: "active" | "past";
  onChange: (t: "active" | "past") => void;
  activeCount: number;
  pastCount: number;
}

function TabToggle({ tab, onChange, activeCount, pastCount }: TabToggleProps) {
  const items: { id: "active" | "past"; label: string; count: number; icon: typeof ListChecks }[] = [
    { id: "active", label: "Active", count: activeCount, icon: ListChecks },
    { id: "past", label: "Past", count: pastCount, icon: HistoryIcon },
  ];

  return (
    <div className="relative border-b border-border/40 max-w-md">
      <div className="flex">
        {items.map((it) => {
          const isActive = tab === it.id;
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onChange(it.id)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{it.label}</span>
              {it.count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold tabular-nums",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        className="absolute bottom-0 h-[2px] bg-primary rounded-full transition-all duration-[240ms] ease-out"
        style={{
          width: "50%",
          left: tab === "active" ? "0%" : "50%",
        }}
      />
    </div>
  );
}

function RREventRow({ entry, onClick }: { entry: RREntry; onClick: () => void }) {
  const statusLine = (() => {
    if (entry.status === "live" && entry.currentRound) {
      return `Round ${entry.currentRound} of ${entry.numRounds}`;
    }
    if (entry.status === "completed") {
      return `Completed · ${format(parseISO(entry.date + "T00:00:00"), "PP")}`;
    }
    if (entry.status === "voided") {
      return `Voided · ${format(parseISO(entry.date + "T00:00:00"), "PP")}`;
    }
    return format(parseISO(entry.date + "T00:00:00"), "PP");
  })();

  const tileTone =
    entry.status === "live"
      ? "bg-primary text-primary-foreground"
      : entry.status === "voided"
        ? "bg-muted text-muted-foreground"
        : "bg-primary/10 text-primary";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-border/60 bg-card",
        "hover:bg-accent/40 hover:border-border active:scale-[0.99] transition-all text-left group",
        entry.status === "voided" && "opacity-75",
      )}
    >
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", tileTone)}>
        <Trophy className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <StatusBadge status={entry.status} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {entry.role === "host" ? "Hosting" : "Playing"}
          </span>
        </div>
        <div className="text-sm font-semibold text-foreground truncate leading-tight">{entry.name}</div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{statusLine}</div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-bold tracking-wider uppercase">
        <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
        Live
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-foreground/90 text-background text-[9px] font-bold tracking-wider uppercase">
        Done
      </span>
    );
  }
  if (status === "voided") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[9px] font-bold tracking-wider uppercase">
        Voided
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
      Draft
    </span>
  );
}

function EmptyState({ tab, onHost }: { tab: "active" | "past"; onHost: () => void }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-6 py-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        {tab === "active" ? (
          <Repeat className="h-6 w-6 text-primary" />
        ) : (
          <HistoryIcon className="h-6 w-6 text-primary" />
        )}
      </div>
      <p className="text-sm font-medium text-foreground mb-1">
        {tab === "active" ? "No active round robins" : "No past round robins yet"}
      </p>
      <p className="text-xs text-muted-foreground mb-5 max-w-sm mx-auto">
        {tab === "active"
          ? "Host one with your group, or join one with an invite code from your group's organizer."
          : "Completed and cancelled events will appear here once you've played in one."}
      </p>
      {tab === "active" && (
        <Button
          size="sm"
          onClick={onHost}
          className="gap-1.5 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
        >
          Host a Round Robin
        </Button>
      )}
    </div>
  );
}
