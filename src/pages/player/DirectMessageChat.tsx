import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, BellOff, Bell, Shield, Flag, UserX, Check, RefreshCw } from 'lucide-react';
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
import { useConversation, type DirectMessage } from '@/hooks/useDirectMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from '@/components/community/TypingIndicator';
import { supabase } from '@/integrations/supabase/client';
import { reportUser, useBlockedUsers } from '@/hooks/useMessagingSafety';
import { cn } from '@/lib/utils';

export default function DirectMessageChat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { messages, loading, participant, sendMessage, retryMessage } = useConversation(conversationId || null);
  const { block } = useBlockedUsers();
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // No more isSending state — sends are optimistic and the spinner UX
  // moved onto the per-bubble _status='sending' indicator. The
  // composer's `sending` prop is hardcoded false now so the send
  // button stays live for back-to-back sends.
  const [muted, setMuted] = useState(false);
  const [leftAt, setLeftAt] = useState<string | null>(null);
  const [restricted, setRestricted] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<MessageComposerHandle>(null);

  const { typingUsers, startTyping } = useTypingIndicator(conversationId ? `dm-${conversationId}` : undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // Load my participant record (mute/left state).
  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('conversation_participants')
        .select('is_muted, left_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId)
        .maybeSingle();
      if (data) {
        setMuted(!!data.is_muted);
        setLeftAt(data.left_at);
      }
    })();
  }, [conversationId, currentUserId]);

  // Check if blocked either way / target privacy.
  useEffect(() => {
    if (!participant?.id || !currentUserId) return;
    (async () => {
      const { data: blocks } = await (supabase as any)
        .from('user_blocks')
        .select('blocker_id, blocked_id')
        .or(
          `and(blocker_id.eq.${currentUserId},blocked_id.eq.${participant.id}),` +
          `and(blocker_id.eq.${participant.id},blocked_id.eq.${currentUserId})`
        );
      if (blocks && blocks.length > 0) {
        const youBlocked = blocks.some((b: any) => b.blocker_id === currentUserId);
        setRestricted(youBlocked ? "You've blocked this user. Unblock from Settings to message." : "You can't message this user.");
        return;
      }
      const { data: prefs } = await (supabase as any)
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
  }, [participant?.id, currentUserId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    inputRef.current?.focus();
    void sendMessage(text);
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    startTyping('You');
  };

  const toggleMute = async () => {
    if (!conversationId || !currentUserId) return;
    const next = !muted;
    setMuted(next);
    const { error } = await (supabase as any)
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
    const { error } = await (supabase as any)
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
    if (!prev || cur.sender_id !== prev.sender_id) return false;
    return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() < 60000;
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

  const sendDisabled = !!restricted || !!leftAt;
  const restrictedBanner = leftAt
    ? 'You are no longer in this conversation.'
    : restricted;

  return (
    <div className="flex flex-col h-[100dvh]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 shrink-0 bg-gradient-to-b from-primary/[0.06] via-background to-background">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <button
          onClick={() => participant?.id && navigate(`/player/profile?userId=${participant.id}`)}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={participant?.avatar_url || undefined} />
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="text-left min-w-0">
            <p className="font-medium text-sm truncate">{name}</p>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            const prev = index > 0 ? messages[index - 1] : null;
            const isOwn = message.sender_id === currentUserId;
            const showDate = shouldShowDateSeparator(message, prev);
            const grouped = shouldGroupWithPrevious(message, prev);
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
                  className={cn('flex', isOwn ? 'justify-end' : 'justify-start', grouped ? 'mt-0.5' : 'mt-3')}
                >
                  <div className={cn(
                    'max-w-[80%] px-3 py-2 rounded-2xl text-sm transition-opacity duration-200',
                    isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md',
                    // Faded while in-flight, bright once acked. Mirrors
                    // the iMessage "sending → sent" pulse.
                    message._status === 'sending' && 'opacity-70',
                    message._status === 'failed' && 'bg-destructive/15 text-destructive-foreground/90',
                  )}>
                    <p className="break-words">{message.content}</p>
                    {!grouped && (
                      <p className={cn(
                        'text-[10px] mt-1 flex items-center gap-1',
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}>
                        <span>{format(new Date(message.created_at), 'h:mm a')}</span>
                        {/* Status indicator for own messages only. The
                            "sent" check ack is intentionally subtle —
                            no double-tick, no read receipt yet. */}
                        {isOwn && message._status === 'sending' && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-50 animate-pulse" aria-label="Sending" />
                        )}
                        {isOwn && message._status === 'sent' && (
                          <Check className="h-3 w-3 opacity-80" aria-label="Sent" />
                        )}
                      </p>
                    )}
                    {/* Failed-send affordance — tap the bubble to retry.
                        Only renders for own optimistic rows that
                        couldn't reach the server. */}
                    {isOwn && message._status === 'failed' && message._clientId && (
                      <button
                        type="button"
                        onClick={() => retryMessage(message._clientId!)}
                        className="mt-1 text-[10px] underline text-destructive hover:opacity-80 flex items-center gap-1"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Tap to retry
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>

        {typingUsers.length > 0 && (
          <div className="flex justify-start mt-3">
            <TypingIndicator typingUsers={typingUsers} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {restrictedBanner && (
        <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-muted/40 border-t border-border/30">
          {restrictedBanner}
        </div>
      )}

      <MessageComposer
        ref={inputRef}
        value={newMessage}
        onChange={handleInputChange}
        onSubmit={handleSend}
        sending={false}
        disabled={!!sendDisabled}
        placeholder={sendDisabled ? 'Messaging unavailable' : 'Type a message…'}
        sendLabel="Send message"
      />


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
