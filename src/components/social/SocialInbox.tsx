import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isToday, isThisWeek } from 'date-fns';
import { AlertCircle, ArrowUpRight, CheckCheck, Compass, Loader2, MessageCircle, PenSquare, RefreshCw, Search, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { filterConversations, inboxCount, inboxFilter, type InboxFilter, type SocialConversation } from '@/lib/social/inbox';
import { useSocialInbox } from '@/hooks/useSocialInbox';
import { useFriends } from '@/hooks/useFriends';
import { SocialEmptyState } from './_shared';
import { ConversationRow } from './ConversationRow';
import { MessageFriendPickerSheet } from '@/components/messaging/MessageFriendPickerSheet';

const PAGE_SIZE = 30;
export function SocialInbox() {
  const { conversations, loading, refreshing, error, markRead, setMuted, leaveConversation, refetch } = useSocialInbox();
  const { friends, pendingRequests } = useFriends();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const filter = inboxFilter(params.get('filter'));
  const [shown, setShown] = useState(PAGE_SIZE);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leaving, setLeaving] = useState<SocialConversation | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaveError, setLeaveError] = useState(false);
  const leaveLock = useRef(false);
  const change = (next: { query?: string; filter?: InboxFilter }) => {
    const copy = new URLSearchParams(params);
    if (next.query !== undefined) { if (next.query) copy.set('q', next.query); else copy.delete('q'); }
    if (next.filter !== undefined) { if (next.filter === 'all') copy.delete('filter'); else copy.set('filter', next.filter); }
    setParams(copy, { replace: true });
  };
  useEffect(() => { setShown(PAGE_SIZE); }, [query, filter]);
  const visible = useMemo(() => filterConversations(conversations, filter, query), [conversations, filter, query]);
  const unreadChats = conversations.filter(c => c.unreadCount > 0).length;
  const sections = useMemo(() => {
    const buckets: Record<string, SocialConversation[]> = { Today: [], 'This week': [], Earlier: [] };
    for (const conversation of visible.slice(0, shown)) {
      const date = new Date(conversation.lastActivityAt);
      buckets[isToday(date) ? 'Today' : isThisWeek(date, { weekStartsOn: 1 }) ? 'This week' : 'Earlier'].push(conversation);
    }
    return Object.entries(buckets).filter(([, items]) => items.length);
  }, [visible, shown]);
  const clearFilters = () => change({ query: '', filter: 'all' });
  const requestLeave = (id: string) => { setLeaving(conversations.find(c => c.id === id && c.type === 'dm') ?? null); setLeaveError(false); };
  const confirmLeave = async () => {
    if (!leaving || leaveLock.current) return;
    leaveLock.current = true; setSaving(true); setLeaveError(false);
    try {
      if (await leaveConversation(leaving.id)) setLeaving(null);
      else setLeaveError(true);
    } catch { setLeaveError(true); }
    finally { leaveLock.current = false; setSaving(false); }
  };
  const filtered = !!query.trim() || filter !== 'all';
  return (
    <div className="grid min-w-0 gap-8 pb-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_248px] lg:gap-10 lg:px-8">
      <section aria-label="Conversations" className="min-w-0 overflow-hidden border-y border-border/40 bg-card sm:rounded-2xl sm:border">
        <div className="space-y-3 border-b border-border/40 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <h2 className="sr-only">Conversations</h2>
          <div className="flex items-center justify-between gap-3">
            <SearchField value={query} onValueChange={value => change({ query: value })} placeholder="Search chats" aria-label="Search chats" containerClassName="min-w-0 flex-1" className="h-11 rounded-xl border-transparent bg-muted/50 shadow-none" />
            <Button onClick={() => setPickerOpen(true)} className="h-11 w-11 shrink-0 gap-2 rounded-full p-0 shadow-none transition-[background-color,transform] active:scale-95 motion-reduce:transform-none sm:w-auto sm:px-4">
              <PenSquare className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">New message</span><span className="sr-only sm:hidden">New message</span>
            </Button>
          </div>
          <div role="group" aria-label="Filter conversations" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {([['all', 'All'], ['unread', 'Unread'], ['direct', 'Direct'], ['groups', 'Groups'], ['muted', 'Muted']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => change({ filter: value })}
                className={cn('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  filter === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
                {label}{value === 'unread' && unreadChats > 0 && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums', filter === value ? 'bg-background/15 text-background' : 'bg-primary/10 text-foreground')}>{inboxCount(unreadChats)}</span>}
              </button>
            ))}
          </div>
        </div>
        {error && <div role="alert" className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 text-sm sm:mx-5">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <p className="flex-1 py-3">{conversations.length ? "Some chats couldn't refresh. Your loaded conversations are still here." : "Couldn't load your chats. Please try again."}</p>
          <Button variant="ghost" className="min-h-11 shrink-0 px-2" disabled={refreshing || loading} onClick={refetch}>Retry</Button>
        </div>}
        <div className="min-h-64 py-3">
          {loading && !conversations.length ? <div role="status" aria-label="Loading conversations" className="divide-y divide-border/30">
            {[0, 1, 2, 3].map(id => <div key={id} className="flex h-[88px] items-center gap-3 px-4 sm:px-6"><Skeleton className="h-12 w-12 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-4/5" /></div></div>)}
          </div> : error && !conversations.length ? null : !visible.length ? (
            <SocialEmptyState icon={filter === 'unread' && !query ? CheckCheck : filtered ? Search : MessageCircle}
              title={query.trim() ? 'No matching conversations' : filter === 'unread' ? "You're all caught up" : filtered ? 'No chats in this view' : 'Your next game starts here'}
              description={query.trim() ? 'Try a name or words from the latest message.' : filter === 'unread' ? 'New messages will appear here.' : filtered ? 'Switch to All to see your conversations.' : 'Message a friend or meet your people in a community.'}
              action={filtered ? <Button variant="outline" className="min-h-11 rounded-xl" onClick={clearFilters}>Show all chats</Button> : <div className="flex flex-wrap justify-center gap-2"><Button className="min-h-11 rounded-xl" onClick={() => setPickerOpen(true)}>New message</Button><Button variant="outline" className="min-h-11 rounded-xl" onClick={() => navigate('/player/community?view=explore')}>Explore communities</Button></div>} />
          ) : <div className="space-y-3">
            {sections.map(([label, items]) => <section key={label} aria-label={label}>
              <h3 className="px-4 pb-1 pt-2 text-[11px] font-medium text-muted-foreground sm:px-6">{label}</h3>
              <ul className="divide-y divide-border/30">{items.map(conversation => <ConversationRow key={conversation.type + ':' + conversation.id} conversation={conversation} onMarkRead={markRead} onToggleMute={setMuted} onLeave={requestLeave} />)}</ul>
            </section>)}
            {visible.length > shown && <div className="px-4 sm:px-6"><Button variant="ghost" className="min-h-11 w-full rounded-xl" onClick={() => setShown(value => value + PAGE_SIZE)}>Load more conversations</Button></div>}
          </div>}
        </div>
        {conversations.length > 0 && <div className="flex min-h-12 items-center justify-between gap-2 border-t border-border/40 px-4 text-[11px] text-muted-foreground sm:px-6">
          <span role="status">{refreshing ? 'Updating chats…' : loading ? 'Loading more chats…' : filtered ? visible.length + (visible.length === 1 ? ' conversation' : ' conversations') : 'Chats update automatically'}</span>
          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" aria-label="Refresh conversations" disabled={refreshing || loading} onClick={refetch}><RefreshCw aria-hidden className={cn('h-4 w-4', refreshing && 'animate-spin motion-reduce:animate-none')} /></Button>
        </div>}
      </section>
      <aside aria-label="Your social circle" className="px-4 sm:px-0 lg:sticky lg:top-24 lg:self-start">
        <div className="border-t border-border/40 pt-5 lg:border-0 lg:pt-2">
          <h2 className="mb-4 px-2 text-sm font-semibold tracking-tight">Your circle</h2>
          {pendingRequests.length > 0 && <button type="button" onClick={() => navigate('/player/friends?tab=requests')} className="mb-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary"><span>{pendingRequests.length} friend {pendingRequests.length === 1 ? 'request' : 'requests'}</span><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden /></button>}
          <QuickLink icon={Users} label="Friends" detail={friends.length ? friends.length + ' in your circle' : 'Familiar faces'} onClick={() => navigate('/player/friends')} />
          <QuickLink icon={UserPlus} label="Find players" detail="New connections" onClick={() => navigate('/player/friends?connect=1')} />
          <QuickLink icon={Compass} label="Communities" detail="Find your crew" onClick={() => navigate('/player/community?view=explore')} />
        </div>
      </aside>
      <MessageFriendPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
      <AlertDialog open={!!leaving} onOpenChange={open => { if (!open && !leaveLock.current) setLeaving(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Leave this conversation?</AlertDialogTitle><AlertDialogDescription>The chat with {leaving?.title} will leave your inbox and you'll stop receiving its message notifications.</AlertDialogDescription></AlertDialogHeader>
          {leaveError && <p role="alert" className="text-sm text-destructive">Couldn't leave this conversation. Please try again.</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={saving}>Keep conversation</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={event => { event.preventDefault(); void confirmLeave(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}Leave conversation</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function QuickLink({ icon: Icon, label, detail, onClick }: { icon: typeof Users; label: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span></span><ArrowUpRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" /></button>;
}
