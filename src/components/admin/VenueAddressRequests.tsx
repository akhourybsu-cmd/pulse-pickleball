import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthState } from '@/hooks/useAuthState';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { ADDRESS_STATUS, venueAddressUrl } from '@/lib/venues/address';
import { getVenueAddressSetup, listVenueAddressRequests, syncVenueAddress, type VenueAddressRequest } from '@/lib/venues/integrations';

function AddressSetupDialog({ request, onClose }: { request: VenueAddressRequest; onClose(): void }) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const query = useQuery({ queryKey: ['venue-integrations', user?.id, request.venue_id], queryFn: () => getVenueAddressSetup(request.venue_id), enabled: !!user });
  const setup = query.data;
  const connection = setup?.connection;
  const details = connection?.provider_details;
  async function sync() {
    if (busy) return;
    setBusy(true); setFailure('');
    try {
      await syncVenueAddress(request.venue_id);
      await Promise.all([query.refetch(), client.invalidateQueries({ queryKey: ['venue-address-requests'] })]);
    } catch (error) { setFailure(getErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl p-5">
    <DialogHeader><DialogTitle>Connect {request.venue_name}</DialogTitle><DialogDescription className="break-all">{venueAddressUrl(request.slug)}</DialogDescription></DialogHeader>
    {query.isPending ? <p role="status">Loading address setup…</p> : query.isError ? <div role="alert"><p>Couldn’t load this request.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div> : <div className="space-y-4">
      <p className="text-sm leading-6">PULSE manages this address for the venue. Connect hosting, apply the DNS records below at PULSE’s DNS provider, then check again. The owner sees “connected” only after hosting and HTTPS are ready.</p>
      <p role="status" className="rounded-xl bg-muted/50 p-3 text-sm font-medium">{connection ? ADDRESS_STATUS[connection.status].label : 'No address request found'}</p>
      {!setup.public_ready && <p className="text-sm leading-6">The venue page is not public yet. Hosting setup won’t publish it or change community privacy.</p>}
      {(!setup.verified || !setup.active || setup.private_sample) && <p className="text-sm leading-6">An active, verified, real venue is required before connecting hosting.</p>}
      {details && <dl className="grid gap-2 rounded-xl border p-4 text-xs sm:grid-cols-3">{[['Hosting',details.host],['Ownership',details.ownership],['HTTPS',details.certificate]].map(([label,value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-medium">{value ?? 'Not checked'}</dd></div>)}</dl>}
      {!!details?.issues?.length && <div role="alert" className="space-y-2 rounded-xl border border-amber-500/40 p-4 text-sm leading-6">{details.issues.map((issue,index) => <p key={index} className="break-words">{issue}</p>)}</div>}
      {!!details?.dns?.length && <section className="space-y-3"><h3 className="text-sm font-semibold">PULSE DNS changes</h3><p className="text-xs leading-5 text-muted-foreground">These records come from Firebase. Review shared or parent-domain records before changing them. DNS and certificate updates can take time to propagate.</p><div className="space-y-2">{details.dns.map((record,index) => <div key={index} className="space-y-1 rounded-xl border p-3 text-sm"><p className="font-semibold">{record.requiredAction === 'REMOVE' ? 'Remove' : 'Add'} {record.type}</p><p className="break-all">{record.domainName}</p><p className="break-all font-mono text-xs">{record.rdata}</p><Button size="sm" variant="outline" className="mt-2 min-h-11" onClick={async () => { try { await navigator.clipboard.writeText(record.rdata); setCopyMessage(`Copied ${record.type} value for ${record.domainName}`); } catch { setCopyMessage('Select and copy the record value above.'); } }}>Copy record value</Button></div>)}</div><p role="status" className="text-xs">{copyMessage}</p></section>}
      {connection?.checked_at && <p className="text-xs text-muted-foreground">Last hosting check: {new Date(connection.checked_at).toLocaleString()}</p>}
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !connection || !setup.active || !setup.verified || setup.private_sample} className="min-h-11" onClick={() => void sync()}>{busy ? 'Checking hosting…' : connection?.checked_at ? 'Check hosting again' : 'Connect hosting'}</Button><Button disabled={busy} variant="outline" className="min-h-11" onClick={onClose}>Done</Button></div>
    </div>}
  </DialogContent></Dialog>;
}

export function VenueAddressRequests() {
  const { user } = useAuthState();
  const [selected, setSelected] = useState<VenueAddressRequest | null>(null);
  const query = useQuery({ queryKey: ['venue-address-requests', user?.id], queryFn: listVenueAddressRequests, enabled: !!user, refetchInterval: 30_000 });
  return <section className="space-y-4 rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><Globe2 className="h-5 w-5" />Venue address requests</h2><p className="mt-1 text-sm text-muted-foreground">Connect venue integrations and follow up on setup.</p></div><Button variant="outline" className="min-h-11" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh requests</Button></div>
    {query.isPending ? <p role="status" className="text-sm">Loading requests…</p> : query.isError ? <p role="alert" className="text-sm">Address requests couldn’t be loaded. Try refreshing after the backend update.</p> : !query.data.length ? <p className="text-sm text-muted-foreground">No address requests yet. Venue managers can request one from Venue settings → Integrations.</p> : <div className="max-h-80 space-y-2 overflow-y-auto">{query.data.map(request => <div key={request.venue_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{request.venue_name}</p><p className="break-all text-xs text-muted-foreground">{request.slug}.pulsepb.com · {ADDRESS_STATUS[request.status].label}</p></div><Button variant="outline" className="min-h-11" onClick={() => setSelected(request)}>Review setup</Button></div>)}{query.data.length === 100 && <p className="text-xs text-muted-foreground">Showing the first 100 requests, with unfinished setup first.</p>}</div>}
    {selected && <AddressSetupDialog key={selected.venue_id} request={selected} onClose={() => setSelected(null)} />}
  </section>;
}
