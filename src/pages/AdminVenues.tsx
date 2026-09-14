import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, ShieldCheck } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthState } from '@/hooks/useAuthState';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { accessChangeError, getPlatformVenues, saveVenueAccess, tierLabel, VENUE_FEATURES, type PlatformVenue } from '@/lib/admin/platformAdmin';
import { hasVenueModule, type VenueModuleKey } from '@/lib/venues/venueApplications';

export function VenueAccessEditor({ venue, onClose, onSaved }: { venue: PlatformVenue; onClose: () => void; onSaved: () => Promise<void> }) {
  const [modules, setModules] = useState<VenueModuleKey[]>(VENUE_FEATURES.filter(f => hasVenueModule(venue.modules, f.key)).map(f => f.key));
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const verified = !!venue.verification_approved_at && !!venue.verification_approved_by;
  const error = accessChangeError(venue, modules, note, expires);
  const nextTier = tierLabel(modules.includes('court_booking'), modules.includes('facility_tools'));
  const removing = VENUE_FEATURES.some(f => hasVenueModule(venue.modules, f.key) && !modules.includes(f.key));
  const paid = venue.modules.filter(r => r.source === 'subscription');
  async function save() {
    if (busy || !confirmed || error) return;
    setBusy(true); setFailure(null);
    try { await saveVenueAccess(venue, modules, expires, note); await onSaved(); toast.success('Venue feature access updated. No charge or subscription was created.'); onClose(); }
    catch (e) { setFailure(getErrorMessage(e)); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-2xl p-5 font-sans sm:p-6">
    <DialogHeader className="min-w-0 pr-6 text-left"><DialogTitle className="font-sans text-xl [overflow-wrap:anywhere]">Feature access · {venue.name}</DialogTitle><DialogDescription>Grant or remove included platform features. Ownership, bookings, funds and Stripe subscriptions stay unchanged.</DialogDescription></DialogHeader>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <div className="rounded-xl bg-muted/40 p-3 text-sm leading-6"><strong>{venue.owner_name}</strong><span className="block text-muted-foreground [overflow-wrap:anywhere]">{venue.owner_email ?? 'No owner email available'}</span></div>
      {!verified && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6">Ownership is not verified. You can remove included access, but granting features requires approval first.</p>}
      <div className="space-y-3">{VENUE_FEATURES.map(feature => {
        const row = venue.modules.find(r => r.module_key === feature.key); const locked = row?.source === 'subscription';
        return <label key={feature.key} className="flex min-w-0 items-start gap-3 rounded-xl border p-4">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" disabled={locked || (!verified && !modules.includes(feature.key))} checked={modules.includes(feature.key)} onChange={e => { setModules(value => e.target.checked ? [...value, feature.key] : value.filter(k => k !== feature.key)); setConfirmed(false); }} />
          <span className="min-w-0 text-sm"><span className="block font-semibold">{feature.title}</span><span className="mt-1 block leading-6 text-muted-foreground">{feature.detail}</span><span className="mt-2 block text-xs text-muted-foreground">{locked ? 'Stripe-managed · locked here' : row?.source === 'existing_venue' ? 'Existing venue grant' : 'PULSE included access'}{row?.expires_at && ' · current expiry ' + new Date(row.expires_at).toLocaleString()}</span></span>
        </label>;
      })}</div>
      {paid.length > 0 && <p className="text-sm leading-6 text-muted-foreground">Stripe-managed features are read-only here. The owner manages renewals and cancellations in Payments & purchases. This screen never stops billing.</p>}
      <div className="space-y-2"><Label htmlFor="access-expiry">Included access expiry (optional)</Label><Input id="access-expiry" type="datetime-local" value={expires} onChange={e => { setExpires(e.target.value); setConfirmed(false); }} className="min-w-0 max-w-full" /><p className="text-xs leading-5 text-muted-foreground">Your local time. Blank means no expiry for selected non-subscription features. Stripe expiry dates are never changed.</p></div>
      <div className="space-y-2"><Label htmlFor="access-reason">Reason for this decision</Label><Textarea id="access-reason" value={note} onChange={e => { setNote(e.target.value); setConfirmed(false); }} rows={3} maxLength={2000} placeholder="Explain the approved access change (at least 20 characters)." /><p className="text-xs text-muted-foreground">Stored in the private platform audit log. The owner receives a generic access-change notification.</p></div>
      <div className="rounded-xl border p-4 text-sm leading-6"><p className="font-semibold">{tierLabel(venue.booking, venue.facility)} → {nextTier}</p><p className="mt-1 text-muted-foreground">Free community posts, chat, members and community events remain available. No charge, refund or subscription change.</p>{removing && <p className="mt-2 font-medium">Removed tools stop accepting new facility actions. Existing records and reservations are retained; this does not cancel a booking.</p>}</div>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I reviewed the venue, selected features and expiry, and understand this is included access—not a billing change.</span></label>
      {error && note.length > 0 && <p className="text-sm text-muted-foreground">{error}</p>}
      {failure && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 [overflow-wrap:anywhere]">{failure}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" className="min-h-11" onClick={onClose}>Cancel</Button><Button className="h-auto min-h-11 whitespace-normal py-3" disabled={!confirmed || !!error} onClick={() => void save()}>{busy ? 'Saving…' : 'Confirm access change'}</Button></div>
    </fieldset>
  </DialogContent></Dialog>;
}

const FILTERS = [['all','All venues'],['unverified','Need verification'],['free','Free community'],['upgraded','With features'],['samples','Private samples']] as const;
export default function AdminVenues() {
  const { user } = useAuthState(); const client = useQueryClient(); const [params, setParams] = useSearchParams();
  const filter = FILTERS.some(f => f[0] === params.get('filter')) ? params.get('filter')! : 'all';
  const [search, setSearch] = useState(''); const [term, setTerm] = useState(''); const [page, setPage] = useState(0); const [selected, setSelected] = useState<PlatformVenue | null>(null);
  useEffect(() => { const timer = setTimeout(() => { setTerm(search.trim()); setPage(0); }, 250); return () => clearTimeout(timer); }, [search]);
  const query = useQuery({ queryKey: ['platform-admin', user?.id, 'venues', term, filter, page], queryFn: () => getPlatformVenues(term, filter, page), enabled: !!user?.id, refetchInterval: 30_000 });
  async function refresh() {
    await Promise.all([client.invalidateQueries({ queryKey: ['platform-admin'] }),client.invalidateQueries({ queryKey: ['venue-modules'] })]);
  }
  return <AdminLayout title="Venues & feature access" subtitle="Review ownership and platform entitlements. This directory does not give you venue staff or operating controls.">
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border bg-card p-4 sm:p-5"><div className="flex flex-wrap gap-3"><div className="relative min-w-0 flex-1 basis-64"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search venues by name, location or owner" className="h-11 pl-10" placeholder="Search venue, location or owner…" value={search} maxLength={200} onChange={e => setSearch(e.target.value)} /></div><Button variant="outline" className="min-h-11" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh</Button></div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter venues">{FILTERS.map(([value, label]) => <Button key={value} variant={filter === value ? 'default' : 'outline'} className="min-h-11 rounded-full px-4 text-xs" aria-pressed={filter === value} onClick={() => { setParams(value === 'all' ? {} : { filter: value }); setPage(0); }}>{label}</Button>)}</div>
      </section>
      <p className="text-sm leading-6 text-muted-foreground">Free community is always included. Add-ons are Court Booking and Facility Tools. PULSE grants are complimentary; owner-purchased add-ons are $10 each per month. No new bundles or automatic charges are introduced here.</p>
      {query.isPending ? <p role="status">Loading venues…</p> : query.isError ? <div role="alert" className="rounded-xl border p-5"><p>Venues couldn’t be loaded. Check your connection and database deployment.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void query.refetch()}>Retry</Button></div> : <>
        {!query.data?.rows.length && <div className="rounded-2xl border bg-card p-8 text-center"><Building2 className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm">No venues match this view.</p></div>}
        <div className="grid gap-4 xl:grid-cols-2">{query.data?.rows.map(venue => <article key={venue.id} className="flex min-w-0 flex-col rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-semibold [overflow-wrap:anywhere]">{venue.name}</h2><p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{[venue.city, venue.state].filter(Boolean).join(', ') || 'Location not provided'}</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">{venue.private_sample ? 'Private sample' : tierLabel(venue.booking, venue.facility)}</span></div>
          <div className="mt-4 rounded-xl bg-muted/30 p-3"><p className="text-xs font-medium text-muted-foreground">Venue owner</p><p className="mt-1 text-sm font-medium [overflow-wrap:anywhere]">{venue.owner_name}</p><p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{venue.owner_email ?? 'Email unavailable'}</p></div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5"><ShieldCheck className="h-3.5 w-3.5" />{venue.private_sample ? 'Sample · not business-verified' : venue.verification_approved_at && venue.verification_approved_by ? 'Ownership verified' : 'Verification needed'}</span>{!venue.is_active && <span className="rounded-full border px-2.5 py-1.5">Inactive</span>}{!venue.is_published && <span className="rounded-full border px-2.5 py-1.5">Unpublished</span>}</div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5"><Button className="min-h-11" disabled={venue.private_sample} onClick={() => setSelected(venue)}>{venue.private_sample ? 'Sample features included' : 'Review feature access'}</Button><Button asChild variant="outline" className="min-h-11"><Link to={'/admin/activity?venue=' + venue.id}>History</Link></Button>{!venue.private_sample && !venue.verification_approved_at && <Button asChild variant="ghost" className="min-h-11"><Link to={'/admin/venue-requests?venue=' + venue.id}>Review requests</Link></Button>}</div>
        </article>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{query.data?.total ?? 0} venues · page {page + 1}</p><div className="flex gap-2"><Button className="min-h-11" variant="outline" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</Button><Button className="min-h-11" variant="outline" disabled={(page + 1) * 25 >= (query.data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
      </>}
    </div>
    {selected && <VenueAccessEditor key={selected.id} venue={selected} onClose={() => setSelected(null)} onSaved={refresh} />}
  </AdminLayout>;
}
