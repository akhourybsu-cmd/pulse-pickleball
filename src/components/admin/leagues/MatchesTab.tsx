import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Info, CalendarClock, ChevronRight, Swords, ShieldAlert,
  Gavel, Flag, Check,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import type {
  League, LeagueSeason, LeagueSession, LeagueTeam, LeagueMatch,
  LeagueMatchStatus, LeagueMember,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { sideName } from "@/lib/leagues/matchSides";
import { cn } from "@/lib/utils";
import {
  EmptyState, TabSkeleton, LeagueTabProps,
  FormShell, FormSection, FormRow, FIELD_H, SeasonSelect,
} from "./_shared";

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

export function MatchesTab({ league, dataVersion, onMutated }: LeagueTabProps) {
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
  }, [league.id, dataVersion]);

  useEffect(() => {
    if (!seasonId) return;
    void reload();
    // eslint-disable-next-line
  }, [seasonId, dataVersion]);

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
        <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} className="flex-1" />
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
              onDone={async () => { setCreateOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
      </div>
      {sessions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Create a session on the Sessions tab before scheduling matches.
        </p>
      )}

      {/* Disputed matches need admin attention. Bright red-tinted banner
          + a jump link that scrolls to the first disputed row. */}
      {matches.filter((m) => m.status === "disputed").length > 0 && (
        <button
          type="button"
          onClick={() => {
            const first = matches.find((m) => m.status === "disputed");
            if (first) setEditing(first);
          }}
          className="w-full flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-left hover:bg-destructive/10 transition-colors"
        >
          <div className="h-9 w-9 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-destructive">
              {matches.filter((m) => m.status === "disputed").length} disputed match{matches.filter((m) => m.status === "disputed").length === 1 ? "" : "es"} need review
            </div>
            <div className="text-[11px] text-destructive/80 mt-0.5">
              Tap to open the first one and resolve
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-destructive shrink-0" />
        </button>
      )}

      {matches.length === 0 ? (
        <EmptyState
          icon={<Swords className="w-5 h-5" />}
          title="No league matches yet"
          desc={sessions.length > 0 ? "Schedule the first match to seed a session." : undefined}
        />
      ) : (
        <ul className="space-y-2.5">
          {matches.map((m) => {
            const teamA = teams.find((t) => t.id === m.team_a_id);
            const teamB = teams.find((t) => t.id === m.team_b_id);
            const nameOf = (id: string | null): string | null =>
              id ? (profilesById[id] ? resolvePlayerName(profilesById[id]) : null) : null;
            // Prefer team name; fall back to the individual player names so
            // matchups read as people, not "TBD".
            const aName = sideName(teamA?.name ?? null, [nameOf(m.player_a_id), nameOf(m.player_b_id)]);
            const bName = sideName(teamB?.name ?? null, [nameOf(m.player_c_id), nameOf(m.player_d_id)]);
            const scoreShown =
              m.team_a_score !== null && m.team_b_score !== null;
            const aWon = scoreShown && (m.team_a_score ?? 0) > (m.team_b_score ?? 0);
            const bWon = scoreShown && (m.team_b_score ?? 0) > (m.team_a_score ?? 0);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setEditing(m)}
                  className="group w-full text-left rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Top meta strip */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/50">
                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                      <span className={cn(
                        "font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        STATUS_TONE[m.status],
                      )}>{m.status.replace("_", " ")}</span>
                      {m.scheduled_time && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {new Date(m.scheduled_time).toLocaleString(undefined, {
                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          })}
                        </span>
                      )}
                      {m.court_number && <span>· Court {m.court_number}</span>}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                  </div>

                  {/* Scoreboard row */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3.5">
                    <TeamCell name={aName} won={aWon} align="right" />
                    <div className="flex items-center gap-2 font-black tabular-nums">
                      {scoreShown ? (
                        <>
                          <span className={cn(
                            "text-2xl leading-none",
                            aWon ? "text-primary" : "text-muted-foreground",
                          )}>{m.team_a_score}</span>
                          <span className="text-muted-foreground text-sm font-bold">–</span>
                          <span className={cn(
                            "text-2xl leading-none",
                            bWon ? "text-primary" : "text-muted-foreground",
                          )}>{m.team_b_score}</span>
                        </>
                      ) : (
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                          vs
                        </span>
                      )}
                    </div>
                    <TeamCell name={bName} won={bWon} align="left" />
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
            onDone={async () => { setEditing(null); await reload(); onMutated(); }}
          />
        </Dialog>
      )}
    </div>
  );
}

/**
 * Team name cell for the scoreboard-style match card. Winner text is
 * bolder + primary-colored; loser is muted.
 */
function TeamCell({
  name, won, align,
}: {
  name: string;
  won: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0", align === "right" ? "text-right" : "text-left")}>
      <div className={cn(
        "text-sm font-semibold truncate",
        won && "text-primary font-bold",
      )}>
        {name}
      </div>
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
  const [resolveOpen, setResolveOpen] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [sessionId, setSessionId] = useState(initial?.session_id ?? sessions[0]?.id ?? "");
  const [courtNumber, setCourtNumber] = useState(initial?.court_number?.toString() ?? "");
  const [scheduledTime, setScheduledTime] = useState(
    initial?.scheduled_time ? toLocalInput(initial.scheduled_time) : "",
  );
  const [teamAId, setTeamAId] = useState<string | "none">(initial?.team_a_id ?? "none");
  const [teamBId, setTeamBId] = useState<string | "none">(initial?.team_b_id ?? "none");
  // Individual players are the default; teams are opt-in. Start "on" only
  // if this match already carries teams.
  const [useTeams, setUseTeams] = useState<boolean>(
    !!(initial?.team_a_id || initial?.team_b_id),
  );
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
    if (useTeams && teamAId !== "none" && teamAId === teamBId) {
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
      team_a_id: useTeams && teamAId !== "none" ? teamAId : null,
      team_b_id: useTeams && teamBId !== "none" ? teamBId : null,
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

  // Live side names for the scoreboard: team name when teams are on,
  // otherwise the picked player names, otherwise a "Side A/B" placeholder.
  const nameOf = (id: string | "none"): string | null => {
    if (!id || id === "none") return null;
    if (profilesById[id]) return resolvePlayerName(profilesById[id]);
    return playerPool.find((p) => p.id === id)?.label ?? null;
  };
  const sideAName = sideName(
    useTeams && teamAId !== "none" ? teams.find((t) => t.id === teamAId)?.name : null,
    [nameOf(playerAId), nameOf(playerBId)],
    "Side A",
  );
  const sideBName = sideName(
    useTeams && teamBId !== "none" ? teams.find((t) => t.id === teamBId)?.name : null,
    [nameOf(playerCId), nameOf(playerDId)],
    "Side B",
  );
  const showAdminActions = mode === "edit" && initial && (
    initial.status === "disputed" || initial.status === "score_submitted"
    || initial.status === "scheduled" || initial.status === "in_progress"
  );

  return (
    <>
      <FormShell
        icon={<Swords className="w-5 h-5" />}
        tone="primary"
        size="lg"
        kicker={mode === "create" ? "New matchup" : "Matchup"}
        title={mode === "create" ? "Schedule a match" : "Edit match"}
        subtitle="Scores feed standings only — league play never touches PULSE Ratings."
        primaryLabel={mode === "create" ? "Schedule match" : "Save changes"}
        primaryLoading={saving}
        onPrimary={submit}
      >
        <FormSection label="When & where">
          <FormRow label="Session">
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.scheduled_date ? ` · ${s.scheduled_date}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Court #">
              <Input type="number" min="1" value={courtNumber}
                onChange={(e) => setCourtNumber(e.target.value)} className={FIELD_H} />
            </FormRow>
            <FormRow label="Scheduled at">
              <Input type="datetime-local" value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)} className={FIELD_H} />
            </FormRow>
          </div>
        </FormSection>

        <FormSection label="Matchup">
          {/* Individual players are the default line-up. Flip this on only
              if you run this league with named teams. */}
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
            <div className="min-w-0">
              <div className="text-xs font-semibold">Use team names</div>
              <div className="text-[11px] text-muted-foreground">
                Off — the matchup shows individual player names
              </div>
            </div>
            <Switch checked={useTeams} onCheckedChange={setUseTeams} />
          </label>

          {useTeams && (
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Team A">
                <Select value={teamAId} onValueChange={setTeamAId}>
                  <SelectTrigger className={FIELD_H}><SelectValue placeholder="Pick team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Team B">
                <Select value={teamBId} onValueChange={setTeamBId}>
                  <SelectTrigger className={FIELD_H}><SelectValue placeholder="Pick team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormRow>
            </div>
          )}

          {/* Player line-ups — the default input */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Side A", slots: [
                { val: playerAId, set: setPlayerAId },
                { val: playerBId, set: setPlayerBId },
              ] },
              { label: "Side B", slots: [
                { val: playerCId, set: setPlayerCId },
                { val: playerDId, set: setPlayerDId },
              ] },
            ] as const).map((side) => (
              <div key={side.label} className="rounded-lg border border-border/60 bg-card p-2.5 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {side.label}
                </div>
                {side.slots.map((slot, i) => (
                  <Select key={i} value={slot.val} onValueChange={slot.set}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Add player" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Empty</SelectItem>
                      {playerPool.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            One player per side for singles, two for doubles. Only active
            league members appear.
          </p>

          {/* Broadcast-style scoreboard score entry */}
          <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/50 to-muted/10 p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="text-center min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate mb-1">
                  {sideAName}
                </div>
                <Input type="number" min="0" inputMode="numeric" value={teamAScore}
                  onChange={(e) => setTeamAScore(e.target.value)} placeholder="—"
                  className="h-14 text-center text-3xl font-black tabular-nums" />
              </div>
              <div className="text-2xl font-black text-muted-foreground pb-4">–</div>
              <div className="text-center min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate mb-1">
                  {sideBName}
                </div>
                <Input type="number" min="0" inputMode="numeric" value={teamBScore}
                  onChange={(e) => setTeamBScore(e.target.value)} placeholder="—"
                  className="h-14 text-center text-3xl font-black tabular-nums" />
              </div>
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              Leave blank until the match is played.
            </p>
          </div>
        </FormSection>

        <FormSection label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as LeagueMatchStatus)}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
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
        </FormSection>

        {/* Admin escape hatches — kept out of the footer so an accidental
            tap can't nuke a match. */}
        {showAdminActions && initial && (
          <FormSection label="Admin actions">
            <div className="flex items-center gap-2">
              {(initial.status === "disputed" || initial.status === "score_submitted") && (
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setResolveOpen(true)}
                  className="flex-1 h-10 border-destructive/40 text-destructive hover:bg-destructive/5"
                >
                  <Gavel className="w-3.5 h-3.5 mr-1.5" />
                  Resolve dispute
                </Button>
              )}
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setForfeitOpen(true)}
                className="flex-1 h-10 text-muted-foreground hover:text-foreground"
              >
                <Flag className="w-3.5 h-3.5 mr-1.5" />
                Mark forfeit
              </Button>
            </div>
          </FormSection>
        )}
      </FormShell>

      {mode === "edit" && initial && (
        <>
          <ResolveDisputeDialog
            open={resolveOpen}
            onOpenChange={setResolveOpen}
            match={initial}
            teams={teams}
            onDone={async () => { setResolveOpen(false); await onDone(); }}
          />
          <ForfeitMatchDialog
            open={forfeitOpen}
            onOpenChange={setForfeitOpen}
            match={initial}
            teams={teams}
            onDone={async () => { setForfeitOpen(false); await onDone(); }}
          />
        </>
      )}
    </>
  );
}

/* ---------- admin action dialogs ---------- */

/**
 * Admin-only. Overrides the disputed match with a canonical score and
 * flips status directly to 'verified' via the resolve_league_match_dispute
 * RPC. Shows the player-submitted dispute reason as read-only context.
 */
function ResolveDisputeDialog({
  open, onOpenChange, match, teams, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  match: LeagueMatch;
  teams: LeagueTeam[];
  onDone: () => void | Promise<void>;
}) {
  const [aScore, setAScore] = useState(
    match.team_a_score !== null ? String(match.team_a_score) : "",
  );
  const [bScore, setBScore] = useState(
    match.team_b_score !== null ? String(match.team_b_score) : "",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const teamAName = teams.find((t) => t.id === match.team_a_id)?.name ?? "Team A";
  const teamBName = teams.find((t) => t.id === match.team_b_id)?.name ?? "Team B";

  const submit = async () => {
    const a = Number(aScore);
    const b = Number(bScore);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      toast.error("Enter non-negative whole numbers"); return;
    }
    if (a === b) { toast.error("Scores can't be tied"); return; }
    setSaving(true);
    const { error } = await supabase.rpc(
      "resolve_league_match_dispute" as never,
      {
        p_match_id: match.id,
        p_team_a_score: a,
        p_team_b_score: b,
        p_note: note.trim() || null,
      } as never,
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Dispute resolved — match is now verified");
    await onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormShell
        icon={<Gavel className="w-5 h-5" />}
        tone="amber"
        kicker="Dispute"
        title="Resolve dispute"
        subtitle="Set the official score — this verifies the match."
        primaryLabel="Verify score"
        primaryLoading={saving}
        onPrimary={submit}
        secondary={
          <Button variant="ghost" className="h-12"
            onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
        }
      >
        {match.dispute_reason && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <div className="font-semibold text-destructive mb-1 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Player reason
            </div>
            <div className="italic text-destructive/90">
              "{match.dispute_reason}"
            </div>
          </div>
        )}
        <FormSection label="Final score">
          <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/50 to-muted/10 p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="text-center min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate mb-1">
                  {teamAName}
                </div>
                <Input type="number" min={0} inputMode="numeric" value={aScore}
                  onChange={(e) => setAScore(e.target.value)}
                  className="h-14 text-center text-3xl font-black tabular-nums" />
              </div>
              <div className="text-2xl font-black text-muted-foreground pb-4">–</div>
              <div className="text-center min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate mb-1">
                  {teamBName}
                </div>
                <Input type="number" min={0} inputMode="numeric" value={bScore}
                  onChange={(e) => setBScore(e.target.value)}
                  className="h-14 text-center text-3xl font-black tabular-nums" />
              </div>
            </div>
          </div>
        </FormSection>
        <FormRow label="Resolution note (optional)" hint="Kept in the audit log.">
          <Textarea rows={2} value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., 'confirmed via kiosk photo'" />
        </FormRow>
      </FormShell>
    </Dialog>
  );
}

/**
 * Admin-only from this surface — captains use the player-side action
 * we'll wire in LeagueMatchActions. Records which team gets the win
 * via forfeit_winner_team_id.
 */
function ForfeitMatchDialog({
  open, onOpenChange, match, teams, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  match: LeagueMatch;
  teams: LeagueTeam[];
  onDone: () => void | Promise<void>;
}) {
  const [winnerId, setWinnerId] = useState<string>(match.team_a_id ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const teamAName = teams.find((t) => t.id === match.team_a_id)?.name ?? "Team A";
  const teamBName = teams.find((t) => t.id === match.team_b_id)?.name ?? "Team B";

  const submit = async () => {
    if (!match.team_a_id || !match.team_b_id) {
      toast.error("Both teams must be set before recording a forfeit"); return;
    }
    if (!winnerId) { toast.error("Pick the winning team"); return; }
    setSaving(true);
    const { error } = await supabase.rpc(
      "forfeit_league_match" as never,
      {
        p_match_id: match.id,
        p_winner_team_id: winnerId,
        p_reason: reason.trim() || null,
      } as never,
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Match recorded as forfeit");
    await onDone();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-amber-600" />
            Mark match as forfeit
          </AlertDialogTitle>
          <AlertDialogDescription>
            The winning team gets a W in standings. Any submitted scores
            are cleared — the forfeit is the source of truth. This can
            be undone by editing the raw row.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Winning team</Label>
            <Select value={winnerId} onValueChange={setWinnerId}>
              <SelectTrigger><SelectValue placeholder="Pick a team" /></SelectTrigger>
              <SelectContent>
                {match.team_a_id && (
                  <SelectItem value={match.team_a_id}>{teamAName}</SelectItem>
                )}
                {match.team_b_id && (
                  <SelectItem value={match.team_b_id}>{teamBName}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea rows={2} value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., 'no-show', 'season withdrawal', 'medical'" />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={submit} disabled={saving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {saving ? "Saving…" : "Record forfeit"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

