import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  UserPlus,
  X,
  User,
  ChevronRight,
  Shield,
  Users,
  Star,
  MapPin,
  Sparkles,
  UserCheck,
  Swords,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useFriends } from "@/hooks/useFriends";
import { useFriendSuggestions } from "@/hooks/useFriendSuggestions";
import { useRecentCoPlayers } from "@/hooks/useRecentCoPlayers";
import { useDebounce } from "@/hooks/useDebounce";
import { MatchWizardFormData, PlayerSlot } from "../hooks/useMatchWizardSteps";

interface PlayerSelectionStepProps {
  formData: MatchWizardFormData;
  updateFormData: <K extends keyof MatchWizardFormData>(
    field: K,
    value: MatchWizardFormData[K],
  ) => void;
}

interface Player {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  town?: string | null;
  state?: string | null;
}

type Relationship = "friend" | "recent" | "community" | "suggested" | "self" | null;

interface RowPlayer extends Player {
  relationship: Relationship;
}


type SlotTarget = { team: "team1" | "team2"; index: number };
type TabKey = "suggested" | "friends" | "nearby";

const TEAM_LABEL: Record<"team1" | "team2", string> = {
  team1: "Team 1",
  team2: "Team 2",
};

function shortName(p: { display_name?: string | null; full_name?: string | null }) {
  const raw = (p.display_name || p.full_name || "").trim();
  if (!raw) return "Player";
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function initials(p: { display_name?: string | null; full_name?: string | null }) {
  const raw = (p.display_name || p.full_name || "?").trim();
  return raw
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relationshipMeta(rel: Relationship) {
  switch (rel) {
    case "friend":
      return {
        label: "Friend",
        icon: UserCheck,
        className:
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20",
      };
    case "recent":
      return {
        label: "Recent Opponent",
        icon: Swords,
        className:
          "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20",
      };
    case "community":
      return {
        label: "Same Community",
        icon: Users,
        className:
          "bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20",
      };
    case "suggested":
      return {
        label: "Suggested",
        icon: Sparkles,
        className:
          "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20",
      };
    case "self":
      return {
        label: "You",
        icon: UserCheck,
        className:
          "bg-primary/15 text-primary ring-1 ring-primary/30",
      };
    default:
      return null;
  }
}


export function PlayerSelectionStep({
  formData,
  updateFormData,
}: PlayerSelectionStepProps) {
  const slotsPerTeam = formData.matchFormat === "singles" ? 1 : 2;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<SlotTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestData, setGuestData] = useState({ name: "", notes: "" });
  const [profileCache, setProfileCache] = useState<Record<string, Player>>({});
  const [currentUserProfile, setCurrentUserProfile] = useState<Player | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await supabase
        .from("profiles_public")
        .select("id, display_name, full_name, avatar_url, current_rating")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        const me = data as Player;
        setCurrentUserProfile(me);
        setProfileCache((prev) => ({ ...prev, [me.id]: me }));
      }
    });
  }, []);


  const selectedIds = useMemo(() => {
    const ids = new Set<string>();
    [...formData.team1, ...formData.team2].forEach((s) => {
      if (s?.playerId) ids.add(s.playerId);
    });
    return ids;
  }, [formData.team1, formData.team2]);

  // Hydrate profile cache for any selected real players (skip current user — already cached)
  useEffect(() => {
    const missing = [...selectedIds].filter(
      (id) => !profileCache[id] && id !== currentUserId,
    );
    if (missing.length === 0) return;
    supabase
      .from("profiles_public")
      .select("id, display_name, full_name, avatar_url, current_rating")
      .in("id", missing)
      .then(({ data }) => {
        if (!data) return;
        setProfileCache((prev) => {
          const next = { ...prev };
          for (const p of data) {
            if (p.id) next[p.id] = p as Player;
          }
          return next;
        });
      });
  }, [selectedIds, profileCache, currentUserId]);

  const openSheetForSlot = (target: SlotTarget) => {
    setActiveSlot(target);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setActiveSlot(null);
  };

  const commitPlayerToSlot = (player: Player, target: SlotTarget) => {
    setProfileCache((prev) => ({ ...prev, [player.id]: player }));
    const team = [...formData[target.team]];
    while (team.length < slotsPerTeam) team.push({ playerId: null, isGuest: false });
    team[target.index] = { playerId: player.id, isGuest: false };
    updateFormData(target.team, team);
    setSheetOpen(false);
    setActiveSlot(null);
  };


  const commitGuestToSlot = (name: string, notes: string, target: SlotTarget) => {
    const team = [...formData[target.team]];
    while (team.length < slotsPerTeam) team.push({ playerId: null, isGuest: false });
    team[target.index] = {
      playerId: null,
      isGuest: true,
      guestName: name,
      guestNotes: notes || undefined,
    };
    updateFormData(target.team, team);
    setActiveSlot(null);
  };


  const handleAddGuestFromHeader = () => {
    // Pick first empty slot, defaulting to team 1
    const findEmpty = (team: "team1" | "team2"): number => {
      for (let i = 0; i < slotsPerTeam; i++) {
        const s = formData[team][i];
        if (!s?.playerId && !s?.isGuest) return i;
      }
      return -1;
    };
    let target: SlotTarget | null = null;
    const t1 = findEmpty("team1");
    if (t1 >= 0) target = { team: "team1", index: t1 };
    else {
      const t2 = findEmpty("team2");
      if (t2 >= 0) target = { team: "team2", index: t2 };
    }
    if (!target) return;
    setActiveSlot(target);
    setShowGuestModal(true);
  };

  const handleRemove = (team: "team1" | "team2", index: number) => {
    if (
      team === "team1" &&
      index === 0 &&
      formData.team1[0]?.playerId === currentUserId
    ) {
      return;
    }
    const next = [...formData[team]];
    next[index] = { playerId: null, isGuest: false };
    updateFormData(team, next);
  };

  const teamHasSelection = (team: "team1" | "team2") =>
    formData[team].slice(0, slotsPerTeam).some((s) => s?.playerId || s?.isGuest);

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-secondary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-secondary" strokeWidth={1.75} />
          </div>
          <h2 className="text-base font-semibold tracking-tight">Who played?</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full h-10 px-4 text-xs gap-1.5 border-border/70"
          onClick={handleAddGuestFromHeader}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add Guest
        </Button>
      </div>

      {/* Team panels */}
      <div className="grid grid-cols-2 gap-3">
        {(["team1", "team2"] as const).map((teamKey) => {
          const active = teamHasSelection(teamKey);
          return (
            <div
              key={teamKey}
              className="rounded-2xl border border-border/60 bg-card p-3.5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">
                  {TEAM_LABEL[teamKey]}
                </span>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    active ? "bg-primary" : "bg-muted-foreground/25",
                  )}
                  aria-hidden
                />
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: slotsPerTeam }).map((_, idx) => (
                  <SlotButton
                    key={idx}
                    slot={formData[teamKey][idx]}
                    isActive={
                      activeSlot?.team === teamKey && activeSlot.index === idx
                    }
                    isCurrentUser={
                      formData[teamKey][idx]?.playerId === currentUserId
                    }
                    cachedPlayer={
                      formData[teamKey][idx]?.playerId
                        ? profileCache[formData[teamKey][idx]!.playerId!]
                        : undefined
                    }
                    onOpen={() =>
                      openSheetForSlot({ team: teamKey, index: idx })
                    }
                    onRemove={() => handleRemove(teamKey, idx)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add-player bottom sheet */}
      <AddPlayerSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        excludeIds={selectedIds}
        currentUserId={currentUserId}
        currentUserProfile={currentUserProfile}
        onPick={(p) => activeSlot && commitPlayerToSlot(p, activeSlot)}
        onPickGuest={() => {
          setSheetOpen(false);
          setShowGuestModal(true);
        }}
      />



      {/* Guest dialog */}
      <Dialog open={showGuestModal} onOpenChange={setShowGuestModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Guest Player</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest-name">Display name</Label>
              <Input
                id="guest-name"
                placeholder="Guest's name"
                value={guestData.name}
                onChange={(e) =>
                  setGuestData((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-notes">Notes (optional)</Label>
              <Textarea
                id="guest-notes"
                placeholder="e.g. visiting friend"
                rows={2}
                value={guestData.notes}
                onChange={(e) =>
                  setGuestData((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGuestModal(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!guestData.name.trim()}
              onClick={() => {
                if (!activeSlot) return;
                commitGuestToSlot(
                  guestData.name.trim(),
                  guestData.notes.trim(),
                  activeSlot,
                );
                setShowGuestModal(false);
                setGuestData({ name: "", notes: "" });
              }}
            >
              Add Guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================ Slot button ============================ */

interface SlotButtonProps {
  slot: PlayerSlot | undefined;
  isActive: boolean;
  isCurrentUser: boolean;
  cachedPlayer: Player | undefined;
  onOpen: () => void;
  onRemove: () => void;
}

function SlotButton({
  slot,
  isActive,
  isCurrentUser,
  cachedPlayer,
  onOpen,
  onRemove,
}: SlotButtonProps) {
  const filled = !!(slot?.playerId || slot?.isGuest);

  if (!filled) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl border bg-background/40 px-3 py-3 text-left transition-all min-h-[52px]",
          isActive
            ? "border-primary ring-2 ring-primary/25 shadow-[0_0_0_4px_hsl(var(--primary)/0.06)]"
            : "border-border/70 hover:border-primary/40",
        )}
      >
        <span
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
            isActive
              ? "bg-primary/10 text-primary ring-1 ring-primary/30"
              : "bg-muted text-muted-foreground",
          )}
        >
          <User className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span
          className={cn(
            "flex-1 text-sm font-medium truncate",
            isActive ? "text-primary" : "text-foreground/80",
          )}
        >
          Add player
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0",
            isActive ? "text-primary" : "text-muted-foreground/60",
          )}
        />
      </button>
    );
  }

  const displayName = slot?.isGuest
    ? slot.guestName
    : isCurrentUser
      ? "You"
      : cachedPlayer
        ? shortName(cachedPlayer)
        : "Player";

  return (
    <div
      className={cn(
        "w-full flex items-center gap-2.5 rounded-xl border pl-2.5 pr-1 py-2 min-h-[52px]",
        slot?.isGuest
          ? "border-dashed border-primary/40 bg-primary/5"
          : "border-border/70 bg-muted/40",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label="Replace player"
        className="flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg -m-1 p-1 hover:bg-foreground/[0.02] active:bg-foreground/[0.04] transition-colors"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={cachedPlayer?.avatar_url || undefined} />
          <AvatarFallback className="text-[10px]">
            {slot?.isGuest
              ? (slot.guestName?.[0] || "G").toUpperCase()
              : cachedPlayer
                ? initials(cachedPlayer)
                : "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate leading-tight">
            {displayName}
          </p>
          {slot?.isGuest ? (
            <p className="text-[10px] uppercase tracking-wide text-primary/80 font-semibold">
              Guest
            </p>
          ) : cachedPlayer?.current_rating ? (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              PULSE {cachedPlayer.current_rating.toFixed(1)}
            </p>
          ) : null}
        </div>
      </button>
      {!isCurrentUser && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove player"
          className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}


/* =========================== Add player sheet =========================== */

interface AddPlayerSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  excludeIds: Set<string>;
  currentUserId: string | null;
  currentUserProfile: Player | null;
  onPick: (player: Player) => void;
  onPickGuest: () => void;
}

function AddPlayerSheet({
  open,
  onOpenChange,
  excludeIds,
  currentUserId: _currentUserId,
  currentUserProfile,
  onPick,
  onPickGuest: _onPickGuest,
}: AddPlayerSheetProps) {

  const [tab, setTab] = useState<TabKey>("suggested");
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);

  const { friends, loading: friendsLoading } = useFriends();
  const { suggestions, loading: suggestionsLoading } = useFriendSuggestions();
  const { data: recent = [] } = useRecentCoPlayers();

  // Search across profiles_public
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const { data } = await supabase
        .from("profiles_public")
        .select("id, display_name, full_name, avatar_url, current_rating")
        .or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(15);
      setSearchResults(
        (data || []).map((p) => ({
          ...p,
          id: p.id as string,
        })) as Player[],
      );
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounced) runSearch(debounced);
    else setSearchResults([]);
  }, [debounced, runSearch]);

  // Allow the signed-in user to pick themselves — only exclude already-selected slots.
  const filterOut = useCallback(
    (p: { id: string }) => !excludeIds.has(p.id),
    [excludeIds],
  );


  // Build relationship-tagged lists
  const friendIdSet = useMemo(
    () => new Set(friends.map((f) => f.profile.id)),
    [friends],
  );
  const recentIdSet = useMemo(() => new Set(recent.map((r) => r.id)), [recent]);

  const suggestedList: RowPlayer[] = useMemo(() => {
    // Hierarchy: self → friends → recent → community → suggested
    const seen = new Set<string>();
    const out: RowPlayer[] = [];

    const push = (p: Player, rel: Relationship) => {
      if (!p?.id || seen.has(p.id)) return;
      if (!filterOut({ id: p.id })) return;
      seen.add(p.id);
      out.push({ ...p, relationship: rel });
    };

    if (currentUserProfile) push(currentUserProfile, "self");



    for (const f of friends) {
      push(
        {
          id: f.profile.id,
          display_name: f.profile.display_name,
          full_name: f.profile.full_name,
          avatar_url: f.profile.avatar_url,
          current_rating: f.profile.current_rating,
        },
        "friend",
      );
    }
    for (const r of recent) {
      push(
        {
          id: r.id,
          display_name: r.display_name,
          full_name: r.full_name,
          avatar_url: r.avatar_url,
          current_rating: r.current_rating,
        },
        friendIdSet.has(r.id) ? "friend" : "recent",
      );
    }
    for (const s of suggestions) {
      const rel: Relationship = friendIdSet.has(s.id)
        ? "friend"
        : recentIdSet.has(s.id)
          ? "recent"
          : s.reason === "same_group" || s.reason === "shared_community"
            ? "community"
            : "suggested";
      push(
        {
          id: s.id,
          display_name: s.display_name,
          full_name: s.full_name,
          avatar_url: s.avatar_url,
          current_rating: s.current_rating,
        },
        rel,
      );
    }
    return out.slice(0, 30);
  }, [friends, recent, suggestions, friendIdSet, recentIdSet, filterOut, currentUserProfile]);

  const friendsList: RowPlayer[] = useMemo(
    () =>
      friends
        .map((f) => ({
          id: f.profile.id,
          display_name: f.profile.display_name,
          full_name: f.profile.full_name,
          avatar_url: f.profile.avatar_url,
          current_rating: f.profile.current_rating,
          relationship: "friend" as Relationship,
        }))
        .filter(filterOut),
    [friends, filterOut],
  );

  const searchList: RowPlayer[] = useMemo(
    () =>
      searchResults.filter(filterOut).map((p) => ({
        ...p,
        relationship: friendIdSet.has(p.id)
          ? ("friend" as Relationship)
          : recentIdSet.has(p.id)
            ? ("recent" as Relationship)
            : null,
      })),
    [searchResults, filterOut, friendIdSet, recentIdSet],
  );

  // Reset only when the sheet opens — avoids a flash on close.
  useEffect(() => {
    if (open) {
      setTab("suggested");
      setSearch("");
    }
  }, [open]);

  const isSearching = search.trim().length >= 2;

  // Pin the current user as a dedicated "You" row at the top of Suggested,
  // and remove them from the rest of the list so they only appear once.
  const selfRow: RowPlayer | null =
    !isSearching && currentUserProfile && filterOut({ id: currentUserProfile.id })
      ? { ...currentUserProfile, relationship: "self" }
      : null;
  const suggestedWithoutSelf = selfRow
    ? suggestedList.filter((p) => p.id !== selfRow.id)
    : suggestedList;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] h-[85vh] p-0 flex flex-col gap-0 rounded-t-3xl border-t border-border/70"
      >
        <SheetHeader className="px-5 pt-5 pb-2 text-left">
          <SheetTitle className="text-xl tracking-tight">Add Player</SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="px-5 pt-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-muted/40 border-border/60 text-sm"
            />
          </div>
        </div>

        {/* Pill tabs — hidden while searching so the active tab doesn't jump */}
        {!isSearching && (
          <div className="px-5 pt-3 pb-1">
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {(
                [
                  { key: "suggested", label: "Suggested", icon: Star },
                  { key: "friends", label: "Friends", icon: Users },
                  { key: "nearby", label: "Nearby", icon: MapPin },
                ] as { key: TabKey; label: string; icon: typeof Star }[]
              ).map((p) => {
                const Icon = p.icon;
                const isActive = tab === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setTab(p.key)}
                    className={cn(
                      "shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 min-h-[36px] min-w-[88px] text-sm font-medium border transition-colors",
                      isActive
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-background text-muted-foreground border-border/70 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3 space-y-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {isSearching ? (
              searchLoading ? (
                <EmptyHint text="Searching…" />
              ) : searchList.length === 0 ? (
                <EmptyHint text="No players match that name." />
              ) : (
                searchList.map((p) => (
                  <ResultRow key={p.id} player={p} onAdd={() => onPick(p)} />
                ))
              )
            ) : tab === "suggested" ? (
              suggestionsLoading && suggestedWithoutSelf.length === 0 && !selfRow ? (
                <EmptyHint text="Finding players you know…" />
              ) : suggestedWithoutSelf.length === 0 && !selfRow ? (
                <EmptyHint text="No suggestions yet — try Friends or Search." />
              ) : (
                <>
                  {selfRow && (
                    <>
                      <ResultRow player={selfRow} onAdd={() => onPick(selfRow)} />
                      {suggestedWithoutSelf.length > 0 && (
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                          Suggested
                        </div>
                      )}
                    </>
                  )}
                  {suggestedWithoutSelf.map((p) => (
                    <ResultRow key={p.id} player={p} onAdd={() => onPick(p)} />
                  ))}
                </>
              )
            ) : tab === "friends" ? (
              friendsLoading ? (
                <EmptyHint text="Loading friends…" />
              ) : friendsList.length === 0 ? (
                <EmptyHint text="You haven't added any friends yet." />
              ) : (
                friendsList.map((p) => (
                  <ResultRow key={p.id} player={p} onAdd={() => onPick(p)} />
                ))
              )
            ) : (
              <EmptyHint text="Nearby player discovery is coming soon. For now use Suggested or Search." />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}


function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ResultRow({
  player,
  onAdd,
}: {
  player: RowPlayer;
  onAdd: () => void;
}) {
  const rel = relationshipMeta(player.relationship);
  const RelIcon = rel?.icon;
  const isSelf = player.relationship === "self";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
        isSelf
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-border/60 bg-card",
      )}
    >
      <Avatar className="h-11 w-11">
        <AvatarImage src={player.avatar_url || undefined} />
        <AvatarFallback>{initials(player)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold leading-tight truncate">
          {isSelf ? "You" : shortName(player)}
        </p>
        {rel && RelIcon && (
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              rel.className,
            )}
          >
            <RelIcon className="h-3 w-3" />
            {rel.label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 pl-1">
        {player.current_rating != null && (
          <div className="text-right pr-2 border-r border-border/70">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">
              Pulse
            </p>
            <p className="text-sm font-bold text-primary tabular-nums leading-tight mt-0.5">
              {player.current_rating.toFixed(1)}
            </p>
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onAdd}
          className="h-10 px-3 text-primary hover:bg-primary/10 font-semibold text-sm"
        >
          {isSelf ? "Add me" : "+ Add"}
        </Button>
      </div>
    </div>
  );
}

