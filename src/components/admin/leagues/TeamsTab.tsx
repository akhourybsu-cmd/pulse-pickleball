import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type {
  League, LeagueSeason, LeagueDivision, LeagueTeam, LeagueMember,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";

interface PlayerRow { id: string; display_name: string | null; full_name: string | null }

export function TeamsTab({ league }: { league: League }) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, PlayerRow>>({});
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
    const [{ data: divs }, { data: t }, { data: mems }] = await Promise.all([
      supabase.from("league_divisions" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_teams" as never).select("*")
        .eq("season_id", seasonId).order("created_at", { ascending: false }),
      supabase.from("league_members" as never).select("*")
        .eq("season_id", seasonId).eq("status", "active"),
    ]);
    setDivisions((divs ?? []) as unknown as LeagueDivision[]);
    setTeams((t ?? []) as unknown as LeagueTeam[]);
    const memList = (mems ?? []) as unknown as LeagueMember[];
    setMembers(memList);
    const captainIds = ((t ?? []) as unknown as LeagueTeam[])
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
      <div className="flex items-center gap-2">
        <Select value={seasonId} onValueChange={setSeasonId}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />New team</Button>
          </DialogTrigger>
          {seasonId && (
            <TeamEditor
              league={league} seasonId={seasonId}
              divisions={divisions} members={members} profilesById={profilesById}
              onDone={async () => { setCreateOpen(false); await reload(); }}
            />
          )}
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No teams yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => {
            const captain = t.captain_user_id ? profilesById[t.captain_user_id] : null;
            const division = divisions.find((d) => d.id === t.division_id);
            return (
              <li key={t.id} className="rounded-lg border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {captain ? `Captain: ${resolvePlayerName(captain)}` : "No captain assigned"}
                      {division && ` · ${division.name}`}
                      {t.status === "archived" && " · archived"}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: "team.created", entityType: "team",
      entityId: (data as unknown as LeagueTeam).id, newValue: payload,
    });
    toast.success("Team created");
    setSaving(false);
    await onDone();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New team</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Team name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team A" />
        </div>
        <div className="space-y-1.5">
          <Label>Division</Label>
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No division</SelectItem>
              {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Captain (from league members)</Label>
          <Select value={captainId} onValueChange={setCaptainId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
        </div>
        <p className="text-[11px] text-muted-foreground">
          Team roster (adding/removing players) will be part of the next batch.
          For now, teams hold a name + captain + division.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Creating…" : "Create team"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
