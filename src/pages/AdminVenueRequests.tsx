import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthState } from '@/hooks/useAuthState';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { APPLICATION_STATUS, listVenueApplications, reviewVenueApplication, getVenueApplicationHistory, type VenueApplication } from '@/lib/venues/venueApplications';

function ReviewCard({ app, onReviewed }: { app: VenueApplication; onReviewed: () => Promise<unknown> }) {
  const [note, setNote] = useState(''); const [checked, setChecked] = useState(false); const [busy, setBusy] = useState(false);
  const { user } = useAuthState(); const ownRequest = app.applicant_id === user?.id;
  const [showHistory, setShowHistory] = useState(false);
  const history = useQuery({ queryKey: ['platform-admin', user?.id, 'request-history', app.id], enabled: showHistory && !!user?.id, queryFn: () => getVenueApplicationHistory(app.id) });
  const { toast } = useToast();
  async function decide(decision: string) {
    setBusy(true);
    try { await reviewVenueApplication(app.id, decision, note, checked); await onReviewed(); toast({ title: 'Review saved' }); }
    catch (e) { toast({ title: 'Review not saved', description: getErrorMessage(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  const d = app.details;
  const safeWebsite = /^https:\/\//i.test(d.website) ? d.website : undefined;
  return <article className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-sans text-xl font-semibold">{d.name}</h2><p className="mt-1 text-sm text-muted-foreground">{d.address}, {d.city}, {d.state}</p></div><span className="h-fit rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">{APPLICATION_STATUS[app.status]}</span></div>
    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-medium text-muted-foreground">Applicant</dt><dd className="mt-1 break-words">{d.contact_name}</dd></div><div><dt className="text-xs font-medium text-muted-foreground">Private business contact</dt><dd className="mt-1 break-all">{d.contact_email}<br />{d.contact_phone}</dd></div></dl>
    {safeWebsite && <a href={safeWebsite} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block break-all text-sm text-primary underline underline-offset-4">Open submitted business website / listing ↗</a>}
    <div className="mt-4 rounded-xl bg-muted/40 p-4"><h3 className="font-sans text-sm font-semibold">Ownership evidence</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{d.evidence}</p></div>
    {app.review_note && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6"><span className="font-semibold">Review note: </span>{app.review_note}</p>}
    {app.group_id && <Link className="mt-4 inline-block text-sm text-primary underline" to={`/player/community/group/${app.group_id}`}>View venue community</Link>}
    <p className="mt-3 text-xs text-muted-foreground">Submitted {new Date(app.created_at).toLocaleString()}{app.venue_id ? ' · Existing venue re-verification' : ' · New venue request'}</p>
    <Button variant="ghost" className="mt-2 min-h-11" aria-expanded={showHistory} onClick={() => setShowHistory(open => !open)}>{showHistory ? 'Hide history' : 'Review history'}</Button>
    {showHistory && <div className="mt-2 space-y-3 rounded-xl bg-muted/30 p-4">{history.isPending ? <p role="status" className="text-sm">Loading history…</p> : history.isError ? <Button variant="outline" onClick={() => void history.refetch()}>Retry history</Button> : history.data?.map(item => <div key={item.id} className="text-sm"><p className="font-medium">{item.action.replace(/_/g, ' ')}</p>{item.note && <p className="mt-1 whitespace-pre-wrap leading-6">{item.note}</p>}<p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div>)}</div>}
    {app.status === 'pending' && <fieldset disabled={busy} className="mt-5 space-y-4 border-t pt-5">
      {ownRequest && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6">This is your own request. As the sole superadmin, you can resolve it. The audit trail explicitly records a self-review; supply genuine business evidence, not an independent-review claim.</p>}
      <p className="text-sm leading-6 text-muted-foreground">Confirm the business independently—not only through contact details supplied by the applicant. Check for an existing venue or competing claim. For an existing venue, resolve ownership first; do not create a duplicate. Private evidence must not be copied into the public profile.</p>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked} onChange={e => setChecked(e.target.checked)} /><span>{ownRequest ? 'I documented my business authority, checked duplicate claims, and acknowledge this will be recorded as superadmin self-review.' : 'I independently confirmed this person’s ownership or authorization through a trusted business source and checked for duplicate claims.'}</span></label>
      <div className="space-y-2"><Label htmlFor={`review-${app.id}`}>Review note (shared with applicant)</Label><Textarea id={`review-${app.id}`} value={note} minLength={20} maxLength={2000} rows={3} onChange={e => setNote(e.target.value)} placeholder="Record how authority was verified, or explain exactly what information is missing." /></div>
      <div className="flex flex-wrap gap-2"><Button className="h-11 rounded-xl" disabled={!checked || note.trim().length < 20} onClick={() => decide('approved')}>{busy ? 'Saving…' : app.venue_id ? 'Approve re-verification' : 'Approve free venue'}</Button><Button className="h-11 rounded-xl" variant="outline" disabled={note.trim().length < 20} onClick={() => decide('needs_info')}>Request information</Button><Button className="h-11 rounded-xl text-destructive" variant="outline" disabled={note.trim().length < 20} onClick={() => decide('rejected')}>Decline</Button></div>
    </fieldset>}
  </article>;
}
export default function AdminVenueRequests() {
  const { user } = useAuthState(); const [params, setParams] = useSearchParams();
  const view = ['pending','needs_info','all'].includes(params.get('view') ?? '') ? params.get('view')! : 'pending';
  const venueId = params.get('venue'); const [page, setPage] = useState(0); const client = useQueryClient();
  const query = useQuery({ queryKey: ['venue-applications','admin',user?.id,view,page,venueId], queryFn: () => listVenueApplications(undefined,view === 'all' ? undefined : view,page,venueId), enabled: !!user?.id, refetchInterval: 30_000 });
  const pending = query.data?.filter(a => a.status === 'pending').length ?? 0;
  return <AdminLayout title="Venue ownership requests" subtitle="Verify the business. Give its community a free home.">
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 font-sans sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-sans text-xl font-semibold tracking-tight">Ownership review queue</h2><div className="flex flex-wrap gap-2">{[['pending','To review'],['needs_info','Waiting on applicant'],['all','All requests']].map(([value,label]) => <Button key={value} className="min-h-11" variant={view === value ? 'default' : 'outline'} aria-pressed={view === value} onClick={() => { setParams({ ...(venueId ? {venue: venueId} : {}), view: value }); setPage(0); }}>{label}</Button>)}</div></div>
      <p className="text-sm leading-6 text-muted-foreground">Approval creates a free community or re-verifies its current owner. It never activates paid modules or charges the applicant. Superadmin self-reviews are explicitly recorded.</p>
      {venueId && <p className="text-sm">Showing requests for one venue. <Link className="underline" to="/admin/venue-requests">Show all venues</Link></p>}
      {query.isPending ? <p role="status">Loading requests…</p> : query.isError ? <div role="alert"><p>Couldn’t load the review queue.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Retry</Button></div> : <>
        {query.data?.map(app => <ReviewCard key={app.id + app.status} app={app} onReviewed={async () => { await Promise.all([client.invalidateQueries({ queryKey: ['venue-applications'] }), client.invalidateQueries({ queryKey: ['platform-admin'] })]); }} />)}
        {!query.data?.length && <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No requests in this view.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Page {page + 1} · {pending} awaiting review on this page</p><div className="flex gap-2"><Button variant="outline" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" disabled={query.data?.length !== 50} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
      </>}
    </div>
  </AdminLayout>;
}
