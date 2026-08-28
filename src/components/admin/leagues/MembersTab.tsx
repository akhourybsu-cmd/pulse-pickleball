import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, Search, UserX, Users, RotateCcw, ClipboardList, Mail, CheckCircle2,
  XCircle, RotateCw, AlertCircle, Crown, UserRound, UserPlus2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { withPulseActivity } from "@/components/ui/pulse-activity";

import { cn } from "@/lib/utils";
import {
  EmptyState, TabSkeleton, LeagueTabProps,
  FormShell, FormSection, FormRow, FIELD_H, SegmentedControl, SeasonSelect,
} from "./_shared";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  League, LeagueSeason, LeagueMember, MemberRole,
  MemberStatus,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { OrganizerSkillCard } from "@/components/skill/OrganizerSkillCard";

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
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, PlayerRow>>({});
  const [primaryManager, setPrimaryManager] = useState<PlayerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
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

  // Primary manager (league creator) — pinned at top of the roster.
  useEffect(() => {
    (async () => {
      if (!league.created_by) { setPrimaryManager(null); return; }
      const { data } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name, avatar_url")
        .eq("id", league.created_by)
        .maybeSingle();
      setPrimaryManager((data ?? null) as PlayerRow | null);
    })();
  }, [league.created_by]);

  useEffect(() => {
    if (!seasonId) return;
    void reload();
    // eslint-disable-next-line
  }, [seasonId, dataVersion]);

  const reload = async () => {
    const { data: mems } = await supabase.from("league_members" as never).select("*")
      .eq("league_id", league.id).eq("season_id", seasonId).order("joined_at", { ascending: false });
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
  const matches = (m: LeagueMember) => {
    if (!q) return true;
    const p = profilesById[m.user_id];
    if (!p) return false;
    return resolvePlayerName(p).toLowerCase().includes(q);
  };

  // Split: assistant managers (role=manager, active) first, then active
  // players, then inactive/removed at the very bottom. Primary manager is
  // pinned above the whole list as a special row.
  const assistantMgrs = members
    .filter((m) => m.role === "manager" && m.status === "active" && m.user_id !== league.created_by && matches(m));
  const activePlayers = members
    .filter((m) => m.status === "active" && m.role !== "manager" && matches(m));
  const inactive = members
    .filter((m) => m.status !== "active" && matches(m));

  const renderMemberRow = (m: LeagueMember) => {
    const p = profilesById[m.user_id];
    const name = p ? resolvePlayerName(p) : "Loading…";
    const initials = name
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map((s) => s[0]).join("").toUpperCase() || "?";
    // Captain is retired as a member role — anyone who isn't a manager shows
    // as a plain Player.
    const roleLabel = m.role === "manager" ? "Assistant manager" : "Player";
    const isInactive = m.status !== "active";
    return (
      <li key={m.id} className={cn(
        "rounded-lg border border-border/70 bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3",
        isInactive && "opacity-60",
      )}>
        <div className="flex items-center gap-3 min-w-0 sm:flex-1">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
            {p?.avatar_url ? (
              <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-muted-foreground">{initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-1">
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                m.role === "manager"
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "bg-muted text-muted-foreground",
              )}>
                {m.role === "manager" && <Crown className="w-2.5 h-2.5" />}
                {roleLabel}
              </span>
              {m.status !== "active" && (
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  m.status === "removed"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-600",
                )}>
                  {m.status}
                </span>
              )}
            </div>
            {/* Organizer-only skill self-assessment (feature-flagged; renders
                nothing when disabled, unauthorized, or not taken). */}
            <OrganizerSkillCard
              playerId={m.user_id}
              leagueId={league.id}
              playerName={name}
              variant="compact"
            />
          </div>
        </div>
        <MemberInlineActions
          league={league}
          member={m}
          memberName={name}
          onChanged={async () => { await reload(); onMutated(); }}
        />
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} className="flex-1" />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add member</Button>
          </DialogTrigger>
          {seasonId && (
            <AddMemberDialog
              league={league}
              seasonId={seasonId}
              existingUserIds={new Set(members.map((m) => m.user_id))}
              onDone={async () => { setAddOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" title="Paste an email list">
              <ClipboardList className="w-4 h-4 mr-1" />Bulk
            </Button>
          </DialogTrigger>
          {seasonId && (
            <BulkAddMembersDialog
              league={league}
              seasonId={seasonId}
              onDone={async () => { setBulkOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
      </div>

      {/* Search bar — visible whenever there's more than a handful of members. */}
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

      {/* Primary manager — pinned. Cannot be removed here (they run the league). */}
      {primaryManager && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-primary/30">
            {primaryManager.avatar_url ? (
              <img src={primaryManager.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-muted-foreground">
                {resolvePlayerName(primaryManager).split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{resolvePlayerName(primaryManager)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary ring-1 ring-primary/30">
                <Crown className="w-2.5 h-2.5" />
                Manager
              </span>
            </div>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5" />}
          title="No members in this season"
          desc="Search for existing players and add them as league members."
          action={{ label: "Add member", onClick: () => setAddOpen(true) }}
        />
      ) : (assistantMgrs.length + activePlayers.length + inactive.length === 0) ? (
        <EmptyState
          icon={<Search className="w-5 h-5" />}
          title="No matches"
          desc={`No members match "${query}".`}
        />
      ) : (
        <div className="space-y-4">
          {/* Assistant managers — a labeled sub-list directly under the Manager. */}
          {assistantMgrs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Assistant managers</span>
                <span className="text-muted-foreground/70">· {assistantMgrs.length}</span>
              </div>
              <ul className="space-y-2">
                {assistantMgrs.map(renderMemberRow)}
              </ul>
            </div>
          )}
          {activePlayers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Active roster</span>
                <span className="text-muted-foreground/70">· {activePlayers.length}</span>
              </div>
              <ul className="space-y-2">
                {activePlayers.map(renderMemberRow)}
              </ul>
            </div>
          )}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Inactive</span>
                <span className="text-muted-foreground/70">· {inactive.length}</span>
              </div>
              <ul className="space-y-2">
                {inactive.map(renderMemberRow)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function MemberInlineActions({
  league, member, memberName, onChanged,
}: {
  league: League;
  member: LeagueMember;
  memberName: string;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<MemberRole | null>(null);
  const isRemoved = member.status === "removed";
  const isLadder = league.league_type === "ladder";

  const patch = async (fields: Partial<LeagueMember>, action: string) => {
    setBusy(true);
    try {
      await withPulseActivity(`Updating ${memberName}…`, async () => {
        const { error } = await supabase.from("league_members" as never)
          .update(fields as never).eq("id", member.id);
        if (error) throw error;
        await logLeagueAction({
          leagueId: league.id, seasonId: member.season_id,
          action, entityType: "member", entityId: member.id,
          oldValue: { role: member.role, status: member.status },
          newValue: fields,
        });
      }, "Roster updated");
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="flex items-center gap-1 w-full sm:w-auto">
      <Select
        value={member.role === "manager" ? "manager" : "player"}
        onValueChange={(v) => {
          const next = v as MemberRole;
          if (next !== member.role) setPendingRole(next);
        }}
      >
        <SelectTrigger className="h-8 flex-1 sm:flex-none sm:w-[110px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="player">Player</SelectItem>
          <SelectItem value="manager">Assistant manager</SelectItem>
        </SelectContent>
      </Select>

      {/* Role changes grant/revoke full management rights — confirm both ways. */}
      <AlertDialog open={pendingRole !== null} onOpenChange={(o) => { if (!o) setPendingRole(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRole === "manager"
                ? `Make ${memberName} an assistant manager?`
                : `Change ${memberName} back to player?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole === "manager"
                ? "Assistant managers can run the whole league — edit settings, generate and process the ladder, enter and override scores, and add or remove members. Only grant this to someone you trust to manage play."
                : "This revokes their management access. They go back to a regular player who only sees their own matches and standings."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const next = pendingRole;
                setPendingRole(null);
                if (next) await patch({ role: next }, "member.role_changed");
              }}
            >
              {pendingRole === "manager" ? "Make assistant manager" : "Change to player"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  you can restore them later.
                  {isLadder && (
                    <span className="mt-2 block text-amber-600 dark:text-amber-400">
                      Heads up: for a ladder that's already running, this does not pull
                      them out of the rotation — the ladder keeps its own order, so a
                      removed player can still be scheduled. Manage running-ladder rosters
                      from the Ladder tab instead: use <strong>Replace a player</strong> to
                      swap someone who's left for a new player permanently, or the week
                      roster to <strong>sit a player out</strong> for a single week (they
                      keep their spot).
                    </span>
                  )}
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
  league, seasonId, existingUserIds, onDone,
}: {
  league: League;
  seasonId: string;
  existingUserIds: Set<string>;
  onDone: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerRow[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pickedRowOverride, setPickedRowOverride] = useState<PlayerRow | null>(null);
  const [role, setRole] = useState<MemberRole>("player");
  const [status, setStatus] = useState<MemberStatus>("active");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"search" | "friends" | "community" | "guests">("search");
  const [friends, setFriends] = useState<PlayerRow[]>([]);
  const [community, setCommunity] = useState<PlayerRow[]>([]);
  const [guests, setGuests] = useState<PlayerRow[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");

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

  // Load the three non-search sources once when the dialog mounts.
  useEffect(() => {
    (async () => {
      setSourcesLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;

        // Friends (accepted friendships either direction)
        const { data: fships } = await supabase
          .from("friendships")
          .select("user_id, friend_id")
          .eq("status", "accepted")
          .or(`user_id.eq.${uid},friend_id.eq.${uid}`);
        const friendIds = Array.from(new Set(
          ((fships ?? []) as Array<{ user_id: string; friend_id: string }>)
            .map((f) => (f.user_id === uid ? f.friend_id : f.user_id)),
        ));

        // Community members (groups current user belongs to)
        const { data: myMems } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", uid)
          .eq("status", "active");
        const groupIds = ((myMems ?? []) as Array<{ group_id: string }>).map((m) => m.group_id);
        let communityIds: string[] = [];
        if (groupIds.length) {
          const { data: coMems } = await supabase
            .from("group_members")
            .select("user_id")
            .in("group_id", groupIds)
            .eq("status", "active");
          communityIds = Array.from(new Set(
            ((coMems ?? []) as Array<{ user_id: string }>)
              .map((m) => m.user_id).filter((id) => id !== uid),
          ));
        }

        // Guests I added that have been linked to a real profile
        const { data: gs } = await supabase
          .from("guest_players" as never)
          .select("linked_user_id")
          .eq("added_by_user_id", uid)
          .not("linked_user_id", "is", null);
        const guestIds = Array.from(new Set(
          ((gs ?? []) as Array<{ linked_user_id: string | null }>)
            .map((g) => g.linked_user_id).filter((id): id is string => Boolean(id)),
        ));

        const allIds = Array.from(new Set([...friendIds, ...communityIds, ...guestIds]));
        if (allIds.length === 0) return;
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, full_name, first_name, last_name, avatar_url")
          .in("id", allIds as string[]);
        const map: Record<string, PlayerRow> = {};
        ((profs ?? []) as PlayerRow[]).forEach((p) => { map[p.id] = p; });

        setFriends(friendIds.map((id) => map[id]).filter(Boolean));
        setCommunity(communityIds.map((id) => map[id]).filter(Boolean));
        setGuests(guestIds.map((id) => map[id]).filter(Boolean));
      } finally {
        setSourcesLoading(false);
      }
    })();
  }, []);

  const filteredResults = useMemo(
    () => results.filter((r) => !existingUserIds.has(r.id)),
    [results, existingUserIds],
  );

  const applyFilter = (rows: PlayerRow[]) => {
    const q = sourceFilter.trim().toLowerCase();
    const base = rows.filter((r) => !existingUserIds.has(r.id));
    if (!q) return base;
    return base.filter((r) => resolvePlayerName(r).toLowerCase().includes(q));
  };

  const submit = async () => {
    if (!pickedId) { toast.error("Pick a player"); return; }
    setSaving(true);
    const payload = {
      league_id: league.id,
      season_id: seasonId,
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

  const pickedRow =
    pickedRowOverride
      ?? results.find((r) => r.id === pickedId)
      ?? friends.find((r) => r.id === pickedId)
      ?? community.find((r) => r.id === pickedId)
      ?? guests.find((r) => r.id === pickedId)
      ?? null;
  const pickedName = pickedRow ? resolvePlayerName(pickedRow) : "";

  const sourceRows: Record<typeof tab, PlayerRow[]> = {
    search: filteredResults,
    friends: applyFilter(friends),
    community: applyFilter(community),
    guests: applyFilter(guests),
  };

  const SOURCES = [
    { key: "search" as const, label: "Search", icon: Search, count: null as number | null },
    { key: "friends" as const, label: "Friends", icon: UserRound, count: friends.length },
    { key: "community" as const, label: "Community", icon: Users, count: community.length },
    { key: "guests" as const, label: "Guests", icon: UserPlus2, count: guests.length },
  ];

  const emptyLabel: Record<typeof tab, string> = {
    search: "No matches — already-added players are filtered out.",
    friends: "No friends yet. Add some from the Community tab.",
    community: "No community members found. Join a group to see teammates here.",
    guests: "No claimed guests. Only guests linked to a real account can join a league.",
  };

  const rows = sourceRows[tab];
  const listLoading = tab === "search" ? false : sourcesLoading;

  return (
    <FormShell
      icon={<Users className="w-5 h-5" />}
      tone="primary"
      kicker="New member"
      title="Add to the roster"
      subtitle="Pull from your guests, community, or friends — or search everyone."
      primaryLabel="Add member"
      primaryLoading={saving}
      primaryDisabled={!pickedId}
      onPrimary={submit}
    >
      <FormSection label="Player" hint="Pick one">
        {/* Source rail — scrolls horizontally on narrow screens instead of
            squashing four labels into unreadable columns. */}
        <div className="-mx-1 overflow-x-auto scrollbar-none">
          <div
            role="tablist"
            aria-label="Player source"
            className="mx-1 inline-flex min-w-full gap-1 rounded-xl bg-muted/60 p-1 ring-1 ring-inset ring-border/50"
          >
            {SOURCES.map((s) => {
              const active = tab === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setTab(s.key); setSourceFilter(""); }}
                  className={cn(
                    "flex-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11.5px] font-bold uppercase tracking-wide transition-colors inline-flex items-center justify-center gap-1.5",
                    active
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <s.icon className={cn("w-3.5 h-3.5", active && "text-primary")} />
                  {s.label}
                  {s.count !== null && s.count > 0 && (
                    <span className="tabular-nums text-[10px] font-black text-muted-foreground/80">
                      {s.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="mem-search"
            value={tab === "search" ? query : sourceFilter}
            onChange={(e) =>
              tab === "search" ? setQuery(e.target.value) : setSourceFilter(e.target.value)
            }
            placeholder={tab === "search" ? "Search everyone by name…" : "Filter this list…"}
            className={cn(FIELD_H, "pl-9")}
          />
        </div>

        {listLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[52px] rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              {tab === "search" && !query.trim()
                ? "Start typing a name to search every PULSE player."
                : emptyLabel[tab]}
            </p>
          </div>
        ) : (
          <div className="max-h-[248px] overflow-y-auto rounded-xl border border-border/70 bg-card/70 divide-y divide-border/60">
            {rows.map((r) => {
              const name = resolvePlayerName(r);
              const picked = pickedId === r.id;
              const initials = name.split(/\s+/).filter(Boolean).slice(0, 2)
                .map((s) => s[0]).join("").toUpperCase() || "?";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setPickedId(picked ? null : r.id);
                    setPickedRowOverride(picked ? null : r);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    picked ? "bg-primary/10" : "hover:bg-muted/60",
                  )}
                  aria-pressed={picked}
                >
                  <span className="h-8 w-8 rounded-full bg-muted ring-1 ring-border overflow-hidden flex items-center justify-center shrink-0">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">{initials}</span>
                    )}
                  </span>
                  <span className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    picked ? "font-bold text-primary" : "font-medium",
                  )}>
                    {name}
                  </span>
                  <span className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center shrink-0 ring-1",
                    picked
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "ring-border text-transparent",
                  )}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {pickedId && pickedName && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.07] px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span className="min-w-0 flex-1 truncate text-xs">
              <span className="text-muted-foreground">Selected · </span>
              <span className="font-bold">{pickedName}</span>
            </span>
            <button
              type="button"
              onClick={() => { setPickedId(null); setPickedRowOverride(null); }}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Clear selection"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </FormSection>

      <FormSection label="Assignment">
        <FormRow
          label="Role"
          hint={role === "manager"
            ? "Assistant managers can run the league — settings, ladder, scores and roster."
            : "Players appear on the roster and in ladder/match generation."}
        >
          <SegmentedControl
            value={role}
            onChange={(v) => setRole(v as MemberRole)}
            options={[
              { value: "player",  label: "Player" },
              { value: "manager", label: "Assistant manager" },
            ]}
          />
        </FormRow>
        <FormRow
          label="Status"
          hint={status === "pending"
            ? "Pending members don't get scheduled until you activate them."
            : "Active members are eligible for scheduling right away."}
        >
          <SegmentedControl
            value={status}
            onChange={(v) => setStatus(v as MemberStatus)}
            options={[
              { value: "active",  label: "Active" },
              { value: "pending", label: "Pending" },
            ]}
          />
        </FormRow>
      </FormSection>
    </FormShell>
  );
}


/* ------------------------------------------------------------------ */
/*  Bulk-add dialog                                                    */
/* ------------------------------------------------------------------ */

interface ResolvedRow {
  email: string;
  user_id: string;
  name: string;
  outcome: "added" | "already_active" | "reactivated";
}

interface DryRunReport {
  resolved: ResolvedRow[];
  unmatched: string[];
  added_count: number;
  reactivated_count: number;
  already_active_count: number;
  dry_run: boolean;
}

/**
 * Two-phase bulk import. Paste emails, run a server-side dry-run to
 * resolve everything, review the preview, then commit. The commit is
 * idempotent (removed memberships get reactivated; active ones are
 * left alone), so re-running is cheap.
 */
function BulkAddMembersDialog({
  league, seasonId, onDone,
}: {
  league: League;
  seasonId: string;
  onDone: () => Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DryRunReport | null>(null);

  // Split the paste into a clean unique lowercased list — handles both
  // newlines and commas, ignores blanks, dedupes.
  const emails = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    raw.split(/[\n,;]/).forEach((chunk) => {
      const e = chunk.trim();
      if (!e) return;
      const key = e.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(e);
    });
    return out;
  }, [raw]);

  const runDryRun = async () => {
    if (emails.length === 0) { toast.error("Paste some emails first"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc(
      "bulk_add_league_members" as never,
      {
        p_league_id: league.id,
        p_season_id: seasonId,
        p_emails: emails,
        p_dry_run: true,
      } as never,
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPreview(data as unknown as DryRunReport);
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    const { data, error } = await supabase.rpc(
      "bulk_add_league_members" as never,
      {
        p_league_id: league.id,
        p_season_id: seasonId,
        p_emails: emails,
        p_dry_run: false,
      } as never,
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const report = data as unknown as DryRunReport;
    const parts: string[] = [];
    if (report.added_count) parts.push(`${report.added_count} added`);
    if (report.reactivated_count) parts.push(`${report.reactivated_count} reactivated`);
    if (report.already_active_count) parts.push(`${report.already_active_count} already members`);
    toast.success(parts.length ? parts.join(" · ") : "Nothing changed");
    setPreview(null);
    setRaw("");
    await onDone();
  };

  const reset = () => setPreview(null);

  const groupOutcome = (o: ResolvedRow["outcome"]) =>
    preview?.resolved.filter((r) => r.outcome === o) ?? [];

  const commitCount = preview ? preview.added_count + preview.reactivated_count : 0;

  return (
    <FormShell
      icon={<ClipboardList className="w-5 h-5" />}
      tone="gold"
      size="lg"
      kicker={preview ? "Step 2 · Review" : "Step 1 · Paste"}
      title={preview ? "Review the import" : "Bulk add members"}
      subtitle={preview
        ? "Nothing has changed yet — confirm below to commit."
        : "Paste an email list. We resolve every address before anything is saved."}
      primaryLabel={preview
        ? `Add ${commitCount} member${commitCount === 1 ? "" : "s"}`
        : `Preview ${emails.length || ""} match${emails.length === 1 ? "" : "es"}`}
      primaryLoading={busy}
      primaryDisabled={preview ? commitCount === 0 : emails.length === 0}
      onPrimary={preview ? commit : runDryRun}
      secondary={preview ? (
        <Button variant="outline" onClick={reset} disabled={busy} className="h-12 sm:w-28">
          Back
        </Button>
      ) : undefined}
    >
      {/* Phase 1 — paste + preview */}
      {!preview ? (
        <FormSection label="Emails" hint="One per line, or comma-separated">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"alice@example.com\nbob@example.com"}
            rows={7}
            className="rounded-lg font-mono text-sm"
          />
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Case-insensitive · must be existing PULSE accounts
            </span>
            {emails.length > 0 && (
              <span className="font-bold tabular-nums text-primary shrink-0">
                {emails.length} unique
              </span>
            )}
          </div>
        </FormSection>
      ) : (
        // Phase 2 — review + commit
        <>
          <FormSection label="Summary">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Add" count={preview.added_count} tone="primary" icon={CheckCircle2} />
              <StatCard label="Reactivate" count={preview.reactivated_count} tone="amber" icon={RotateCw} />
              <StatCard label="Already in" count={preview.already_active_count} tone="muted" icon={Users} />
              <StatCard label="Unmatched" count={preview.unmatched.length} tone="destructive" icon={AlertCircle} />
            </div>
          </FormSection>

          <FormSection label="Details">
            <div className="max-h-64 overflow-y-auto space-y-3 rounded-xl border border-border/70 bg-card/70 p-3">
              <GroupSection
                title="Will be added" tone="text-primary"
                icon={CheckCircle2}
                rows={groupOutcome("added")}
              />
              <GroupSection
                title="Will be reactivated" tone="text-amber-600"
                icon={RotateCw}
                rows={groupOutcome("reactivated")}
              />
              <GroupSection
                title="Already active" tone="text-muted-foreground"
                icon={Users}
                rows={groupOutcome("already_active")}
              />
              {preview.unmatched.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Not found ({preview.unmatched.length})
                  </div>
                  <ul className="text-xs font-mono space-y-0.5 pl-1">
                    {preview.unmatched.map((e) => (
                      <li key={e} className="text-muted-foreground line-through">
                        {e}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-muted-foreground mt-1 pl-1">
                    No PULSE account matches these. Ask them to sign up first.
                  </p>
                </div>
              )}
            </div>
          </FormSection>
        </>
      )}
    </FormShell>
  );
}


function StatCard({
  label, count, tone, icon: Icon,
}: {
  label: string;
  count: number;
  tone: "primary" | "amber" | "muted" | "destructive";
  icon: typeof CheckCircle2;
}) {
  const toneCls = {
    primary:     "bg-primary/10 text-primary",
    amber:       "bg-amber-500/10 text-amber-600",
    muted:       "bg-muted text-muted-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className={`rounded-lg p-2 flex items-center gap-2 ${toneCls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none tabular-nums">{count}</div>
        <div className="text-[9px] uppercase tracking-wider font-bold opacity-80">
          {label}
        </div>
      </div>
    </div>
  );
}

function GroupSection({
  title, tone, icon: Icon, rows,
}: {
  title: string;
  tone: string;
  icon: typeof CheckCircle2;
  rows: ResolvedRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1 ${tone}`}>
        <Icon className="w-3 h-3" />
        {title} ({rows.length})
      </div>
      <ul className="text-xs space-y-0.5 pl-1">
        {rows.map((r) => (
          <li key={r.email} className="flex items-baseline gap-1.5">
            <span className="font-medium truncate">{r.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {r.email}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
