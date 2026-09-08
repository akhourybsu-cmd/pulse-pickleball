import { useLeagueWorkspace } from '@/hooks/useLeagueWorkspace';
import { useLeagueSeasons } from '@/hooks/useLeagueSeasons';
import { leagueErrorMessage } from '@/lib/leagues/data';
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, ChevronRight, UsersRound, Shield } from "lucide-react";
import type {
  League, LeagueSeason, LeagueTeam, LeagueMember,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
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
  const { seasons, seasonId, setSeasonId, loading: seasonsLoading, error: seasonsError, retry } = useLeagueSeasons(league.id, dataVersion);
  const { teams, members, profilesById, rosterCounts, loading: rowsLoading, error: rowsError, reload } = useLeagueWorkspace(league.id, seasonId, dataVersion, ['teams', 'members', 'rosters']);
  const loading = seasonsLoading || rowsLoading;
  const error = seasonsError ?? rowsError;
  /** count of active roster rows per team_id (for the badge on the team card) */

  const [createOpen, setCreateOpen] = useState(false);
  const [rosterFor, setRosterFor] = useState<LeagueTeam | null>(null);



  if (error) return <EmptyState title="Couldn't load this season" desc={leagueErrorMessage(error)} action={{ label: 'Try again', onClick: () => { void retry(); void reload(); } }} />;
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} className="flex-1" />
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-11 px-4 shrink-0 font-bold"><Plus className="w-4 h-4 mr-1.5" />New team</Button>
          </DialogTrigger>
          {createOpen && seasonId && (
            <TeamEditor
              league={league} seasonId={seasonId}
              members={members.filter(m => m.status === 'active')} profilesById={profilesById}
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
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5" />
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
          eligibleMembers={members.filter(m => m.status === 'active')}
          profilesById={profilesById}
          onChanged={async () => { await reload(); onMutated(); }}
        />
      )}
    </div>
  );
}

function TeamEditor({
  league, seasonId, members, profilesById, onDone,
}: {
  league: League;
  seasonId: string;
  members: LeagueMember[];
  profilesById: Record<string, PlayerRow>;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      league_id: league.id,
      season_id: seasonId,
      name: name.trim(),
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
      </FormSection>
    </FormShell>
  );
}
