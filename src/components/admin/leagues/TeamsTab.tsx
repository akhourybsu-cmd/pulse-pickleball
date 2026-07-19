import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, ChevronRight, UsersRound, Shield, Crown } from "lucide-react";
import type {
  League, LeagueSeason, LeagueDivision, LeagueTeam, LeagueMember,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { TeamRosterDialog } from "./TeamRosterDialog";
import {
  EmptyState, TabSkeleton, LeagueTabProps,
  FormShell, FormSection, FormRow, FIELD_H, SeasonSelect,
} from "./_shared";

interface PlayerRow { id: string; display_name: string | null; full_name: string | null }

/** Team crest initials — first letters of the first two words, uppercased. */
function teamInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "T";
}

export function TeamsTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  /** count of active roster rows per team_id (for the badge on the team card) */
  const [rosterCounts, setRosterCounts] = useState<Record<string, number>>({});
  const [profilesById, setProfilesById] = useState<Record<string, PlayerRow>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [rosterFor, setRosterFor] = useState<LeagueTeam | null>(null);

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
    const [{ data: divs }, { data: t }, { data: mems }] = await Promise.all([
      supabase.from("league_divisions" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_teams" as never).select("*")
        .eq("season_id", seasonId).order("created_at", { ascending: false }),
      supabase.from("league_members" as never).select("*")
        .eq("season_id", seasonId).eq("status", "active"),
    ]);
    setDivisions((divs ?? []) as unknown as LeagueDivision[]);
    const teamList = (t ?? []) as unknown as LeagueTeam[];
    setTeams(teamList);
    const memList = (mems ?? []) as unknown as LeagueMember[];
    setMembers(memList);

    // Active roster counts — one grouped select, avoids N queries.
    if (teamList.length) {
      const { data: rows } = await supabase
        .from("league_team_members" as never)
        .select("team_id")
        .in("team_id", teamList.map((tm) => tm.id))
        .eq("status", "active");
      const counts: Record<string, number> = {};
      (rows ?? []).forEach((r) => {
        const tid = (r as { team_id: string }).team_id;
        counts[tid] = (counts[tid] ?? 0) + 1;
      });
      setRosterCounts(counts);
    } else {
      setRosterCounts({});
    }

    const captainIds = teamList
      .map((tm) => tm.captain_user_id).filter(Boolean) as string[];
    const userIds = Array.from(new Set([...captainIds, ...memList.map((m) => m.user_id)]));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name")
        .in("id", userIds);
      const map: Record<string, PlayerRow> = {};
      (profs ?? []).forEach((p) => { map[(p as PlayerRow).id] = p as PlayerRow; });
      setProfilesById(map);
    }
  };

  if (loading) return <TabSkeleton lines={3} />;
  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<UsersRound className="w-5 h-5" />}
        title="Create a season first"
        desc="Teams live inside a season."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} className="flex-1" />
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />New team</Button>
          </DialogTrigger>
          {seasonId && (
            <TeamEditor
              league={league} seasonId={seasonId}
              divisions={divisions} members={members} profilesById={profilesById}
              onDone={async () => { setCreateOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="w-5 h-5" />}
          title="No teams yet"
          desc="Group members into teams for scheduling and standings."
          action={{ label: "New team", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => {
            const captain = t.captain_user_id ? profilesById[t.captain_user_id] : null;
            const division = divisions.find((d) => d.id === t.division_id);
            const rosterCount = rosterCounts[t.id] ?? 0;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setRosterFor(t)}
                  className="group w-full text-left rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Team crest */}
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-1 ring-inset ring-amber-500/25 flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-amber-600 dark:text-amber-500">
                        {teamInitials(t.name)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold truncate">{t.name}</span>
                        {t.status === "archived" && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {captain ? (
                          <span className="inline-flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-500" />
                            {resolvePlayerName(captain)}
                          </span>
                        ) : (
                          <span>No captain</span>
                        )}
                        {division && (<><span>·</span><span>{division.name}</span></>)}
                      </div>
                    </div>
                    {/* Roster stat */}
                    <div className="text-center shrink-0 px-1.5">
                      <div className="text-lg font-black tabular-nums leading-none">{rosterCount}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        player{rosterCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rosterFor && (
        <TeamRosterDialog
          open={!!rosterFor}
          onOpenChange={(o) => !o && setRosterFor(null)}
          league={league}
          team={rosterFor}
          eligibleMembers={members}
          profilesById={profilesById}
          onChanged={async () => { await reload(); onMutated(); }}
        />
      )}
    </div>
  );
}

function TeamEditor({
  league, seasonId, divisions, members, profilesById, onDone,
}: {
  league: League;
  seasonId: string;
  divisions: LeagueDivision[];
  members: LeagueMember[];
  profilesById: Record<string, PlayerRow>;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [captainId, setCaptainId] = useState<string | "none">("none");
  const [divisionId, setDivisionId] = useState<string | "none">("none");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      league_id: league.id,
      season_id: seasonId,
      division_id: divisionId === "none" ? null : divisionId,
      name: name.trim(),
      captain_user_id: captainId === "none" ? null : captainId,
    };
    const { data, error } = await supabase
      .from("league_teams" as never).insert(payload as never).select().single();
    if (error || !data) { toast.error(error?.message ?? "Save failed"); setSaving(false); return; }
    const team = data as unknown as LeagueTeam;
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: "team.created", entityType: "team",
      entityId: team.id, newValue: payload,
    });

    // If a captain was picked, seed them as an active team member so the
    // roster isn't empty on day one and role/captain stay consistent.
    if (captainId !== "none") {
      const rosterPayload = {
        team_id: team.id,
        user_id: captainId,
        role: "captain" as const,
      };
      await supabase.from("league_team_members" as never).insert(rosterPayload as never);
      await logLeagueAction({
        leagueId: league.id, seasonId,
        action: "team_member.added", entityType: "team_member",
        entityId: null, newValue: rosterPayload,
      });
    }

    toast.success("Team created");
    setSaving(false);
    await onDone();
  };

  return (
    <FormShell
      icon={<Shield className="w-5 h-5" />}
      tone="amber"
      kicker="New team"
      title="New team"
      subtitle="Group active members for scheduling and standings. Add more players from the team card after."
      primaryLabel="Create team"
      primaryLoading={saving}
      primaryDisabled={!name.trim()}
      onPrimary={submit}
    >
      <FormSection label="Identity">
        <FormRow label="Team name" required>
          <Input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Team A" className={FIELD_H}
          />
        </FormRow>
        <FormRow
          label="Division"
          hint={divisions.length === 0
            ? "No divisions yet — you can assign this later."
            : undefined}
        >
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No division</SelectItem>
              {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormRow>
      </FormSection>

      <FormSection label="Leadership">
        <FormRow
          label="Captain"
          hint={members.length === 0
            ? "No active league members yet — add them on the Members tab first."
            : "Auto-added to the roster with the captain role."}
        >
          <Select value={captainId} onValueChange={setCaptainId}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No captain</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {profilesById[m.user_id]
                    ? resolvePlayerName(profilesById[m.user_id])
                    : m.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
      </FormSection>
    </FormShell>
  );
}
