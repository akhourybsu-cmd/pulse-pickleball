import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversation, type DirectMessage } from '@/hooks/useDirectMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from '@/components/community/TypingIndicator';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export default function DirectMessageChat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { messages, loading, participant, sendMessage } = useConversation(conversationId || null);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use typing indicator for DMs (treating conversation as group ID)
  const { typingUsers, startTyping } = useTypingIndicator(conversationId ? `dm-${conversationId}` : undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    const success = await sendMessage(newMessage);
    if (success) {
      setNewMessage('');
      inputRef.current?.focus();
    }
    setIsSending(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    const displayName = 'You';
    startTyping(displayName);
  };

  const getInitials = (name: string | null) => {
    return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  const shouldShowDateSeparator = (currentMsg: DirectMessage, prevMsg: DirectMessage | null) => {
    if (!prevMsg) return true;
    return !isSameDay(new Date(currentMsg.created_at), new Date(prevMsg.created_at));
  };

  const shouldGroupWithPrevious = (currentMsg: DirectMessage, prevMsg: DirectMessage | null) => {
    if (!prevMsg) return false;
    if (currentMsg.sender_id !== prevMsg.sender_id) return false;
    const timeDiff = new Date(currentMsg.created_at).getTime() - new Date(prevMsg.created_at).getTime();
    return timeDiff < 60000; // Group if within 1 minute
  };

  const name = participant?.display_name || participant?.full_name || 'Unknown';

  if (loading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-120px)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-12 w-48 ml-auto" />
          <Skeleton className="h-12 w-56" />
          <Skeleton className="h-12 w-40 ml-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <button 
          onClick={() => navigate('/player/profile')}
          className="flex items-center gap-3"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={participant?.avatar_url || undefined} />
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className="font-medium text-sm">{name}</p>
            {participant?.current_rating && (
              <p className="text-xs text-muted-foreground">
                {participant.current_rating.toFixed(2)} rating
              </p>
            )}
          </div>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const isOwn = message.sender_id === currentUserId;
            const showDate = shouldShowDateSeparator(message, prevMessage);
            const grouped = shouldGroupWithPrevious(message, prevMessage);

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                      {formatMessageDate(new Date(message.created_at))}
                    </span>
                  </div>
                )}
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'flex',
                    isOwn ? 'justify-end' : 'justify-start',
                    grouped ? 'mt-0.5' : 'mt-3'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    )}
                  >
                    <p className="break-words">{message.content}</p>
                    {!grouped && (
                      <p className={cn(
                        'text-[10px] mt-1',
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {format(new Date(message.created_at), 'h:mm a')}
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start mt-3">
            <TypingIndicator typingUsers={typingUsers} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className="h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
