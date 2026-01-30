import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, MessageCircle, Search, Check, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFriends, type FriendWithProfile, type FriendRequest } from '@/hooks/useFriends';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { OnlineIndicator } from './OnlineIndicator';
import { AddFriendDialog } from './AddFriendDialog';

export function FriendsTab() {
  const navigate = useNavigate();
  const { friends, pendingRequests, loading, acceptRequest, declineRequest, removeFriend } = useFriends();
  const { startConversation } = useDirectMessages();
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const filteredFriends = friends.filter(f => {
    const name = f.profile.display_name || f.profile.full_name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleMessage = async (userId: string) => {
    const conversationId = await startConversation(userId);
    if (conversationId) {
      navigate(`/player/messages/${conversationId}`);
    }
  };

  const getInitials = (name: string | null) => {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header with search and add button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-9">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </div>

      {/* Pending Requests */}
      <AnimatePresence>
        {pendingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Friend Requests
              <Badge variant="secondary" className="h-5">{pendingRequests.length}</Badge>
            </h3>
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <FriendRequestCard
                  key={request.id}
                  request={request}
                  onAccept={() => acceptRequest(request.id)}
                  onDecline={() => declineRequest(request.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friends List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          {friends.length} {friends.length === 1 ? 'Friend' : 'Friends'}
        </h3>

        {filteredFriends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Users className="h-5 w-5 text-muted-foreground/70" />
            </div>
            <h3 className="text-base font-medium mb-1">
              {friends.length === 0 ? 'No friends yet' : 'No matches found'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
              {friends.length === 0 
                ? 'Add friends to message them and see when they\'re online'
                : 'Try a different search term'
              }
            </p>
            {friends.length === 0 && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Friends
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFriends.map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onMessage={() => handleMessage(friend.profile.id)}
                onRemove={() => removeFriend(friend.id)}
                getInitials={getInitials}
              />
            ))}
          </div>
        )}
      </div>

      <AddFriendDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}

function FriendRequestCard({ 
  request, 
  onAccept, 
  onDecline 
}: { 
  request: FriendRequest; 
  onAccept: () => void; 
  onDecline: () => void;
}) {
  const name = request.profile.display_name || request.profile.full_name || 'Unknown';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={request.profile.avatar_url || undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{name}</p>
        {request.profile.current_rating && (
          <p className="text-xs text-muted-foreground">
            {request.profile.current_rating.toFixed(2)} rating
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600 hover:bg-green-500/10"
          onClick={onAccept}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:bg-red-500/10"
          onClick={onDecline}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function FriendCard({ 
  friend, 
  onMessage, 
  onRemove,
  getInitials
}: { 
  friend: FriendWithProfile; 
  onMessage: () => void;
  onRemove: () => void;
  getInitials: (name: string | null) => string;
}) {
  const navigate = useNavigate();
  const name = friend.profile.display_name || friend.profile.full_name || 'Unknown';

  return (
    <motion.div
      layout
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30 hover:bg-muted/30 transition-colors"
    >
      <button 
        onClick={() => navigate(`/profile/${friend.profile.id}`)}
        className="relative"
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={friend.profile.avatar_url || undefined} />
          <AvatarFallback>{getInitials(name)}</AvatarFallback>
        </Avatar>
        <OnlineIndicator 
          isOnline={false} // Would integrate with presence system
          size="sm"
          className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
        />
      </button>
      
      <button 
        onClick={() => navigate(`/profile/${friend.profile.id}`)}
        className="flex-1 min-w-0 text-left"
      >
        <p className="font-medium text-sm truncate">{name}</p>
        {friend.profile.current_rating && (
          <p className="text-xs text-muted-foreground">
            {friend.profile.current_rating.toFixed(2)} rating
          </p>
        )}
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onMessage}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
