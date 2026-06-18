import { memo, useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { MoreVertical, Pin, Pencil, Trash2, Check, X } from 'lucide-react';
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
import { MessageReactions } from './MessageReactions';
import type { GroupMessage } from '@/hooks/useGroupChat';

interface ChatMessageProps {
  message: GroupMessage;
  isOwn: boolean;
  showAvatar: boolean;
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
  canPin,
  isFirstUnread,
  onReactionAdd,
  onEdit,
  onDelete,
  onTogglePin,
  onImageClick,
}: ChatMessageProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.setSelectionRange(draft.length, draft.length);
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

  const displayName = message.profile?.display_name || message.profile?.full_name || 'Unknown';
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
          <div className="flex-1 border-t border-border/30" />
          <span className="px-3 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
            {getDateSeparatorText(messageDate)}
          </span>
          <div className="flex-1 border-t border-border/30" />
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
          'flex gap-2 group',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
        onDoubleClick={() => !editing && setShowReactions(true)}
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
            'max-w-[78%] sm:max-w-[75%] space-y-0.5',
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
              {wasEdited && (
                <span className="text-[10px] text-muted-foreground/50 italic">edited</span>
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
              <div
                className={cn(
                  'rounded-2xl px-3 py-2 text-sm transition-colors whitespace-pre-wrap',
                  isOwn
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted/70 rounded-bl-md',
                  message.is_pinned && 'ring-1 ring-primary/40',
                  'group-hover:ring-1 group-hover:ring-border/20'
                )}
              >
                {message.content}
              </div>
            ) : null}

            {/* Hover affordances — reaction trigger and message menu. */}
            {!editing && (
              <div
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
                  isOwn ? 'right-full mr-1' : 'left-full ml-1'
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowReactions(true)}
                  className="text-muted-foreground/40 hover:text-muted-foreground text-xs leading-none"
                  aria-label="React"
                >
                  😊
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
            />
          )}
        </div>
      </motion.div>
    </>
  );
});
