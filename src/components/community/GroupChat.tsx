import { useState, useRef, useEffect, memo } from 'react';
import { Send, Loader2, Smile, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useGroupChat } from '@/hooks/useGroupChat';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { OnlineIndicator } from './OnlineIndicator';
import { cn } from '@/lib/utils';

interface GroupChatProps {
  groupId: string;
  currentUserId: string | null;
  // Presence props passed from parent to avoid duplicate subscriptions
  onlineCount?: number;
  isConnected?: boolean;
}

export const GroupChat = memo(function GroupChat({ 
  groupId, 
  currentUserId,
  onlineCount = 0,
  isConnected = false,
}: GroupChatProps) {
  const { messages, loading, sending, sendMessage } = useGroupChat(groupId);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(groupId);
  
  const [newMessage, setNewMessage] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get user display name for typing indicator
  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!currentUserId) return;
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('profiles')
        .select('display_name, full_name')
        .eq('id', currentUserId)
        .single();
      setUserDisplayName(data?.display_name || data?.full_name || 'User');
    };
    fetchDisplayName();
  }, [currentUserId]);

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
    stopTyping();
    await sendMessage(content);
    textareaRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      startTyping(userDisplayName);
    } else {
      stopTyping();
    }
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
      {/* Online Status Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20 bg-muted/20">
        <OnlineIndicator isOnline={isConnected} size="sm" showPulse={false} />
        <span className="text-xs text-muted-foreground">
          {onlineCount > 0 ? `${onlineCount} online` : 'Connecting...'}
        </span>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-sm font-medium mb-1">Start the conversation</h3>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Be the first to say hello to your group
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((message, index) => {
                const isOwn = message.user_id === currentUserId;
                const showAvatar = index === 0 || messages[index - 1]?.user_id !== message.user_id;
                const previousMessageDate = index > 0 ? new Date(messages[index - 1].created_at) : undefined;

                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    showDateSeparator={index === 0}
                    previousMessageDate={previousMessageDate}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} className="border-t border-border/10" />

      {/* Enhanced Input Bar - Mobile Optimized */}
      <div className="border-t border-border/30 bg-background/95 backdrop-blur-sm px-2 sm:px-3 py-2 sm:py-3">
        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* Emoji Button - hidden on mobile */}
          <Button 
            variant="ghost" 
            size="icon"
            className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 text-muted-foreground hover:text-foreground hidden sm:flex"
          >
            <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              disabled={sending}
              rows={1}
              className={cn(
                "min-h-[38px] sm:min-h-[40px] max-h-[100px] sm:max-h-[120px] resize-none py-2 sm:py-2.5 pr-9 sm:pr-10 text-sm",
                "border-border/40 bg-muted/30 rounded-2xl",
                "focus:ring-1 focus:ring-primary/30 transition-all"
              )}
              style={{ 
                height: 'auto',
                overflow: newMessage.split('\n').length > 3 ? 'auto' : 'hidden'
              }}
            />
            
            {/* Image Button (inside input) */}
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute right-0.5 sm:right-1 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground/50 hover:text-muted-foreground"
            >
              <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>

          {/* Send Button - smaller on mobile */}
          <motion.div
            whileTap={{ scale: 0.9 }}
          >
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className={cn(
                "h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full transition-all",
                newMessage.trim() 
                  ? "bg-primary hover:bg-primary/90 shadow-md" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
});
