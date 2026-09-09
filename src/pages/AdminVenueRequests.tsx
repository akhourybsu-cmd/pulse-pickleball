import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { APPLICATION_STATUS, listVenueApplications, reviewVenueApplication, type VenueApplication } from '@/lib/venues/venueApplications';

function ReviewCard({ app, onReviewed }: { app: VenueApplication; onReviewed: () => Promise<unknown> }) {
  const [note, setNote] = useState(''); const [checked, setChecked] = useState(false); const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  async function decide(decision: string) {
    setBusy(true);
    try { await reviewVenueApplication(app.id, decision, note, checked); await onReviewed(); toast({ title: 'Review saved' }); }
    catch (e) { toast({ title: 'Review not saved', description: getErrorMessage(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  const d = app.details;
  const safeWebsite = /^https:\/\//i.test(d.website) ? d.website : undefined;
  return <article className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-sans text-xl font-semibold">{d.name}</h2><p className="mt-1 text-sm text-muted-foreground">{d.address}, {d.city}, {d.state}</p></div><span className="h-fit rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">{APPLICATION_STATUS[app.status]}</span></div>
    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-medium text-muted-foreground">Applicant</dt><dd className="mt-1 break-words">{d.contact_name}</dd></div><div><dt className="text-xs font-medium text-muted-foreground">Private business contact</dt><dd className="mt-1 break-all">{d.contact_email}<br />{d.contact_phone}</dd></div></dl>
    {safeWebsite && <a href={safeWebsite} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block break-all text-sm text-primary underline underline-offset-4">Open submitted business website / listing ↗</a>}
    <div className="mt-4 rounded-xl bg-muted/40 p-4"><h3 className="font-sans text-sm font-semibold">Ownership evidence</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{d.evidence}</p></div>
    {app.review_note && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6"><span className="font-semibold">Review note: </span>{app.review_note}</p>}
    {app.group_id && <Link className="mt-4 inline-block text-sm text-primary underline" to={`/player/community/group/${app.group_id}`}>View venue community</Link>}
    {app.status === 'pending' && <fieldset disabled={busy} className="mt-5 space-y-4 border-t pt-5">
      <p className="text-sm leading-6 text-muted-foreground">Confirm the business independently—not only through contact details supplied by the applicant. Check for an existing venue or competing claim. For an existing venue, resolve ownership first; do not create a duplicate. Private evidence must not be copied into the public profile.</p>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked} onChange={e => setChecked(e.target.checked)} /><span>I independently confirmed this person’s ownership or authorization through a trusted business source and checked for duplicate claims.</span></label>
      <div className="space-y-2"><Label htmlFor={`review-${app.id}`}>Review note (shared with applicant)</Label><Textarea id={`review-${app.id}`} value={note} minLength={20} maxLength={2000} rows={3} onChange={e => setNote(e.target.value)} placeholder="Record how authority was verified, or explain exactly what information is missing." /></div>
      <div className="flex flex-wrap gap-2"><Button className="h-11 rounded-xl" disabled={!checked || note.trim().length < 20} onClick={() => decide('approved')}>{busy ? 'Saving…' : 'Approve free venue'}</Button><Button className="h-11 rounded-xl" variant="outline" disabled={note.trim().length < 20} onClick={() => decide('needs_info')}>Request information</Button><Button className="h-11 rounded-xl text-destructive" variant="outline" disabled={note.trim().length < 20} onClick={() => decide('rejected')}>Decline</Button></div>
    </fieldset>}
  </article>;
}
export default function AdminVenueRequests() {
  const [view, setView] = useState('pending'); const [page, setPage] = useState(0); const client = useQueryClient();
  const query = useQuery({ queryKey: ['venue-applications','admin',view,page], queryFn: () => listVenueApplications(undefined,view === 'pending' ? 'pending' : undefined,page), refetchInterval: 30_000 });
  const pending = query.data?.filter(a => a.status === 'pending').length ?? 0;
  return <AdminLayout title="Venue ownership requests" subtitle="Verify the business. Give its community a free home.">
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 font-sans sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-sans text-2xl font-semibold tracking-tight">{view === 'pending' ? 'Ownership review queue' : 'Venue requests'}</h1><div className="flex gap-2"><Button variant={view === 'pending' ? 'default' : 'outline'} onClick={() => { setView('pending'); setPage(0); }}>To review</Button><Button variant={view === 'all' ? 'default' : 'outline'} onClick={() => { setView('all'); setPage(0); }}>All requests</Button></div></div>
      <p className="text-sm text-muted-foreground">Approval creates the free community only. It does not activate paid modules or charge the applicant. You cannot approve your own request.</p>
      {query.isPending ? <p role="status">Loading requests…</p> : query.isError ? <div role="alert"><p>Couldn’t load the review queue.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Retry</Button></div> : <>
        {query.data?.filter(a => view === 'all' || a.status === 'pending').map(app => <ReviewCard key={app.id} app={app} onReviewed={() => client.invalidateQueries({ queryKey: ['venue-applications'] })} />)}
        {!query.data?.some(a => view === 'all' || a.status === 'pending') && <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No requests in this view.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Page {page + 1} · {pending} awaiting review on this page</p><div className="flex gap-2"><Button variant="outline" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" disabled={query.data?.length !== 50} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
      </>}
    </div>
  </AdminLayout>;
}
