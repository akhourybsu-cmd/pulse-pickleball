import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, UserMinus, Check, X, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchField } from '@/components/ui/search-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const initials = (name: string | null) =>
  (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const VALID_TABS = ['friends', 'requests', 'suggestions'] as const;
type FriendsTabValue = (typeof VALID_TABS)[number];

export default function Friends() {
  const navigate = useNavigate();
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
    acceptRequest,
    declineRequest,
    removeFriend,
    sendFriendRequest,
  } = useFriends();
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
    } catch (e: any) {
      console.error(e);
      toast.error(interpretDmError(e));
    }
  };

  const totalRequests = pendingRequests.length + sentRequests.length;

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className={cn(
        "border-b border-border/40 bg-gradient-to-b from-primary/[0.06] via-background to-background"
      )}>
        <div className="container mx-auto px-4 py-4 md:py-5 max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/player/community')}
                className="h-9 w-9 -ml-1 shrink-0 mt-0.5"
                aria-label="Back to Community"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Users className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground leading-tight">
                    Friends
                  </h1>
                  <div className="h-[3px] w-10 mt-1.5 bg-primary rounded-full" />
                  <p className="text-sm text-muted-foreground mt-2 leading-snug">
                    Connect with players you know
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setConnectOpen(true)}
              size="sm"
              className="h-9 rounded-full btn-premium shrink-0 mt-1"
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Add
            </Button>
          </div>
        </div>
      </div>
      <ConnectSheet open={connectOpen} onOpenChange={setConnectOpen} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 sm:px-6 pt-3">
          <TabsList className="w-full h-11 bg-muted/40 p-1 rounded-xl grid grid-cols-3">
            <TabsTrigger value="friends" className="h-9 rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Friends
              {friends.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{friends.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="requests" className="h-9 rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Requests
              {totalRequests > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] font-semibold">
                  {totalRequests}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="h-9 rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Suggestions
            </TabsTrigger>
          </TabsList>
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
                    {visibleFriends.map(f => {
                      const isOnline = onlineFriends.has(f.profile.id);
                      const name = f.profile.display_name || f.profile.full_name || 'Player';
                      return (
                        <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                          <button onClick={() => navigate(`/profile/${f.profile.id}`)} aria-label={`View ${name}'s profile`} className="shrink-0">
                            <PresenceAvatar src={f.profile.avatar_url} name={name} online={isOnline} />
                          </button>
                          <button
                            onClick={() => navigate(`/profile/${f.profile.id}`)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="text-sm font-medium truncate">{name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {isOnline
                                ? 'Online now'
                                : f.profile.current_rating != null
                                  ? `Rating ${f.profile.current_rating.toFixed(2)}`
                                  : 'Offline'}
                            </div>
                          </button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => openDM(f.profile.id)} aria-label={`Message ${name}`}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground shrink-0"
                            onClick={() =>
                              setRemoveTarget({
                                friendshipId: f.id,
                                name,
                              })
                            }
                            aria-label={`Remove ${name}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
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
                  {pendingRequests.map(r => {
                    const name = r.profile.display_name || r.profile.full_name || 'Player';
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                        <button onClick={() => navigate(`/profile/${r.profile.id}`)} aria-label={`View ${name}'s profile`} className="shrink-0">
                          <PresenceAvatar
                            src={r.profile.avatar_url}
                            name={name}
                            online={onlineFriends.has(r.profile.id)}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            {onlineFriends.has(r.profile.id) ? 'Online now' : 'Wants to be friends'}
                          </div>
                        </div>
                        <Button size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={processingIds.has(r.id)} onClick={() => handleRequestAction(r.id, acceptRequest)} aria-label={`Accept ${name}`}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={processingIds.has(r.id)} onClick={() => handleRequestAction(r.id, declineRequest)} aria-label={`Decline ${name}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
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
                  {sentRequests.map(r => {
                    const name = r.profile.display_name || r.profile.full_name || 'Player';
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                        <button onClick={() => navigate(`/profile/${r.profile.id}`)} aria-label={`View ${name}'s profile`} className="shrink-0">
                          <PresenceAvatar
                            src={r.profile.avatar_url}
                            name={name}
                            online={onlineFriends.has(r.profile.id)}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            {onlineFriends.has(r.profile.id) ? 'Online now' : 'Request sent'}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0" disabled={processingIds.has(r.id)} onClick={() => handleRequestAction(r.id, declineRequest)}>
                          Cancel
                        </Button>
                      </div>
                    );
                  })}
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
                  return (
                    <div key={s.id} className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border/40">
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
                          {onlineFriends.has(s.id) ? 'Online now' : s.reason}
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
