import { useState, useRef, useEffect, useLayoutEffect, memo, useMemo, useCallback } from 'react';
import { useRegisterActiveContext } from '@/contexts/ActiveViewContext';

import { Send, Loader2, Image as ImageIcon, Pin, X, ArrowDown, MessageCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useGroupChat } from '@/hooks/useGroupChat';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useImageUpload } from '@/hooks/useImageUpload';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { OnlineIndicator } from './OnlineIndicator';
import { ImageLightbox } from './ImageLightbox';
import { cn } from '@/lib/utils';
import {
  anchoredScrollTop,
  isChatNearBottom,
  viewportResizeAnchoredScrollTop,
} from '@/lib/chat/scroll';
import { isSameSenderRun } from '@/lib/chat/grouping';

interface GroupChatProps {
  groupId: string;
  currentUserId: string | null;
  // Presence props passed from parent to avoid duplicate subscriptions
  onlineCount?: number;
  isConnected?: boolean;
  /** Whether the viewer is owner/moderator — unlocks Pin in the message menu. */
  isAdmin?: boolean;
  /**
   * Snapshot of the viewer's membership.last_chat_read_at before this chat
   * became active. It places the unread divider without letting a feed visit
   * clear unseen messages.
   */
  lastReadAt?: string | null;
  /** False while a force-mounted chat tab is hidden. */
  isActive?: boolean;
  /** Optional branded thread title for an immersive venue-chat entry. */
  title?: string;
  subtitle?: string;
  avatarUrl?: string | null;
  /** Adds an in-thread back control when chat owns the full viewport. */
  onBack?: () => void;
  /** Enables safe-area header treatment and focus/viewport locking. */
  immersive?: boolean;
}

export const GroupChat = memo(function GroupChat({
  groupId,
  currentUserId,
  onlineCount = 0,
  isConnected = false,
  isAdmin = false,
  lastReadAt = null,
  isActive = true,
  title,
  subtitle,
  avatarUrl,
  onBack,
  immersive = false,
}: GroupChatProps) {
  const {
    messages, loading, sending, hasOlder, loadingOlder, loadOlder,
    sendMessage, retryMessage, deleteMessage, editMessage, togglePinMessage, toggleReaction,
  } = useGroupChat(groupId);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(groupId);
  // Force-mounted tabs stay in the DOM to preserve scroll position, so only
  // suppress notifications while the chat is actually the visible tab.
  useRegisterActiveContext([isActive && groupId ? `group:${groupId}` : null]);


  const [newMessage, setNewMessage] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [pinnedDismissed, setPinnedDismissed] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelowCount, setNewBelowCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialPositionedFor = useRef<string | null>(null);
  const previousLastMessageId = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const lastMarkedMessageId = useRef<string | null>(null);

  const { uploadImage, uploading, progress } = useImageUpload({
    bucket: 'group-message-images',
    folder: groupId,
  });

  // Get user display name for typing indicator
  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!currentUserId) return;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, full_name')
        .eq('id', currentUserId)
        .single();
      setUserDisplayName(data?.display_name || data?.full_name || 'User');
    };
    fetchDisplayName();
  }, [currentUserId]);

  // Build a preview URL when an image is staged.
  useEffect(() => {
    if (!pendingImage) {
      setPendingImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setPendingImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

  // Identify the pinned message and the first unread index in one pass.
  const pinnedMessage = useMemo(
    () => messages.find((m) => m.is_pinned),
    [messages],
  );

  const firstUnreadIndex = useMemo(() => {
    if (!lastReadAt) return -1;
    return messages.findIndex(
      (m) => m.created_at > lastReadAt && m.user_id !== currentUserId,
    );
  }, [messages, lastReadAt, currentUserId]);
  const isNearBottom = useCallback((element: HTMLDivElement) => isChatNearBottom(element), []);

  const markChatRead = useCallback(() => {
    if (!currentUserId || !isActive) return;
    const newest = messages[messages.length - 1];
    if (!newest || newest.id === lastMarkedMessageId.current) return;
    lastMarkedMessageId.current = newest.id;

    void supabase
      .from('group_members')
      .update({ last_chat_read_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .then(({ error }) => {
        if (error) {
          lastMarkedMessageId.current = null;
          console.error('Could not update chat read position:', error);
        }
      });
  }, [currentUserId, groupId, isActive, messages]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    setAtBottom(true);
    setNewBelowCount(0);
    markChatRead();
  }, [markChatRead]);

  // Preserve the exact distance from the bottom whenever the conversation
  // viewport changes height. This covers keyboard open/close, textarea
  // auto-growth, typing indicators, and pinned-message banners. Without this,
  // the focused composer moves but the bubbles remain at their old scrollTop,
  // so the message a person was reading disappears beneath the keyboard.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    let previousHeight = element.clientHeight;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const nextHeight = element.clientHeight;
      if (nextHeight === previousHeight) return;

      if (initialPositionedFor.current !== groupId) {
        previousHeight = nextHeight;
        return;
      }

      const previousTop = element.scrollTop;
      const previousClientHeight = previousHeight;
      previousHeight = nextHeight;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = scrollRef.current;
        if (!current) return;
        current.scrollTop = viewportResizeAnchoredScrollTop(
          previousTop,
          previousClientHeight,
          current.clientHeight,
          current.scrollHeight,
        );
        setAtBottom(isNearBottom(current));
      });
    });

    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [groupId, isNearBottom]);

  const loadOlderAnchored = useCallback(async () => {
    const element = scrollRef.current;
    if (!element || loadingOlderRef.current || loadingOlder || !hasOlder) return;
    loadingOlderRef.current = true;
    const previousHeight = element.scrollHeight;
    const previousTop = element.scrollTop;

    try {
      await loadOlder();
      requestAnimationFrame(() => {
        const current = scrollRef.current;
        if (!current) return;
        current.scrollTop = anchoredScrollTop(previousTop, previousHeight, current.scrollHeight);
      });
    } finally {
      loadingOlderRef.current = false;
    }
  }, [hasOlder, loadOlder, loadingOlder]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = isNearBottom(element);
    if (nearBottom) {
      if (!atBottom) markChatRead();
      setNewBelowCount(0);
    }
    setAtBottom(nearBottom);

    if (element.scrollTop < 72 && hasOlder && !loadingOlder) {
      void loadOlderAnchored();
    }
  }, [atBottom, hasOlder, isNearBottom, loadOlderAnchored, loadingOlder, markChatRead]);

  // A premium chat opens at the first unread message, or at the latest message
  // when there is nothing unread. The previous implementation often opened at
  // the top because its "near bottom" check ran before any initial positioning.
  useLayoutEffect(() => {
    if (loading || !isActive || initialPositionedFor.current === groupId) return;
    initialPositionedFor.current = groupId;

    requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      const unreadMarker = container.querySelector<HTMLElement>('#chat-first-unread');
      if (unreadMarker) {
        unreadMarker.scrollIntoView({ block: 'start' });
        setAtBottom(isNearBottom(container));
      } else {
        container.scrollTop = container.scrollHeight;
        setAtBottom(true);
        markChatRead();
      }
      previousLastMessageId.current = messages[messages.length - 1]?.id ?? null;
    });
  }, [groupId, isActive, isNearBottom, loading, markChatRead, messages]);

  // Keep following the conversation only when the viewer was already at the
  // bottom (or sent the message). Otherwise preserve their reading position and
  // surface a jump-to-latest control with the number of messages waiting below.
  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (!newest || initialPositionedFor.current !== groupId) return;
    const previousId = previousLastMessageId.current;
    previousLastMessageId.current = newest.id;
    if (!previousId || previousId === newest.id || !isActive) return;

    if (newest.user_id === currentUserId || atBottom) {
      requestAnimationFrame(() => scrollToLatest('smooth'));
    } else {
      setNewBelowCount((count) => count + 1);
    }
  }, [atBottom, currentUserId, groupId, isActive, messages, scrollToLatest]);

  useEffect(() => {
    if (isActive && atBottom) markChatRead();
  }, [atBottom, isActive, markChatRead]);

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if ((!trimmed && !pendingImage) || uploading) return;

    // Capture & clear synchronously so the input is ready for the next message
    // before the network round-trip completes.
    const stagedImage = pendingImage;
    const content = trimmed;
    setNewMessage('');
    setPendingImage(null);
    stopTyping();
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = '40px';
    });

    let imageUrl: string | undefined;
    if (stagedImage) {
      const result = await uploadImage(stagedImage);
      if (!result) {
        // Upload errors should not eat a caption or force the member to choose
        // the image again. Restore the complete draft for a one-tap retry.
        setNewMessage(content);
        setPendingImage(stagedImage);
        requestAnimationFrame(() => {
          const composer = textareaRef.current;
          if (!composer) return;
          composer.style.height = 'auto';
          composer.style.height = `${Math.min(composer.scrollHeight, 120)}px`;
        });
        return; // toast surfaced inside hook
      }
      imageUrl = result.url;
    }

    // sendMessage applies the optimistic bubble immediately via React Query.
    sendMessage(content, imageUrl).catch(() => {/* error toast handled in hook */});
    textareaRef.current?.focus({ preventScroll: true });
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    e.target.style.overflowY = e.target.scrollHeight > 120 ? 'auto' : 'hidden';
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

  const handleComposerFocus = () => {
    const element = scrollRef.current;
    if (!element) return;
    const shouldFollowLatest = isNearBottom(element);
    requestAnimationFrame(() => {
      // Mobile browsers sometimes scroll the layout viewport while revealing a
      // focused textarea even though the chat itself is fixed. Reset only for
      // the immersive venue thread; ordinary embedded group chats keep their
      // surrounding page position.
      if (immersive) document.scrollingElement?.scrollTo({ top: 0, behavior: 'auto' });
      if (shouldFollowLatest) scrollToLatest('auto');
    });
  };

  const handlePickImage = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div
        className={cn(
          'flex shrink-0 items-center gap-2.5 border-b border-border/60 bg-background/95 px-3 backdrop-blur-sm',
          immersive
            ? 'min-h-14 pb-2.5 [padding-top:calc(0.625rem+env(safe-area-inset-top))]'
            : 'h-11 px-4',
        )}
      >
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Back from chat"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </Button>
        )}

        {title ? (
          <Avatar className="h-9 w-9 shrink-0 rounded-xl ring-1 ring-border/70">
            <AvatarImage src={avatarUrl || undefined} alt="" />
            <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-bold text-primary">
              {title.trim().slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">
            {title || 'Community chat'}
          </p>
          {title && (
            <p className="truncate text-[11px] text-muted-foreground">
              {subtitle || 'Group chat'} · {onlineCount > 0 ? `${onlineCount} online` : 'Connecting…'}
            </p>
          )}
        </div>

        {!title && (
          <div className="ml-auto flex items-center gap-1.5">
            <OnlineIndicator isOnline={isConnected} size="sm" showPulse={false} />
            <span className="text-xs text-muted-foreground">
              {onlineCount > 0 ? `${onlineCount} online` : 'Connecting...'}
            </span>
          </div>
        )}
        {title && (
          <OnlineIndicator isOnline={isConnected} size="sm" showPulse={false} />
        )}
      </div>

      {/* Pinned banner — sticks to the top of the chat. Single pinned
          message is enforced by set_group_message_pin (a new pin
          implicitly unpins the previous one in the same group). */}
      <AnimatePresence>
        {pinnedMessage && !pinnedDismissed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-primary/20 bg-primary/5"
          >
            <div className="flex items-start gap-2 px-4 py-2.5">
              <Pin className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">
                  Pinned by {pinnedMessage.profile?.display_name || pinnedMessage.profile?.full_name || 'a member'}
                </div>
                <div className="text-sm text-foreground/90 line-clamp-2">
                  {pinnedMessage.content || (pinnedMessage.image_url ? '📷 Image' : '')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinnedDismissed(true)}
                aria-label="Hide pinned message"
                className="text-muted-foreground/60 hover:text-foreground flex-shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full touch-pan-y overflow-y-auto overscroll-contain bg-background px-3 py-4 [overflow-anchor:none] sm:px-5"
        >
          {messages.length > 0 && (
            <div className="flex min-h-7 items-center justify-center pb-3">
              {loadingOlder ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading earlier messages" />
              ) : hasOlder ? (
                <button
                  type="button"
                  onClick={() => void loadOlderAnchored()}
                  className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Earlier messages
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground/60">Start of conversation</span>
              )}
            </div>
          )}

          {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
                <MessageCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
              <h3 className="mb-1 text-sm font-semibold">Start the conversation</h3>
            <p className="text-xs text-muted-foreground max-w-[200px]">
                Share an update or say hello to the venue community.
            </p>
          </motion.div>
        ) : (
            <div role="log" aria-live="polite" aria-relevant="additions text">
            <AnimatePresence initial={false}>
              {messages.map((message, index) => {
                const isOwn = message.user_id === currentUserId;
                const isFirstInGroup = !isSameSenderRun(messages[index - 1], message);
                const isLastInGroup = !isSameSenderRun(message, messages[index + 1]);
                const previousMessageDate = index > 0 ? new Date(messages[index - 1].created_at) : undefined;
                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isOwn={isOwn}
                      showAvatar={!isOwn && isLastInGroup}
                    showHeader={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                    showDateSeparator={index === 0}
                    previousMessageDate={previousMessageDate}
                    canPin={isAdmin || isOwn}
                    isFirstUnread={index === firstUnreadIndex}
                    onEdit={editMessage}
                    onDelete={deleteMessage}
                    onTogglePin={togglePinMessage}
                    onImageClick={setLightboxImage}
                    onRetry={retryMessage}
                      onReactionAdd={toggleReaction}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}

        </div>

        <AnimatePresence>
          {!atBottom && (
            <motion.button
              type="button"
                initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
                onClick={() => scrollToLatest()}
                className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted"
            >
                <ArrowDown className="h-3.5 w-3.5 text-primary" />
                {newBelowCount > 0 ? `${newBelowCount} new` : 'Latest'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} className="border-t border-border/10" />

      <div className="relative z-20 shrink-0 border-t border-border/60 bg-background/95 px-3 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-8px_24px_-20px_hsl(var(--foreground)/0.45)] backdrop-blur-sm">
        {/* Pending-image preview chip — sits above the textarea while a
            file is staged. Cancel removes it without sending. */}
        {pendingImagePreview && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="relative">
              <img
                src={pendingImagePreview}
                alt="Pending attachment"
                className="h-14 w-14 rounded-lg object-cover border border-border/40"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                aria-label="Remove attachment"
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center shadow"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {uploading ? (
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Uploading…</span>
                  <span className="text-muted-foreground tabular-nums">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Image attached</span>
            )}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePickImage}
            disabled={sending || uploading}
            aria-label="Attach an image"
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleComposerFocus}
              placeholder={pendingImage ? 'Add a caption (optional)…' : 'Message...'}
              disabled={uploading}
              rows={1}
              className="min-h-10 max-h-[120px] resize-none overflow-hidden rounded-[20px] border-border/70 bg-muted/35 px-3 py-2.5 text-sm leading-5 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>

          <motion.div whileTap={{ scale: 0.92 }}>
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={(!newMessage.trim() && !pendingImage) || uploading}
              aria-label="Send message"
              className={cn(
                "h-10 w-10 shrink-0 rounded-full transition-all",
                (newMessage.trim() || pendingImage)
                  ? "bg-primary shadow-sm hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Lightbox for tapped chat images. */}
      <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
});
