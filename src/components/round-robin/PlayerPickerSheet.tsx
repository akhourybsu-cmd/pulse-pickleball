import { useEffect, useMemo, useState } from "react";
import { Search, Users, UsersRound, Clock, UserPlus, X, Check, Link2, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFriends } from "@/hooks/useFriends";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useRecentCoPlayers } from "@/hooks/useRecentCoPlayers";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export interface PickerPlayer {
  id: string;
  full_name: string;
  display_name: string | null;
  gender?: string | null;
  avatar_url?: string | null;
  current_rating?: number | null;
  isGuest?: boolean;
}

interface PlayerPickerSheetProps {
  selectedPlayers: PickerPlayer[];
  onPlayersChange: (players: PickerPlayer[]) => void;
  genderFilter?: "male" | "female";
  groupId?: string | null;
  trigger: React.ReactNode;
  /** "multi" keeps a Done button; "single" commits on the first tap. */
  mode?: "multi" | "single";
  /** Player IDs to hide from all tabs (already-in-event roster, etc.). */
  excludePlayerIds?: string[];
  /** Show the Guest tab. Default: true in multi mode, false in single mode
   *  (single is used for substitution which writes to schedule.player_id). */
  allowGuest?: boolean;
}

type PickerTab = "friends" | "group" | "recent" | "search" | "guest";

function initials(p: { full_name: string; display_name: string | null }) {
  const name = p.display_name || p.full_name || "?";
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function matchGender(g: string | null | undefined, filter?: "male" | "female") {
  if (!filter) return true;
  return g === filter;
}

export function PlayerPickerSheet({
  selectedPlayers,
  onPlayersChange,
  genderFilter,
  groupId,
  trigger,
  mode = "multi",
  excludePlayerIds,
  allowGuest,
}: PlayerPickerSheetProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<PickerPlayer[]>(selectedPlayers);
  const [tab, setTab] = useState<PickerTab>("friends");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [guestName, setGuestName] = useState("");

  const showGuest = allowGuest ?? mode === "multi";
  const excludeSet = useMemo(
    () => new Set(excludePlayerIds ?? []),
    [excludePlayerIds],
  );

  // Reset local state every time the sheet opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setLocal(selectedPlayers);
      if (tab === "guest" && !showGuest) setTab("friends");
      if (tab === "group" && !groupId) setTab("friends");
    }
    setOpen(v);
  };

  useEffect(() => {
    if (tab === "guest" && !showGuest) setTab("friends");
    if (tab === "group" && !groupId) setTab("friends");
  }, [groupId, showGuest, tab]);

  const selectedIds = useMemo(() => new Set(local.map((p) => p.id)), [local]);

  const toggle = (p: PickerPlayer) => {
    if (mode === "single") {
      // Commit immediately and close
      onPlayersChange([p]);
      setOpen(false);
      return;
    }
    setLocal((prev) =>
      prev.some((x) => x.id === p.id)
        ? prev.filter((x) => x.id !== p.id)
        : [...prev, p],
    );
  };

  const removeOne = (id: string) => {
    setLocal((prev) => prev.filter((p) => p.id !== id));
  };

  const qc = useQueryClient();

  const addGuest = async () => {
    const name = guestName.trim();
    if (!name) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("guest_players")
        .insert({
          display_name: name,
          created_by: user.id,
          group_id: groupId ?? null,
        } as never)
        .select("id, display_name")
        .single();
      if (error) throw error;
      const guest: PickerPlayer = {
        id: (data as { id: string }).id,
        full_name: name,
        display_name: name,
        isGuest: true,
      };
      // Refresh the saved-guest roster query so the new entry shows up below
      qc.invalidateQueries({ queryKey: ["guest-players-roster"] });
      toast.success(`${name} added as a guest`);
      if (mode === "single") {
        onPlayersChange([guest]);
        setGuestName("");
        setOpen(false);
        return;
      }
      setLocal((prev) => [...prev, guest]);
      setGuestName("");
    } catch (e) {
      console.error("Failed to save guest:", e);
      toast.error("Couldn't add that guest. Try again.");
    }
  };


  const commit = () => {
    onPlayersChange(local);
    setOpen(false);
  };

  const tabs: { value: PickerTab; label: string; icon: LucideIcon }[] = [
    { value: "friends", label: "Friends", icon: Users },
    ...(groupId ? [{ value: "group" as const, label: "Group", icon: UsersRound }] : []),
    { value: "recent", label: "Recent", icon: Clock },
    { value: "search", label: "Search", icon: Search },
    ...(showGuest ? [{ value: "guest" as const, label: "Guest", icon: UserPlus }] : []),
  ];


  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-[90vh] p-0 flex flex-col gap-0 rounded-t-2xl"
      >
        {/* Sticky header */}
        <div className="px-4 pt-4 pb-2 border-b bg-background">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">
              {mode === "single" ? "Choose a player" : "Add Players"}
            </h3>
            {mode === "multi" && (
              <span className="text-sm text-muted-foreground">
                {local.length} selected
              </span>
            )}
          </div>

          {mode === "multi" && local.length > 0 && (
            <ScrollArea className="max-h-20 mb-3">
              <div className="flex flex-wrap gap-1.5 pb-1">
                {local.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className="px-2 py-1 gap-1"
                  >
                    {p.display_name || p.full_name}
                    {p.isGuest && (
                      <span className="text-[10px] uppercase opacity-60">
                        guest
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeOne(p.id)}
                      className="ml-1 hover:text-destructive"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Picker tabs use plain buttons instead of Radix Tabs so the bottom-sheet
            content stays reliable inside the Round Robin wizard on mobile. */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            className="mx-4 mt-3 grid rounded-md bg-muted p-1 text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
            role="tablist"
            aria-label="Player sources"
          >
            {tabs.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center gap-1 rounded-sm px-1.5 py-2 text-xs font-medium transition-all",
                  tab === value && "bg-background text-foreground shadow-sm",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "friends" && (
              <FriendsList
                selectedIds={selectedIds}
                onToggle={toggle}
                genderFilter={genderFilter}
                excludeSet={excludeSet}
              />
            )}

            {groupId && tab === "group" && (
                <GroupList
                  groupId={groupId}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                  genderFilter={genderFilter}
                  excludeSet={excludeSet}
                  showAddAll={mode === "multi"}
                />
            )}

            {tab === "recent" && (
              <RecentList
                selectedIds={selectedIds}
                onToggle={toggle}
                genderFilter={genderFilter}
                excludeSet={excludeSet}
              />
            )}

            {tab === "search" && (
              <div className="h-full m-0 flex flex-col">
              <div className="px-4 pt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Search by name…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-11 text-base"
                  />
                </div>
              </div>
              <SearchList
                query={debouncedSearch}
                selectedIds={selectedIds}
                onToggle={toggle}
                genderFilter={genderFilter}
                excludeSet={excludeSet}
              />
              </div>
            )}

            {showGuest && tab === "guest" && (
              <GuestPanel
                guestName={guestName}
                onGuestNameChange={setGuestName}
                onAddGuest={addGuest}
                groupId={groupId}
                selectedIds={selectedIds}
                onToggle={toggle}
                excludeSet={excludeSet}
              />
            )}

          </div>
        </div>

        {/* Sticky footer — only in multi mode */}
        {mode === "multi" && (
          <div className="border-t bg-background p-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {local.length} player{local.length === 1 ? "" : "s"}
            </span>
            <Button onClick={commit} className="flex-1 max-w-[180px]">
              Done
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function GuestPanel({
  guestName,
  onGuestNameChange,
  onAddGuest,
  groupId,
  selectedIds,
  onToggle,
  excludeSet,
}: {
  guestName: string;
  onGuestNameChange: (value: string) => void;
  onAddGuest: () => void;
  groupId?: string | null;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  excludeSet?: Set<string>;
}) {
  return (
    <div className="h-full m-0 flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add new guest
          </p>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 text-right">
            Name only — reusable later
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Alex K"
            value={guestName}
            onChange={(e) => onGuestNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddGuest();
              }
            }}
            className="h-11 text-base"
          />
          <Button type="button" onClick={onAddGuest} disabled={!guestName.trim()}>
            <UserPlus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
      <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Saved guests
      </div>
      <GuestRosterList
        groupId={groupId}
        selectedIds={selectedIds}
        onToggle={onToggle}
        excludeSet={excludeSet}
      />
    </div>
  );
}


interface RowProps {
  p: PickerPlayer;
  selected: boolean;
  onToggle: () => void;
  hint?: string;
  /** Optional trailing element rendered to the left of the check indicator. */
  trailing?: React.ReactNode;
}

function PlayerRow({ p, selected, onToggle, hint, trailing }: RowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left",
        selected && "bg-primary/5",
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={p.avatar_url || undefined} />
        <AvatarFallback>{initials(p)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{p.display_name || p.full_name}</p>
        {(hint || p.current_rating) && (
          <p className="text-xs text-muted-foreground truncate">
            {p.current_rating ? `${p.current_rating.toFixed(2)}` : ""}
            {hint && p.current_rating ? " · " : ""}
            {hint}
          </p>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
      <div
        className={cn(
          "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
          selected
            ? "bg-primary border-primary"
            : "border-muted-foreground/30",
        )}
      >
        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
    </button>
  );
}


function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center px-8">
      <p className="text-sm text-muted-foreground text-center">{message}</p>
    </div>
  );
}

function FriendsList({
  selectedIds,
  onToggle,
  genderFilter,
  excludeSet,
}: {
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
  excludeSet?: Set<string>;
}) {
  const { friends, loading } = useFriends();
  const items = friends
    .map((f) => ({
      id: f.profile.id,
      full_name: f.profile.full_name || "",
      display_name: f.profile.display_name,
      avatar_url: f.profile.avatar_url,
      current_rating: f.profile.current_rating,
    }))
    .filter((p) => (p.full_name || p.display_name) && !excludeSet?.has(p.id));

  if (loading) return <EmptyState message="Loading friends…" />;
  if (items.length === 0)
    return (
      <EmptyState message="No friends available — add some from Community, or use Search." />
    );

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        {items.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            selected={selectedIds.has(p.id)}
            onToggle={() => onToggle(p)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function GroupList({
  groupId,
  selectedIds,
  onToggle,
  genderFilter,
  excludeSet,
  showAddAll = true,
}: {
  groupId: string;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
  excludeSet?: Set<string>;
  showAddAll?: boolean;
}) {
  const { members, loading } = useGroupMembers(groupId);
  const items = members
    .map((m) => ({
      id: m.profile.id,
      full_name: m.profile.full_name,
      display_name: m.profile.display_name,
      avatar_url: m.profile.avatar_url,
      current_rating: m.profile.current_rating,
    }))
    .filter((p) => !excludeSet?.has(p.id));

  if (loading) return <EmptyState message="Loading group members…" />;
  if (items.length === 0)
    return <EmptyState message="No group members available." />;

  const remaining = items.filter((p) => !selectedIds.has(p.id));

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        {showAddAll && remaining.length > 0 && (
          <div className="px-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => remaining.forEach((p) => onToggle(p))}
            >
              Add all {remaining.length}
            </Button>
          </div>
        )}
        {items.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            selected={selectedIds.has(p.id)}
            onToggle={() => onToggle(p)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function RecentList({
  selectedIds,
  onToggle,
  genderFilter,
  excludeSet,
}: {
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
  excludeSet?: Set<string>;
}) {
  const { data = [], isLoading } = useRecentCoPlayers();
  const items = data
    .filter((p) => matchGender(p.gender, genderFilter))
    .filter((p) => !excludeSet?.has(p.id));

  if (isLoading) return <EmptyState message="Loading recent players…" />;
  if (items.length === 0)
    return (
      <EmptyState message="No recent co-players available." />
    );

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        {items.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            selected={selectedIds.has(p.id)}
            onToggle={() => onToggle(p)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function SearchList({
  query,
  selectedIds,
  onToggle,
  genderFilter,
  excludeSet,
}: {
  query: string;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
  excludeSet?: Set<string>;
}) {
  const { data = [], isFetching } = useQuery({
    queryKey: ["picker-search", query, genderFilter ?? "any"],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("id, full_name, display_name, avatar_url, current_rating, gender")
        .or(`full_name.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(30);
      if (genderFilter) q = q.eq("gender", genderFilter);
      const { data } = await q;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const items = data.filter((p) => !excludeSet?.has(p.id));

  if (query.trim().length < 2)
    return <EmptyState message="Type at least 2 characters to search." />;
  if (isFetching) return <EmptyState message="Searching…" />;
  if (items.length === 0) return <EmptyState message="No players found." />;

  return (
    <ScrollArea className="h-[calc(100%-72px)]">
      <div className="py-2">
        {items.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            selected={selectedIds.has(p.id)}
            onToggle={() => onToggle(p)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function GuestRosterList({
  groupId,
  selectedIds,
  onToggle,
  excludeSet,
}: {
  groupId?: string | null;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  excludeSet?: Set<string>;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["guest-players-roster", groupId ?? "personal"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let q = supabase
        .from("guest_players")
        .select("id, display_name, linked_user_id, created_at")
        .order("display_name", { ascending: true })
        .limit(100);
      if (groupId) {
        q = q.or(`created_by.eq.${user.id},group_id.eq.${groupId}`);
      } else {
        q = q.eq("created_by", user.id);
      }
      const { data } = await q;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Detect duplicate display_names so we can surface a date hint on each
  // sibling — helps a host tell "Alex K (Jun 2)" from "Alex K (Jun 14)".
  const nameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of data) {
      const k = g.display_name.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  const items = data
    .filter((g) => !excludeSet?.has(g.id))
    .map((g) => {
      const isDup = (nameCounts.get(g.display_name.toLowerCase()) ?? 0) > 1;
      const created = g.created_at
        ? new Date(g.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : null;
      return {
        id: g.id,
        full_name: g.display_name,
        display_name: g.display_name,
        isGuest: true,
        linked: !!g.linked_user_id,
        hint: g.linked_user_id
          ? "Linked to a registered player"
          : isDup && created
            ? `Guest · added ${created}`
            : "Guest",
      };
    });

  if (isLoading) return <EmptyState message="Loading guest roster…" />;
  if (items.length === 0)
    return (
      <EmptyState message="No saved guests yet. Add one above — they'll be reusable next time." />
    );

  return (
    <ScrollArea className="flex-1">
      <div className="py-2">
        {items.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            selected={selectedIds.has(p.id)}
            onToggle={() => onToggle(p)}
            hint={p.hint}
            trailing={
              p.linked ? (
                <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                  <Link2 className="h-3 w-3" />
                  Linked
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Guest
                </Badge>
              )
            }
          />
        ))}
      </div>
    </ScrollArea>
  );
}



