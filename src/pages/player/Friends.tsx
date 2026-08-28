import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, UserMinus, Check, X, UserPlus, Users, AlertCircle, MoreVertical, User } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchField } from '@/components/ui/search-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFriends } from '@/hooks/useFriends';
import { useFriendsPresence } from '@/hooks/useFriendsPresence';
import { useFriendSuggestions } from '@/hooks/useFriendSuggestions';
import { ConnectSheet } from '@/components/community/ConnectSheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { interpretDmError } from '@/lib/dmErrors';
import { cn } from '@/lib/utils';
import { SocialHero, SocialStatTile, glassRow } from '@/components/social/_shared';

const initials = (name: string | null) =>
  (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

/** Consistent "3.00 rating · Online" metadata line for a person row. */
const personMeta = (rating: number | null, online: boolean): string => {
  const parts: string[] = [];
  if (rating != null) parts.push(`${rating.toFixed(2)} rating`);
  parts.push(online ? 'Online' : 'Offline');
  return parts.join(' · ');
};

/** Only surface a suggestion reason when it's a real, specific one — never a
 *  generic placeholder. Presentation guard; the RPC stays the source. */
const realReason = (reason: string | null | undefined): string | null => {
  const r = (reason ?? '').trim();
  if (!r) return null;
  if (/^(suggested( for you)?|you might know)$/i.test(r)) return null;
  return r;
};

/** Motion presets for request rows animating out (reduced-motion aware). */
const rowExit = (reduced: boolean | null) =>
  reduced
    ? { transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, x: 12, height: 0, marginBottom: 0 },
        transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const },
      };

const VALID_TABS = ['friends', 'requests', 'suggestions'] as const;
type FriendsTabValue = (typeof VALID_TABS)[number];

export default function Friends({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connectOpen, setConnectOpen] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');

  // Honor ?tab= deep links (e.g. MyFriendsRail -> ?tab=requests) and keep the
  // URL in sync as the user switches tabs, so back/forward and shared links
  // land on the right view.
  const tabParam = searchParams.get('tab') as FriendsTabValue | null;
  const activeTab: FriendsTabValue =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'friends';
  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'friends') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };
  // Friend-removal confirmation. Previously the X icon called
  // removeFriend() directly on click — a single-tap mistake (very
  // easy to fat-finger on mobile) nuked the friendship with no undo.
  // Now the tap opens a confirm dialog that names the person and the
  // consequence.
  const [removeTarget, setRemoveTarget] = useState<{ friendshipId: string; name: string } | null>(null);
  // Friendship ids with an accept/decline in flight — a rapid double-tap
  // on the same request otherwise fires two overlapping mutations.
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    error,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    sendFriendRequest,
    refetch,
  } = useFriends({ realtime: true });
  const { suggestions, loading: suggestionsLoading, refetch: refetchSuggestions, dismissSuggestion } = useFriendSuggestions();

  // Live online presence for green dots + online-first ordering. Track every
  // person shown on the page (friends, requests, suggestions) via the single
  // global presence channel.
  const presenceIds = useMemo(() => {
    const ids = new Set<string>();
    friends.forEach((f) => ids.add(f.profile.id));
    pendingRequests.forEach((r) => ids.add(r.profile.id));
    sentRequests.forEach((r) => ids.add(r.profile.id));
    suggestions.forEach((s) => ids.add(s.id));
    return Array.from(ids);
  }, [friends, pendingRequests, sentRequests, suggestions]);
  const { onlineFriends } = useFriendsPresence(presenceIds);

  // Filter by the in-list search, then sort online-first, then alphabetical —
  // so the people you can play with right now bubble to the top.
  const visibleFriends = useMemo(() => {
    const q = friendQuery.trim().toLowerCase();
    const nameOf = (f: (typeof friends)[number]) =>
      (f.profile.display_name || f.profile.full_name || 'Player');
    return friends
      .filter((f) => !q || nameOf(f).toLowerCase().includes(q))
      .sort((a, b) => {
        const aOn = onlineFriends.has(a.profile.id) ? 0 : 1;
        const bOn = onlineFriends.has(b.profile.id) ? 0 : 1;
        if (aOn !== bOn) return aOn - bOn;
        return nameOf(a).localeCompare(nameOf(b));
      });
  }, [friends, friendQuery, onlineFriends]);

  // Render the friends grid in windows so a large friends list doesn't mount
  // hundreds of rows at once. "Show more" reveals the next window.
  const FRIENDS_PAGE = 24;
  const [friendsShown, setFriendsShown] = useState(FRIENDS_PAGE);
  const windowedFriends = useMemo(
    () => visibleFriends.slice(0, friendsShown),
    [visibleFriends, friendsShown],
  );

  const onlineCount = useMemo(
    () => friends.reduce((n, f) => n + (onlineFriends.has(f.profile.id) ? 1 : 0), 0),
    [friends, onlineFriends],
  );

  const handleRequestAction = async (
    friendshipId: string,
    action: (id: string) => Promise<boolean>,
  ) => {
    if (processingIds.has(friendshipId)) return;
    setProcessingIds(prev => new Set(prev).add(friendshipId));
    try {
      await action(friendshipId);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(friendshipId);
        return next;
      });
    }
  };

  const openDM = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc('get_or_create_dm_conversation', {
        other_user_id: userId,
      });
      if (error) throw error;
      navigate(`/player/messages/${data}`);
    } catch (e) {
      console.error(e);
      toast.error(interpretDmError(e));
    }
  };

  const totalRequests = pendingRequests.length + sentRequests.length;

  return (
    <div className={cn("flex flex-col", !embedded && "min-h-[calc(100vh-120px)]")}>
      {/* Premium hero (standalone only — the Social hub provides its own). */}
      {!embedded && (
        <SocialHero
          eyebrow="Community"
          title="Friends"
          action={
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/player/community')}
                className="h-9 w-9 text-muted-foreground"
                aria-label="Back to Community"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Button
                onClick={() => setConnectOpen(true)}
                size="sm"
                className="h-9 rounded-full btn-premium"
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Add
              </Button>
            </div>
          }
        >
          <div className="mt-3 grid grid-cols-3 gap-2">
            <SocialStatTile icon={Users} label="Friends" value={String(friends.length)} />
            <SocialStatTile icon={Radio} label="Online" value={String(onlineCount)} accent />
            <SocialStatTile icon={UserPlus} label="Requests" value={String(totalRequests)} accent />
          </div>
        </SocialHero>
      )}

      <ConnectSheet open={connectOpen} onOpenChange={setConnectOpen} />

      {error && !loading && (
        <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => void refetch()} className="font-medium underline underline-offset-2">Retry</button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        {/* Secondary underline tabs — deliberately lighter than the primary
            Chats/Friends switch in the Social hero so the hierarchy reads. */}
        <div className="px-4 sm:px-6 pt-1 flex items-center gap-2 border-b border-border/40">
          <TabsList className="flex-1 h-auto bg-transparent p-0 gap-5 justify-start rounded-none">
            <UnderlineTab value="friends" label="Friends" count={friends.length > 0 ? friends.length : undefined} />
            <UnderlineTab value="requests" label="Requests" count={totalRequests > 0 ? totalRequests : undefined} accent />
            <UnderlineTab value="suggestions" label="Suggestions" />
          </TabsList>
          {embedded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConnectOpen(true)}
              className="h-8 w-8 shrink-0 text-primary -mb-px"
              aria-label="Add friend"
            >
              <UserPlus className="h-[18px] w-[18px]" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Friends list */}
          <TabsContent value="friends" className="m-0 px-4 sm:px-6 pt-4 pb-8 space-y-3">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[68px] w-full rounded-xl" />)}
              </div>
            ) : friends.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5 text-muted-foreground/70" />}
                title="No friends yet"
                description="Find people you play with in Suggestions or invite them to a group."
              />
            ) : (
              <>
                {/* Search + online summary — only once the list is long enough
                    to warrant filtering. */}
                {friends.length >= 6 && (
                  <SearchField
                    value={friendQuery}
                    onValueChange={setFriendQuery}
                    placeholder="Search your friends..."
                    className="h-10 bg-muted/40 border-border/30"
                    aria-label="Search your friends"
                  />
                )}
                {onlineCount > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    {onlineCount} online now
                  </p>
                )}

                {visibleFriends.length === 0 ? (
                  <EmptyState
                    icon={<Users className="h-5 w-5 text-muted-foreground/70" />}
                    title="No matches"
                    description="No friends match that search."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {windowedFriends.map(f => {
                      const isOnline = onlineFriends.has(f.profile.id);
                      const name = f.profile.display_name || f.profile.full_name || 'Player';
                      return (
                        <div key={f.id} className={glassRow}>
                          <button onClick={() => navigate(`/profile/${f.profile.id}`)} aria-label={`View ${name}'s profile`} className="shrink-0">
                            <PresenceAvatar src={f.profile.avatar_url} name={name} online={isOnline} />
                          </button>
                          <button
                            onClick={() => navigate(`/profile/${f.profile.id}`)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="text-sm font-medium truncate">{name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {personMeta(f.profile.current_rating, isOnline)}
                            </div>
                          </button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => openDM(f.profile.id)} aria-label={`Message ${name}`}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground shrink-0"
                                aria-label={`More actions for ${name}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => navigate(`/profile/${f.profile.id}`)}>
                                <User className="h-4 w-4 mr-2" /> View profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDM(f.profile.id)}>
                                <MessageCircle className="h-4 w-4 mr-2" /> Message
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setRemoveTarget({ friendshipId: f.id, name })}
                                className="text-destructive focus:text-destructive"
                              >
                                <UserMinus className="h-4 w-4 mr-2" /> Remove friend
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
                {visibleFriends.length > friendsShown && (
                  <div className="flex justify-center pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full text-xs text-muted-foreground"
                      onClick={() => setFriendsShown((c) => c + FRIENDS_PAGE)}
                    >
                      Show more friends
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Requests */}
          <TabsContent value="requests" className="m-0 px-4 sm:px-6 pt-4 pb-8 space-y-6">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Received {pendingRequests.length > 0 && `(${pendingRequests.length})`}
              </h2>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incoming requests.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AnimatePresence initial={false}>
                    {pendingRequests.map(r => {
                      const name = r.profile.display_name || r.profile.full_name || 'Player';
                      return (
                        <motion.div key={r.id} layout={!reduced} {...rowExit(reduced)} className={cn(glassRow, "overflow-hidden")}>
                          <button onClick={() => navigate(`/profile/${r.profile.id}`)} aria-label={`View ${name}'s profile`} className="shrink-0">
                            <PresenceAvatar
                              src={r.profile.avatar_url}
                              name={name}
                              online={onlineFriends.has(r.profile.id)}
                            />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {onlineFriends.has(r.profile.id) ? 'Online · wants to be friends' : 'Wants to be friends'}
                            </div>
                          </div>
                          <Button size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={processingIds.has(r.id)} onClick={() => handleRequestAction(r.id, acceptRequest)} aria-label={`Accept ${name}`}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={processingIds.has(r.id)} onClick={() => handleRequestAction(r.id, declineRequest)} aria-label={`Decline ${name}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Sent {sentRequests.length > 0 && `(${sentRequests.length})`}
              </h2>
              {sentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending sent requests.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AnimatePresence initial={false}>
                    {sentRequests.map(r => {
                      const name = r.profile.display_name || r.profile.full_name || 'Player';
                      return (
                        <motion.div key={r.id} layout={!reduced} {...rowExit(reduced)} className={cn(glassRow, "overflow-hidden")}>
                          <button onClick={() => navigate(`/profile/${r.profile.id}`)} aria-label={`View ${name}'s profile`} className="shrink-0">
                            <PresenceAvatar
                              src={r.profile.avatar_url}
                              name={name}
                              online={onlineFriends.has(r.profile.id)}
                            />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {onlineFriends.has(r.profile.id) ? 'Online · request sent' : 'Request sent'}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="shrink-0" disabled={processingIds.has(r.id)} onClick={() => handleRequestAction(r.id, cancelRequest)}>
                            Cancel
                          </Button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </TabsContent>

          {/* Suggestions */}
          <TabsContent value="suggestions" className="m-0 px-4 sm:px-6 pt-4 pb-8 space-y-3">
            {suggestionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : suggestions.length === 0 ? (
              <EmptyState
                icon={<UserPlus className="h-5 w-5 text-muted-foreground/70" />}
                title="No suggestions right now"
                description="Play matches or join groups — we'll suggest people you might know."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map(s => {
                  const name = s.display_name || s.full_name || 'Player';
                  const reason = realReason(s.reason);
                  // Prefer a real, specific reason; otherwise fall back to the
                  // consistent rating · presence line (never a fake reason).
                  const meta = reason ?? personMeta(s.current_rating, onlineFriends.has(s.id));
                  return (
                    <div key={s.id} className={cn(glassRow, "gap-2")}>
                      <button onClick={() => navigate(`/profile/${s.id}`)} aria-label={`View ${name}'s profile`} className="shrink-0">
                        <PresenceAvatar
                          src={s.avatar_url}
                          name={name}
                          online={onlineFriends.has(s.id)}
                          className="ring-1 ring-border/40"
                          fallbackClassName="bg-primary/10 text-primary font-semibold"
                        />
                      </button>
                      <button onClick={() => navigate(`/profile/${s.id}`)} className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {meta}
                        </div>
                      </button>
                      {/* Dismiss — quiet, secondary affordance. Sits to the
                          left of the primary Add CTA so the eye lands on
                          Add first; X is for "not interested". */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground/60 hover:text-muted-foreground shrink-0"
                        onClick={() => dismissSuggestion(s.id)}
                        aria-label={`Dismiss ${name}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="shrink-0"
                        onClick={async () => {
                          const ok = await sendFriendRequest(s.id);
                          if (ok) refetchSuggestions();
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-1.5" />
                        Add
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Confirm before removing a friend — single-tap removal was a
          mobile footgun pre-fix. */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to send a new friend request to reconnect. Direct messages and shared groups stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (removeTarget) {
                  await removeFriend(removeTarget.friendshipId);
                  setRemoveTarget(null);
                }
              }}
            >
              Remove friend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UnderlineTab({
  value, label, count, accent,
}: { value: string; label: string; count?: number; accent?: boolean }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative h-10 px-0 rounded-none bg-transparent shadow-none text-sm font-medium text-muted-foreground",
        "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
        "after:opacity-0 after:transition-opacity motion-reduce:after:transition-none data-[state=active]:after:opacity-100",
      )}
    >
      {label}
      {count != null && (
        <Badge
          variant="secondary"
          className={cn(
            "ml-1.5 h-5 px-1.5 text-[10px] font-semibold",
            accent && "bg-primary/15 text-primary",
          )}
        >
          {count}
        </Badge>
      )}
    </TabsTrigger>
  );
}

function PresenceAvatar({
  src,
  name,
  online,
  className,
  fallbackClassName,
}: {
  src: string | null;
  name: string;
  online: boolean;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <div className="relative">
      <Avatar className={cn('h-11 w-11', className)}>
        <AvatarImage src={src || undefined} />
        <AvatarFallback className={fallbackClassName}>{initials(name)}</AvatarFallback>
      </Avatar>
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"
          aria-label="Online"
        />
      )}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">{description}</p>
    </div>
  );
}
