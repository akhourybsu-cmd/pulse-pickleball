import { memo, useState } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MessageReactions } from './MessageReactions';
import type { GroupMessage } from '@/hooks/useGroupChat';

interface ChatMessageProps {
  message: GroupMessage;
  isOwn: boolean;
  showAvatar: boolean;
  showDateSeparator?: boolean;
  previousMessageDate?: Date;
  onReactionAdd?: (messageId: string, emoji: string) => void;
}

function getDateSeparatorText(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isOwn,
  showAvatar,
  showDateSeparator,
  previousMessageDate,
  onReactionAdd,
}: ChatMessageProps) {
  const [showReactions, setShowReactions] = useState(false);
  
  const messageDate = new Date(message.created_at);
  const shouldShowSeparator = showDateSeparator || 
    (previousMessageDate && !isSameDay(previousMessageDate, messageDate));

  const initials = (message.profile?.display_name || message.profile?.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const displayName = message.profile?.display_name || message.profile?.full_name || 'Unknown';

  return (
    <>
      {shouldShowSeparator && (
        <div className="flex items-center justify-center py-4">
          <div className="flex-1 border-t border-border/30" />
          <span className="px-3 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
            {getDateSeparatorText(messageDate)}
          </span>
          <div className="flex-1 border-t border-border/30" />
        </div>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'flex gap-2 group',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
        onDoubleClick={() => setShowReactions(true)}
      >
        {showAvatar ? (
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarImage src={message.profile?.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
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
                {displayName}
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                {formatDistanceToNow(messageDate, { addSuffix: true })}
              </span>
            </div>
          )}
          
          <div className="relative">
            <div
              className={cn(
                'rounded-2xl px-3 py-2 text-sm transition-colors',
                isOwn
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted/70 rounded-bl-md',
                'group-hover:ring-1 group-hover:ring-border/20'
              )}
            >
              {message.content}
            </div>
            
            {/* Quick reaction hint on hover */}
            <div 
              className={cn(
                'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity',
                isOwn ? 'right-full mr-1' : 'left-full ml-1'
              )}
            >
              <button
                onClick={() => setShowReactions(true)}
                className="text-muted-foreground/40 hover:text-muted-foreground text-xs"
              >
                😊
              </button>
            </div>
          </div>

          {/* Message Reactions */}
          <MessageReactions
            messageId={message.id}
            isOwn={isOwn}
            showPicker={showReactions}
            onPickerClose={() => setShowReactions(false)}
            onReactionAdd={onReactionAdd}
          />
        </div>
      </motion.div>
    </>
  );
});
