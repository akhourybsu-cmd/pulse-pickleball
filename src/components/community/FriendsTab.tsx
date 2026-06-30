import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, MessageCircle, Search, Check, X, Clock,
  MoreVertical, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFriends, type FriendWithProfile, type FriendRequest } from '@/hooks/useFriends';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useFriendsPresence } from '@/hooks/useFriendsPresence';
import { OnlineIndicator } from './OnlineIndicator';
import { ConnectSheet } from './ConnectSheet';
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

type Segment = 'all' | 'online' | 'requests';

export function FriendsTab() {
  const navigate = useNavigate();
  const {
    friends, pendingRequests, sentRequests, loading,
    acceptRequest, declineRequest, removeFriend, blockUser,
  } = useFriends();
  const { startConversation } = useDirectMessages();
  const [searchQuery, setSearchQuery] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);
  const [segment, setSegment] = useState<Segment>('all');
  // Confirm dialog state — see Friends.tsx for the same pattern. The
  // FriendCard's Remove menu item used to call removeFriend on click
  // with zero confirmation; now it stages here instead.
  const [removeTarget, setRemoveTarget] = useState<{ friendshipId: string; name: string } | null>(null);

  const friendIds = useMemo(() => friends.map((f) => f.profile.id), [friends]);
  const { isOnline } = useFriendsPresence(friendIds);

  const filteredFriends = useMemo(() => {
    let list = friends;
    if (segment === 'online') list = list.filter((f) => isOnline(f.profile.id));
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((f) => {
      const name = (f.profile.display_name || f.profile.full_name || '').toLowerCase();
      return name.includes(q);
    });
  }, [friends, segment, searchQuery, isOnline]);

  const handleMessage = async (userId: string) => {
    const conversationId = await startConversation(userId);
    if (conversationId) navigate(`/player/messages/${conversationId}`);
  };

  const getInitials = (name: string | null) =>
    (name || 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const onlineCount = friends.filter((f) => isOnline(f.profile.id)).length;
  const requestsCount = pendingRequests.length;

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-9 w-full rounded-lg" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="relative pb-24">
      <div className="px-4 sm:px-6 pt-4 pb-3 space-y-3">
        {/* Header: count + search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-muted/40 border-border/30"
            />
          </div>
        </div>

        {/* Segmented control */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border/30">
          <SegmentButton active={segment === 'all'} onClick={() => setSegment('all')}>
            All <span className="ml-1.5 text-xs opacity-70">{friends.length}</span>
          </SegmentButton>
          <SegmentButton active={segment === 'online'} onClick={() => setSegment('online')}>
            Online <span className="ml-1.5 text-xs opacity-70">{onlineCount}</span>
          </SegmentButton>
          <SegmentButton active={segment === 'requests'} onClick={() => setSegment('requests')}>
            Requests
            {requestsCount > 0 && (
              <Badge className="ml-1.5 h-4 min-w-[16px] px-1 text-[10px] bg-primary text-primary-foreground">
                {requestsCount}
              </Badge>
            )}
          </SegmentButton>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        <AnimatePresence mode="wait">
          {segment === 'requests' ? (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="space-y-4"
            >
              <RequestsSection
                pending={pendingRequests}
                sent={sentRequests}
                onAccept={acceptRequest}
                onDecline={declineRequest}
                onConnect={() => setConnectOpen(true)}
              />
            </motion.div>
          ) : (
            <motion.div
              key={segment}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="space-y-2"
            >
              {filteredFriends.length === 0 ? (
                <EmptyState
                  friendsCount={friends.length}
                  segment={segment}
                  onConnect={() => setConnectOpen(true)}
                />
              ) : (
                filteredFriends.map((friend) => (
                  <FriendCard
                    key={friend.id}
                    friend={friend}
                    isOnline={isOnline(friend.profile.id)}
                    onMessage={() => handleMessage(friend.profile.id)}
                    onRemove={() =>
                      setRemoveTarget({
                        friendshipId: friend.id,
                        name: friend.profile.display_name || friend.profile.full_name || 'this friend',
                      })
                    }
                    onBlock={() => blockUser(friend.profile.id)}
                    onView={() => navigate(`/profile/${friend.profile.id}`)}
                    getInitials={getInitials}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Connect FAB */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setConnectOpen(true)}
        className="fixed bottom-24 right-4 sm:right-6 z-30 h-14 px-5 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center gap-2 font-medium font-display"
      >
        <UserPlus className="h-5 w-5" />
        Connect
      </motion.button>

      <ConnectSheet open={connectOpen} onOpenChange={setConnectOpen} />

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

function SegmentButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-8 rounded-md text-xs font-medium flex items-center justify-center transition-all ${
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  friendsCount, segment, onConnect,
}: { friendsCount: number; segment: Segment; onConnect: () => void }) {
  if (segment === 'online' && friendsCount > 0) {
    return (
      <div className="flex flex-col items-center text-center py-16">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Users className="h-5 w-5 text-muted-foreground/70" />
        </div>
        <h3 className="text-base font-medium mb-1 font-display">No friends online</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Check back later or send a message to start a conversation.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-base font-medium mb-1 font-display">
        {friendsCount === 0 ? 'Start your network' : 'No matches found'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[280px] mb-5">
        {friendsCount === 0
          ? 'Share your handle, scan a QR code, or connect with people you\'ve played with.'
          : 'Try a different name.'}
      </p>
      {friendsCount === 0 && (
        <Button onClick={onConnect}>
          <UserPlus className="h-4 w-4 mr-2" /> Connect with players
        </Button>
      )}
    </div>
  );
}

function RequestsSection({
  pending, sent, onAccept, onDecline, onConnect,
}: {
  pending: FriendRequest[];
  sent: FriendRequest[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onConnect: () => void;
}) {
  if (pending.length === 0 && sent.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Clock className="h-5 w-5 text-muted-foreground/70" />
        </div>
        <h3 className="text-base font-medium mb-1 font-display">No pending requests</h3>
        <p className="text-sm text-muted-foreground max-w-[280px] mb-5">
          Invite someone to play — they'll show up here when they respond.
        </p>
        <Button variant="outline" onClick={onConnect}>
          <UserPlus className="h-4 w-4 mr-2" /> Connect
        </Button>
      </div>
    );
  }
  return (
    <>
      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Incoming · {pending.length}
          </h3>
          {pending.map((request) => (
            <FriendRequestCard
              key={request.id}
              request={request}
              onAccept={() => onAccept(request.id)}
              onDecline={() => onDecline(request.id)}
            />
          ))}
        </div>
      )}
      {sent.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sent · {sent.length}
          </h3>
          {sent.map((req) => (
            <SentRequestCard key={req.id} request={req} onCancel={() => onDecline(req.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function FriendRequestCard({
  request, onAccept, onDecline,
}: { request: FriendRequest; onAccept: () => void; onDecline: () => void }) {
  const name = request.profile.display_name || request.profile.full_name || 'Community member';
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={request.profile.avatar_url || undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate font-display">{name}</p>
        {request.profile.current_rating && (
          <p className="text-xs text-muted-foreground">{request.profile.current_rating.toFixed(2)} rating</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10" onClick={onAccept}>
          <Check className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-500/10" onClick={onDecline}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function SentRequestCard({ request, onCancel }: { request: FriendRequest; onCancel: () => void }) {
  const name = request.profile.display_name || request.profile.full_name || 'Community member';
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30">
      <Avatar className="h-10 w-10">
        <AvatarImage src={request.profile.avatar_url || undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate font-display">{name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Awaiting response
        </p>
      </div>
      <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function FriendCard({
  friend, isOnline, onMessage, onRemove, onBlock, onView, getInitials,
}: {
  friend: FriendWithProfile;
  isOnline: boolean;
  onMessage: () => void;
  onRemove: () => void;
  onBlock: () => void;
  onView: () => void;
  getInitials: (name: string | null) => string;
}) {
  const name = friend.profile.display_name || friend.profile.full_name || 'Community member';
  return (
    <motion.div
      layout
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30 hover:bg-muted/30 transition-colors"
    >
      <button onClick={onView} className="relative shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={friend.profile.avatar_url || undefined} />
          <AvatarFallback>{getInitials(name)}</AvatarFallback>
        </Avatar>
        <OnlineIndicator isOnline={isOnline} size="sm" className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card" />
      </button>
      <button onClick={onView} className="flex-1 min-w-0 text-left">
        <p className="font-medium text-sm truncate font-display">{name}</p>
        <p className="text-xs text-muted-foreground">
          {isOnline ? 'Online now' : friend.profile.current_rating ? `${friend.profile.current_rating.toFixed(2)} rating` : 'Offline'}
        </p>
      </button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMessage}>
        <MessageCircle className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>View profile</DropdownMenuItem>
          <DropdownMenuItem onClick={onRemove}>Remove friend</DropdownMenuItem>
          <DropdownMenuItem onClick={onBlock} className="text-destructive focus:text-destructive">
            Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
