import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  ArrowLeft, MessageCircle, Search, BellOff, MoreVertical,
  ArrowDownUp, Check, AlertCircle, Pencil,
} from 'lucide-react';
import { formatDistanceToNow, isToday, isThisWeek } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDirectMessages, type ConversationPreview } from '@/hooks/useDirectMessages';
import { MessageFriendPickerSheet } from '@/components/messaging/MessageFriendPickerSheet';

type Filter = 'all' | 'unread' | 'muted';
type Sort = 'recent' | 'unread' | 'name';

const initials = (n: string | null) =>
  (n || 'U').split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2);

const nameOf = (c: ConversationPreview) =>
  c.participant.display_name || c.participant.full_name || 'Player';

export default function DirectMessages() {
  const navigate = useNavigate();
  const {
    conversations, loading, error, totalUnread, currentUserId,
    markRead, setMuted, leaveConversation, refetch,
  } = useDirectMessages();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [pickerOpen, setPickerOpen] = useState(false);

  const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const mutedCount = conversations.filter(c => c.isMuted).length;

  const visible = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter(c => c.unreadCount > 0);
    if (filter === 'muted') list = list.filter(c => c.isMuted);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => nameOf(c).toLowerCase().includes(q));
    }
    const copy = [...list];
    if (sort === 'unread') {
      copy.sort((a, b) => (b.unreadCount - a.unreadCount) ||
        (new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
    } else if (sort === 'name') {
      copy.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    } else {
      copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return copy;
  }, [conversations, query, filter, sort]);

  // Grouping is only meaningful for "recent" sort
  const groups = useMemo(() => {
    if (sort !== 'recent') return [{ label: '', items: visible }];
    const today: ConversationPreview[] = [];
    const week: ConversationPreview[] = [];
    const earlier: ConversationPreview[] = [];
    for (const c of visible) {
      const d = new Date(c.updated_at);
      if (isToday(d)) today.push(c);
      else if (isThisWeek(d, { weekStartsOn: 1 })) week.push(c);
      else earlier.push(c);
    }
    return [
      { label: 'Today', items: today },
      { label: 'This week', items: week },
      { label: 'Earlier', items: earlier },
    ].filter(g => g.items.length > 0);
  }, [visible, sort]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold font-display flex-1">Messages</h1>
        <Button
          size="sm"
          onClick={() => setPickerOpen(true)}
          className="h-9 rounded-full btn-premium"
        >
          <Pencil className="h-4 w-4 mr-1.5" />
          New
        </Button>
      </div>

      {/* Search + Sort */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Sort">
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <DropdownMenuRadioItem value="recent">Most recent</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="unread">Unread first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name">Name (A–Z)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter chips */}
      <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={conversations.length} />
        <FilterChip active={filter === 'unread'} onClick={() => setFilter('unread')} label="Unread" count={unreadCount} accent />
        <FilterChip active={filter === 'muted'} onClick={() => setFilter('muted')} label="Muted" count={mutedCount} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Couldn't load messages.</span>
          <button onClick={refetch} className="font-medium underline underline-offset-2">Retry</button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-6">
        {loading ? (
          <div className="space-y-2 px-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            onStart={() => setPickerOpen(true)}
            isFiltered={conversations.length > 0}
          />
        ) : (
          <div className="px-4 space-y-5">
            {groups.map(group => (
              <section key={group.label || 'all'}>
                {group.label && (
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    {group.label}
                  </h2>
                )}
                <ul className="space-y-1.5">
                  {group.items.map(c => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      currentUserId={currentUserId}
                      onOpen={() => navigate(`/player/messages/${c.id}`)}
                      onMarkRead={() => markRead(c.id)}
                      onToggleMute={() => setMuted(c.id, !c.isMuted)}
                      onLeave={() => leaveConversation(c.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <MessageFriendPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}

function FilterChip({
  active, onClick, label, count, accent,
}: { active: boolean; onClick: () => void; label: string; count: number; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-8 px-3 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 border',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-foreground border-border/40 hover:bg-muted/40'
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn(
          'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
          active
            ? 'bg-primary-foreground/20 text-primary-foreground'
            : accent
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground'
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function ConversationRow({
  conversation, currentUserId, onOpen, onMarkRead, onToggleMute, onLeave,
}: {
  conversation: ConversationPreview;
  currentUserId: string | null;
  onOpen: () => void;
  onMarkRead: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
}) {
  const name = nameOf(conversation);
  const hasUnread = conversation.unreadCount > 0;
  const last = conversation.lastMessage;
  const lastFromMe = last?.sender_id === currentUserId;

  return (
    <motion.li
      whileTap={{ scale: 0.99 }}
      className={cn(
        'group relative flex items-center gap-3 p-3 rounded-2xl border transition-colors',
        hasUnread
          ? 'bg-card border-primary/30 shadow-sm'
          : 'bg-card border-border/30 hover:bg-muted/30'
      )}
    >
      {/* Unread accent bar */}
      {hasUnread && (
        <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-primary" aria-hidden />
      )}

      <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={conversation.participant.avatar_url || undefined} />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={cn(
                'text-sm truncate',
                hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
              )}>
                {name}
              </p>
              {conversation.isMuted && (
                <BellOff className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Muted" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: false })}
            </span>
          </div>
          {last ? (
            <p className={cn(
              'text-xs truncate mt-0.5',
              hasUnread ? 'text-foreground/90 font-medium' : 'text-muted-foreground'
            )}>
              {lastFromMe && <span className="text-muted-foreground/80">You: </span>}
              {last.content}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground mt-0.5">No messages yet</p>
          )}
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {hasUnread && (
          <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] justify-center px-1.5">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-60 hover:opacity-100"
              aria-label="Conversation actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled={!hasUnread} onClick={onMarkRead}>
              <Check className="h-4 w-4 mr-2" /> Mark as read
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleMute}>
              <BellOff className="h-4 w-4 mr-2" />
              {conversation.isMuted ? 'Unmute' : 'Mute'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLeave} className="text-destructive focus:text-destructive">
              Leave conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.li>
  );
}

function EmptyState({ onStart, isFiltered }: { onStart: () => void; isFiltered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <MessageCircle className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-base font-semibold mb-1 font-display">
        {isFiltered ? 'No conversations here' : 'No messages yet'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[260px] mb-5">
        {isFiltered
          ? 'Try a different filter or search term.'
          : 'Start a private chat with one of your friends.'}
      </p>
      {!isFiltered && (
        <Button onClick={onStart} className="rounded-full btn-premium">
          <Pencil className="h-4 w-4 mr-1.5" />
          Message a friend
        </Button>
      )}
    </div>
  );
}
