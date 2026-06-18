import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Plus, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface RR {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  num_courts: number;
  max_players: number | null;
  status: string;
  group_visibility: string;
  player_count?: number;
}

interface Props {
  groupId: string;
  isAdmin: boolean;
}

export function GroupRoundRobinsRail({ groupId, isAdmin }: Props) {
  const navigate = useNavigate();
  const [rrs, setRrs] = useState<RR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("round_robin_events")
        .select(
          "id, name, date, start_time, num_courts, max_players, status, group_visibility"
        )
        .eq("group_id", groupId)
        .gte("date", today)
        .neq("status", "completed")
        .order("date", { ascending: true })
        .limit(8);

      if (cancelled) return;
      const events = (data || []) as RR[];

      if (events.length > 0) {
        const { data: players } = await supabase
          .from("round_robin_players")
          .select("event_id")
          .in(
            "event_id",
            events.map((e) => e.id)
          )
          .eq("active", true);
        const counts = new Map<string, number>();
        (players || []).forEach((p: any) =>
          counts.set(p.event_id, (counts.get(p.event_id) || 0) + 1)
        );
        events.forEach((e) => (e.player_count = counts.get(e.id) || 0));
      }

      if (!cancelled) {
        setRrs(events);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (loading) return null;
  if (rrs.length === 0 && !isAdmin) return null;

  return (
    <div className="mb-4 rounded-xl border border-border/40 bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Upcoming Round Robins</h3>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() =>
              navigate(`/round-robin/create?groupId=${groupId}`)
            }
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        )}
      </div>

      {rrs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No upcoming events. {isAdmin && "Create one to invite the group."}
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {rrs.map((rr) => (
            <button
              key={rr.id}
              onClick={() => navigate(`/round-robin/${rr.id}`)}
              className="shrink-0 w-[200px] text-left p-3 rounded-lg border border-border/40 bg-background hover:border-primary/40 transition-colors"
            >
              <p className="text-xs font-semibold truncate">{rr.name}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(rr.date), "EEE, MMM d")}
                {rr.start_time ? ` · ${rr.start_time.slice(0, 5)}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Users className="h-3 w-3" />
                {rr.player_count || 0}
                {rr.max_players ? ` / ${rr.max_players}` : ""} players
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
