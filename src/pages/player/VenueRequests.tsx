import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthState } from '@/hooks/useAuthState';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { VenueApplicationForm } from '@/components/venue/VenueApplicationForm';
import { APPLICATION_STATUS, listVenueApplications, submitVenueApplication, withdrawVenueApplication, type VenueApplication, type VenueApplicationDetails } from '@/lib/venues/venueApplications';

export default function VenueRequests() {
  const { user } = useAuthState(); const { toast } = useToast(); const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<VenueApplication | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['venue-applications', user?.id,page], enabled: !!user?.id,
    queryFn: () => listVenueApplications(user!.id,undefined,page), refetchInterval: 30_000 });
  const close = () => { setEditing(null); setParams({}); setError(null); };
  async function submit(details: VenueApplicationDetails) {
    setBusy(true); setError(null);
    try {
      await submitVenueApplication(details, editing?.id, editing?.venue_id ?? params.get('venue'));
      await client.invalidateQueries({ queryKey: ['venue-applications'] }); setPage(0); close();
      toast({ title: 'Request submitted', description: 'You can follow the ownership review here.' });
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 font-sans sm:px-6 sm:py-10">
    <Link to="/player/community" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Community</Link>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-widest text-primary">PULSE FOR VENUES</p><h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight">Your venue, your community.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Request a free venue, verify your authority, then build the space your players need.</p></div>
      {!params.has('new') && !editing && <Button className="h-11 rounded-xl" onClick={() => setParams({ new: '1' })}><Plus className="mr-2 h-4 w-4" />Request a venue</Button>}</header>
    {(params.has('new') || editing) ? <VenueApplicationForm key={editing?.id ?? params.get('venue') ?? 'new'} initial={editing?.details} busy={busy} error={error} onSubmit={submit} onCancel={close} /> : <>
      {query.isPending ? <p role="status">Loading your requests…</p> : query.isError ? <div role="alert" className="rounded-2xl border p-5"><p>We couldn’t load venue requests. Please try again.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div> : !query.data?.length ? <section className="rounded-3xl border bg-card p-8 text-center"><Building2 className="mx-auto h-9 w-9 text-primary" /><h2 className="mt-4 font-sans text-lg font-semibold">Start with the essentials. Stay free.</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Posts, messaging, members, invitations, files, and community events. Add facility tools only when you need them.</p></section> : <div className="space-y-4">{query.data.map(app => <article key={app.id} className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-sans text-lg font-semibold">{app.details.name}</h2><p className="mt-1 text-sm text-muted-foreground">{app.details.city} · Requested {new Date(app.created_at).toLocaleDateString()}</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">{APPLICATION_STATUS[app.status]}</span></div>
        {app.review_note && <div className="mt-4 rounded-xl bg-muted/50 p-4"><p className="text-xs font-semibold text-muted-foreground">PULSE review</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{app.review_note}</p></div>}
        {app.status === 'pending' && <p className="mt-3 text-sm text-muted-foreground">No community is created until ownership is approved. Check here for an update or a request for more information.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {app.status === 'approved' && app.group_id && <Button asChild className="h-11 rounded-xl"><Link to={`/player/community/group/${app.group_id}`}>Open venue</Link></Button>}
          {['needs_info','rejected'].includes(app.status) && <Button className="h-11 rounded-xl" onClick={() => setEditing(app)}>Update and resubmit</Button>}
          {['pending','needs_info'].includes(app.status) && <Button disabled={busy} variant="outline" className="h-11 rounded-xl" onClick={async () => {
            setBusy(true); try { await withdrawVenueApplication(app.id); await query.refetch(); } catch (e) { toast({ title: 'Could not withdraw request', description: getErrorMessage(e), variant: 'destructive' }); } finally { setBusy(false); }
          }}>Withdraw request</Button>}
        </div>
      </article>)}</div>}
      {(page > 0 || query.data?.length === 50) && <div className="flex justify-between gap-3"><Button variant="outline" disabled={!page || query.isFetching} onClick={() => setPage(p => p - 1)}>Newer requests</Button><Button variant="outline" disabled={query.data?.length !== 50 || query.isFetching} onClick={() => setPage(p => p + 1)}>Older requests</Button></div>}
    </>}
  </div>;
}
