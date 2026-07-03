import { useEffect, useMemo, useState } from "react";
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
import { Plus, Search, UserX, Users, RotateCcw } from "lucide-react";
import { EmptyState, TabSkeleton, LeagueTabProps } from "./_shared";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  League, LeagueSeason, LeagueDivision, LeagueMember, MemberRole,
  MemberStatus,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";

interface PlayerRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export function MembersTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, PlayerRow>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Season list — subscribes to dataVersion so new seasons show up here.
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
    const [{ data: divs }, { data: mems }] = await Promise.all([
      supabase.from("league_divisions" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_members" as never).select("*")
        .eq("league_id", league.id).eq("season_id", seasonId).order("joined_at", { ascending: false }),
    ]);
    setDivisions((divs ?? []) as unknown as LeagueDivision[]);
    const memList = (mems ?? []) as unknown as LeagueMember[];
    setMembers(memList);
    if (memList.length) {
      const ids = Array.from(new Set(memList.map((m) => m.user_id)));
      const { data: profs } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name, avatar_url")
        .in("id", ids);
      const map: Record<string, PlayerRow> = {};
      (profs ?? []).forEach((p) => { map[(p as PlayerRow).id] = p as PlayerRow; });
      setProfilesById(map);
    } else {
      setProfilesById({});
    }
  };

  if (loading) return <TabSkeleton lines={3} />;
  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-5 h-5" />}
        title="Create a season first"
        desc="Members are scoped to a season so history stays clean."
      />
    );
  }

  // Filter members by the search query (name substring). Case-insensitive.
  const q = query.trim().toLowerCase();
  const filteredMembers = q
    ? members.filter((m) => {
        const p = profilesById[m.user_id];
        if (!p) return false;
        const name = resolvePlayerName(p).toLowerCase();
        return name.includes(q);
      })
    : members;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={seasonId} onValueChange={setSeasonId}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add member</Button>
          </DialogTrigger>
          {seasonId && (
            <AddMemberDialog
              league={league}
              seasonId={seasonId}
              divisions={divisions}
              existingUserIds={new Set(members.map((m) => m.user_id))}
              onDone={async () => { setAddOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
      </div>

      {/* Search bar — visible whenever there's more than a handful of
          members. Below that it's just noise. */}
      {members.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${members.length} member${members.length === 1 ? "" : "s"}…`}
            className="pl-9 h-10"
          />
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5" />}
          title="No members in this season"
          desc="Search for existing players and add them as league members."
          action={{ label: "Add member", onClick: () => setAddOpen(true) }}
        />
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Search className="w-5 h-5" />}
          title="No matches"
          desc={`No members match "${query}".`}
        />
      ) : (
        <ul className="space-y-2">
          {filteredMembers.map((m) => {
            const p = profilesById[m.user_id];
            const name = p ? resolvePlayerName(p) : "Loading…";
            const division = divisions.find((d) => d.id === m.division_id);
            const initials = name
              .split(/\s+/).filter(Boolean).slice(0, 2)
              .map((s) => s[0]).join("").toUpperCase() || "?";
            return (
              <li key={m.id} className="rounded-lg border border-border/70 bg-card p-3 flex items-center gap-3">
                {/* Avatar chip — pulls from profile.avatar_url when
                    available, initials otherwise. Small enough to not
                    dominate the row. */}
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
                  {p?.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {initials}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                    <span>{m.role}</span>
                    <span>·</span>
                    <span>{m.status}</span>
                    {division && (<><span>·</span><span>{division.name}</span></>)}
                  </div>
                </div>
                <MemberInlineActions
                  league={league}
                  member={m}
                  memberName={name}
                  divisions={divisions}
                  onChanged={async () => { await reload(); onMutated(); }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MemberInlineActions({
  league, member, memberName, divisions, onChanged,
}: {
  league: League;
  member: LeagueMember;
  memberName: string;
  divisions: LeagueDivision[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const isRemoved = member.status === "removed";

  const patch = async (fields: Partial<LeagueMember>, action: string) => {
    setBusy(true);
    const { error } = await supabase.from("league_members" as never)
      .update(fields as never).eq("id", member.id);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await logLeagueAction({
      leagueId: league.id, seasonId: member.season_id,
      action, entityType: "member", entityId: member.id,
      oldValue: { role: member.role, status: member.status, division_id: member.division_id },
      newValue: fields,
    });
    setBusy(false);
    await onChanged();
  };

  return (
    <div className="flex items-center gap-1">
      <Select
        value={member.role}
        onValueChange={(v) => patch({ role: v as MemberRole }, "member.role_changed")}
      >
        <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="player">Player</SelectItem>
          <SelectItem value="captain">Captain</SelectItem>
          <SelectItem value="manager">Manager</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={member.division_id ?? "none"}
        onValueChange={(v) => patch({ division_id: v === "none" ? null : v }, "member.division_changed")}
      >
        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No division</SelectItem>
          {divisions.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Restore is benign — direct action. Remove needs a confirm. */}
      {isRemoved ? (
        <Button
          variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
          disabled={busy}
          onClick={() => patch({ status: "active" }, "member.restored")}
          aria-label="Restore member"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      ) : (
        <>
          <Button
            variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={() => setConfirmRemoveOpen(true)}
            aria-label="Remove member"
          >
            <UserX className="w-4 h-4" />
          </Button>
          <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this member from the season?</AlertDialogTitle>
                <AlertDialogDescription>
                  {memberName} will be marked removed. This is a soft delete —
                  you can restore them later. Their existing team assignments
                  will remain unless you also remove them from those teams.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setConfirmRemoveOpen(false);
                    await patch({ status: "removed" }, "member.removed");
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function AddMemberDialog({
  league, seasonId, divisions, existingUserIds, onDone,
}: {
  league: League;
  seasonId: string;
  divisions: LeagueDivision[];
  existingUserIds: Set<string>;
  onDone: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerRow[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [role, setRole] = useState<MemberRole>("player");
  const [divisionId, setDivisionId] = useState<string | "none">("none");
  const [status, setStatus] = useState<MemberStatus>("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
  }, [query]);

  const filteredResults = useMemo(
    () => results.filter((r) => !existingUserIds.has(r.id)),
    [results, existingUserIds],
  );

  const submit = async () => {
    if (!pickedId) { toast.error("Pick a player"); return; }
    setSaving(true);
    const payload = {
      league_id: league.id,
      season_id: seasonId,
      division_id: divisionId === "none" ? null : divisionId,
      user_id: pickedId,
      role, status,
    };
    const { data, error } = await supabase
      .from("league_members" as never).insert(payload as never).select().single();
    if (error || !data) {
      toast.error(error?.message ?? "Add failed");
      setSaving(false);
      return;
    }
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: "member.added", entityType: "member",
      entityId: (data as unknown as LeagueMember).id,
      newValue: payload,
    });
    toast.success("Member added");
    setSaving(false);
    await onDone();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add league member</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Search players</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Name…" className="pl-9"
            />
          </div>
          {filteredResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              {filteredResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPickedId(r.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${pickedId === r.id ? "bg-primary/10 text-primary" : ""}`}
                >
                  {resolvePlayerName(r)}
                </button>
              ))}
            </div>
          )}
          {query && filteredResults.length === 0 && (
            <p className="text-xs text-muted-foreground">No matches (already-added players are filtered out).</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Player</SelectItem>
                <SelectItem value="captain">Captain</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as MemberStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Division</Label>
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No division</SelectItem>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving || !pickedId} className="w-full">
          {saving ? "Adding…" : "Add member"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
