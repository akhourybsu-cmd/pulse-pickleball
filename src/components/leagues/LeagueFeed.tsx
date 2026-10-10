import { useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2, Megaphone, MoreHorizontal, Pencil, Pin, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLeaguePosts, LEAGUE_POST_LIMIT, type LeaguePost } from '@/hooks/useLeaguePosts';
import { leagueErrorMessage } from '@/lib/leagues/data';
import { resolvePlayerName } from '@/lib/matchDisplay';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupEmptyState } from '@/components/community/GroupEmptyState';
import { CommunityLoadError } from '@/components/community/CommunityLoadError';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function LeagueFeed({ leagueId, canManage, currentUserId, active }: {
  leagueId: string; canManage: boolean; currentUserId: string | null; active: boolean;
}) {
  const feed = useLeaguePosts(leagueId, currentUserId, active);
  const [draft, setDraft] = useState('');
  const request = useRef<{ id: string; content: string } | null>(null);
  const [editing, setEditing] = useState<LeaguePost | null>(null);
  const [editText, setEditText] = useState('');
  const [deleting, setDeleting] = useState<LeaguePost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const run = async (work: () => Promise<unknown>, onSaved: () => void, message: string) => {
    if (busy.current) return;
    busy.current = true; setError(null);
    try { await work(); onSaved(); toast.success(message); }
    catch (cause) { setError(leagueErrorMessage(cause)); }
    finally { busy.current = false; }
  };
  const post = () => {
    const content = draft.trim();
    if (!content || content.length > LEAGUE_POST_LIMIT) return;
    if (request.current?.content !== content) request.current = { id: crypto.randomUUID(), content };
    const savedRequest = request.current!;
    void run(() => feed.mutate({ type: 'create', ...savedRequest }), () => {
      setDraft(''); request.current = null;
    }, 'Update posted');
  };
  return (
    <section className="mx-auto w-full min-w-0 max-w-3xl space-y-4" aria-labelledby="league-feed-heading">
      <header>
        <h2 id="league-feed-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Megaphone className="h-5 w-5 text-primary" aria-hidden /> League feed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Updates from your league organizers.</p>
      </header>
      {canManage && (
        <form className="rounded-2xl border border-border bg-card p-4 sm:p-5" onSubmit={event => { event.preventDefault(); post(); }}>
          <label htmlFor="league-update-draft" className="mb-2 block text-sm font-semibold">Share an update</label>
          <Textarea id="league-update-draft" value={draft} onChange={event => setDraft(event.target.value)}
            placeholder="What does your league need to know?" maxLength={LEAGUE_POST_LIMIT} rows={4}
            disabled={feed.saving} className="min-h-28 resize-y" aria-describedby="league-update-help" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p id="league-update-help" className="text-xs text-muted-foreground">Visible to league members · {draft.length.toLocaleString()}/{LEAGUE_POST_LIMIT.toLocaleString()}</p>
            <Button type="submit" disabled={feed.saving || !draft.trim()} className="min-h-11 gap-2 rounded-xl">
              {feed.saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />} Post update
            </Button>
          </div>
        </form>
      )}
      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p>{error}</p>{(draft || editing) && <p className="mt-1 text-muted-foreground">Your draft has been kept.</p>}
        <Button variant="outline" className="mt-3 min-h-11" onClick={() => void feed.refetch()}>Refresh feed</Button>
      </div>}
      {feed.isPending ? <div role="status" aria-label="Loading league updates" className="space-y-4">
        {[0, 1].map(key => <div key={key} className="space-y-3 rounded-2xl border border-border bg-card p-5"><Skeleton className="h-9 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>)}
      </div> : feed.isError && !feed.posts.length ? <CommunityLoadError subject="league updates" onRetry={feed.refetch} /> : <>
        {feed.isError && <div role="alert" className="rounded-xl border border-border p-3 text-sm">Updates could not refresh. Showing the last loaded posts. <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => void feed.refetch()}>Try again</button></div>}
        {!feed.posts.length ? <GroupEmptyState icon={Megaphone} title="Your league updates start here"
          description={canManage ? 'Post the first update for your players.' : 'Updates will appear here when your organizers post.'} size="sm" />
          : <div className="space-y-4" aria-label="League updates">
            {feed.posts.map(update => {
              const name = update.author ? resolvePlayerName(update.author) : 'League organizer';
              const isEditing = editing?.id === update.id;
              const changed = isEditing && editing.version !== update.version;
              return <article key={update.id} className={cn('min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5', update.pinned ? 'border-primary/35 border-l-4 border-l-primary' : 'border-border')}>
                {update.pinned && <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-primary"><Pin className="h-3.5 w-3.5" aria-hidden /> Pinned update</p>}
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={update.author?.avatar_url ?? undefined} alt="" /><AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold">{name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground"><time dateTime={update.created_at} title={format(new Date(update.created_at), 'PPpp')}>{formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}</time>{update.edited_at && ' · Edited'}</p>
                  </div>
                  {canManage && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={feed.saving} aria-label={`Manage update by ${name}`}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setEditing(update); setEditText(update.content); setError(null); }}><Pencil className="mr-2 h-4 w-4" />Edit update</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void run(() => feed.mutate({ type: 'update', post: update, content: update.content, pinned: !update.pinned }), () => {}, update.pinned ? 'Update unpinned' : 'Update pinned')}><Pin className="mr-2 h-4 w-4" />{update.pinned ? 'Unpin' : 'Pin update'}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onSelect={() => { setDeleting(update); setError(null); }}><Trash2 className="mr-2 h-4 w-4" />Delete update</DropdownMenuItem>
                    </DropdownMenuContent></DropdownMenu>}
                </div>
                {isEditing && canManage ? <form className="mt-4 space-y-3" onSubmit={event => {
                  event.preventDefault();
                  if (!editText.trim()) return;
                  void run(() => feed.mutate({ type: 'update', post: editing, content: editText, pinned: editing.pinned }), () => setEditing(null), 'Update saved');
                }}>
                  <label htmlFor={`edit-${update.id}`} className="block text-sm font-semibold">Edit update</label>
                  <Textarea id={`edit-${update.id}`} value={editText} onChange={event => setEditText(event.target.value)} maxLength={LEAGUE_POST_LIMIT} rows={5} disabled={feed.saving} />
                  {changed && <div role="alert" className="text-sm text-muted-foreground">Another organizer changed this update. Your draft is kept.<Button type="button" variant="outline" className="mt-2 min-h-11 whitespace-normal" onClick={() => { setEditing(update); setEditText(update.content); setError(null); }}>Replace draft with latest update</Button></div>}
                  <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" className="min-h-11" disabled={feed.saving} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" className="min-h-11" disabled={feed.saving || !editText.trim() || changed}>Save update</Button></div>
                </form> : <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{update.content}</p>}
              </article>;
            })}
          </div>}
        {feed.hasNextPage && <div className="flex justify-center"><Button variant="outline" className="min-h-11 rounded-xl" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage ? 'Loading…' : 'Load more updates'}</Button></div>}
      </>}
      <AlertDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this update?</AlertDialogTitle><AlertDialogDescription>This removes the update from the league feed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={feed.saving}>Cancel</AlertDialogCancel><AlertDialogAction disabled={feed.saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={event => {
            event.preventDefault();
            if (deleting) void run(() => feed.mutate({ type: 'delete', post: deleting }), () => { setDeleting(null); if (editing?.id === deleting.id) setEditing(null); }, 'Update deleted').then(() => setDeleting(null));
          }}>{feed.saving ? 'Deleting…' : 'Delete update'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
