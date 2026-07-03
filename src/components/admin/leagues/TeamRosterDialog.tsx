import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPlus, UserX, Crown, Search, Users } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface PlayerRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

/**
 * Two-letter fallback for the roster avatar chip when the player has
 * no uploaded avatar. Prefers display_name → first+last → id prefix.
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AvatarChip({
  url, name, size = "sm", captain,
}: {
  url?: string | null;
  name: string;
  size?: "sm" | "md";
  captain?: boolean;
}) {
  const dim = size === "md" ? "h-9 w-9 text-xs" : "h-8 w-8 text-[11px]";
  return (
    <div className="relative shrink-0">
      <div className={cn(
        "rounded-full ring-1 ring-border bg-muted/60 flex items-center justify-center overflow-hidden font-semibold text-muted-foreground",
        dim,
      )}>
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initialsOf(name)}</span>
        )}
      </div>
      {captain && (
        <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-amber-500 ring-2 ring-background flex items-center justify-center">
          <Crown className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </div>
  );
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
  const [addQuery, setAddQuery] = useState("");

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

  const filteredAddable = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return addable;
    return addable.filter((m) => {
      const p = profilesById[m.user_id];
      const name = p ? resolvePlayerName(p) : m.user_id;
      return name.toLowerCase().includes(q);
    });
  }, [addable, addQuery, profilesById]);

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
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
        {/* Amber accent — teams tone throughout the league system */}
        <div className="h-1.5 w-full bg-amber-500" aria-hidden />

        <DialogHeader className="p-5 pb-3 space-y-0">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"
              aria-hidden
            >
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <DialogTitle className="text-lg font-bold tracking-tight leading-tight truncate">
                {team.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {active.length} active player{active.length === 1 ? "" : "s"}
                {" · "}
                {team.captain_user_id ? "captain set" : "no captain"}
              </p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Loading…</p>
        ) : (
          <div className="px-5 pb-5 pt-1 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Active roster */}
            <section className="space-y-2.5">
              <div className="flex items-baseline gap-2 border-b border-border/40 pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Active roster
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  {active.length}
                </span>
              </div>
              {active.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No players on the roster yet — add some below.
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
                        className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-2 hover:border-amber-500/40 transition-colors"
                      >
                        <AvatarChip
                          url={p?.avatar_url}
                          name={name}
                          captain={isCaptain}
                        />
                        <span className="text-sm font-medium truncate flex-1">
                          {name}
                        </span>
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            patch(m, { role: v as TeamMemberRole }, "team_member.role_changed")
                          }
                        >
                          <SelectTrigger className="h-8 w-[112px] text-xs">
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
                            className="h-8 px-2 hover:text-amber-500"
                            disabled={busy}
                            onClick={() => promoteCaptain(m.user_id)}
                            aria-label="Set as team captain"
                            title="Make captain"
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
            <section className="space-y-2.5">
              <div className="flex items-baseline gap-2 border-b border-border/40 pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Add from league members
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  {addable.length} available
                </span>
              </div>
              {addable.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {eligibleMembers.length === 0
                    ? "No active league members in this season yet."
                    : "Everyone eligible is already on the roster."}
                </div>
              ) : (
                <>
                  {addable.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search members…"
                        value={addQuery}
                        onChange={(e) => setAddQuery(e.target.value)}
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
                  )}
                  <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {filteredAddable.map((m) => {
                      const p = profilesById[m.user_id];
                      const name = p ? resolvePlayerName(p) : m.user_id.slice(0, 8);
                      return (
                        <li
                          key={m.id}
                          className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-2 hover:border-amber-500/40 transition-colors"
                        >
                          <AvatarChip url={p?.avatar_url} name={name} />
                          <span className="text-sm truncate flex-1">{name}</span>
                          <Button
                            size="sm" variant="outline" className="h-8 shrink-0"
                            disabled={busy}
                            onClick={() => addMember(m.user_id)}
                          >
                            <UserPlus className="w-3.5 h-3.5 mr-1" />
                            Add
                          </Button>
                        </li>
                      );
                    })}
                    {filteredAddable.length === 0 && (
                      <li className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                        No matches — clear the search or add the player to the league first.
                      </li>
                    )}
                  </ul>
                </>
              )}
              <p className="text-[11px] text-muted-foreground">
                Only active league members appear here. Missing someone?
                Add them on the Members tab first.
              </p>
            </section>

            {/* Removed history */}
            {removed.length > 0 && (
              <section>
                <details className="group">
                  <summary className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground cursor-pointer flex items-center gap-1.5 pb-1.5 border-b border-border/40 hover:text-foreground transition-colors">
                    <span>Removed history · {removed.length}</span>
                  </summary>
                  <ul className="space-y-1.5 mt-2.5">
                    {removed.map((m) => {
                      const p = profilesById[m.user_id];
                      const name = p ? resolvePlayerName(p) : m.user_id.slice(0, 8);
                      return (
                        <li
                          key={m.id}
                          className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 opacity-70"
                        >
                          <AvatarChip url={p?.avatar_url} name={name} />
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
