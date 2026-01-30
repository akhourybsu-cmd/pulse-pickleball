import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupChat } from '@/hooks/useGroupChat';
import { cn } from '@/lib/utils';

interface GroupChatProps {
  groupId: string;
  currentUserId: string | null;
}

export function GroupChat({ groupId, currentUserId }: GroupChatProps) {
  const { messages, loading, sending, sendMessage } = useGroupChat(groupId);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
    const content = newMessage;
    setNewMessage('');
    await sendMessage(content);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col p-4 gap-4">
        <Skeleton className="flex-1 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area - Full height, edge-to-edge */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <MessageCircle className="h-5 w-5 text-muted-foreground/70" />
            </div>
            <h3 className="text-sm font-medium mb-1">No messages yet</h3>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => {
              const isOwn = message.user_id === currentUserId;
              const showAvatar = index === 0 || messages[index - 1]?.user_id !== message.user_id;
              const initials = (message.profile?.display_name || message.profile?.full_name || 'U')
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-2',
                    isOwn ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {showAvatar ? (
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={message.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-7" />
                  )}
                  <div
                    className={cn(
                      'max-w-[75%] space-y-0.5',
                      isOwn ? 'items-end' : 'items-start'
                    )}
                  >
                    {showAvatar && (
                      <div className={cn('flex items-center gap-2', isOwn && 'flex-row-reverse')}>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {message.profile?.display_name || message.profile?.full_name || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2 text-sm',
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted/70 rounded-bl-md'
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Input - Sticky to bottom with blur */}
      <div className="border-t border-border/30 bg-background/95 backdrop-blur-sm px-3 py-3">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={sending}
            className="flex-1 h-10 text-sm border-border/40 bg-muted/30"
          />
          <Button 
            size="icon" 
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="h-10 w-10 shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
