import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDown, MoreVertical, BellOff, Bell, Shield, Flag, UserX, Check, RefreshCw, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { MessageComposer, type MessageComposerHandle } from '@/components/community/MessageComposer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useConversation, useDirectMessages, type DirectMessage } from '@/hooks/useDirectMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from '@/components/community/TypingIndicator';
import { supabase } from '@/integrations/supabase/client';
import { reportUser, useBlockedUsers } from '@/hooks/useMessagingSafety';
import { cn } from '@/lib/utils';
import { outgoingBubble, incomingBubble } from '@/lib/chat/bubbleStyles';
import { isSameSenderRun } from '@/lib/chat/grouping';
import { useRegisterActiveContext } from '@/contexts/ActiveViewContext';
import { useVisualViewportPane } from '@/hooks/useVisualViewportPane';
import {
  anchoredScrollTop,
  isChatNearBottom,
  viewportResizeAnchoredScrollTop,
} from '@/lib/chat/scroll';


// Render http(s) URLs in message text as tappable links — invite links
// shared in DMs were dead plain text otherwise. Text-only splitting
// (no HTML injection); everything that isn't a URL passes through as a
// plain string.
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

function linkifyContent(content: string) {
  const parts = content.split(URL_RE);
  if (parts.length === 1) return content;
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

export default function DirectMessageChat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const {
    messages,
    loading,
    hasMore,
    loadingOlder,
    loadOlder,
    participant,
    viewerMembership,
    currentUserId,
    notFound,
    sendMessage,
    retryMessage,
  } = useConversation(conversationId || null);
  const { markRead } = useDirectMessages();
  // While this thread is open, its message notifications self-clear.
  useRegisterActiveContext([conversationId ? `conversation:${conversationId}` : null]);

  const { block } = useBlockedUsers();
  const [newMessage, setNewMessage] = useState('');
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState('Someone');
  // No more isSending state — sends are optimistic and the spinner UX
  // moved onto the per-bubble _status='sending' indicator. The
  // composer's `sending` prop is hardcoded false now so the send
  // button stays live for back-to-back sends.
  const [muted, setMuted] = useState(false);
  const [leftAt, setLeftAt] = useState<string | null>(null);
  const [restricted, setRestricted] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const [newBelowCount, setNewBelowCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const lastMsgIdRef = useRef<string | null>(null);
  const didInitialScrollRef = useRef(false);
  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const inputRef = useRef<MessageComposerHandle>(null);

  // Pin the whole thread to the visible viewport so the header stays put when
  // the keyboard opens (see hook for the edge-to-edge / overlay rationale).
  const paneStyle = useVisualViewportPane();

  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversationId ? `dm-${conversationId}` : undefined);

  // React Router can reuse this component while only the conversation id
  // changes. Clear every thread-specific visual state before paint so a draft,
  // scroll marker, or restriction from one person never flashes in another
  // conversation.
  useLayoutEffect(() => {
    setNewMessage('');
    setMuted(false);
    setLeftAt(null);
    setRestricted(null);
    setReportOpen(false);
    setReportReason('');
    setAtBottom(true);
    setNewBelowCount(0);
    prevCountRef.current = 0;
    lastMsgIdRef.current = null;
    didInitialScrollRef.current = false;
    lastMarkedMessageIdRef.current = null;
    loadingOlderRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (!currentUserId) {
      setCurrentUserDisplayName('Someone');
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: profile } = await supabase
        .from('profiles_public')
        .select('display_name, full_name')
        .eq('id', currentUserId)
        .maybeSingle();
      if (!cancelled) {
        setCurrentUserDisplayName(profile?.display_name || profile?.full_name || 'Someone');
      }
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  // Membership is resolved alongside the thread before loading is released,
  // preventing a departed viewer from briefly seeing an enabled composer
  // while a second request catches up.
  useLayoutEffect(() => {
    if (!viewerMembership) return;
    setMuted(viewerMembership.isMuted);
    setLeftAt(viewerMembership.leftAt);
  }, [viewerMembership]);

  // Check if blocked either way / target privacy.
  useEffect(() => {
    if (!participant?.id || !currentUserId) return;
    (async () => {
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('blocker_id, blocked_id')
        .or(
          `and(blocker_id.eq.${currentUserId},blocked_id.eq.${participant.id}),` +
          `and(blocker_id.eq.${participant.id},blocked_id.eq.${currentUserId})`
        );
      if (blocks && blocks.length > 0) {
        const youBlocked = blocks.some((block) => block.blocker_id === currentUserId);
        setRestricted(youBlocked ? "You've blocked this user. Unblock from Settings to message." : "You can't message this user.");
        return;
      }
      const { data: prefs } = await supabase
        .from('user_messaging_prefs')
        .select('dm_privacy')
        .eq('user_id', participant.id)
        .maybeSingle();
      if (prefs?.dm_privacy === 'nobody') {
        setRestricted('This user is not accepting messages.');
        return;
      }
      setRestricted(null);
    })();
    // Block/privacy status depends on the two users, not on message volume —
    // keying on messages.length re-ran this whole check (two extra queries)
    // on every incoming message.
  }, [participant?.id, currentUserId]);

  const markNewestRead = useCallback(() => {
    const newest = messages[messages.length - 1];
    if (!conversationId || !newest || document.visibilityState !== 'visible') return;
    const marker = `${conversationId}:${newest.id}`;
    if (lastMarkedMessageIdRef.current === marker) return;
    lastMarkedMessageIdRef.current = marker;
    void markRead(conversationId).then((success) => {
      if (!success && lastMarkedMessageIdRef.current === marker) {
        lastMarkedMessageIdRef.current = null;
      }
    });
  }, [conversationId, markRead, messages]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    setAtBottom(true);
    setNewBelowCount(0);
    markNewestRead();
  }, [markNewestRead]);

  // Load older messages and keep the viewport anchored on the message the user
  // was looking at (prepending above the viewport would otherwise jump them).
  const handleLoadOlder = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (!container || loadingOlderRef.current || loadingOlder || !hasMore) return;
    loadingOlderRef.current = true;
    const previousHeight = container.scrollHeight;
    const previousTop = container.scrollTop;
    try {
      await loadOlder();
      requestAnimationFrame(() => {
        container.scrollTop = anchoredScrollTop(
          previousTop,
          previousHeight,
          container.scrollHeight,
        );
      });
    } finally {
      loadingOlderRef.current = false;
    }
  }, [hasMore, loadOlder, loadingOlder]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 72 && hasMore && !loadingOlderRef.current) {
      void handleLoadOlder();
    }
    const nearBottom = isChatNearBottom(container, 140);
    setAtBottom(nearBottom);
    if (nearBottom) {
      setNewBelowCount(0);
      markNewestRead();
    }
  }, [handleLoadOlder, hasMore, markNewestRead]);

  // Only advance the read marker while this tab is visible and the user is at
  // the latest messages. Incoming rows must remain unread when someone is
  // reviewing history or the app is backgrounded.
  useEffect(() => {
    if (atBottom) markNewestRead();
  }, [atBottom, markNewestRead]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && atBottom) markNewestRead();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [atBottom, markNewestRead]);

  // Keep the same bottom-anchored bubble in view when the visual viewport or
  // composer changes height. This is the key keyboard-open/close behavior in
  // iOS, Android, and their Capacitor webviews.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    let previousHeight = container.clientHeight;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const nextHeight = container.clientHeight;
      if (nextHeight === previousHeight) return;
      if (!didInitialScrollRef.current) {
        previousHeight = nextHeight;
        return;
      }

      const previousTop = container.scrollTop;
      const previousClientHeight = previousHeight;
      previousHeight = nextHeight;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = scrollContainerRef.current;
        if (!current) return;
        current.scrollTop = viewportResizeAnchoredScrollTop(
          previousTop,
          previousClientHeight,
          current.clientHeight,
          current.scrollHeight,
        );
        const nearBottom = isChatNearBottom(current, 140);
        setAtBottom(nearBottom);
        if (nearBottom) setNewBelowCount(0);
      });
    });

    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [conversationId]);

  // First time this thread's messages land, jump straight to the bottom so an
  // opened chat always starts on the latest message. A layout effect makes the
  // jump happen before paint, and deferred pins catch late font/avatar layout.
  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return;
    const container = scrollContainerRef.current;
    if (!container || messages.length === 0) return;
    didInitialScrollRef.current = true;
    prevCountRef.current = messages.length;
    lastMsgIdRef.current = messages[messages.length - 1]?.id ?? null;
    const pin = () => {
      container.scrollTop = container.scrollHeight;
      setAtBottom(true);
      setNewBelowCount(0);
    };
    pin();
    const raf = requestAnimationFrame(pin);
    const timer = setTimeout(() => {
      pin();
      markNewestRead();
    }, 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [markNewestRead, messages, messages.length]);

  // After the initial jump, only auto-scroll on genuinely NEW messages, and
  // only when it won't yank the user out of older history they're reading:
  // their own outgoing message, or when they're already near the bottom.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !didInitialScrollRef.current) return;
    const prevCount = prevCountRef.current;
    prevCountRef.current = messages.length;
    const last = messages[messages.length - 1];
    const tailChanged = last?.id !== lastMsgIdRef.current;
    lastMsgIdRef.current = last?.id ?? null;
    if (messages.length <= prevCount) return; // status/edit change, not a new msg
    if (!tailChanged) return; // grew via a prepend (load older), not a new message
    const lastIsMine = last?.sender_id === currentUserId;
    if (lastIsMine || atBottom) {
      requestAnimationFrame(() => scrollToLatest('smooth'));
    } else {
      setNewBelowCount((count) => count + Math.max(1, messages.length - prevCount));
    }
  }, [atBottom, currentUserId, messages, scrollToLatest]);

  // Fire-and-forget — sendMessage is optimistic now, so the bubble
  // renders before the network completes. Clear the input synchronously
  // and refocus immediately to keep the composer ready for the next
  // message. Pre-conversion the input was blocked behind an
  // await + spinner until the server ACK'd, which felt sluggish on
  // anything but a perfect connection.
  const handleSend = () => {
    const text = newMessage.trim();
    if (!text || restricted || leftAt) return;
    setNewMessage('');
    void stopTyping();
    inputRef.current?.focus();
    void sendMessage(text);
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (value.trim()) void startTyping(currentUserDisplayName);
    else void stopTyping();
  };

  const toggleMute = async () => {
    if (!conversationId || !currentUserId) return;
    const next = !muted;
    setMuted(next);
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_muted: next })
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId);
    if (error) {
      setMuted(!next);
      toast.error('Failed to update mute');
    } else {
      toast.success(next ? 'Conversation muted' : 'Conversation unmuted');
    }
  };

  const leaveConversation = async () => {
    if (!conversationId || !currentUserId) return;
    const { error } = await supabase
      .from('conversation_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId);
    if (error) { toast.error('Failed to leave'); return; }
    toast.success('You left the conversation');
    navigate('/player/messages');
  };

  const doBlock = async () => {
    if (!participant?.id) return;
    const ok = await block(participant.id);
    if (ok) navigate('/player/messages');
  };

  const submitReport = async () => {
    if (!participant?.id || !reportReason.trim()) {
      toast.error('Please pick a reason');
      return;
    }
    const ok = await reportUser({
      reportedUserId: participant.id,
      reason: reportReason,
      conversationId: conversationId || undefined,
    });
    if (ok) { setReportOpen(false); setReportReason(''); }
  };

  const getInitials = (n: string | null) =>
    (n || 'U').split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2);

  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  const shouldShowDateSeparator = (cur: DirectMessage, prev: DirectMessage | null) =>
    !prev || !isSameDay(new Date(cur.created_at), new Date(prev.created_at));

  const shouldGroupWithPrevious = (cur: DirectMessage, prev: DirectMessage | null) => {
    return isSameSenderRun(
      { user_id: cur.sender_id, created_at: cur.created_at },
      prev ? { user_id: prev.sender_id, created_at: prev.created_at } : undefined,
    );
  };

  const name = participant?.display_name || participant?.full_name || 'Player';

  if (loading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-120px)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-gradient-to-b from-primary/[0.06] via-background to-background">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-12 w-48 ml-auto" />
          <Skeleton className="h-12 w-56" />
        </div>
      </div>
    );
  }

  // Invalid conversation id, or one this user isn't a participant of
  // (RLS returns zero rows for both). Previously this rendered an
  // empty chat headed "Player" with no indication anything was wrong.
  if (notFound) {
    return (
      <div className="px-4 py-12 text-center">
        <h2 className="text-lg font-medium">Conversation not found</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This conversation doesn't exist or you no longer have access to it.
        </p>
        <Button onClick={() => navigate('/player/messages')} variant="outline" size="sm" className="mt-4">
          Back to Messages
        </Button>
      </div>
    );
  }

  const sendDisabled = !!restricted || !!leftAt;
  const restrictedBanner = leftAt
    ? 'You are no longer in this conversation.'
    : restricted;

  return (
    <div className="flex flex-col h-[100dvh] z-40 bg-gradient-to-b from-primary/[0.04] via-background to-background" style={paneStyle}>
      <div className="shrink-0 border-b border-border/30 bg-background/80 pb-3 shadow-[0_1px_3px_-1px_hsl(220_10%_10%/0.12)] backdrop-blur-sm [padding-top:calc(0.75rem+env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-[820px] items-center gap-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8"
            aria-label="Back to messages"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <button
            type="button"
            onClick={() => participant?.id && navigate(`/profile/${participant.id}`)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`View ${name}'s profile`}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={participant?.avatar_url || undefined} />
              <AvatarFallback>{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-medium">{name}</p>
              {participant?.current_rating != null && (
                <p className="text-xs text-muted-foreground">
                  {participant.current_rating.toFixed(2)} rating
                </p>
              )}
            </div>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Conversation options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={toggleMute}>
              {muted ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
              {muted ? 'Unmute notifications' : 'Mute notifications'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setReportOpen(true)}>
              <Flag className="h-4 w-4 mr-2" /> Report user
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                  <Shield className="h-4 w-4 mr-2" /> Block user
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Block {name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They won't be able to message you or add you to groups. You will not get notifications from them. You can unblock from Settings.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={doBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Block
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <UserX className="h-4 w-4 mr-2" /> Leave conversation
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave this conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You won't be able to send messages here unless a new conversation is started.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={leaveConversation}>Leave</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label={`Conversation with ${name}`}
          className="h-full touch-pan-y overflow-y-auto overscroll-contain px-3 py-4 [overflow-anchor:none] sm:px-5"
        >
          <div className="mx-auto w-full max-w-[820px] space-y-1">
            {hasMore && (
              <div className="flex justify-center pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full text-xs text-muted-foreground"
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                >
                  {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                </Button>
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex min-h-[45vh] flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-sm font-semibold text-foreground">Start the conversation</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Send a message to {name}. Your conversation will stay here.
                </p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((message, index) => {
                const prev = index > 0 ? messages[index - 1] : null;
                const next = index < messages.length - 1 ? messages[index + 1] : null;
                const isOwn = message.sender_id === currentUserId;
                const showDate = shouldShowDateSeparator(message, prev);
                const grouped = shouldGroupWithPrevious(message, prev);
                const isLastInRun = !next || !shouldGroupWithPrevious(next, message);
                const isFailed = message._status === 'failed';
                const showTail = isLastInRun && !isFailed;
                return (
                  <div key={message.id}>
                    {showDate && (
                      <div className="my-4 flex justify-center">
                        <span className="rounded-full border border-border/50 bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
                          {formatMessageDate(new Date(message.created_at))}
                        </span>
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'flex items-end gap-2',
                        isOwn ? 'flex-row-reverse' : 'flex-row',
                        grouped ? 'mt-0.5' : 'mt-3',
                      )}
                      role="group"
                      aria-label={`${isOwn ? 'You' : name}, ${format(new Date(message.created_at), 'h:mm a')}`}
                    >
                      {!isOwn && isLastInRun ? (
                        <button
                          type="button"
                          onClick={() => participant?.id && navigate(`/profile/${participant.id}`)}
                          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`View ${name}'s profile`}
                        >
                          <Avatar className="h-7 w-7 ring-1 ring-border/60">
                            <AvatarImage src={participant?.avatar_url || undefined} />
                            <AvatarFallback className="text-[9px]">{getInitials(name)}</AvatarFallback>
                          </Avatar>
                        </button>
                      ) : !isOwn ? (
                        <div className="w-7 shrink-0" aria-hidden />
                      ) : null}

                      <div className={cn('flex max-w-[82%] flex-col', isOwn ? 'items-end' : 'items-start')}>
                        <div className={cn(
                          'rounded-2xl px-3.5 py-2.5 text-[15px] leading-[1.42] transition-opacity duration-200',
                          isOwn
                            ? (isFailed
                                ? 'bg-destructive/15 text-destructive-foreground/90 ring-1 ring-destructive/60'
                                : outgoingBubble)
                            : incomingBubble,
                          showTail && (isOwn ? 'chat-tail-right' : 'chat-tail-left'),
                          message._status === 'sending' && 'opacity-70',
                        )}>
                          <p className="whitespace-pre-wrap break-words select-text">
                            {linkifyContent(message.content)}
                          </p>
                        </div>

                        {isLastInRun && (
                          <div className={cn(
                            'mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground',
                            isOwn && 'justify-end',
                          )}>
                            <span className="tabular-nums">{format(new Date(message.created_at), 'h:mm a')}</span>
                            {isOwn && message._status === 'sending' && (
                              <span className="inline-flex items-center gap-1" aria-label="Sending">
                                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50 animate-pulse" />
                                Sending
                              </span>
                            )}
                            {isOwn && message._status === 'sent' && (
                              <Check className="h-3 w-3 opacity-80" aria-label="Sent" />
                            )}
                          </div>
                        )}

                        {isOwn && message._status === 'failed' && message._clientId && (
                          <button
                            type="button"
                            onClick={() => retryMessage(message._clientId!)}
                            className="mt-1 flex items-center gap-1 px-1 text-[10px] text-destructive underline hover:opacity-80"
                          >
                            <RefreshCw className="h-2.5 w-2.5" />
                            Failed — tap to retry
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>

          </div>
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
              aria-label={newBelowCount > 0 ? `${newBelowCount} new messages. Jump to latest` : 'Jump to latest message'}
            >
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
              {newBelowCount > 0 ? `${newBelowCount} new` : 'Latest'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {typingUsers.length > 0 && (
        <div className="shrink-0 border-t border-border/30 bg-background/90 px-4 py-1.5 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[820px] justify-start pl-9">
            <TypingIndicator typingUsers={typingUsers} />
          </div>
        </div>
      )}

      {restrictedBanner && (
        <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-muted/40 border-t border-border/30">
          <div className="mx-auto max-w-[820px]">{restrictedBanner}</div>
        </div>
      )}

      <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm">
        <MessageComposer
          ref={inputRef}
          value={newMessage}
          onChange={handleInputChange}
          onBlur={() => void stopTyping()}
          onSubmit={handleSend}
          sending={false}
          disabled={!!sendDisabled}
          placeholder={sendDisabled ? 'Messaging unavailable' : 'Type a message…'}
          sendLabel="Send message"
          className="mx-auto w-full max-w-[820px] border-t-0 bg-transparent"
        />
      </div>


      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {name}</DialogTitle>
            <DialogDescription>
              Tell us what's wrong. Our team will review this report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {['Harassment', 'Spam', 'Inappropriate', 'Other'].map(r => (
                <Button
                  key={r}
                  type="button"
                  variant={reportReason === r ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReportReason(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
            <Textarea
              placeholder="Additional details (optional)"
              onChange={(e) => setReportReason(prev => prev.includes(':') ? `${prev.split(':')[0]}: ${e.target.value}` : `${prev || 'Other'}: ${e.target.value}`)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={submitReport}>Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
