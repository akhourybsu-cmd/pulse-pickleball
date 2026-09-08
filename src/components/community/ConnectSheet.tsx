import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Search,
  UserPlus,
  Check,
  Clock,
  QrCode,
  Copy,
  Share2,
  Sparkles,
  AtSign,
  Loader2,
  Users,
  X,
  MapPin,
  Navigation,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SearchField } from "@/components/ui/search-field";
import {
  GlassPanel,
  glassRow,
  SocialEmptyState,
} from "@/components/social/_shared";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useFriends } from "@/hooks/useFriends";
import {
  useFriendSuggestions,
  type SuggestedFriend,
} from "@/hooks/useFriendSuggestions";
import { useNearbyPlayers, type NearbyPlayer } from "@/hooks/useNearbyPlayers";
import {
  useRecentPlayPartners,
  type RecentPlayPartner,
} from "@/hooks/useRecentPlayPartners";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthState } from "@/hooks/useAuthState";
import { toast } from "sonner";

interface ConnectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  handle: string | null;
  reason?: string;
}

type SourceKey =
  | "suggested"
  | "recent"
  | "nearby"
  | "search"
  | "enter"
  | "code";

const SOURCES: { key: SourceKey; label: string; icon: LucideIcon }[] = [
  { key: "suggested", label: "Suggested", icon: Sparkles },
  { key: "recent", label: "Recent", icon: History },
  { key: "nearby", label: "Nearby", icon: MapPin },
  { key: "search", label: "Search", icon: Search },
  { key: "enter", label: "Handle", icon: AtSign },
  { key: "code", label: "My code", icon: QrCode },
];

const getInitials = (name: string | null) =>
  (name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const displayName = (p: {
  display_name: string | null;
  full_name: string | null;
}) => p.display_name || p.full_name || "Community member";

export function ConnectSheet({ open, onOpenChange }: ConnectSheetProps) {
  const {
    sendFriendRequest,
    acceptRequest,
    cancelRequest,
    pendingRequests,
    sentRequests,
    getFriendshipStatus,
    currentUserId,
    isPending,
    loading,
    error,
    refetch,
  } = useFriends({ enabled: open });
  const [source, setSource] = useState<SourceKey>("suggested");
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current !== location.pathname) onOpenChange(false);
    previousPath.current = location.pathname;
  }, [location.pathname, onOpenChange]);
  const handleQuery = useQuery({
    queryKey: ["player-handle", currentUserId],
    enabled: open && source === "code" && !!currentUserId,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", currentUserId!)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data?.handle ?? null;
    },
  });
  const actionButton = (player: SearchResult) => {
    const userId = player.id;
    const status = getFriendshipStatus(userId);
    if (isPending(userId) || loading)
      return (
        <Button
          size="sm"
          disabled
          className="h-11 min-w-20 shrink-0 rounded-xl"
          aria-label="Updating connection"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      );
    if (status === "blocked")
      return <span className="text-xs text-muted-foreground">Unavailable</span>;
    if (status === "accepted") {
      return (
        <span className="inline-flex h-11 shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          Friends
        </span>
      );
    }
    if (status === "pending_sent") {
      return (
        <Button
          variant="outline"
          size="sm"
          className="h-11 shrink-0 rounded-xl"
          disabled={!!error}
          aria-label={`Cancel request to ${displayName(player)}`}
          onClick={() => {
            const request = sentRequests.find((row) => row.user_id === userId);
            if (request) void cancelRequest(request.id);
          }}
        >
          <Clock className="h-3.5 w-3.5 mr-1" /> Sent
        </Button>
      );
    }
    if (status === "pending_received") {
      return (
        <Button
          size="sm"
          className="h-11 shrink-0 rounded-xl"
          disabled={!!error}
          onClick={() => {
            const request = pendingRequests.find(
              (row) => row.user_id === userId
            );
            if (request) void acceptRequest(request.id);
          }}
        >
          Accept
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        className="h-11 shrink-0 rounded-xl"
        onClick={() =>
          void sendFriendRequest(userId, { ...player, gender: null })
        }
        disabled={!!error}
      >
        <UserPlus className="h-3.5 w-3.5 mr-1" />
        Add
      </Button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] min-h-0 flex-col rounded-t-2xl p-0 sm:inset-y-4 sm:left-auto sm:right-4 sm:h-[calc(100dvh-2rem)] sm:w-[480px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl [&>button]:right-3 [&>button]:top-3 [&>button]:h-11 [&>button]:w-11"
      >
        <div className="shrink-0 border-b border-border/50">
          <SheetHeader className="px-5 pb-4 pt-6 pr-16 text-left">
            <SheetTitle className="text-xl font-semibold tracking-tight">
              Find your people
            </SheetTitle>
            <SheetDescription className="text-sm">
              Connect on court. Keep in touch here.
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable segmented source rail. */}
          <div className="relative -mx-0 px-3 pb-3">
            <div className="grid grid-cols-3 gap-1.5">
              {SOURCES.map(({ key, label, icon: Icon }) => {
                const activeTab = source === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSource(key)}
                    aria-pressed={activeTab}
                    className={cn(
                      "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-medium transition-colors active:scale-[0.98] motion-reduce:transform-none",
                      activeTab
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error && (
            <DiscoveryError retry={() => void refetch()} message={error} />
          )}
          {open && (
            <>
              {source === "suggested" && (
                <SuggestionsPanel actionButton={actionButton} />
              )}
              {source === "recent" && (
                <RecentPanel actionButton={actionButton} />
              )}
              {source === "nearby" && (
                <NearbyPanel
                  actionButton={actionButton}
                  onClose={() => onOpenChange(false)}
                />
              )}
              {source === "search" && (
                <ScopedSearchPanel actionButton={actionButton} />
              )}
              {source === "enter" && (
                <EnterCodePanel actionButton={actionButton} />
              )}
              {source === "code" &&
                (handleQuery.isPending ? (
                  <RowSkeletons />
                ) : handleQuery.isError ? (
                  <DiscoveryError retry={() => void handleQuery.refetch()} />
                ) : (
                  <MyCodePanel
                    handle={handleQuery.data}
                    onClose={() => onOpenChange(false)}
                  />
                ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Shared caption above a list of people. */
function PanelHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-medium leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}

/** Glassy person row shared by every discovery source. */
function PersonRow({
  player,
  meta,
  action,
  onDismiss,
}: {
  player: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  meta: React.ReactNode;
  action: JSX.Element;
  onDismiss?: () => void;
}) {
  const navigate = useNavigate();
  const name = displayName(player);
  return (
    <div className={cn(glassRow, "gap-2")}>
      <button
        onClick={() => navigate(`/profile/${player.id}`)}
        aria-label={`View ${name}'s profile`}
        className="shrink-0"
      >
        <Avatar className="h-10 w-10 ring-1 ring-border/60">
          <AvatarImage src={player.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      </button>
      <button
        onClick={() => navigate(`/profile/${player.id}`)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-semibold tracking-tight">{name}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {meta}
        </div>
      </button>
      {onDismiss && (
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-xl text-muted-foreground/60 hover:text-muted-foreground"
          onClick={onDismiss}
          aria-label={`Dismiss ${name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {action}
    </div>
  );
}

// ---------- Suggestions ----------
function SuggestionsPanel({
  actionButton,
}: {
  actionButton: (player: SearchResult) => JSX.Element;
}) {
  const { suggestions, loading, error, refetch, dismissSuggestion } =
    useFriendSuggestions();

  if (loading) return <RowSkeletons />;
  if (error) return <DiscoveryError retry={() => void refetch()} />;

  if (suggestions.length === 0) {
    return (
      <SocialEmptyState
        icon={Sparkles}
        title="No suggestions yet"
        description="Play matches, join a round robin, or share a group — we'll surface familiar players here."
      />
    );
  }

  return (
    <div className="space-y-2">
      <PanelHint>People you've crossed paths with</PanelHint>
      {suggestions.map((s: SuggestedFriend) => (
        <PersonRow
          key={s.id}
          player={s}
          action={actionButton(s)}
          onDismiss={() => dismissSuggestion(s.id)}
          meta={
            <>
              <span className="truncate">{s.reason}</span>
              {s.current_rating != null && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="shrink-0 tabular-nums">
                    {Number(s.current_rating).toFixed(2)}
                  </span>
                </>
              )}
            </>
          }
        />
      ))}
    </div>
  );
}

// ---------- Recent ----------
const relativeDay = (iso: string | null) => {
  if (!iso) return "Recently";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

function RecentPanel({
  actionButton,
}: {
  actionButton: (player: SearchResult) => JSX.Element;
}) {
  const { players, status, refetch } = useRecentPlayPartners(true);

  if (status === "idle" || status === "loading") return <RowSkeletons />;

  if (status === "unavailable") {
    return (
      <DiscoveryError
        retry={() => void refetch()}
        message="Couldn't load recent players."
      />
    );
  }

  if (players.length === 0) {
    return (
      <SocialEmptyState
        icon={History}
        title="No recent players to add"
        description="Everyone from your recent matches and round robins is already connected. Play more to see new faces here."
      />
    );
  }

  return (
    <div className="space-y-2">
      <PanelHint>From your latest matches & round robins</PanelHint>
      {players.map((p: RecentPlayPartner) => (
        <PersonRow
          key={p.id}
          player={p}
          action={actionButton(p)}
          meta={
            <>
              <span className="truncate">{p.reason}</span>
              <span className="opacity-50">·</span>
              <span className="shrink-0">{relativeDay(p.last_played_at)}</span>
            </>
          }
        />
      ))}
    </div>
  );
}

// ---------- Nearby ----------
const RADII: { label: string; km: number }[] = [
  { label: "25 mi", km: 40 },
  { label: "50 mi", km: 80 },
  { label: "150 mi", km: 240 },
];

function NearbyPanel({
  actionButton,
  onClose,
}: {
  actionButton: (player: SearchResult) => JSX.Element;
  onClose: () => void;
}) {
  const [radiusKm, setRadiusKm] = useState(RADII[0].km);
  const { players, status, selfLocationName, refetch } = useNearbyPlayers(
    true,
    radiusKm
  );

  const radiusRail = (
    <div className="mb-3 flex items-center gap-1.5">
      {RADII.map((r) => (
        <button
          key={r.km}
          type="button"
          onClick={() => setRadiusKm(r.km)}
          aria-pressed={radiusKm === r.km}
          className={cn(
            "h-11 rounded-xl border px-4 text-xs font-medium transition-colors",
            radiusKm === r.km
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (status === "idle" || status === "loading") return <RowSkeletons />;

  if (status === "unavailable") {
    return (
      <DiscoveryError
        retry={() => void refetch()}
        message="Couldn't load nearby players."
      />
    );
  }

  if (status === "not_enabled") {
    return (
      <SocialEmptyState
        icon={Navigation}
        title="Turn on nearby discovery"
        description="Set your home city and opt in — we'll show players near you. You only appear to others who've opted in too."
        action={
          <Button asChild onClick={onClose} className="rounded-full">
            <Link to="/player/profile/edit?focus=location">
              <MapPin className="h-4 w-4 mr-1.5" />
              Set up in profile
            </Link>
          </Button>
        }
      />
    );
  }

  if (players.length === 0) {
    return (
      <div>
        {radiusRail}
        <SocialEmptyState
          icon={MapPin}
          title="No new players in range"
          description={
            selfLocationName
              ? `Nobody new has opted into nearby discovery around ${selfLocationName} yet. Try a wider radius.`
              : "Nobody new has opted into nearby discovery in this range yet. Try a wider radius."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {radiusRail}
      <PanelHint>
        {selfLocationName
          ? `Opted-in players near ${selfLocationName}`
          : "Opted-in players near you"}
      </PanelHint>
      {players.map((p: NearbyPlayer) => (
        <PersonRow
          key={p.id}
          player={p}
          action={actionButton(p)}
          meta={
            <>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{p.location_name || "Nearby"}</span>
              <span className="opacity-50">·</span>
              <span className="shrink-0">{formatDistance(p.distance_km)}</span>
            </>
          }
        />
      ))}
    </div>
  );
}

const formatDistance = (km: number) => {
  const miles = km * 0.621371;
  return miles < 1 ? "<1 mi" : `${Math.round(miles)} mi`;
};

// ---------- My Code ----------
function MyCodePanel({
  handle,
  onClose,
}: {
  handle: string | null;
  onClose: () => void;
}) {
  if (!handle) {
    return (
      <SocialEmptyState
        icon={AtSign}
        title="Set up your player handle"
        description="Add a handle to your profile to share your link and player code."
        action={
          <Button asChild onClick={onClose}>
            <Link to="/player/profile/edit">Edit profile</Link>
          </Button>
        }
      />
    );
  }

  const inviteUrl = `${window.location.origin}/u/${handle}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`@${handle}`);
      toast.success("Handle copied");
    } catch {
      toast.error(
        "Copy unavailable. You can select and copy your handle below."
      );
    }
  };

  const share = async () => {
    const text = `Add me on Pulse: @${handle}\n${inviteUrl}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "Add me on Pulse",
          text,
          url: inviteUrl,
        });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Invite copied");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        toast.error("Sharing unavailable. Try copying your handle.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm shadow-[0_8px_30px_-20px_hsl(var(--foreground)/0.35)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full blur-3xl opacity-[0.16]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex flex-col items-center">
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG
              value={inviteUrl}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="mt-4 text-center">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
              Your handle
            </p>
            <p className="select-text break-all text-xl font-semibold tracking-tight">
              @{handle}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={copy} className="h-11 rounded-xl">
          <Copy className="h-4 w-4 mr-2" /> Copy
        </Button>
        <Button onClick={share} className="h-11 rounded-xl">
          <Share2 className="h-4 w-4 mr-2" /> Share
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Anyone with your handle or QR can send you a friend request.
      </p>
    </div>
  );
}

// ---------- Enter handle ----------
function EnterCodePanel({
  actionButton,
}: {
  actionButton: (player: SearchResult) => JSX.Element;
}) {
  const { user } = useAuthState();
  const [code, setCode] = useState("");
  const [submitted, setSubmitted] = useState("");
  const cleaned = code.trim().replace(/^@/, "").toLowerCase();
  const query = useQuery({
    queryKey: ["player-lookup", user?.id, submitted],
    enabled: !!user && !!submitted && submitted === cleaned,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("lookup_player_by_handle", { _handle: submitted })
        .abortSignal(signal);
      if (error) throw error;
      return (data?.[0] as SearchResult) ?? null;
    },
  });
  const loading = submitted === cleaned && query.isFetching;
  const result = submitted === cleaned ? query.data : null;
  const notFound = submitted === cleaned && query.isSuccess && !result;
  const lookup = () => {
    if (!cleaned || loading) return;
    if (submitted === cleaned) void query.refetch();
    else setSubmitted(cleaned);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="friend-handle" className="text-sm font-medium">
          Friend's handle
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="friend-handle"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setSubmitted("");
              }}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="alex-7q4"
              className="h-11 rounded-xl border-border/60 pl-9 text-base"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          </div>
          <Button
            onClick={lookup}
            disabled={loading || cleaned.length < 2}
            className="h-11 rounded-xl"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ask your friend for their handle from their{" "}
          <span className="font-medium">My code</span> tab.
        </p>
      </div>

      {result && (
        <GlassPanel divided={false} className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-1 ring-border/60">
              <AvatarImage src={result.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(displayName(result))}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {displayName(result)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{result.handle}
              </p>
            </div>
            {actionButton(result)}
          </div>
        </GlassPanel>
      )}

      {notFound && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-center text-sm text-muted-foreground backdrop-blur-sm">
          No player found with that handle.
        </div>
      )}
      {submitted === cleaned && query.isError && (
        <DiscoveryError
          retry={() => void query.refetch()}
          message="Couldn't look up this handle."
        />
      )}
    </div>
  );
}

// ---------- Scoped search ----------
function ScopedSearchPanel({
  actionButton,
}: {
  actionButton: (player: SearchResult) => JSX.Element;
}) {
  const { user } = useAuthState();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const debounced = useDebounce(trimmed, 250);
  const search = useQuery({
    queryKey: ["connect-search", user?.id, debounced],
    enabled: !!user && debounced.length >= 2 && debounced === trimmed,
    staleTime: 15_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("search_connectable_users", { _query: debounced })
        .abortSignal(signal);
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
  });
  const pending =
    trimmed.length >= 2 && (search.isPending || trimmed !== debounced);
  const results =
    trimmed.length >= 2 && trimmed === debounced ? search.data ?? [] : [];
  // Render current actions directly; memoizing this body left request buttons stale.
  const renderBody = () => {
    if (pending) {
      return (
        <>
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </>
      );
    }
    if (trimmed === debounced && trimmed.length >= 2 && search.isError)
      return (
        <DiscoveryError
          retry={() => void search.refetch()}
          message="Couldn't search your network."
        />
      );
    if (results.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {query.trim().length < 2
            ? "Type at least 2 characters to search"
            : "No matches in your network"}
        </div>
      );
    }
    return results.map((r) => (
      <PersonRow
        key={r.id}
        player={r}
        action={actionButton(r)}
        meta={
          <>
            {r.handle && <span className="truncate">@{r.handle}</span>}
            {r.reason && (
              <>
                <span className="opacity-50">·</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {r.reason}
                </Badge>
              </>
            )}
          </>
        }
      />
    ));
  };

  return (
    <div className="space-y-4">
      <SearchField
        value={query}
        onValueChange={setQuery}
        loading={pending}
        placeholder="Search by name or handle..."
        autoFocus
        className="h-11 rounded-xl border-border/60 text-base"
        aria-label="Search for players by name or handle"
      />

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 backdrop-blur-sm">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          We only show players you share a group, event, tournament, match, or
          mutual friend with.
        </p>
      </div>

      <div className="space-y-2" aria-live="polite">
        {renderBody()}
      </div>
    </div>
  );
}

function DiscoveryError({
  retry,
  message = "Could not load players. Please try again.",
}: {
  retry: () => void;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm"
    >
      <p>{message}</p>
      <Button
        variant="outline"
        className="mt-3 h-11 rounded-xl"
        onClick={retry}
      >
        Try again
      </Button>
    </div>
  );
}
