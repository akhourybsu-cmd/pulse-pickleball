import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPlus, UserX, Crown } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  League, LeagueTeam, LeagueTeamMember, LeagueMember, TeamMemberRole,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";

interface PlayerRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  league: League;
  team: LeagueTeam;
  /** Active league members for the same season — eligible to be added to the team. */
  eligibleMembers: LeagueMember[];
  profilesById: Record<string, PlayerRow>;
  /** Called after any successful mutation so the parent list can reload. */
  onChanged: () => Promise<void> | void;
}

export function TeamRosterDialog({
  open, onOpenChange, league, team, eligibleMembers, profilesById, onChanged,
}: Props) {
  const [roster, setRoster] = useState<LeagueTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ member: LeagueTeamMember; name: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("league_team_members" as never)
      .select("*")
      .eq("team_id", team.id)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setRoster((data ?? []) as unknown as LeagueTeamMember[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, team.id]);

  const rosterUserIds = useMemo(
    () => new Set(roster.filter((r) => r.status === "active").map((r) => r.user_id)),
    [roster],
  );

  const addable = useMemo(
    () => eligibleMembers.filter((m) => !rosterUserIds.has(m.user_id)),
    [eligibleMembers, rosterUserIds],
  );

  const addMember = async (userId: string) => {
    setBusy(true);
    const payload = { team_id: team.id, user_id: userId, role: "player" as TeamMemberRole };
    const { data, error } = await supabase
      .from("league_team_members" as never).insert(payload as never).select().single();
    if (error || !data) {
      toast.error(error?.message ?? "Add failed");
      setBusy(false);
      return;
    }
    await logLeagueAction({
      leagueId: league.id, seasonId: team.season_id,
      action: "team_member.added", entityType: "team_member",
      entityId: (data as unknown as LeagueTeamMember).id,
      newValue: payload,
    });
    toast.success("Added to team");
    await load();
    await onChanged();
    setBusy(false);
  };

  const patch = async (
    member: LeagueTeamMember,
    fields: Partial<LeagueTeamMember>,
    action: string,
  ) => {
    setBusy(true);
    const { error } = await supabase
      .from("league_team_members" as never)
      .update(fields as never).eq("id", member.id);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await logLeagueAction({
      leagueId: league.id, seasonId: team.season_id,
      action, entityType: "team_member", entityId: member.id,
      oldValue: { role: member.role, status: member.status },
      newValue: fields,
    });
    await load();
    await onChanged();
    setBusy(false);
  };

  const promoteCaptain = async (userId: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("league_teams" as never)
      .update({ captain_user_id: userId } as never)
      .eq("id", team.id);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await logLeagueAction({
      leagueId: league.id, seasonId: team.season_id,
      action: "team.captain_changed", entityType: "team", entityId: team.id,
      oldValue: { captain_user_id: team.captain_user_id },
      newValue: { captain_user_id: userId },
    });
    toast.success("Captain updated");
    await onChanged();
    setBusy(false);
  };

  const active = roster.filter((r) => r.status === "active");
  const removed = roster.filter((r) => r.status === "removed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">{team.name} · roster</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : (
          <div className="space-y-4">
            {/* Active roster */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active ({active.length})
                </h3>
              </div>
              {active.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No players on the roster yet.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {active.map((m) => {
                    const p = profilesById[m.user_id];
                    const name = p ? resolvePlayerName(p) : m.user_id.slice(0, 8);
                    const isCaptain = team.captain_user_id === m.user_id;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <span className="text-sm truncate">{name}</span>
                          {isCaptain && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Captain" />
                          )}
                        </div>
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            patch(m, { role: v as TeamMemberRole }, "team_member.role_changed")
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="player">Player</SelectItem>
                            <SelectItem value="captain">Captain</SelectItem>
                            <SelectItem value="substitute">Substitute</SelectItem>
                          </SelectContent>
                        </Select>
                        {!isCaptain && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 px-2"
                            disabled={busy}
                            onClick={() => promoteCaptain(m.user_id)}
                            aria-label="Set as team captain"
                          >
                            <Crown className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-destructive"
                          disabled={busy}
                          onClick={() => setConfirmRemove({ member: m, name })}
                          aria-label="Remove from team"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Add from league members */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Add from league members
              </h3>
              {addable.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {eligibleMembers.length === 0
                    ? "No active league members in this season yet."
                    : "Everyone eligible is already on the roster."}
                </div>
              ) : (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {addable.map((m) => {
                    const p = profilesById[m.user_id];
                    const name = p ? resolvePlayerName(p) : m.user_id.slice(0, 8);
                    return (
                      <li
                        key={m.id}
                        className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
                      >
                        <span className="text-sm truncate flex-1">{name}</span>
                        <Button
                          size="sm" variant="outline" className="h-8"
                          disabled={busy}
                          onClick={() => addMember(m.user_id)}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" />
                          Add
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                Only active league members appear here. Add players to the
                league on the Members tab first if the person is missing.
              </p>
            </section>

            {/* Removed history */}
            {removed.length > 0 && (
              <section>
                <details>
                  <summary className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer">
                    Removed ({removed.length})
                  </summary>
                  <ul className="space-y-1.5 mt-2">
                    {removed.map((m) => {
                      const p = profilesById[m.user_id];
                      const name = p ? resolvePlayerName(p) : m.user_id.slice(0, 8);
                      return (
                        <li
                          key={m.id}
                          className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 opacity-70"
                        >
                          <span className="text-sm truncate flex-1">{name}</span>
                          <Button
                            variant="ghost" size="sm" className="h-7 text-xs"
                            disabled={busy}
                            onClick={() => patch(m, { status: "active" }, "team_member.restored")}
                          >
                            Restore
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </section>
            )}
          </div>
        )}
      </DialogContent>

      {/* Remove confirmation. Roster removal is soft (status = removed)
          but still worth a confirm — accidental clicks on a full-roster
          view happen. */}
      <AlertDialog
        open={!!confirmRemove}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from team?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.name ?? "This player"} will be removed from
              {" "}{team.name}. Soft delete — restore any time from the
              Removed section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmRemove) return;
                const target = confirmRemove.member;
                setConfirmRemove(null);
                await patch(target, { status: "removed" }, "team_member.removed");
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
