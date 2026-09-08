import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  MessageCircle,
  UserMinus,
  Check,
  X,
  UserPlus,
  Users,
  AlertCircle,
  MoreHorizontal,
  User,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchField } from "@/components/ui/search-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFriends } from "@/hooks/useFriends";
import { useFriendsPresence } from "@/hooks/useFriendsPresence";
import { useFriendSuggestions } from "@/hooks/useFriendSuggestions";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { ConnectSheet } from "@/components/community/ConnectSheet";
import { SocialHero } from "@/components/social/_shared";
import {
  friendName,
  matchesFriend,
  type FriendProfile,
} from "@/lib/social/friends";
import { cn } from "@/lib/utils";

const VALID_TABS = ["friends", "requests", "suggestions"] as const;
type FriendsTab = (typeof VALID_TABS)[number];
const grid = "grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3";
const card =
  "min-w-0 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm";

export default function Friends({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connectOpen, setConnectOpen] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [friendsShown, setFriendsShown] = useState(24);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    userId: string;
    name: string;
  } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const openingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const tabParam = searchParams.get("tab") as FriendsTab | null;
  const activeTab =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "friends";
  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "friends") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    if (searchParams.get("connect") !== "1") return;
    setConnectOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("connect");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    error,
    isPending,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    sendFriendRequest,
    getFriendshipStatus,
    refetch,
  } = useFriends();
  const {
    suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    refetch: refetchSuggestions,
    dismissSuggestion,
  } = useFriendSuggestions(activeTab === "suggestions");
  const { startConversation } = useDirectMessages();
  const presenceIds = useMemo(
    () => friends.map((friend) => friend.profile.id),
    [friends]
  );
  const { onlineFriends, isConnected } = useFriendsPresence(presenceIds);
  // Names stay in a predictable order while presence changes in the background.
  const visibleFriends = useMemo(
    () =>
      friends.filter(
        (friend) =>
          matchesFriend(friend.profile, friendQuery) &&
          (!onlineOnly || onlineFriends.has(friend.profile.id))
      ),
    [friends, friendQuery, onlineOnly, onlineFriends]
  );
  useEffect(() => {
    setFriendsShown(24);
  }, [friendQuery, onlineOnly]);
  const availableSuggestions = suggestions.filter(
    (person) => getFriendshipStatus(person.id) === "none"
  );
  const openDM = async (userId: string) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(userId);
    try {
      const id = await startConversation(userId);
      if (id && mounted.current) navigate(`/player/messages/${id}`);
    } finally {
      openingRef.current = false;
      if (mounted.current) setOpening(null);
    }
  };
  const findPlayers = (
    <Button className="h-11 rounded-xl" onClick={() => setConnectOpen(true)}>
      <UserPlus className="mr-2 h-4 w-4" />
      Find players
    </Button>
  );

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        !embedded && "min-h-[calc(100dvh-120px)]"
      )}
    >
      {!embedded && (
        <SocialHero
          eyebrow="Your community"
          title="Friends"
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl"
              onClick={() => navigate("/player/social")}
              aria-label="Back to Social"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          }
        >
          <p className="mt-1 text-sm text-muted-foreground">
            Good games start with good company.
          </p>
        </SocialHero>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold">Your circle</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loading
              ? "Loading connections…"
              : error && !friends.length
              ? "Connections unavailable"
              : `${friends.length} ${
                  friends.length === 1 ? "friend" : "friends"
                }`}
            {isConnected && onlineFriends.size > 0 && (
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                • {onlineFriends.size} online
              </span>
            )}
          </p>
        </div>
        {findPlayers}
      </div>
      <ConnectSheet open={connectOpen} onOpenChange={setConnectOpen} />
      {error && (
        <div className="px-4 sm:px-6 lg:px-8">
          <LoadError message={error} retry={() => void refetch()} />
        </div>
      )}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-w-0 flex-1 flex-col"
      >
        <div className="border-b border-border/50 px-4 sm:px-6 lg:px-8">
          <TabsList className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none bg-transparent p-0 sm:gap-7">
            <FriendTab value="friends" label="Friends" />
            <FriendTab
              value="requests"
              label="Requests"
              count={pendingRequests.length}
            />
            <FriendTab value="suggestions" label="Discover" />
          </TabsList>
        </div>
        <TabsContent
          value="friends"
          className="m-0 space-y-4 px-4 py-5 sm:px-6 lg:px-8"
        >
          {loading ? (
            <FriendsSkeleton />
          ) : error && !friends.length ? null : !friends.length ? (
            <EmptyState
              title="Make your first connection"
              description="Find a court partner, reconnect with someone you've played, or share your player code."
              action={findPlayers}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 basis-48">
                  <SearchField
                    value={friendQuery}
                    onValueChange={setFriendQuery}
                    placeholder="Search name or @handle"
                    aria-label="Search your friends"
                    className="h-11 rounded-xl text-base sm:text-sm"
                  />
                </div>
                <Button
                  variant={onlineOnly ? "secondary" : "outline"}
                  onClick={() => setOnlineOnly((value) => !value)}
                  aria-pressed={onlineOnly}
                  className="h-11 rounded-xl"
                >
                  <span
                    className={cn(
                      "mr-2 h-2 w-2 rounded-full",
                      isConnected ? "bg-emerald-500" : "bg-muted-foreground"
                    )}
                  />
                  Online{isConnected ? ` (${onlineFriends.size})` : ""}
                </Button>
              </div>
              {onlineOnly && !isConnected ? (
                <EmptyState
                  title="Reconnecting to live status"
                  description="Your friends list is still available. Live status will return when your connection recovers."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => setOnlineOnly(false)}
                    >
                      Show all friends
                    </Button>
                  }
                />
              ) : !visibleFriends.length ? (
                <EmptyState
                  title={
                    friendQuery
                      ? "No matching friends"
                      : "No friends online right now"
                  }
                  description={
                    friendQuery
                      ? "Try another name or handle."
                      : "You can still send a message. They’ll see it when they return."
                  }
                  action={
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={() => {
                        setFriendQuery("");
                        setOnlineOnly(false);
                      }}
                    >
                      Show all friends
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className={grid}>
                    {visibleFriends.slice(0, friendsShown).map((friend) => {
                      const name = friendName(friend.profile);
                      const online = onlineFriends.has(friend.profile.id);
                      return (
                        <div
                          key={friend.id}
                          className={cn(card, "flex items-center gap-3")}
                        >
                          <PersonLink
                            profile={friend.profile}
                            online={online}
                            meta={
                              online
                                ? "Online now"
                                : friend.profile.handle
                                ? `@${friend.profile.handle}`
                                : friend.profile.current_rating != null
                                ? `${friend.profile.current_rating.toFixed(
                                    2
                                  )} rating`
                                : "View profile"
                            }
                          />
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-xl"
                            disabled={!!opening || isPending(friend.profile.id)}
                            onClick={() => void openDM(friend.profile.id)}
                            aria-label={`Message ${name}`}
                          >
                            {opening === friend.profile.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessageCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="-ml-2 h-11 w-9 shrink-0 rounded-xl text-muted-foreground"
                                aria-label={`More actions for ${name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 rounded-xl p-1.5"
                            >
                              <DropdownMenuItem
                                className="min-h-11 rounded-lg"
                                onClick={() =>
                                  navigate(`/profile/${friend.profile.id}`)
                                }
                              >
                                <User className="mr-2 h-4 w-4" />
                                View profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="min-h-11 rounded-lg text-destructive focus:text-destructive"
                                disabled={isPending(friend.profile.id)}
                                onClick={() =>
                                  setRemoveTarget({
                                    id: friend.id,
                                    userId: friend.profile.id,
                                    name,
                                  })
                                }
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                Remove friend
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                  {visibleFriends.length > friendsShown && (
                    <Button
                      variant="outline"
                      className="h-11 w-full rounded-xl"
                      onClick={() => setFriendsShown((count) => count + 24)}
                    >
                      Show more · {visibleFriends.length - friendsShown}{" "}
                      remaining
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent
          value="requests"
          className="m-0 space-y-7 px-4 py-5 sm:px-6 lg:px-8"
        >
          {loading ? (
            <FriendsSkeleton />
          ) : error &&
            !pendingRequests.length &&
            !sentRequests.length ? null : (
            <>
              <section className="space-y-3">
                <SectionTitle
                  title="Received"
                  count={pendingRequests.length}
                  description="Accept a request to connect and start chatting."
                />
                {!pendingRequests.length ? (
                  <p className="rounded-xl bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
                    You're all caught up. New requests will appear here.
                  </p>
                ) : (
                  <div className={grid}>
                    {pendingRequests.map((request) => (
                      <div key={request.id} className={card}>
                        <PersonLink
                          profile={request.profile}
                          meta={`Wants to connect · ${requestDate(
                            request.created_at
                          )}`}
                        />
                        <div className="mt-3 flex gap-2">
                          <Button
                            className="h-11 flex-1 rounded-xl"
                            disabled={isPending(request.profile.id)}
                            onClick={() => void acceptRequest(request.id)}
                          >
                            <Check className="mr-1.5 h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            className="h-11 flex-1 rounded-xl"
                            disabled={isPending(request.profile.id)}
                            onClick={() => void declineRequest(request.id)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="space-y-3">
                <SectionTitle
                  title="Sent"
                  count={sentRequests.length}
                  description="Waiting for the other player to accept."
                />
                {!sentRequests.length ? (
                  <p className="text-sm text-muted-foreground">
                    No requests waiting for a reply.
                  </p>
                ) : (
                  <div className={grid}>
                    {sentRequests.map((request) => (
                      <div
                        key={request.id}
                        className={cn(card, "flex items-center gap-3")}
                      >
                        <PersonLink
                          profile={request.profile}
                          meta={`Request sent · ${requestDate(
                            request.created_at
                          )}`}
                        />
                        <Button
                          variant="ghost"
                          className="h-11 shrink-0 rounded-xl text-muted-foreground"
                          disabled={
                            isPending(request.profile.id) ||
                            request.id.startsWith("optimistic:")
                          }
                          onClick={() => void cancelRequest(request.id)}
                        >
                          {isPending(request.profile.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Cancel"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </TabsContent>
        <TabsContent
          value="suggestions"
          className="m-0 space-y-4 px-4 py-5 sm:px-6 lg:px-8"
        >
          <SectionTitle
            title="People you may know"
            description="Familiar faces from your matches, groups, and events."
          />
          {suggestionsLoading ? (
            <FriendsSkeleton />
          ) : suggestionsError ? (
            <LoadError
              message={suggestionsError}
              retry={() => void refetchSuggestions()}
            />
          ) : !availableSuggestions.length ? (
            <EmptyState
              title="Find your next court partner"
              description="Suggestions grow as you play. You can also find someone by their handle or player code."
              action={findPlayers}
            />
          ) : (
            <div className={grid}>
              {availableSuggestions.map((person) => (
                <div key={person.id} className={card}>
                  <div className="flex items-center gap-2">
                    <PersonLink
                      profile={{ ...person, gender: null }}
                      meta={
                        person.reason ||
                        (person.handle
                          ? `@${person.handle}`
                          : "From your community")
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-xl text-muted-foreground"
                      disabled={isPending(person.id)}
                      onClick={() => dismissSuggestion(person.id)}
                      aria-label={`Hide suggestion for ${friendName(person)}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-3 h-11 w-full rounded-xl"
                    disabled={isPending(person.id) || loading || !!error}
                    onClick={() =>
                      void sendFriendRequest(person.id, {
                        ...person,
                        gender: null,
                      })
                    }
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add friend
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open && !isPending(removeTarget?.userId ?? ""))
            setRemoveTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your message history and shared groups stay. You’ll need to
              reconnect before sending new direct messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending(removeTarget?.userId ?? "")}>
              Keep friend
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending(removeTarget?.userId ?? "")}
              onClick={async (event) => {
                event.preventDefault();
                if (removeTarget && (await removeFriend(removeTarget.id)))
                  setRemoveTarget(null);
              }}
            >
              {isPending(removeTarget?.userId ?? "")
                ? "Removing…"
                : "Remove friend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PersonLink({
  profile,
  meta,
  online = false,
}: {
  profile: FriendProfile;
  meta: string;
  online?: boolean;
}) {
  const navigate = useNavigate();
  const name = friendName(profile);
  return (
    <button
      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => navigate(`/profile/${profile.id}`)}
      aria-label={`View ${name}'s profile`}
    >
      <span className="relative shrink-0">
        <Avatar className="h-11 w-11">
          <AvatarImage src={profile.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-sm font-medium">
            {name
              .split(/\s+/)
              .map((word) => word[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {online && (
          <span
            aria-label="Online"
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"
          />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span
          className={cn(
            "mt-0.5 block truncate text-xs",
            online
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground"
          )}
        >
          {meta}
        </span>
      </span>
    </button>
  );
}
function FriendTab({
  value,
  label,
  count = 0,
}: {
  value: string;
  label: string;
  count?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative h-12 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      {label}
      {count > 0 && (
        <Badge className="ml-1.5 h-5 bg-primary/15 px-1.5 text-[11px] text-primary hover:bg-primary/15">
          {count}
        </Badge>
      )}
    </TabsTrigger>
  );
}
function SectionTitle({
  title,
  count,
  description,
}: {
  title: string;
  count?: number;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold">
        {title}
        {count != null && (
          <span className="ml-2 text-muted-foreground">{count}</span>
        )}
      </h2>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 px-5 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Users className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mb-5 mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action}
    </div>
  );
}
function FriendsSkeleton() {
  return (
    <div className={grid} aria-label="Loading connections">
      {[1, 2, 3, 4].map((id) => (
        <Skeleton key={id} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
      <p className="flex-1 text-sm">{message}</p>
      <Button
        variant="ghost"
        className="h-11 shrink-0 rounded-lg"
        onClick={retry}
      >
        Retry
      </Button>
    </div>
  );
}
function requestDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
