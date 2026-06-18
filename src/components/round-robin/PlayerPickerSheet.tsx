import { useMemo, useState } from "react";
import { Search, Users, UsersRound, Clock, UserPlus, X, Check } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useQuery } from "@tanstack/react-query";
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
  const [tab, setTab] = useState("friends");
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
    if (v) setLocal(selectedPlayers);
    setOpen(v);
  };

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

  const addGuest = () => {
    const name = guestName.trim();
    if (!name) return;
    const guest: PickerPlayer = {
      id: `guest-${crypto.randomUUID()}`,
      full_name: name,
      display_name: name,
      isGuest: true,
    };
    if (mode === "single") {
      onPlayersChange([guest]);
      setGuestName("");
      setOpen(false);
      return;
    }
    setLocal((prev) => [...prev, guest]);
    setGuestName("");
  };

  const commit = () => {
    onPlayersChange(local);
    setOpen(false);
  };


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

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList
            className="mx-4 mt-3 h-auto grid"
            style={{
              gridTemplateColumns: `repeat(${
                3 + (groupId ? 1 : 0) + (showGuest ? 1 : 0)
              }, minmax(0, 1fr))`,
            }}
          >
            <TabsTrigger value="friends" className="text-xs py-2 gap-1">
              <Users className="h-3.5 w-3.5" />
              Friends
            </TabsTrigger>
            {groupId && (
              <TabsTrigger value="group" className="text-xs py-2 gap-1">
                <UsersRound className="h-3.5 w-3.5" />
                Group
              </TabsTrigger>
            )}
            <TabsTrigger value="recent" className="text-xs py-2 gap-1">
              <Clock className="h-3.5 w-3.5" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="search" className="text-xs py-2 gap-1">
              <Search className="h-3.5 w-3.5" />
              Search
            </TabsTrigger>
            {showGuest && (
              <TabsTrigger value="guest" className="text-xs py-2 gap-1">
                <UserPlus className="h-3.5 w-3.5" />
                Guest
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="friends" className="h-full m-0">
              <FriendsList
                selectedIds={selectedIds}
                onToggle={toggle}
                genderFilter={genderFilter}
                excludeSet={excludeSet}
              />
            </TabsContent>

            {groupId && (
              <TabsContent value="group" className="h-full m-0">
                <GroupList
                  groupId={groupId}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                  genderFilter={genderFilter}
                  excludeSet={excludeSet}
                  showAddAll={mode === "multi"}
                />
              </TabsContent>
            )}

            <TabsContent value="recent" className="h-full m-0">
              <RecentList
                selectedIds={selectedIds}
                onToggle={toggle}
                genderFilter={genderFilter}
                excludeSet={excludeSet}
              />
            </TabsContent>

            <TabsContent value="search" className="h-full m-0 flex flex-col">
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
            </TabsContent>

            {showGuest && (
              <TabsContent value="guest" className="h-full m-0 p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Add someone who isn't on the app. They'll appear in the
                  lineup by name only — no profile or rating.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Guest name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addGuest();
                      }
                    }}
                    className="h-11 text-base"
                  />
                  <Button onClick={addGuest} disabled={!guestName.trim()}>
                    Add
                  </Button>
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>

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


interface RowProps {
  p: PickerPlayer;
  selected: boolean;
  onToggle: () => void;
  hint?: string;
}

function PlayerRow({ p, selected, onToggle, hint }: RowProps) {
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
}: {
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
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
    .filter((p) => p.full_name || p.display_name);

  if (loading) return <EmptyState message="Loading friends…" />;
  if (items.length === 0)
    return (
      <EmptyState message="No friends yet — add some from Community, or use Search." />
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
}: {
  groupId: string;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
}) {
  const { members, loading } = useGroupMembers(groupId);
  const items = members.map((m) => ({
    id: m.profile.id,
    full_name: m.profile.full_name,
    display_name: m.profile.display_name,
    avatar_url: m.profile.avatar_url,
    current_rating: m.profile.current_rating,
  }));

  if (loading) return <EmptyState message="Loading group members…" />;
  if (items.length === 0)
    return <EmptyState message="This group doesn't have any members yet." />;

  const remaining = items.filter((p) => !selectedIds.has(p.id));

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        {remaining.length > 0 && (
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
}: {
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
}) {
  const { data = [], isLoading } = useRecentCoPlayers();
  const items = data.filter((p) => matchGender(p.gender, genderFilter));

  if (isLoading) return <EmptyState message="Loading recent players…" />;
  if (items.length === 0)
    return (
      <EmptyState message="No recent co-players yet. Once you've organized a round robin, regulars will show up here." />
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
}: {
  query: string;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
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

  if (query.trim().length < 2)
    return <EmptyState message="Type at least 2 characters to search." />;
  if (isFetching) return <EmptyState message="Searching…" />;
  if (data.length === 0) return <EmptyState message="No players found." />;

  return (
    <ScrollArea className="h-[calc(100%-72px)]">
      <div className="py-2">
        {data.map((p) => (
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
