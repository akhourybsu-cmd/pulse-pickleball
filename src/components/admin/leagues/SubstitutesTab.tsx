import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, LifeBuoy, Trash2, Repeat, Power, PowerOff, StickyNote,
} from "lucide-react";
import type {
  LeagueSeason, LeagueDivision, LeagueSubstitute, SubstituteStatus,
  LeagueSession, LeagueMatch, LeagueTeam,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { cn } from "@/lib/utils";
import {
  EmptyState, TabSkeleton, LeagueTabProps,
  FormShell, FormSection, FormRow, FIELD_H,
} from "./_shared";

interface PlayerRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

const SLOTS: Array<{ key: "a" | "b" | "c" | "d"; team: "A" | "B" }> = [
  { key: "a", team: "A" },
  { key: "b", team: "A" },
  { key: "c", team: "B" },
  { key: "d", team: "B" },
];

export function SubstitutesTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [subs, setSubs] = useState<LeagueSubstitute[]>([]);
  const [sessions, setSessions] = useState<LeagueSession[]>([]);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, PlayerRow>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<LeagueSubstitute | null>(null);
  const [swapFor, setSwapFor] = useState<LeagueSubstitute | null>(null);

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
    const [{ data: divs }, { data: s }, { data: sess }, { data: mt }, { data: t }] =
      await Promise.all([
        supabase.from("league_divisions" as never).select("*").eq("season_id", seasonId),
        supabase.from("league_substitutes" as never).select("*")
          .eq("season_id", seasonId).order("created_at", { ascending: false }),
        supabase.from("league_sessions" as never).select("*")
          .eq("season_id", seasonId).order("scheduled_date", { ascending: true }),
        supabase.from("league_matches" as never).select("*")
          .eq("season_id", seasonId).order("scheduled_time", { ascending: true }),
        supabase.from("league_teams" as never).select("*").eq("season_id", seasonId),
      ]);
    setDivisions((divs ?? []) as unknown as LeagueDivision[]);
    const subList = (s ?? []) as unknown as LeagueSubstitute[];
    setSubs(subList);
    setSessions((sess ?? []) as unknown as LeagueSession[]);
    const matchList = (mt ?? []) as unknown as LeagueMatch[];
    setMatches(matchList);
    setTeams((t ?? []) as unknown as LeagueTeam[]);

    // Names for subs + every slot occupant referenced by a match.
    const ids = new Set<string>(subList.map((x) => x.user_id));
    matchList.forEach((m) => {
      [m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id]
        .forEach((id) => id && ids.add(id));
    });
    if (ids.size) {
      const { data: profs } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name, avatar_url")
        .in("id", Array.from(ids));
      const map: Record<string, PlayerRow> = {};
      (profs ?? []).forEach((p) => { map[(p as PlayerRow).id] = p as PlayerRow; });
      setProfilesById(map);
    } else {
      setProfilesById({});
    }
  };

  // How many match slots each sub currently fills this season — the
  // "track subs" signal so the organizer can see who's carrying the load.
  const appearancesByUser = useMemo(() => {
    const counts: Record<string, number> = {};
    matches.forEach((m) => {
      [m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id].forEach((id) => {
        if (id) counts[id] = (counts[id] ?? 0) + 1;
      });
    });
    return counts;
  }, [matches]);

  if (loading) return <TabSkeleton lines={3} />;
  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<LifeBuoy className="w-5 h-5" />}
        title="Create a season first"
        desc="Subs are tracked per season, alongside members and teams."
      />
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
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add sub</Button>
          </DialogTrigger>
          {seasonId && (
            <SubEditorDialog
              mode="create"
              leagueId={league.id}
              seasonId={seasonId}
              divisions={divisions}
              existingUserIds={new Set(subs.map((x) => x.user_id))}
              initial={null}
              onDone={async () => { setAddOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex gap-2">
        <LifeBuoy className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Keep a bench of fill-in players here, then use <strong>Swap in</strong> to
          drop a sub into any match for a given week. Swaps are recorded in the
          audit log and never touch PULSE Ratings.
        </span>
      </div>

      {subs.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="w-5 h-5" />}
          title="No subs on the bench yet"
          desc="Add fill-in players you can swap into a match when a regular can't make it."
          action={{ label: "Add sub", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <ul className="space-y-2">
          {subs.map((sub) => {
            const p = profilesById[sub.user_id];
            const name = p ? resolvePlayerName(p) : "Loading…";
            const division = divisions.find((d) => d.id === sub.division_id);
            const initials = name
              .split(/\s+/).filter(Boolean).slice(0, 2)
              .map((s) => s[0]).join("").toUpperCase() || "?";
            const appearances = appearancesByUser[sub.user_id] ?? 0;
            const inactive = sub.status === "inactive";
            return (
              <li
                key={sub.id}
                className={cn(
                  "rounded-lg border border-border/70 bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3",
                  inactive && "opacity-60",
                )}
              >
                <div className="flex items-center gap-3 min-w-0 sm:flex-1">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[11px] font-bold text-muted-foreground">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{name}</span>
                      {inactive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Inactive
                        </span>
                      )}
                      {appearances > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          In {appearances} matchup{appearances === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      {division && <span>{division.name}</span>}
                      {sub.notes && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <StickyNote className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[220px]">{sub.notes}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <SubInlineActions
                  leagueId={league.id}
                  sub={sub}
                  subName={name}
                  onSwap={() => setSwapFor(sub)}
                  onEdit={() => setEditing(sub)}
                  onChanged={async () => { await reload(); onMutated(); }}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <SubEditorDialog
            mode="edit"
            leagueId={league.id}
            seasonId={seasonId as string}
            divisions={divisions}
            existingUserIds={new Set(subs.map((x) => x.user_id))}
            initial={editing}
            onDone={async () => { setEditing(null); await reload(); onMutated(); }}
          />
        </Dialog>
      )}

      {/* Swap dialog */}
      {swapFor && (
        <SubSwapDialog
          open={!!swapFor}
          onOpenChange={(o) => !o && setSwapFor(null)}
          sub={swapFor}
          subName={profilesById[swapFor.user_id] ? resolvePlayerName(profilesById[swapFor.user_id]) : "This sub"}
          sessions={sessions}
          matches={matches}
          teams={teams}
          profilesById={profilesById}
          onDone={async () => { setSwapFor(null); await reload(); onMutated(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline row actions                                                 */
/* ------------------------------------------------------------------ */

function SubInlineActions({
  leagueId, sub, subName, onSwap, onEdit, onChanged,
}: {
  leagueId: string;
  sub: LeagueSubstitute;
  subName: string;
  onSwap: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inactive = sub.status === "inactive";

  const toggleStatus = async () => {
    setBusy(true);
    const next: SubstituteStatus = inactive ? "active" : "inactive";
    const { error } = await supabase.from("league_substitutes" as never)
      .update({ status: next } as never).eq("id", sub.id);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await logLeagueAction({
      leagueId, seasonId: sub.season_id,
      action: inactive ? "substitute.activated" : "substitute.deactivated",
      entityType: "substitute", entityId: sub.id,
      oldValue: { status: sub.status }, newValue: { status: next },
    });
    setBusy(false);
    await onChanged();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("league_substitutes" as never)
      .delete().eq("id", sub.id);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await logLeagueAction({
      leagueId, seasonId: sub.season_id,
      action: "substitute.removed", entityType: "substitute", entityId: sub.id,
      oldValue: { user_id: sub.user_id, status: sub.status },
    });
    setBusy(false);
    setConfirmOpen(false);
    await onChanged();
  };

  return (
    <div className="flex items-center gap-1 w-full sm:w-auto">
      <Button
        size="sm"
        variant="outline"
        className="h-8 flex-1 sm:flex-none"
        disabled={busy || inactive}
        onClick={onSwap}
        title={inactive ? "Activate this sub to swap them in" : "Swap into a match"}
      >
        <Repeat className="w-3.5 h-3.5 mr-1.5" />
        Swap in
      </Button>
      <Button
        size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        disabled={busy} onClick={onEdit} aria-label="Edit sub" title="Edit notes / division"
      >
        <StickyNote className="w-4 h-4" />
      </Button>
      <Button
        size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        disabled={busy} onClick={toggleStatus}
        aria-label={inactive ? "Activate sub" : "Bench sub"}
        title={inactive ? "Mark active" : "Mark inactive"}
      >
        {inactive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
      </Button>
      <Button
        size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        disabled={busy} onClick={() => setConfirmOpen(true)}
        aria-label="Remove sub"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {subName} from the sub list?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes them from the bench for this season. Any matches
              they've already been swapped into keep them — this only takes
              them off the sub list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={busy}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add / edit sub dialog                                              */
/* ------------------------------------------------------------------ */

function SubEditorDialog({
  mode, leagueId, seasonId, divisions, existingUserIds, initial, onDone,
}: {
  mode: "create" | "edit";
  leagueId: string;
  seasonId: string;
  divisions: LeagueDivision[];
  existingUserIds: Set<string>;
  initial: LeagueSubstitute | null;
  onDone: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerRow[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(initial?.user_id ?? null);
  const [pickedName, setPickedName] = useState<string>("");
  const [divisionId, setDivisionId] = useState<string | "none">(initial?.division_id ?? "none");
  const [status, setStatus] = useState<SubstituteStatus>(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "edit") return; // player is fixed when editing
    if (!query.trim()) { setResults([]); return; }
    const q = query.trim();
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name, avatar_url")
        .or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(20);
      setResults((data ?? []) as unknown as PlayerRow[]);
    }, 200);
    return () => clearTimeout(t);
  }, [query, mode]);

  const filteredResults = useMemo(
    () => results.filter((r) => !existingUserIds.has(r.id)),
    [results, existingUserIds],
  );

  const submit = async () => {
    if (!pickedId) { toast.error("Pick a player"); return; }
    setSaving(true);
    if (mode === "create") {
      const payload = {
        league_id: leagueId,
        season_id: seasonId,
        division_id: divisionId === "none" ? null : divisionId,
        user_id: pickedId,
        notes: notes.trim() || null,
        status,
      };
      const { data, error } = await supabase
        .from("league_substitutes" as never).insert(payload as never).select().single();
      if (error || !data) { toast.error(error?.message ?? "Add failed"); setSaving(false); return; }
      await logLeagueAction({
        leagueId, seasonId,
        action: "substitute.added", entityType: "substitute",
        entityId: (data as unknown as LeagueSubstitute).id, newValue: payload,
      });
      toast.success("Sub added to the bench");
    } else if (initial) {
      const payload = {
        division_id: divisionId === "none" ? null : divisionId,
        notes: notes.trim() || null,
        status,
      };
      const { error } = await supabase
        .from("league_substitutes" as never).update(payload as never).eq("id", initial.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logLeagueAction({
        leagueId, seasonId,
        action: "substitute.updated", entityType: "substitute",
        entityId: initial.id,
        oldValue: { division_id: initial.division_id, notes: initial.notes, status: initial.status },
        newValue: payload,
      });
      toast.success("Sub updated");
    }
    setSaving(false);
    await onDone();
  };

  return (
    <FormShell
      icon={<LifeBuoy className="w-5 h-5" />}
      tone="emerald"
      title={mode === "create" ? "Add substitute" : "Edit substitute"}
      subtitle={mode === "create"
        ? "Add a fill-in player to the bench for this season."
        : "Update this sub's division, status, or notes."}
      primaryLabel={mode === "create" ? "Add sub" : "Save changes"}
      primaryLoading={saving}
      primaryDisabled={!pickedId}
      onPrimary={submit}
    >
      {mode === "create" ? (
        <FormSection label="Player">
          <FormRow label="Search players" htmlFor="sub-search">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="sub-search"
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Name…" className={cn(FIELD_H, "pl-9")}
              />
            </div>
          </FormRow>
          {filteredResults.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
              {filteredResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setPickedId(r.id); setPickedName(resolvePlayerName(r)); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors",
                    pickedId === r.id && "bg-primary/10 text-primary",
                  )}
                >
                  {resolvePlayerName(r)}
                </button>
              ))}
            </div>
          )}
          {query && filteredResults.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No matches (players already on the bench are filtered out).
            </p>
          )}
          {pickedId && pickedName && (
            <p className="text-xs text-emerald-600">Selected: {pickedName}</p>
          )}
        </FormSection>
      ) : null}

      <FormSection label="Details">
        <FormRow label="Preferred division" hint="Optional — where this sub best fits.">
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No division</SelectItem>
              {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as SubstituteStatus)}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active (available)</SelectItem>
              <SelectItem value="inactive">Inactive (benched)</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Notes" htmlFor="sub-notes" hint="Availability, contact preference, skill notes…">
          <Textarea
            id="sub-notes" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Weeknights only · texts fastest · strong 3.5"
          />
        </FormRow>
      </FormSection>
    </FormShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Swap-into-a-week dialog                                            */
/* ------------------------------------------------------------------ */

function SubSwapDialog({
  open, onOpenChange, sub, subName, sessions, matches, teams, profilesById, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sub: LeagueSubstitute;
  subName: string;
  sessions: LeagueSession[];
  matches: LeagueMatch[];
  teams: LeagueTeam[];
  profilesById: Record<string, PlayerRow>;
  onDone: () => Promise<void>;
}) {
  const [sessionId, setSessionId] = useState<string>(sessions[0]?.id ?? "");
  const [matchId, setMatchId] = useState<string>("");
  const [slot, setSlot] = useState<"a" | "b" | "c" | "d" | "">("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const sessionMatches = useMemo(
    () => matches.filter((m) => m.session_id === sessionId),
    [matches, sessionId],
  );
  const match = useMemo(
    () => sessionMatches.find((m) => m.id === matchId) ?? null,
    [sessionMatches, matchId],
  );

  const teamName = (id: string | null) =>
    (id && teams.find((t) => t.id === id)?.name) || "TBD";
  const occupantName = (id: string | null) =>
    id ? (profilesById[id] ? resolvePlayerName(profilesById[id]) : "Assigned") : "Empty";

  // Reset downstream selections when the week changes.
  useEffect(() => { setMatchId(""); setSlot(""); }, [sessionId]);
  useEffect(() => { setSlot(""); }, [matchId]);

  const submit = async () => {
    if (!match || !slot) { toast.error("Pick a match and a slot"); return; }
    setSaving(true);
    const { error } = await (supabase.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>)(
      "swap_league_match_player",
      {
        p_match_id: match.id,
        p_slot: slot,
        p_new_player_id: sub.user_id,
        p_note: note.trim() || null,
      },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${subName} swapped in`);
    await onDone();
  };

  const slotOccupant = (key: "a" | "b" | "c" | "d"): string | null => {
    if (!match) return null;
    return key === "a" ? match.player_a_id
      : key === "b" ? match.player_b_id
      : key === "c" ? match.player_c_id
      : match.player_d_id;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" />
            Swap {subName} into a week
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Week */}
          <div className="space-y-1.5">
            <Label>Week</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder="Pick a week" /></SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.scheduled_date ? ` · ${s.scheduled_date}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No sessions in this season yet — create them on the Sessions tab.
              </p>
            )}
          </div>

          {/* Match */}
          <div className="space-y-1.5">
            <Label>Match</Label>
            <Select value={matchId} onValueChange={setMatchId} disabled={!sessionId}>
              <SelectTrigger>
                <SelectValue placeholder={sessionMatches.length ? "Pick a match" : "No matches this week"} />
              </SelectTrigger>
              <SelectContent>
                {sessionMatches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {teamName(m.team_a_id)} vs {teamName(m.team_b_id)}
                    {m.court_number ? ` · Court ${m.court_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Slot — who's coming out */}
          {match && (
            <div className="space-y-1.5">
              <Label>Replace which player?</Label>
              <div className="space-y-1.5">
                {SLOTS.map((s) => {
                  const occ = slotOccupant(s.key);
                  const isSelf = occ === sub.user_id;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={isSelf}
                      onClick={() => setSlot(s.key)}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 flex items-center justify-between gap-2 transition-colors",
                        slot === s.key
                          ? "border-primary bg-primary/10"
                          : "border-border/70 hover:bg-muted/50",
                        isSelf && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Team {s.team} · Slot {s.key.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {isSelf ? "Already this sub" : occupantName(occ)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Slots A/B are {teamName(match.team_a_id)}; C/D are {teamName(match.team_b_id)}.
              </p>
            </div>
          )}

          {/* Optional note */}
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea
              rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Kept in the audit log — e.g. 'filling in for Marcus, out sick'"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !match || !slot} className="flex-1">
            <Repeat className="w-4 h-4 mr-1.5" />
            {saving ? "Swapping…" : "Swap in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
