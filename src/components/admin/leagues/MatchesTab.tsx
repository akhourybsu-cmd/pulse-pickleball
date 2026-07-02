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
import { Plus, Info, CalendarClock, ChevronRight, Swords } from "lucide-react";
import type {
  League, LeagueSeason, LeagueSession, LeagueTeam, LeagueMatch,
  LeagueMatchStatus, LeagueMember,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { cn } from "@/lib/utils";
import { EmptyState, TabSkeleton } from "./_shared";

interface PlayerRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

const STATUS_TONE: Record<LeagueMatchStatus, string> = {
  scheduled:       "bg-muted text-muted-foreground",
  in_progress:     "bg-primary/15 text-primary",
  score_submitted: "bg-amber-500/15 text-amber-600",
  verified:        "bg-emerald-500/15 text-emerald-500",
  disputed:        "bg-destructive/15 text-destructive",
  canceled:        "bg-slate-500/15 text-slate-500",
  forfeit:         "bg-slate-500/15 text-slate-500",
};

export function MatchesTab({ league }: { league: League }) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [sessions, setSessions] = useState<LeagueSession[]>([]);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, PlayerRow>>({});
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LeagueMatch | null>(null);

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
    const [{ data: sess }, { data: t }, { data: mt }, { data: mems }] = await Promise.all([
      supabase.from("league_sessions" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_teams" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_matches" as never).select("*")
        .eq("season_id", seasonId).order("scheduled_time", { ascending: true }),
      supabase.from("league_members" as never).select("*")
        .eq("season_id", seasonId).eq("status", "active"),
    ]);
    setSessions((sess ?? []) as unknown as LeagueSession[]);
    setTeams((t ?? []) as unknown as LeagueTeam[]);
    const matchList = (mt ?? []) as unknown as LeagueMatch[];
    setMatches(matchList);
    const memList = (mems ?? []) as unknown as LeagueMember[];
    setMembers(memList);

    // Grab profiles for any player referenced in a match slot OR in the
    // active member list (so the pickers show names, not UUIDs).
    const playerIds = new Set<string>(memList.map((m) => m.user_id));
    matchList.forEach((m) => {
      [m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id]
        .forEach((id) => id && playerIds.add(id));
    });
    if (playerIds.size) {
      const { data: profs } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name")
        .in("id", Array.from(playerIds));
      const map: Record<string, PlayerRow> = {};
      (profs ?? []).forEach((p) => { map[(p as PlayerRow).id] = p as PlayerRow; });
      setProfilesById(map);
    } else {
      setProfilesById({});
    }
  };

  if (loading) return <TabSkeleton lines={3} />;
  if (seasons.length === 0) {
    return <EmptyState title="Create a season first" desc="Matches belong to a session, which belongs to a season." />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          League matches don't touch PULSE Ratings. rating_status stays
          <code className="mx-1 px-1 rounded bg-blue-500/10 text-[10px]">not_connected</code>
          regardless of score or verification.
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
              mode="create"
              league={league} seasonId={seasonId}
              sessions={sessions} teams={teams} members={members} profilesById={profilesById}
              initial={null}
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
        <EmptyState
          icon={<Swords className="w-5 h-5" />}
          title="No league matches yet"
          desc={sessions.length > 0 ? "Schedule the first match to seed a session." : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => {
            const teamA = teams.find((t) => t.id === m.team_a_id);
            const teamB = teams.find((t) => t.id === m.team_b_id);
            const players = [m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id]
              .filter(Boolean) as string[];
            const scoreShown =
              m.team_a_score !== null && m.team_b_score !== null;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setEditing(m)}
                  className="w-full text-left rounded-lg border border-border/70 bg-card p-3 hover:bg-muted/50 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {teamA?.name ?? "TBD"}
                        <span className="text-muted-foreground mx-1.5">vs</span>
                        {teamB?.name ?? "TBD"}
                        {scoreShown && (
                          <span className="ml-2 font-mono text-sm">
                            {m.team_a_score}–{m.team_b_score}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          STATUS_TONE[m.status],
                        )}>{m.status.replace("_", " ")}</span>
                        {m.scheduled_time && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {new Date(m.scheduled_time).toLocaleString()}
                          </span>
                        )}
                        {m.court_number && <span>Court {m.court_number}</span>}
                        {players.length > 0 && <span>{players.length}/4 players set</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <MatchEditor
            mode="edit"
            league={league} seasonId={seasonId as string}
            sessions={sessions} teams={teams} members={members} profilesById={profilesById}
            initial={editing}
            onDone={async () => { setEditing(null); await reload(); }}
          />
        </Dialog>
      )}
    </div>
  );
}

/* ---------- match editor (create + edit) ---------- */

function MatchEditor({
  mode, league, seasonId, sessions, teams, members, profilesById, initial, onDone,
}: {
  mode: "create" | "edit";
  league: League;
  seasonId: string;
  sessions: LeagueSession[];
  teams: LeagueTeam[];
  members: LeagueMember[];
  profilesById: Record<string, PlayerRow>;
  initial: LeagueMatch | null;
  onDone: () => Promise<void>;
}) {
  const [sessionId, setSessionId] = useState(initial?.session_id ?? sessions[0]?.id ?? "");
  const [courtNumber, setCourtNumber] = useState(initial?.court_number?.toString() ?? "");
  const [scheduledTime, setScheduledTime] = useState(
    initial?.scheduled_time ? toLocalInput(initial.scheduled_time) : "",
  );
  const [teamAId, setTeamAId] = useState<string | "none">(initial?.team_a_id ?? "none");
  const [teamBId, setTeamBId] = useState<string | "none">(initial?.team_b_id ?? "none");
  const [playerAId, setPlayerAId] = useState<string | "none">(initial?.player_a_id ?? "none");
  const [playerBId, setPlayerBId] = useState<string | "none">(initial?.player_b_id ?? "none");
  const [playerCId, setPlayerCId] = useState<string | "none">(initial?.player_c_id ?? "none");
  const [playerDId, setPlayerDId] = useState<string | "none">(initial?.player_d_id ?? "none");
  const [status, setStatus] = useState<LeagueMatchStatus>(initial?.status ?? "scheduled");
  const [teamAScore, setTeamAScore] = useState(initial?.team_a_score?.toString() ?? "");
  const [teamBScore, setTeamBScore] = useState(initial?.team_b_score?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!sessionId) { toast.error("Session required"); return; }
    if (teamAId !== "none" && teamAId === teamBId) {
      toast.error("Team A and Team B must differ"); return;
    }
    setSaving(true);

    const session = sessions.find((s) => s.id === sessionId);
    const parseScore = (v: string): number | null => {
      if (!v.trim()) return null;
      const n = Number(v);
      return Number.isNaN(n) || n < 0 ? null : n;
    };

    const payload = {
      league_id: league.id,
      season_id: seasonId,
      division_id: session?.division_id ?? initial?.division_id ?? null,
      session_id: sessionId,
      court_number: courtNumber ? Number(courtNumber) : null,
      scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
      team_a_id: teamAId === "none" ? null : teamAId,
      team_b_id: teamBId === "none" ? null : teamBId,
      player_a_id: playerAId === "none" ? null : playerAId,
      player_b_id: playerBId === "none" ? null : playerBId,
      player_c_id: playerCId === "none" ? null : playerCId,
      player_d_id: playerDId === "none" ? null : playerDId,
      status,
      team_a_score: parseScore(teamAScore),
      team_b_score: parseScore(teamBScore),
      // rating_status intentionally not set — stays at 'not_connected' default.
    };

    const q = mode === "create"
      ? supabase.from("league_matches" as never).insert(payload as never).select().single()
      : supabase.from("league_matches" as never).update(payload as never).eq("id", initial!.id).select().single();

    const { data, error } = await q;
    if (error || !data) {
      toast.error(error?.message ?? "Save failed");
      setSaving(false);
      return;
    }
    const saved = data as unknown as LeagueMatch;
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: mode === "create" ? "match.created" : "match.updated",
      entityType: "league_match", entityId: saved.id,
      oldValue: initial ? {
        status: initial.status,
        team_a_id: initial.team_a_id, team_b_id: initial.team_b_id,
        team_a_score: initial.team_a_score, team_b_score: initial.team_b_score,
      } : null,
      newValue: payload,
    });
    toast.success(mode === "create" ? "Match scheduled" : "Match updated");
    setSaving(false);
    await onDone();
  };

  // Player pool = members with a profile we already know about.
  const playerPool = members.map((m) => ({
    id: m.user_id,
    label: profilesById[m.user_id] ? resolvePlayerName(profilesById[m.user_id]) : m.user_id.slice(0, 8),
  }));

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "New league match" : "Edit league match"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeagueMatchStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="score_submitted">Score submitted</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="forfeit">Forfeit</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

        {/* Teams */}
        <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* Individual player slots (optional) */}
        <details className="rounded-lg border border-border/70 bg-muted/30 p-3">
          <summary className="text-xs font-semibold cursor-pointer">
            Individual player slots (optional)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { label: "Player A", val: playerAId, set: setPlayerAId },
              { label: "Player B", val: playerBId, set: setPlayerBId },
              { label: "Player C", val: playerCId, set: setPlayerCId },
              { label: "Player D", val: playerDId, set: setPlayerDId },
            ].map((slot) => (
              <div key={slot.label} className="space-y-1.5">
                <Label className="text-xs">{slot.label}</Label>
                <Select value={slot.val} onValueChange={slot.set}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unset</SelectItem>
                    {playerPool.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Only active league members appear here. These slots never
            feed the rating engine.
          </p>
        </details>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Team A score</Label>
            <Input type="number" min="0" value={teamAScore}
              onChange={(e) => setTeamAScore(e.target.value)} placeholder="—" />
          </div>
          <div className="space-y-1.5">
            <Label>Team B score</Label>
            <Input type="number" min="0" value={teamBScore}
              onChange={(e) => setTeamBScore(e.target.value)} placeholder="—" />
          </div>
        </div>

        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2 text-[11px] text-blue-700 dark:text-blue-300 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Scores are for admin display only. No rating impact.</span>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Saving…" : mode === "create" ? "Schedule match" : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------- primitives ---------- */

function toLocalInput(iso: string): string {
  // datetime-local wants "YYYY-MM-DDTHH:mm" in the *local* zone. Do the
  // conversion here so re-opening an edit dialog shows the same wall-
  // clock time the admin picked.
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

