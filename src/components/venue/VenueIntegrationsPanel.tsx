import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Globe2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthState } from '@/hooks/useAuthState';
import { VenueEmailIntegration } from './VenueEmailIntegration';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { venuePublicUrl } from '@/lib/communityAccess';
import { ADDRESS_STATUS, suggestedVenueAddress, venueAddressError, venueAddressUrl } from '@/lib/venues/address';
import { checkVenueAddress, getVenueAddressSetup, requestVenueAddress, VENUE_INTEGRATIONS, type AddressAvailability, type VenueAddressSetup } from '@/lib/venues/integrations';

export function ShareVenueAddress({ url, label }: { url: string; label: string }) {
  const [message, setMessage] = useState('');
  return <div className="space-y-3">
    <p className="break-all rounded-xl bg-muted/60 p-3 text-sm font-medium">{url}</p>
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setMessage('Copied! Your venue link is ready to share.'); }
        catch { setMessage('Select and copy the address above to share it.'); }
      }}>Copy {label}</Button>
      <Button asChild variant="outline" className="min-h-11"><a href={url} target="_blank" rel="noopener noreferrer">Open venue page</a></Button>
    </div>
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </div>;
}

interface AddressCardProps {
  setup: VenueAddressSetup;
  onCheck(slug: string): Promise<AddressAvailability>;
  onRequest(slug: string): Promise<unknown>;
  onRefresh(): void;
  refreshing?: boolean;
  onOpenTab(tab: string): void;
  canManageCommunity: boolean;
}

export function VenueAddressCard({ setup, onCheck, onRequest, onRefresh, refreshing, onOpenTab, canManageCommunity }: AddressCardProps) {
  const [slug, setSlug] = useState(suggestedVenueAddress(setup.venue_slug));
  const [availability, setAvailability] = useState<AddressAvailability | null>(null);
  const [busy, setBusy] = useState<'check' | 'request' | null>(null);
  const [failure, setFailure] = useState('');
  const connection = setup.connection;
  const status = connection && ADDRESS_STATUS[connection.status];
  const validation = venueAddressError(slug);
  const eligible = setup.verified && setup.active && !setup.private_sample;
  const connected = connection?.status === 'connected';

  async function act(action: 'check' | 'request') {
    if (busy || validation || !eligible) return;
    setBusy(action); setFailure('');
    try {
      if (action === 'check') setAvailability(await onCheck(slug));
      else await onRequest(slug);
    } catch (error) { setFailure(getErrorMessage(error, 'We couldn’t save this address. Please try again.')); }
    finally { setBusy(null); }
  }

  return <section aria-labelledby="pulse-address-title" className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-primary/10 p-3"><Globe2 className="h-5 w-5 text-primary" /></span><div>
        <h2 id="pulse-address-title" className="font-semibold">{VENUE_INTEGRATIONS[0].name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{VENUE_INTEGRATIONS[0].description}</p>
      </div></div>
      <span className="rounded-full border px-3 py-1.5 text-xs font-medium">{setup.private_sample ? 'Unavailable in samples' : status?.label ?? 'Ready to set up'}</span>
    </div>
    {setup.private_sample ? <p className="text-sm leading-6 text-muted-foreground">This sample stays private. Open your real venue’s Integrations tab when you’re ready to create a public address.</p> : <>
      <p className="text-sm leading-6 text-muted-foreground">Give players an easy way to find you, like <span className="font-medium text-foreground">your-venue.pulsepb.com</span>. They can explore your public page, then make a free PULSE account to join in. PULSE handles the connection for you.</p>
      {!setup.public_ready && <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm leading-6">
        <p className="font-medium">Your page isn’t open to guests yet</p>
        <p className="text-muted-foreground">Your venue must be active and published, with its community set to Public. Setting up an address won’t change your privacy settings.</p>
        {canManageCommunity ? <Button variant="outline" className="min-h-11" onClick={() => onOpenTab('privacy')}>Review access & privacy</Button> : <p className="text-muted-foreground">Ask your community owner to review visibility before sharing.</p>}
      </div>}
      {connection ? <div className="space-y-4">
        <div role="status" className="flex items-start gap-2 text-sm leading-6">{connected && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}<p>{status.message}</p></div>
        {connected && setup.public_ready ? <ShareVenueAddress url={venueAddressUrl(connection.slug)} label="PULSE address" /> : <div className="rounded-xl bg-muted/60 p-3"><p className="break-all text-sm font-medium">{venueAddressUrl(connection.slug)}</p><p className="mt-1 text-xs text-muted-foreground">{connected ? 'Connected · make your page public before sharing' : 'Reserved · not ready to share yet'}</p></div>}
        <p className="text-xs leading-5 text-muted-foreground">This is a shortcut to your venue on pulsepb.com, where players stay signed in. Your reserved name stays with your venue so shared links keep working.</p>
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="min-h-11" disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Refreshing…' : 'Refresh status'}</Button>{connection.checked_at && <p className="text-xs text-muted-foreground">Last checked {new Date(connection.checked_at).toLocaleString()}</p>}</div>
      </div> : !setup.verified ? <div className="space-y-3 rounded-xl border p-4"><p className="text-sm leading-6">First, verify that you manage this venue. Once PULSE approves ownership, you can reserve your address here.</p><Button variant="outline" className="min-h-11" onClick={() => onOpenTab('modules')}>Review ownership verification</Button></div> : !setup.active ? <p className="text-sm leading-6">This venue is inactive. PULSE needs to reactivate it before you can request an address.</p> : <form onSubmit={event => { event.preventDefault(); void act(availability?.available && availability.slug === slug ? 'request' : 'check'); }}>
        <fieldset disabled={!!busy} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="venue-address-name">Choose your address</Label><div className="flex min-w-0 items-center rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring"><Input id="venue-address-name" value={slug} onChange={event => { setSlug(event.target.value.toLowerCase()); setAvailability(null); setFailure(''); }} maxLength={63} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" aria-describedby="venue-address-help venue-address-feedback" className="h-12 min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0" /><span className="shrink-0 pr-3 text-sm text-muted-foreground">.pulsepb.com</span></div><p id="venue-address-help" className="text-xs leading-5 text-muted-foreground">Use your venue name, adding your city if needed. Choose carefully: this address stays with your venue.</p></div>
          <p id="venue-address-feedback" aria-live="polite" className="text-sm leading-6">{validation ?? (availability?.available ? 'That address is available. Ready to make it yours?' : availability?.reason) ?? 'Check availability to see if this name is yours to use.'}</p>
          <Button type="submit" disabled={!!validation || !!busy} className="min-h-11">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy === 'check' ? 'Checking…' : busy === 'request' ? 'Requesting…' : availability?.available && availability.slug === slug ? 'Request this address' : 'Check availability'}</Button>
          {availability?.available && <p className="text-xs leading-5 text-muted-foreground">We’ll reserve the name and start setup automatically. You can follow progress right here.</p>}
        </fieldset>
      </form>}
      {failure && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm">{failure}</p>}
      {setup.public_ready && <div className="space-y-3 border-t pt-5"><h3 className="text-sm font-semibold">Your current venue link</h3><p className="text-sm leading-6 text-muted-foreground">This link is ready to share and keeps working when your new address is connected.</p><ShareVenueAddress url={venuePublicUrl(setup.venue_slug)} label="venue link" /></div>}
    </>}
  </section>;
}

export function VenueIntegrationsPanel({ venueId, groupId, canManageCommunity }: { venueId: string; groupId: string; canManageCommunity: boolean }) {
  const { user } = useAuthState();
  const navigate = useNavigate();
  const client = useQueryClient();
  const key = ['venue-integrations', user?.id, venueId];
  const query = useQuery({ queryKey: key, queryFn: () => getVenueAddressSetup(venueId), enabled: !!user, refetchInterval: 30_000 });
  return <div className="space-y-5">
    <p className="text-sm leading-6 text-muted-foreground">Connect your venue address and branded email in one place.</p>
    <VenueEmailIntegration venueId={venueId} groupId={groupId} />
    {query.isPending ? <p role="status">Loading integrations…</p> : query.isError ? <div role="alert" className="space-y-3 rounded-2xl border p-5"><p>We couldn’t load your integrations. Please try again.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div> : <VenueAddressCard key={venueId} setup={query.data} onCheck={slug => checkVenueAddress(venueId, slug)} onRequest={async slug => { const setup = await requestVenueAddress(venueId, slug); client.setQueryData(key, setup); }} onRefresh={() => void query.refetch()} refreshing={query.isFetching} onOpenTab={tab => navigate(`/player/community/group/${groupId}/manage?tab=${tab}`)} canManageCommunity={canManageCommunity} />}
  </div>;
}
