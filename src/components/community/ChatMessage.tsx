import { memo, useState, useRef, useEffect } from 'react';
import { StaffBadge } from '@/components/venue/StaffBadge';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { MoreVertical, Pin, Pencil, Trash2, Check, X, RefreshCw, SmilePlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { outgoingBubble, incomingBubble } from '@/lib/chat/bubbleStyles';
import { MessageReactions } from './MessageReactions';
import type { GroupMessage } from '@/hooks/useGroupChat';

interface ChatMessageProps {
  message: GroupMessage;
  isOwn: boolean;
  showAvatar: boolean;
  /** First bubble of an incoming sender run. */
  showHeader?: boolean;
  /** Last bubble of a sender's run — gets the iMessage-style tail. */
  isLastInGroup?: boolean;
  showDateSeparator?: boolean;
  previousMessageDate?: Date;
  /** Roles that gate Pin in the dropdown — only shown when true. */
  canPin?: boolean;
  isFirstUnread?: boolean;
  onReactionAdd?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, content: string) => Promise<void>;
  onDelete?: (messageId: string) => void;
  onTogglePin?: (messageId: string, pinned: boolean) => void;
  onImageClick?: (url: string) => void;
  /** Re-fire a failed send for an own optimistic row. */
  onRetry?: (clientId: string) => void;
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
  showHeader = false,
  isLastInGroup = true,
  showDateSeparator,
  previousMessageDate,
  canPin,
  isFirstUnread,
  onReactionAdd,
  onEdit,
  onDelete,
  onTogglePin,
  onImageClick,
  onRetry,
}: ChatMessageProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (editing) {
      const field = editRef.current;
      field?.focus();
      field?.setSelectionRange(field.value.length, field.value.length);
    }
  }, [editing]);

  const messageDate = new Date(message.created_at);
  const shouldShowSeparator = showDateSeparator ||
    (previousMessageDate && !isSameDay(previousMessageDate, messageDate));

  const initials = (message.profile?.display_name || message.profile?.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const displayName = message.profile?.display_name || message.profile?.full_name || 'Someone';
  const senderLabel = isOwn ? 'You' : displayName;
  const wasEdited = !!message.edited_at;

  const handleSaveEdit = async () => {
    const next = draft.trim();
    if (!next || next === message.content) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    setSaving(true);
    try {
      await onEdit?.(message.id, next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setDraft(message.content);
  };

  // The dropdown is shown only when there's at least one action available.
  // Pin is gated by the canPin prop; edit/delete by isOwn.
  const hasMenu = isOwn || canPin;

  return (
    <>
      {shouldShowSeparator && (
        <div className="flex items-center justify-center py-4">
          <div className="flex-1 border-t border-border/50" />
          <span className="mx-2 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-sm">
            {getDateSeparatorText(messageDate)}
          </span>
          <div className="flex-1 border-t border-border/50" />
        </div>
      )}

      {/* "New messages" marker on the first unread row — sits ABOVE the
          message so the user sees the separator before the content. */}
      {isFirstUnread && (
        <div className="flex items-center justify-center py-2" id="chat-first-unread">
          <div className="flex-1 border-t border-primary/40" />
          <span className="px-3 text-[10px] text-primary uppercase tracking-wider font-bold">
            New messages
          </span>
          <div className="flex-1 border-t border-primary/40" />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'flex items-end gap-2 group',
          isOwn ? 'flex-row-reverse' : 'flex-row',
          showHeader ? (shouldShowSeparator ? 'pt-1' : 'pt-4') : 'pt-1',
        )}
        role="group"
        aria-label={`${senderLabel}, ${format(messageDate, 'h:mm a')}`}
        onDoubleClick={() => !editing && setShowReactions(true)}
      >
        {!isOwn && showAvatar ? (
          <button
            type="button"
            onClick={() => !isOwn && navigate(`/profile/${message.user_id}`)}
            className="flex-shrink-0"
            aria-label="View profile"
          >
            <Avatar className="h-8 w-8 ring-1 ring-border/60">
              <AvatarImage src={message.profile?.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
            </Avatar>
          </button>
        ) : !isOwn ? (
          <div className="w-8 shrink-0" />
        ) : null}

        <div
          className={cn(
            'flex max-w-[82%] flex-col space-y-1 sm:max-w-[74%]',
            isOwn ? 'items-end' : 'items-start'
          )}
        >
          {showHeader && (
            <div className={cn('flex min-h-4 items-center gap-1.5 px-1', isOwn && 'justify-end')}>
              <span className="max-w-[150px] truncate text-[11px] font-bold text-foreground/80">
                {senderLabel}
              </span>
              <StaffBadge userId={message.user_id} />
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                {format(messageDate, 'h:mm a')}
              </span>
              {wasEdited && (
                <span className="text-[10px] italic text-muted-foreground/70">edited</span>
              )}
            </div>
          )}

          <div className="relative">
            {/* Image attachment — rendered above the bubble so it stays
                full-width even when the text is short. Clicking opens the
                shared ImageLightbox in the parent. */}
            {message.image_url && (
              <button
                type="button"
                onClick={() => onImageClick?.(message.image_url!)}
                className={cn(
                  'block rounded-2xl overflow-hidden mb-1 max-w-[280px]',
                  isOwn ? 'ml-auto' : '',
                )}
              >
                <img
                  src={message.image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full max-h-72 object-cover hover:opacity-95 transition-opacity"
                />
              </button>
            )}

            {editing ? (
              // Inline edit mode — replaces the bubble with a textarea +
              // save/cancel buttons. Keeps width consistent with the
              // surrounding messages.
              <div className="space-y-2 w-full min-w-[220px]">
                <Textarea
                  ref={editRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  className="resize-none text-sm rounded-2xl min-h-[44px]"
                  disabled={saving}
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleSaveEdit}
                    disabled={saving || !draft.trim()}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : message.content ? (
              <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'rounded-[18px] px-3.5 py-2.5 text-[15px] leading-[1.42] transition-colors whitespace-pre-wrap break-words select-text',
                    isOwn ? outgoingBubble : incomingBubble,
                    // Tail on the last bubble of a run, unless the send failed.
                    isLastInGroup && message._status !== 'failed' &&
                      (isOwn ? 'chat-tail-right' : 'chat-tail-left'),
                    message.is_pinned && 'ring-1 ring-primary/40',
                    'group-hover:ring-1 group-hover:ring-foreground/10',
                    message._status === 'sending' && 'opacity-70',
                    message._status === 'failed' && 'ring-1 ring-destructive/60',
                  )}
                >
                  {message.content}
                </div>
                {/* Per-bubble status indicator for own messages — matches
                    the DM pattern (pulse during sending, subtle check on
                    sent, tap-to-retry on failed). Off-bubble so the
                    bubble shape stays clean and the indicator can be
                    color-tuned independently. */}
                {isOwn && message._status === 'sending' && (
                  <span
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                    aria-label="Sending"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50 animate-pulse" />
                    Sending
                  </span>
                )}
                {isOwn && message._status === 'sent' && (
                  <Check
                    className="mt-1 h-3 w-3 text-muted-foreground opacity-70"
                    aria-label="Sent"
                  />
                )}
                {isOwn && message._status === 'failed' && message._clientId && (
                  <button
                    type="button"
                    onClick={() => onRetry?.(message._clientId!)}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-destructive underline hover:opacity-80"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                    Failed — tap to retry
                  </button>
                )}
              </div>
            ) : null}


            {/* Hover affordances — reaction trigger and message menu. */}
            {!editing && (
              <div
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity',
                  isOwn ? 'right-full mr-1' : 'left-full ml-1'
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowReactions(true)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="React"
                >
                  <SmilePlus className="h-3.5 w-3.5" />
                </button>
                {hasMenu && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground/40 hover:text-muted-foreground"
                        aria-label="Message actions"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
                      {canPin && (
                        <DropdownMenuItem onClick={() => onTogglePin?.(message.id, !message.is_pinned)}>
                          <Pin className="h-3.5 w-3.5 mr-2" />
                          {message.is_pinned ? 'Unpin' : 'Pin to chat'}
                        </DropdownMenuItem>
                      )}
                      {isOwn && message.content && (
                        <DropdownMenuItem onClick={() => { setEditing(true); setDraft(message.content); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {isOwn && (
                        <DropdownMenuItem
                          onClick={() => onDelete?.(message.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>

          {/* Message Reactions */}
          {!editing && (
            <MessageReactions
              messageId={message.id}
              isOwn={isOwn}
              showPicker={showReactions}
              onPickerClose={() => setShowReactions(false)}
              onReactionAdd={onReactionAdd}
              reactions={message.reactions ?? []}
            />
          )}
        </div>
      </motion.div>
    </>
  );
});
