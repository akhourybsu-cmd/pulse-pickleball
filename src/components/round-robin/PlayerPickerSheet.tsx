import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, Users, UsersRound, Clock, UserPlus, X, Check, Plus, Link2, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { RoundRobinButton as Button } from "@/components/round-robin/RoundRobinButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthState } from "@/hooks/useAuthState";
import { fetchSavedGuests } from "@/lib/guests";
import { useFriends } from "@/hooks/useFriends";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useRecentCoPlayers } from "@/hooks/useRecentCoPlayers";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { startPulseActivity } from "@/components/ui/pulse-activity";
import { cn } from "@/lib/utils";
import type { EventFormat } from "@/lib/roundRobin/scheduleCore";
import {
  type BinaryGender,
  participantGenderEligibility,
  requiredGenderForFormat,
  resolveGuestGenderForCreate,
} from "@/lib/roundRobin/participantGender";


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
  /** Full event format, used to validate guest creation and saved guests. */
  eventFormat?: EventFormat;
  groupId?: string | null;
  trigger: React.ReactNode;
  /** "multi" keeps a Done button; "single" commits on the first tap. */
  mode?: "multi" | "single";
  /** Player IDs to hide from all tabs (already-in-event roster, etc.). */
  excludePlayerIds?: string[];
  /** Show the Guest tab. Default: true in multi mode, false in single mode
   *  (single is used for substitution which writes to schedule.player_id). */
  allowGuest?: boolean;
  /** Optional creation-only presentation, without changing other picker callers. */
  contentClassName?: string;
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
  eventFormat,
  groupId,
  trigger,
  mode = "multi",
  excludePlayerIds,
  allowGuest,
  contentClassName,
}: PlayerPickerSheetProps) {
  const tabId = useId();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<PickerPlayer[]>(selectedPlayers);
  const [tab, setTab] = useState<PickerTab>("friends");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const guestBusyRef = useRef(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestName, setGuestName] = useState("");
  const resolvedEventFormat: EventFormat = eventFormat ?? genderFilter ?? "open";
  const fixedGuestGender = requiredGenderForFormat(resolvedEventFormat);
  const constrainedGuestGender = fixedGuestGender ?? (
    resolvedEventFormat === "mixed" ? genderFilter ?? null : null
  );
  const effectiveGenderFilter = fixedGuestGender ?? genderFilter;
  const [guestGender, setGuestGender] = useState<BinaryGender | "">(
    constrainedGuestGender ?? "",
  );

  const showGuest = allowGuest ?? mode === "multi";
  const excludeSet = useMemo(
    () => new Set(excludePlayerIds ?? []),
    [excludePlayerIds],
  );

  // Reset local state every time the sheet opens
  const handleOpenChange = (v: boolean) => {
    if (guestBusyRef.current) return;
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

  useEffect(() => {
    setGuestGender(constrainedGuestGender ?? "");
  }, [constrainedGuestGender]);

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
    if (!name || guestBusyRef.current) return;
    const gender = resolveGuestGenderForCreate(
      resolvedEventFormat,
      guestGender || null,
    );
    if (resolvedEventFormat === "mixed" && !gender) {
      toast.error("Choose male or female so this guest can be scheduled in mixed play.");
      return;
    }
    guestBusyRef.current = true;
    setGuestBusy(true);
    const pulse = startPulseActivity(`Creating guest ${name}…`);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to add a guest.");
      const { data, error } = await supabase
        .from("guest_players")
        .insert({
          display_name: name,
          created_by: user.id,
          group_id: groupId ?? null,
          gender,
        } as never)
        .select("id, display_name, gender")
        .single();
      if (error) throw error;
      const guest: PickerPlayer = {
        id: (data as { id: string }).id,
        full_name: name,
        display_name: name,
        gender: (data as { gender: string | null }).gender,
        isGuest: true,
      };
      // Refresh the saved-guest roster query so the new entry shows up below
      qc.invalidateQueries({ queryKey: ["guest-players-roster"] });
      qc.invalidateQueries({ queryKey: ["my-guest-players"] });
      pulse.done(`${name} added as a guest`);

      if (mode === "single") {
        onPlayersChange([guest]);
        setGuestName("");
        setGuestGender(constrainedGuestGender ?? "");
        setOpen(false);
        return;
      }
      setLocal((prev) => [...prev, guest]);
      setGuestName("");
      setGuestGender(constrainedGuestGender ?? "");
    } catch (e) {
      pulse.fail();
      console.error("Failed to save guest:", e);
      toast.error("Couldn't add that guest. Try again.");
    } finally { guestBusyRef.current = false; setGuestBusy(false); }

  };


  const commit = () => {
    if (guestBusyRef.current) return;
    onPlayersChange(local);
    setOpen(false);
  };

  const tabs: { value: PickerTab; label: string; icon: LucideIcon }[] = [
    { value: "friends", label: "Friends", icon: Users },
    ...(groupId ? [{ value: "group" as const, label: "Group", icon: UsersRound }] : []),
    { value: "recent", label: "Recent", icon: Clock },
    { value: "search", label: "Search", icon: Search },
    ...(showGuest ? [{ value: "guest" as const, label: "Guests", icon: UserPlus }] : []),
  ];


  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className={cn("rr-roster-picker h-[90dvh] p-0 flex flex-col gap-0 rounded-t-3xl border-t border-primary/30", contentClassName)}
      >
        {/* Sticky header */}
        <div className="relative px-4 pt-4 pb-2 border-b border-border/60 bg-background overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.10] to-transparent"
          />
          <div className="relative flex items-start justify-between gap-3 mb-3 pr-10">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
                PULSE · Your roster
              </div>
              <SheetTitle className="text-[20px] font-extrabold tracking-[-0.01em] leading-tight">
                {mode === "single" ? "Choose a player" : "Add players"}
              </SheetTitle>
            </div>
            {mode === "multi" && (
              <span role="status" aria-live="polite" aria-atomic="true" className="flex-shrink-0 mt-1 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-foreground tabular-nums">
                {local.length} selected
              </span>
            )}
          </div>

          <SheetDescription className="relative mb-3 text-sm leading-relaxed">{mode === "single" ? "Choose a player to continue." : "Tap to select. Tap again to remove. Review your selection below."}</SheetDescription>

          {mode === "multi" && local.length > 0 && (
            <ScrollArea className="relative max-h-20 mb-3">
              <div className="flex flex-wrap gap-1.5 pb-1">
                {local.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className="pl-2.5 pr-0 py-0 gap-1 rounded-full border border-primary/30 bg-primary/10 text-foreground"
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
                      className="rr-pressable ml-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-primary/15"
                      aria-label={`Remove ${p.display_name || p.full_name} from selection`}
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
            className="mx-4 mt-3 grid rounded-xl border border-border/60 bg-muted/60 p-1 text-muted-foreground backdrop-blur-sm"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
            role="tablist"
            aria-label="Player sources"
            onKeyDown={(event) => {
              const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              const current = tabs.findIndex((item) => item.value === tab);
              const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
                : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
              setTab(tabs[next].value);
              document.getElementById(`${tabId}-${tabs[next].value}`)?.focus();
            }}
          >
            {tabs.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`${tabId}-${value}`}
                aria-controls={`${tabId}-panel`}
                tabIndex={tab === value ? 0 : -1}
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  "rr-pressable inline-flex min-h-12 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-xs font-semibold",
                  tab === value
                    ? "bg-secondary text-secondary-foreground shadow-sm ring-1 ring-primary/50"
                    : "hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>


          <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} className="flex-1 min-h-0 overflow-hidden">
            {tab === "friends" && (
              <FriendsList
                selectedIds={selectedIds}
                onToggle={toggle}
                genderFilter={effectiveGenderFilter}
                eventFormat={resolvedEventFormat}
                excludeSet={excludeSet}
              />
            )}

            {groupId && tab === "group" && (
                <GroupList
                  groupId={groupId}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                  genderFilter={effectiveGenderFilter}
                  eventFormat={resolvedEventFormat}
                  excludeSet={excludeSet}
                  showAddAll={mode === "multi"}
                />
            )}

            {tab === "recent" && (
              <RecentList
                selectedIds={selectedIds}
                onToggle={toggle}
                genderFilter={effectiveGenderFilter}
                eventFormat={resolvedEventFormat}
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
                genderFilter={effectiveGenderFilter}
                eventFormat={resolvedEventFormat}
                excludeSet={excludeSet}
              />
              </div>
            )}

            {showGuest && tab === "guest" && (
              <GuestPanel
                busy={guestBusy}
                guestName={guestName}
                onGuestNameChange={setGuestName}
                guestGender={guestGender}
                onGuestGenderChange={setGuestGender}
                eventFormat={resolvedEventFormat}
                genderConstraint={constrainedGuestGender}
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
          <div className="rr-picker-footer shrink-0 border-t bg-background p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tabular-nums">{local.length} selected</p>
              <p className="text-xs text-muted-foreground">{local.filter(p => p.isGuest).length} guests included</p>
            </div>
            <Button onClick={commit} disabled={guestBusy} className="flex-1 min-w-[150px] sm:max-w-[240px]">
              <Check className="h-4 w-4" /> Use selection
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function GuestPanel({
  busy,
  guestName,
  onGuestNameChange,
  guestGender,
  onGuestGenderChange,
  eventFormat,
  genderConstraint,
  onAddGuest,
  groupId,
  selectedIds,
  onToggle,
  excludeSet,
}: {
  busy: boolean;
  guestName: string;
  onGuestNameChange: (value: string) => void;
  guestGender: BinaryGender | "";
  onGuestGenderChange: (value: BinaryGender) => void;
  eventFormat: EventFormat;
  genderConstraint: BinaryGender | null;
  onAddGuest: () => void;
  groupId?: string | null;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  excludeSet?: Set<string>;
}) {
  const fixedGender = genderConstraint ?? requiredGenderForFormat(eventFormat);
  const genderRequired = eventFormat === "mixed";
  const canAdd = !busy && !!guestName.trim() && (!genderRequired || !!guestGender);

  return (
    <div className="h-full min-h-0 m-0 flex flex-col overflow-y-auto">
      <div className="shrink-0 mx-4 mt-4 mb-2 rounded-2xl border border-primary/25 bg-primary/[0.045] p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            Add new guest
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {eventFormat === "open"
              ? "No account needed. Create once, then select this guest for future events."
              : fixedGender
                ? "Gender set by event format"
                : "Gender required for scheduling"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="e.g. Alex K"
            aria-label="New guest name"
            autoComplete="off"
            value={guestName}
            disabled={busy}
            onChange={(e) => onGuestNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddGuest();
              }
            }}
            className="h-11 flex-1 text-base"
          />
          {eventFormat !== "open" && (
            <Select
              value={guestGender}
              onValueChange={(value) => onGuestGenderChange(value as BinaryGender)}
              disabled={busy || !!fixedGender}
            >
              <SelectTrigger
                className="h-11 w-full sm:w-36"
                aria-label="Guest gender"
              >
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button type="button" onClick={onAddGuest} disabled={!canAdd} busy={busy} className="h-11">
            <UserPlus className="h-4 w-4 mr-1" />
            {busy ? "Creating guest…" : "Create & select"}
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
        eventFormat={eventFormat}
        genderFilter={genderConstraint ?? undefined}
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
  disabled?: boolean;
  disabledReason?: string | null;
}

function PlayerRow({
  p,
  selected,
  onToggle,
  hint,
  trailing,
  disabled = false,
  disabledReason,
}: RowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      aria-describedby={disabledReason ? `${p.id}-eligibility` : undefined}
      className={cn(
        "rr-roster-choice rr-pressable flex items-center gap-3 px-3 py-3 text-left",
        disabled && "cursor-not-allowed opacity-55 hover:bg-transparent",
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={p.avatar_url || undefined} />
        <AvatarFallback>{initials(p)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{p.display_name || p.full_name}</p>
        {(disabledReason || hint || p.current_rating) && (
          <p
            id={disabledReason ? `${p.id}-eligibility` : undefined}
            className={cn(
              "text-xs text-muted-foreground leading-relaxed",
              disabledReason && "text-amber-600 dark:text-amber-400",
            )}
          >
            {p.current_rating ? `${p.current_rating.toFixed(2)}` : ""}
            {(disabledReason || hint) && p.current_rating ? " · " : ""}
            {disabledReason || hint}
          </p>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
      <div
        className={cn(
          "rr-roster-check h-7 w-7 rounded-full border flex items-center justify-center shrink-0",
          selected
            ? "bg-primary border-primary"
            : disabled
              ? "border-muted-foreground/15"
              : "border-muted-foreground/30",
        )}
      >
        {selected ? <Check className="h-4 w-4 text-primary-foreground" /> : !disabled && <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
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
  eventFormat,
  excludeSet,
}: {
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
  eventFormat: EventFormat;
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
      gender: f.profile.gender,
    }))
    .filter((p) => matchGender(p.gender, genderFilter))
    .filter((p) => (p.full_name || p.display_name) && !excludeSet?.has(p.id));

  if (loading) return <EmptyState message="Loading friends…" />;
  if (items.length === 0)
    return (
      <EmptyState message="No friends available — add some from Community, or use Search." />
    );

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        {items.map((p) => {
          const eligibility = participantGenderEligibility(eventFormat, p.gender);
          return (
            <PlayerRow
              key={p.id}
              p={p}
              selected={selectedIds.has(p.id)}
              onToggle={() => onToggle(p)}
              disabled={!eligibility.eligible}
              disabledReason={eligibility.reason}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

function GroupList({
  groupId,
  selectedIds,
  onToggle,
  genderFilter,
  eventFormat,
  excludeSet,
  showAddAll = true,
}: {
  groupId: string;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
  eventFormat: EventFormat;
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
      gender: m.profile.gender,
    }))
    .filter((p) => matchGender(p.gender, genderFilter))
    .filter((p) => !excludeSet?.has(p.id));

  if (loading) return <EmptyState message="Loading group members…" />;
  if (items.length === 0)
    return <EmptyState message="No group members available." />;

  const remaining = items.filter(
    (p) =>
      participantGenderEligibility(eventFormat, p.gender).eligible &&
      !selectedIds.has(p.id),
  );

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        {showAddAll && remaining.length > 0 && (
          <div className="px-4 pb-2">
            <Button
              variant="outline"
              size="sm"
              className="text-primary"
              onClick={() => remaining.forEach((p) => onToggle(p))}
            >
              <Plus className="h-4 w-4" /> Select all {remaining.length}
            </Button>
          </div>
        )}
        {items.map((p) => {
          const eligibility = participantGenderEligibility(eventFormat, p.gender);
          return (
            <PlayerRow
              key={p.id}
              p={p}
              selected={selectedIds.has(p.id)}
              onToggle={() => onToggle(p)}
              disabled={!eligibility.eligible}
              disabledReason={eligibility.reason}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

function RecentList({
  selectedIds,
  onToggle,
  genderFilter,
  eventFormat,
  excludeSet,
}: {
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
  eventFormat: EventFormat;
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
        {items.map((p) => {
          const eligibility = participantGenderEligibility(eventFormat, p.gender);
          return (
            <PlayerRow
              key={p.id}
              p={p}
              selected={selectedIds.has(p.id)}
              onToggle={() => onToggle(p)}
              disabled={!eligibility.eligible}
              disabledReason={eligibility.reason}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

function SearchList({
  query,
  selectedIds,
  onToggle,
  genderFilter,
  eventFormat,
  excludeSet,
}: {
  query: string;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  genderFilter?: "male" | "female";
  eventFormat: EventFormat;
  excludeSet?: Set<string>;
}) {
  const { data = [], isFetching } = useQuery({
    queryKey: ["picker-search", query, genderFilter ?? "any"],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      let q = supabase
        .from("profiles_public")
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
        {items.map((p) => {
          const eligibility = participantGenderEligibility(eventFormat, p.gender);
          return (
            <PlayerRow
              key={p.id}
              p={p}
              selected={selectedIds.has(p.id)}
              onToggle={() => onToggle(p)}
              disabled={!eligibility.eligible}
              disabledReason={eligibility.reason}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

function GuestRosterList({
  groupId,
  selectedIds,
  onToggle,
  excludeSet,
  eventFormat,
  genderFilter,
}: {
  groupId?: string | null;
  selectedIds: Set<string>;
  onToggle: (p: PickerPlayer) => void;
  excludeSet?: Set<string>;
  eventFormat: EventFormat;
  genderFilter?: BinaryGender;
}) {
  const { user } = useAuthState();
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["guest-players-roster", user?.id, groupId ?? "personal"],
    enabled: !!user,
    queryFn: () => fetchSavedGuests(user!.id, groupId),
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
    // Guests who claimed a PULSE account graduate off the guest roster —
    // pick them from the player search instead so their rating counts.
    .filter((g) => !g.linked_user_id)
    .filter((g) => !excludeSet?.has(g.id))
    .filter((g) => g.display_name.toLowerCase().includes(search.trim().toLowerCase()))

    .map((g) => {
      const isDup = (nameCounts.get(g.display_name.toLowerCase()) ?? 0) > 1;
      const created = g.created_at
        ? new Date(g.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : null;
      const formatEligibility = participantGenderEligibility(eventFormat, g.gender);
      const eligibility = eventFormat !== "mixed" || matchGender(g.gender, genderFilter)
        ? formatEligibility
        : {
            eligible: false,
            normalizedGender: formatEligibility.normalizedGender,
            reason: `This substitution needs a ${genderFilter} guest.`,
          };
      return {
        id: g.id,
        full_name: g.display_name,
        display_name: g.display_name,
        gender: g.gender,
        isGuest: true,
        linked: !!g.linked_user_id,
        eligibility,
        hint: g.linked_user_id
          ? "Linked to a registered player"
          : isDup && created
            ? `Guest · added ${created}`
            : "Guest",
      };
    });

  if (isError) return <div role="alert" className="p-4 text-sm">Couldn't load saved guests. <Button variant="link" onClick={() => refetch()}>Retry</Button></div>;
  if (isLoading) return <EmptyState message="Loading guest roster…" />;
  if (data.length === 0)
    return (
      <EmptyState message="No saved guests yet. Add one above — they'll be reusable next time." />
    );

  return (
    <>
    <div className="px-4 py-2"><Input aria-label="Search saved guests" placeholder="Search saved guests" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    {items.length === 0 && <EmptyState message="No available guests match your search." />}
    <ScrollArea className="flex-1 min-h-[180px]">
      <div className="py-2">
        {items.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            selected={selectedIds.has(p.id)}
            onToggle={() => onToggle(p)}
            hint={p.hint}
            disabled={!p.eligibility.eligible}
            disabledReason={p.eligibility.reason}
            trailing={
              p.linked ? (
                <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                  <Link2 className="h-3 w-3" />
                  Linked
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    !p.eligibility.eligible && "border-amber-500/40 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {p.gender === "male"
                    ? "Male"
                    : p.gender === "female"
                      ? "Female"
                      : eventFormat === "open"
                        ? "Guest"
                        : "Gender needed"}
                </Badge>
              )
            }
          />
        ))}
      </div>
    </ScrollArea>
    </>
  );
}


