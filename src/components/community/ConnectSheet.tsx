import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Search, UserPlus, Check, Clock, QrCode, Copy, Share2,
  Sparkles, AtSign, Loader2, Users, X, MapPin, Navigation, History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SearchField } from '@/components/ui/search-field';
import { GlassPanel, glassRow, SocialEmptyState } from '@/components/social/_shared';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useFriends } from '@/hooks/useFriends';
import { useFriendSuggestions, type SuggestedFriend } from '@/hooks/useFriendSuggestions';
import { useNearbyPlayers, type NearbyPlayer } from '@/hooks/useNearbyPlayers';
import { useRecentPlayPartners, type RecentPlayPartner } from '@/hooks/useRecentPlayPartners';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';

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

type SourceKey = 'suggested' | 'recent' | 'nearby' | 'search' | 'enter' | 'code';

const SOURCES: { key: SourceKey; label: string; icon: LucideIcon }[] = [
  { key: 'suggested', label: 'Suggested', icon: Sparkles },
  { key: 'recent', label: 'Recent', icon: History },
  { key: 'nearby', label: 'Nearby', icon: MapPin },
  { key: 'search', label: 'Search', icon: Search },
  { key: 'enter', label: 'Handle', icon: AtSign },
  { key: 'code', label: 'My code', icon: QrCode },
];

const getInitials = (name: string | null) =>
  (name || 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const displayName = (p: { display_name: string | null; full_name: string | null }) =>
  p.display_name || p.full_name || 'Community member';

export function ConnectSheet({ open, onOpenChange }: ConnectSheetProps) {
  const { sendFriendRequest, acceptRequest, pendingRequests, getFriendshipStatus, currentUserId } = useFriends();
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [source, setSource] = useState<SourceKey>('suggested');

  // Load my handle
  useEffect(() => {
    if (!open || !currentUserId) return;
    supabase
      .from('profiles')
      .select('handle')
      .eq('id', currentUserId)
      .maybeSingle()
      .then(({ data }) => setMyHandle(data?.handle ?? null));
  }, [open, currentUserId]);

  const handleAdd = async (userId: string) => {
    setSendingTo(userId);
    await sendFriendRequest(userId);
    setSendingTo(null);
  };

  // Accept an incoming request from search/suggestions. acceptRequest
  // takes the friendship id, not the user id — resolve it from the pending list.
  const handleAccept = async (userId: string) => {
    const request = pendingRequests.find((r) => r.user_id === userId);
    if (!request) return;
    setSendingTo(userId);
    await acceptRequest(request.id);
    setSendingTo(null);
  };

  const actionButton = (userId: string) => {
    const status = getFriendshipStatus(userId);
    if (status === 'accepted') {
      return (
        <Button variant="outline" size="sm" disabled className="h-8 shrink-0 rounded-full">
          <Check className="h-3.5 w-3.5 mr-1" /> Friends
        </Button>
      );
    }
    if (status === 'pending_sent') {
      return (
        <Button variant="outline" size="sm" disabled className="h-8 shrink-0 rounded-full">
          <Clock className="h-3.5 w-3.5 mr-1" /> Pending
        </Button>
      );
    }
    if (status === 'pending_received') {
      return (
        <Button variant="secondary" size="sm" className="h-8 shrink-0 rounded-full" onClick={() => handleAccept(userId)} disabled={sendingTo === userId}>
          {sendingTo === userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Accept'}
        </Button>
      );
    }
    return (
      <Button size="sm" className="h-8 shrink-0 rounded-full" onClick={() => handleAdd(userId)} disabled={sendingTo === userId}>
        {sendingTo === userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (<><UserPlus className="h-3.5 w-3.5 mr-1" />Add</>)}
      </Button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] p-0 flex flex-col rounded-t-2xl">
        {/* Premium header band — ambient bloom + court-line texture + accent eyebrow. */}
        <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-primary/[0.10] via-primary/[0.03] to-background">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full blur-3xl opacity-[0.18]"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(115deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 1px, transparent 1px, transparent 22px)',
            }}
          />
          <SheetHeader className="relative px-4 pb-3 pt-4 text-left">
            <div className="relative pl-3.5">
              <span
                aria-hidden
                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary to-primary/25"
              />
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
                Add friends
              </div>
              <SheetTitle className="text-left text-[20px] font-extrabold tracking-tight">
                Connect with players
              </SheetTitle>
            </div>
          </SheetHeader>

          {/* Scrollable segmented source rail. */}
          <div className="relative -mx-0 px-3 pb-3">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {SOURCES.map(({ key, label, icon: Icon }) => {
                const activeTab = source === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSource(key)}
                    aria-pressed={activeTab}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors',
                      activeTab
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border/60 bg-card/70 text-muted-foreground backdrop-blur-sm hover:text-foreground',
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

        <div className="flex-1 overflow-y-auto p-4">
          {source === 'suggested' && <SuggestionsPanel actionButton={actionButton} />}
          {source === 'recent' && <RecentPanel actionButton={actionButton} />}
          {source === 'nearby' && <NearbyPanel actionButton={actionButton} onClose={() => onOpenChange(false)} />}
          {source === 'search' && <ScopedSearchPanel actionButton={actionButton} />}
          {source === 'enter' && <EnterCodePanel actionButton={actionButton} />}
          {source === 'code' && <MyCodePanel handle={myHandle} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Shared caption above a list of people. */
function PanelHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
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
  player: { id: string; display_name: string | null; full_name: string | null; avatar_url: string | null };
  meta: React.ReactNode;
  action: JSX.Element;
  onDismiss?: () => void;
}) {
  const navigate = useNavigate();
  const name = displayName(player);
  return (
    <div className={cn(glassRow, 'gap-2')}>
      <button onClick={() => navigate(`/profile/${player.id}`)} aria-label={`View ${name}'s profile`} className="shrink-0">
        <Avatar className="h-10 w-10 ring-1 ring-border/60">
          <AvatarImage src={player.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      </button>
      <button onClick={() => navigate(`/profile/${player.id}`)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold tracking-tight">{name}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{meta}</div>
      </button>
      {onDismiss && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
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
function SuggestionsPanel({ actionButton }: { actionButton: (id: string) => JSX.Element }) {
  const { suggestions, loading, dismissSuggestion } = useFriendSuggestions();

  if (loading) return <RowSkeletons />;

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
          action={actionButton(s.id)}
          onDismiss={() => dismissSuggestion(s.id)}
          meta={
            <>
              <span className="truncate">{s.reason}</span>
              {s.current_rating != null && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="shrink-0 tabular-nums">{Number(s.current_rating).toFixed(2)}</span>
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
  if (!iso) return 'Recently';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

function RecentPanel({ actionButton }: { actionButton: (id: string) => JSX.Element }) {
  const { players, status } = useRecentPlayPartners(true);

  if (status === 'idle' || status === 'loading') return <RowSkeletons />;

  if (status === 'unavailable') {
    return (
      <SocialEmptyState
        icon={History}
        title="Recent players unavailable"
        description="We couldn't load your recent play history right now — try again in a moment."
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
          action={actionButton(p.id)}
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
  { label: '25 mi', km: 40 },
  { label: '50 mi', km: 80 },
  { label: '150 mi', km: 240 },
];

function NearbyPanel({
  actionButton,
  onClose,
}: {
  actionButton: (id: string) => JSX.Element;
  onClose: () => void;
}) {
  const [radiusKm, setRadiusKm] = useState(RADII[0].km);
  const { players, status, selfLocationName } = useNearbyPlayers(true, radiusKm);

  const radiusRail = (
    <div className="mb-3 flex items-center gap-1.5">
      {RADII.map((r) => (
        <button
          key={r.km}
          type="button"
          onClick={() => setRadiusKm(r.km)}
          aria-pressed={radiusKm === r.km}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
            radiusKm === r.km
              ? 'border-primary/40 bg-primary/15 text-primary'
              : 'border-border/60 bg-card/70 text-muted-foreground hover:text-foreground',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (status === 'idle' || status === 'loading') return <RowSkeletons />;

  if (status === 'unavailable') {
    return (
      <SocialEmptyState
        icon={MapPin}
        title="Nearby isn't available yet"
        description="Location discovery hasn't been switched on for your app yet — check back soon."
      />
    );
  }

  if (status === 'not_enabled') {
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
              : 'Nobody new has opted into nearby discovery in this range yet. Try a wider radius.'
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {radiusRail}
      <PanelHint>
        {selfLocationName ? `Opted-in players near ${selfLocationName}` : 'Opted-in players near you'}
      </PanelHint>
      {players.map((p: NearbyPlayer) => (
        <PersonRow
          key={p.id}
          player={p}
          action={actionButton(p.id)}
          meta={
            <>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{p.location_name || 'Nearby'}</span>
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
  return miles < 1 ? '<1 mi' : `${Math.round(miles)} mi`;
};

// ---------- My Code ----------
function MyCodePanel({ handle }: { handle: string | null }) {
  if (!handle) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}/u/${handle}`;

  const copy = async () => {
    await navigator.clipboard.writeText(`@${handle}`);
    toast.success('Handle copied');
  };

  const share = async () => {
    const text = `Add me on Pulse: @${handle}\n${inviteUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Add me on Pulse', text, url: inviteUrl }); } catch { /* user cancelled the share sheet */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Invite copied');
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm shadow-[0_8px_30px_-20px_hsl(var(--foreground)/0.35)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full blur-3xl opacity-[0.16]"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
        />
        <div className="relative flex flex-col items-center">
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={inviteUrl} size={180} level="M" includeMargin={false} />
          </div>
          <div className="mt-4 text-center">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Your handle</p>
            <p className="text-2xl font-extrabold tracking-tight">@{handle}</p>
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
function EnterCodePanel({ actionButton }: { actionButton: (id: string) => JSX.Element }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const lookup = async () => {
    const cleaned = code.trim().replace(/^@/, '');
    if (!cleaned) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc('lookup_player_by_handle', { _handle: cleaned });
      if (error) throw error;
      if (data && data.length > 0) setResult(data[0] as SearchResult);
      else setNotFound(true);
    } catch (e) {
      console.error(e);
      toast.error('Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Friend's handle
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="alex-7q4"
              className="h-10 rounded-xl border-border/60 bg-card/70 pl-9 backdrop-blur-sm"
              autoFocus
            />
          </div>
          <Button onClick={lookup} disabled={loading || code.trim().length < 2} className="h-10 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ask your friend for their handle from their <span className="font-medium">My code</span> tab.
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
              <p className="truncate text-sm font-semibold tracking-tight">{displayName(result)}</p>
              <p className="truncate text-xs text-muted-foreground">@{result.handle}</p>
            </div>
            {actionButton(result.id)}
          </div>
        </GlassPanel>
      )}

      {notFound && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-center text-sm text-muted-foreground backdrop-blur-sm">
          No player found with that handle.
        </div>
      )}
    </div>
  );
}

// ---------- Scoped search ----------
function ScopedSearchPanel({ actionButton }: { actionButton: (id: string) => JSX.Element }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 300);

  useEffect(() => {
    const run = async () => {
      if (!debounced.trim() || debounced.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('search_connectable_users', { _query: debounced.trim() });
        if (error) throw error;
        setResults((data || []) as SearchResult[]);
      } catch (e) {
        console.error(e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [debounced]);

  // Spinner shows the instant the user types (before the debounce fires).
  const pending = query.trim().length >= 2 && (loading || query !== debounced);

  const body = useMemo(() => {
    if (loading) {
      return (
        <>
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </>
      );
    }
    if (results.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {query.trim().length < 2 ? 'Type at least 2 characters to search' : 'No matches in your network'}
        </div>
      );
    }
    return results.map((r) => (
      <PersonRow
        key={r.id}
        player={r}
        action={actionButton(r.id)}
        meta={
          <>
            {r.handle && <span className="truncate">@{r.handle}</span>}
            {r.reason && (
              <>
                <span className="opacity-50">·</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{r.reason}</Badge>
              </>
            )}
          </>
        }
      />
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, results, query]);

  return (
    <div className="space-y-4">
      <SearchField
        value={query}
        onValueChange={setQuery}
        loading={pending}
        placeholder="Search by name or handle..."
        autoFocus
        className="h-10 rounded-xl border-border/60 bg-card/70 backdrop-blur-sm"
        aria-label="Search for players by name or handle"
      />

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 backdrop-blur-sm">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          We only show players you share a group, event, tournament, match, or mutual friend with.
        </p>
      </div>

      <div className="space-y-2">{body}</div>
    </div>
  );
}
