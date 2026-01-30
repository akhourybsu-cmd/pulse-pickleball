import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Search } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDirectMessages, type ConversationPreview } from '@/hooks/useDirectMessages';
import { OnlineIndicator } from '@/components/community/OnlineIndicator';

export default function DirectMessages() {
  const navigate = useNavigate();
  const { conversations, loading } = useDirectMessages();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(c => {
    const name = c.participant.display_name || c.participant.full_name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getInitials = (name: string | null) => {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Messages</h1>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <MessageCircle className="h-5 w-5 text-muted-foreground/70" />
            </div>
            <h3 className="text-base font-medium mb-1">
              {conversations.length === 0 ? 'No messages yet' : 'No matches found'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              {conversations.length === 0 
                ? 'Start a conversation with a friend from the Friends tab'
                : 'Try a different search term'
              }
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filteredConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                onClick={() => navigate(`/player/messages/${conversation.id}`)}
                getInitials={getInitials}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationCard({
  conversation,
  onClick,
  getInitials
}: {
  conversation: ConversationPreview;
  onClick: () => void;
  getInitials: (name: string | null) => string;
}) {
  const name = conversation.participant.display_name || conversation.participant.full_name || 'Unknown';
  const hasUnread = conversation.unreadCount > 0;

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30 hover:bg-muted/30 transition-colors text-left"
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={conversation.participant.avatar_url || undefined} />
          <AvatarFallback>{getInitials(name)}</AvatarFallback>
        </Avatar>
        <OnlineIndicator
          isOnline={false} // Would integrate with presence
          size="sm"
          className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-medium text-sm truncate ${hasUnread ? 'text-foreground' : ''}`}>
            {name}
          </p>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: false })}
          </span>
        </div>
        {conversation.lastMessage && (
          <p className={`text-xs truncate ${hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            {conversation.lastMessage.content}
          </p>
        )}
      </div>

      {hasUnread && (
        <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] justify-center">
          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
        </Badge>
      )}
    </motion.button>
  );
}
