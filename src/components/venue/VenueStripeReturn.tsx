import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { paymentApi } from '@/lib/payments';

export function VenueStripeReturn({ venueId, enabled, onChecked }: { venueId: string; enabled: boolean; onChecked: () => unknown }) {
  const [params, setParams] = useSearchParams();
  const [payload] = useState(() => ({ state: params.get('state'), code: params.get('code'), error: params.get('error'), connect: params.get('connect') }));
  const [status, setStatus] = useState('');
  const started = useRef(false);
  const cleaned = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const hasReturn = !!(payload.state || payload.code || payload.error || payload.connect);
  useEffect(() => { if (hasReturn && !cleaned.current) { cleaned.current = true; setParams({ venue: venueId }, { replace: true }); } }, [hasReturn, setParams, venueId]);
  useEffect(() => {
    if (!hasReturn || started.current || !enabled) return;
    started.current = true;
    // Remove transient authorization data from the URL before further navigation.
    if (payload.error) { setStatus('Stripe connection canceled. No account was changed. You can start again below.'); return; }
    if (payload.connect === 'refresh') { setStatus('Your Stripe setup link expired. Continue setup below to get a fresh link.'); return; }
    setStatus('Checking this venue’s Stripe connection. Returning from Stripe does not itself confirm setup.');
    const action = payload.state || payload.code ? 'complete_connect' : 'refresh_account';
    void paymentApi<{ connected?: boolean; refreshed?: boolean }>(action, { venue_id: venueId, state: payload.state, code: payload.code }).then(result => {
      if (!active.current) return;
      if (!(result?.connected || result?.refreshed)) throw new Error('Stripe connection was not confirmed. Check the connection below.');
      setStatus('Stripe connection checked. Review the checklist below; paid reservations stay off until you explicitly enable them.');
      void onChecked();
    }).catch(error => { if (active.current) setStatus(error instanceof Error ? error.message : 'The connection could not be checked. Start again below.'); });
  }, [enabled, hasReturn, onChecked, payload, setParams, venueId]);
  if (!hasReturn) return null;
  return <p role="status" className="rounded-xl border bg-muted/30 p-4 text-sm leading-6">{status || 'Waiting for payment setup before checking this Stripe return. No payment has been taken.'}</p>;
}
