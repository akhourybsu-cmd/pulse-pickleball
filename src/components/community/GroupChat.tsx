import { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react';
import { Send, Loader2, Smile, Image as ImageIcon, Pin, X, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
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

interface GroupChatProps {
  groupId: string;
  currentUserId: string | null;
  // Presence props passed from parent to avoid duplicate subscriptions
  onlineCount?: number;
  isConnected?: boolean;
  /** Whether the viewer is owner/moderator — unlocks Pin in the message menu. */
  isAdmin?: boolean;
  /**
   * Snapshot of the viewer's membership.last_read_at BEFORE this session.
   * Used to compute the unread count + first-unread index for the
   * jump-to-unread pill. Parent should pass the value it captured at
   * group-enter (the parent also kicks off the last_read_at update so
   * the snapshot represents the prior visit).
   */
  lastReadAt?: string | null;
}

export const GroupChat = memo(function GroupChat({
  groupId,
  currentUserId,
  onlineCount = 0,
  isConnected = false,
  isAdmin = false,
  lastReadAt = null,
}: GroupChatProps) {
  const {
    messages, loading, sending,
    sendMessage, retryMessage, deleteMessage, editMessage, togglePinMessage,
  } = useGroupChat(groupId);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(groupId);

  const [newMessage, setNewMessage] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [pinnedDismissed, setPinnedDismissed] = useState(false);
  const [unreadDismissed, setUnreadDismissed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadImage, uploading, progress } = useImageUpload({
    bucket: 'group-message-images',
    folder: groupId,
  });

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

  // Auto-scroll to bottom only when (a) user is near the bottom already, or
  // (b) the newest message is from the current user. Avoids yanking the view
  // while reading older history as new messages stream in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const lastMsg = messages[messages.length - 1];
    const isOwnLast = lastMsg?.user_id === currentUserId;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isOwnLast || nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, currentUserId]);


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
  const unreadCount = firstUnreadIndex >= 0 ? messages.length - firstUnreadIndex : 0;

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

    let imageUrl: string | undefined;
    if (stagedImage) {
      const result = await uploadImage(stagedImage);
      if (!result) return; // toast surfaced inside hook
      imageUrl = result.url;
    }

    // sendMessage applies the optimistic bubble immediately via React Query.
    sendMessage(content, imageUrl).catch(() => {/* error toast handled in hook */});
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

  const handlePickImage = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const jumpToFirstUnread = useCallback(() => {
    const el = document.getElementById('chat-first-unread');
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Dismiss the pill — user is now reading the unread block.
      setUnreadDismissed(true);
    }
  }, []);

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

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 relative"
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
                    canPin={isAdmin || isOwn}
                    isFirstUnread={index === firstUnreadIndex}
                    onEdit={editMessage as any}
                    onDelete={deleteMessage as any}
                    onTogglePin={togglePinMessage}
                    onImageClick={setLightboxImage}
                    onRetry={retryMessage}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Jump-to-unread pill — floats above the messages, fixed-position
            relative to the scroll container. Hidden when the user has
            already dismissed it (after a jump) or no unread exist. */}
        <AnimatePresence>
          {unreadCount > 0 && !unreadDismissed && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              onClick={jumpToFirstUnread}
              className={cn(
                'sticky top-2 mx-auto z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                'bg-primary text-primary-foreground text-xs font-semibold shadow-lg',
                'hover:bg-primary/90 active:scale-95 transition-all',
              )}
            >
              <ArrowDown className="h-3 w-3" />
              {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} className="border-t border-border/10" />

      {/* Enhanced Input Bar */}
      <motion.div
        className={cn(
          "border-t border-border/30 bg-background/95 backdrop-blur-sm px-2 sm:px-3 py-2 sm:py-3",
          "pb-[env(safe-area-inset-bottom,0px)]",
          focusMode && "shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        )}
        animate={{
          paddingBottom: focusMode ? 'calc(8px + env(safe-area-inset-bottom, 0px))' : 'env(safe-area-inset-bottom, 0px)'
        }}
        transition={{ duration: 0.2 }}
      >
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
              onFocus={() => setFocusMode(true)}
              onBlur={() => setFocusMode(false)}
              placeholder={pendingImage ? 'Add a caption (optional)…' : 'Message...'}
              disabled={uploading}
              rows={1}
              className={cn(
                "resize-none py-2 sm:py-2.5 pr-9 sm:pr-10 text-sm",
                "border-border/40 bg-muted/30 rounded-2xl",
                "focus:ring-1 focus:ring-primary/30 transition-all duration-200",
                focusMode
                  ? "min-h-[80px] sm:min-h-[100px] max-h-[150px]"
                  : "min-h-[38px] sm:min-h-[40px] max-h-[100px] sm:max-h-[120px]"
              )}
              style={{
                overflow: newMessage.split('\n').length > 3 || focusMode ? 'auto' : 'hidden'
              }}
            />


            {/* Image Button (inside input) — picks a file and stages it
                in pendingImage; actual upload happens on send. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePickImage}
              disabled={sending || uploading}
              className={cn(
                "absolute right-0.5 sm:right-1 h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground/70 hover:text-foreground",
                focusMode ? "bottom-1" : "top-1/2 -translate-y-1/2"
              )}
            >
              <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>

          {/* Send Button */}
          <motion.div
            whileTap={{ scale: 0.9 }}
            className={focusMode ? "self-end" : ""}
          >
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!newMessage.trim() && !pendingImage) || uploading}
              className={cn(
                "h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full transition-all",
                (newMessage.trim() || pendingImage)
                  ? "bg-primary hover:bg-primary/90 shadow-md"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </Button>

          </motion.div>
        </div>
      </motion.div>

      {/* Lightbox for tapped chat images. */}
      <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
});
