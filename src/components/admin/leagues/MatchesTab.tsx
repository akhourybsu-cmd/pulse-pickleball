import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Info } from "lucide-react";
import type {
  League, LeagueSeason, LeagueSession, LeagueTeam, LeagueMatch,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";

export function MatchesTab({ league }: { league: League }) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [sessions, setSessions] = useState<LeagueSession[]>([]);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("league_seasons" as never).select("*")
        .eq("league_id", league.id).order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as LeagueSeason[];
      setSeasons(list);
      if (list.length && !seasonId) setSeasonId(list[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [league.id]);

  useEffect(() => {
    if (!seasonId) return;
    void reload();
    // eslint-disable-next-line
  }, [seasonId]);

  const reload = async () => {
    const [{ data: sess }, { data: t }, { data: mt }] = await Promise.all([
      supabase.from("league_sessions" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_teams" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_matches" as never).select("*")
        .eq("season_id", seasonId).order("scheduled_time", { ascending: true }),
    ]);
    setSessions((sess ?? []) as unknown as LeagueSession[]);
    setTeams((t ?? []) as unknown as LeagueTeam[]);
    setMatches((mt ?? []) as unknown as LeagueMatch[]);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (seasons.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Create a season first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          League matches are placeholders — they do <strong>not</strong> affect
          PULSE Ratings. rating_status defaults to <code>not_connected</code>.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Select value={seasonId} onValueChange={setSeasonId}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={sessions.length === 0}>
              <Plus className="w-4 h-4 mr-1" />New match
            </Button>
          </DialogTrigger>
          {seasonId && sessions.length > 0 && (
            <MatchEditor
              league={league} seasonId={seasonId}
              sessions={sessions} teams={teams}
              onDone={async () => { setCreateOpen(false); await reload(); }}
            />
          )}
        </Dialog>
      </div>
      {sessions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Create a session on the Sessions tab before scheduling matches.
        </p>
      )}

      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No league matches scheduled.
        </div>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => {
            const teamA = teams.find((t) => t.id === m.team_a_id);
            const teamB = teams.find((t) => t.id === m.team_b_id);
            return (
              <li key={m.id} className="rounded-lg border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {teamA?.name ?? "TBD"} <span className="text-muted-foreground">vs</span> {teamB?.name ?? "TBD"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      {m.scheduled_time && (
                        <span>{new Date(m.scheduled_time).toLocaleString()}</span>
                      )}
                      {m.court_number && <span>Court {m.court_number}</span>}
                      <span>{m.status}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Rating: {m.rating_status.replace("_", " ")}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MatchEditor({
  league, seasonId, sessions, teams, onDone,
}: {
  league: League;
  seasonId: string;
  sessions: LeagueSession[];
  teams: LeagueTeam[];
  onDone: () => Promise<void>;
}) {
  const [sessionId, setSessionId] = useState<string>(sessions[0]?.id ?? "");
  const [courtNumber, setCourtNumber] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [teamAId, setTeamAId] = useState<string | "none">("none");
  const [teamBId, setTeamBId] = useState<string | "none">("none");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!sessionId) { toast.error("Session required"); return; }
    if (teamAId !== "none" && teamAId === teamBId) {
      toast.error("Teams must differ"); return;
    }
    setSaving(true);
    const session = sessions.find((s) => s.id === sessionId);
    const payload = {
      league_id: league.id,
      season_id: seasonId,
      division_id: session?.division_id ?? null,
      session_id: sessionId,
      court_number: courtNumber ? Number(courtNumber) : null,
      scheduled_time: scheduledTime || null,
      team_a_id: teamAId === "none" ? null : teamAId,
      team_b_id: teamBId === "none" ? null : teamBId,
      // status/rating_status take defaults: scheduled / not_connected
    };
    const { data, error } = await supabase
      .from("league_matches" as never).insert(payload as never).select().single();
    if (error || !data) { toast.error(error?.message ?? "Save failed"); setSaving(false); return; }
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: "match.created", entityType: "league_match",
      entityId: (data as unknown as LeagueMatch).id, newValue: payload,
    });
    toast.success("League match scheduled");
    setSaving(false);
    await onDone();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New league match</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Session</Label>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.scheduled_date ? ` · ${s.scheduled_date}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Court #</Label>
            <Input type="number" min="1" value={courtNumber} onChange={(e) => setCourtNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled at</Label>
            <Input type="datetime-local" value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Team A</Label>
          <Select value={teamAId} onValueChange={setTeamAId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">TBD</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Team B</Label>
          <Select value={teamBId} onValueChange={setTeamBId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">TBD</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Individual-player slots (player_a…d) and score entry will come
          later. This is a scheduling placeholder — rating engine ignores it.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Creating…" : "Schedule match"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
