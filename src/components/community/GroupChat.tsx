import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[400px] max-h-[600px]">
      {/* Messages Area */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Start the conversation with your group!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={message.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8" />
                    )}
                    <div
                      className={cn(
                        'max-w-[70%] space-y-1',
                        isOwn ? 'items-end' : 'items-start'
                      )}
                    >
                      {showAvatar && (
                        <div className={cn('flex items-center gap-2', isOwn && 'flex-row-reverse')}>
                          <span className="text-xs font-medium">
                            {message.profile?.display_name || message.profile?.full_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-2 text-sm',
                          isOwn
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted rounded-bl-sm'
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
        </ScrollArea>
      </Card>

      {/* Message Input */}
      <div className="flex items-center gap-2 mt-4">
        <Input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sending}
          className="flex-1"
        />
        <Button 
          size="icon" 
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}