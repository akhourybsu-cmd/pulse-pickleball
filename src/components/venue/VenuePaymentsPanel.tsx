import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink, Loader2, ShieldCheck, CheckCircle2, Circle } from "lucide-react";
import { Link } from 'react-router-dom';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatMoney, openStripe, paymentApi } from "@/lib/payments";
import { useAuthState } from "@/hooks/useAuthState";
import { emptyPaymentDraft, paymentDraftConflict, paymentDraftDirty, paymentDraftFrom, paymentDraftReducer, validatePaymentDraft, type VenuePaymentDraft } from "@/lib/venues/paymentDraft";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { venuePaymentReadiness, type VenuePaymentSetup } from '@/lib/venues/paymentReadiness';
import { VenueStripeReturn } from './VenueStripeReturn';

const decisions = [
  ["refund_pending", "Cancel & refund", "The remaining payment will be returned to the original payment method. The court stays reserved until the refund succeeds. Stripe fees may not be returned."],
  ["cancel_without_refund", "Cancel without refund", "The court will be released. No money will be refunded."],
  ["declined", "Decline request", "The reservation and payment will remain unchanged."],
] as const;
type ResolutionConfirmation = { orderId: string; decision: string; label: string; impact: string; note: string; description: string; remaining: number };

export function VenuePaymentsPanel({ venueId }: { venueId: string }) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const scope = `${venueId}:${user?.id ?? ''}`;
  const query = useQuery({
    queryKey: ["venue-payments", venueId, user?.id],
    queryFn: () => paymentApi<VenuePaymentSetup>("venue", { venue_id: venueId }),
    enabled: !!user,
    staleTime: 30_000,
  });
  const requests = useQuery({
    queryKey: ["venue-payment-requests", venueId, user?.id],
    queryFn: () => paymentApi<any>("cancellations", { venue_id: venueId }),
    enabled: !!user && !!query.data && query.data.mode !== "off",
  });
  const [draftState, dispatch] = useReducer(paymentDraftReducer, emptyPaymentDraft);
  const dirty = paymentDraftDirty(draftState);
  const conflict = paymentDraftConflict(draftState);
  const [showErrors, setShowErrors] = useState(false);
  const errors = showErrors && draftState.draft ? validatePaymentDraft(draftState.draft) : {};
  const edit = (patch: Partial<VenuePaymentDraft>) => dispatch({ type: 'edit', patch });
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<ResolutionConfirmation | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  useEffect(() => {
    if (!query.data) return;
    dispatch({ type: 'receive', scope, value: paymentDraftFrom(query.data) });
  }, [query.data, scope]);
  useEffect(() => {
    setResolution({}); setConfirmation(null); setShowErrors(false); setResetOpen(false);
  }, [scope]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const action = async (name: string, values: Record<string, unknown> = {}) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(name);
    try {
      const result = await paymentApi<any>(name, {
        venue_id: venueId,
        ...values,
      });
      if (!result || (['onboard', 'connect_existing'].includes(name) && !result.url) || (name === 'refresh_account' && result.refreshed !== true) || (name === 'save_venue' && result.saved !== true) || (name === 'resolve_cancellation' && result.resolved !== true)) throw new Error('The change was not confirmed. Refresh and check before trying again.');
      if (result.url) openStripe(result.url);
      else {
        if (name === 'save_venue') dispatch({ type: 'saved', scope });
        if (name === 'resolve_cancellation') setConfirmation(null);
        toast.success(name === 'save_venue' ? 'Prices and policy saved' : name === 'resolve_cancellation' ? 'Decision recorded — refreshing payment status' : 'Stripe connection checked');
        const refreshed = await query.refetch();
        const refreshedRequests = query.data?.mode !== 'off' ? await requests.refetch() : null;
        if (refreshed.isError || refreshedRequests?.isError) toast.warning('Your action succeeded, but the latest status could not load. Please refresh.');
        void client.invalidateQueries({ queryKey: ['venue-day', venueId] });
        void client.invalidateQueries({ queryKey: ['group-detail'] });
        void client.invalidateQueries({ queryKey: ['venue-courts-settings', venueId] });
        void client.invalidateQueries({ queryKey: ['court-payment-details'] });
        void client.invalidateQueries({ queryKey: ['court-quote'] });
        void client.invalidateQueries({ queryKey: ['payment-history', venueId] });
      }
    } catch (error) {
      toast.error((error as Error).message);
      // A refund request can be recorded before Stripe reports a failure.
      // Re-read its status so the owner cannot mistake it for an untouched request.
      if (name === 'resolve_cancellation') await requests.refetch();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  if (query.isPending)
    return (
      <div className="p-5" role="status">
        Loading venue payment settings…
      </div>
    );
  if (query.isError)
    return (
      <div className="rounded-2xl border p-5" role="alert">
        <p>{query.error.message}</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => query.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  if (!query.data || !draftState.draft || draftState.scope !== scope) return <p role="status" className="p-5">Preparing your payment settings…</p>;
  const data = query.data;
  const { prices, policy, email, timezone, taxes, accepting } = draftState.draft;
  const currentRequest = requests.data?.requests?.find((request: any) => request.order_id === confirmation?.orderId);
  const confirmationCurrent = !!currentRequest && (currentRequest.status === 'requested' || (currentRequest.status === 'refund_pending' && confirmation?.decision === 'refund_pending'));
  const readiness = venuePaymentReadiness(data);
  const connected = readiness.connected;
  const setupBlocked = !!busy || dirty || data.mode === 'off' || data.ready === false || data.transferred || !data.venue.verification_approved_at;
  return (
    <div className="space-y-6 font-sans">
      <VenueStripeReturn venueId={venueId} enabled={data.mode !== 'off' && data.ready !== false} onChecked={() => query.refetch()} />
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="mt-3 break-words font-sans text-xl font-semibold">
          {data.venue.name} · Payments
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Rental payments go directly to your venue’s Stripe account. Your venue
          controls its bank account, payouts, refunds and disputes. Stripe
          processing fees apply; PULSE adds no rental commission.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-4">
          <div>
            <p className="text-sm font-semibold">
              {data.mode === "off"
                ? "Payment setup pending"
                : data.transferred
                ? "Financial ownership review required"
                : connected
                ? "Stripe connected"
                : "Finish Stripe onboarding"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {data.mode === "test"
                ? "Test environment — no real collections or payouts."
                : "Only the current venue owner can change financial settings."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11 whitespace-normal"
              disabled={setupBlocked || !!data.account?.disconnected_at}
              onClick={() => data.account ? void action('onboard') : setNewAccountOpen(true)}
            >
              {busy === "onboard" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {connected ? "Review Stripe setup" : data.account ? 'Continue Stripe setup' : 'Create a venue Stripe account'}
            </Button>
            {(!data.account || data.account.disconnected_at) && <Button variant="outline" className="min-h-11 whitespace-normal" disabled={setupBlocked || !data.connect_existing_available} onClick={() => void action('connect_existing')}>{data.account ? 'Reconnect existing Stripe account' : 'Connect existing Stripe account'}</Button>}
            {data.account && (
              <Button
                variant="ghost"
                disabled={!!busy || data.mode === 'off' || data.transferred || !!data.account.disconnected_at}
                onClick={() => action("refresh_account")}
              >
                {busy === 'refresh_account' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check connection
              </Button>
            )}
          </div>
        </div>
        {dirty && <p className="mt-3 text-sm text-muted-foreground">Save or discard your changes before leaving for Stripe setup. Checking the connection will keep your draft.</p>}
        {!data.account && !data.connect_existing_available && <p className="mt-3 text-sm leading-6 text-muted-foreground">Already use Stripe for this venue? PULSE must enable existing-account linking first. Do not create a second account just to work around that step.</p>}
        {data.account && <div className="mt-4 space-y-1 text-xs leading-5 text-muted-foreground"><p className="break-all">Connected account: {data.account.account_id} · {data.mode === 'test' ? 'Sandbox' : 'Live'}</p><p>{data.account.updated_at ? `Last checked ${new Date(data.account.updated_at).toLocaleString()}. Use Check connection for the latest Stripe status.` : 'Check connection to confirm the latest Stripe status.'}</p>{!!data.account.requirements_due?.length && <p>Stripe needs {data.account.requirements_due.length} more setup item(s). Complete them in Stripe, not in PULSE.</p>}{data.account.requirements_deadline && <p>Stripe requirements deadline: {new Date(data.account.requirements_deadline).toLocaleDateString()}.</p>}</div>}
        {!data.venue.verification_approved_at && <p className="mt-3 text-sm text-muted-foreground">Complete venue ownership verification before connecting Stripe or accepting payments.</p>}
        {connected && (
          <a
            href={`https://dashboard.stripe.com/${encodeURIComponent(data.account!.account_id)}/${data.mode === 'test' ? 'test/' : ''}dashboard`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            Open this venue’s Stripe dashboard <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </section>
      <section aria-labelledby="venue-payment-checklist" className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="venue-payment-checklist" className="text-lg font-semibold">{data.mode === 'test' ? 'Sandbox setup checklist' : 'Ready to accept payments?'}</h2><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{readiness.complete} of {readiness.steps.length} setup checks</span></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">This checklist uses saved settings for {data.venue.name} only. Connecting Stripe or buying a PULSE feature does not automatically enable rental charges.</p>
        <ol className="mt-4 divide-y">{readiness.steps.map(step => <li key={step.id} className="flex gap-3 py-4"><span className="mt-0.5 shrink-0">{step.complete ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}</span><div className="min-w-0"><p className="text-sm font-semibold">{step.title} <span className="font-normal text-muted-foreground">· {step.complete ? 'Complete' : 'Needs setup'}</span></p><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.complete && step.id === 'platform' && data.mode === 'live' ? 'Live checkout configuration is present. Each venue must still finish its own setup.' : step.detail}</p>{step.id === 'owner' && !step.complete && <Link className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" to={`/player/venue-requests?venue=${venueId}`}>Review ownership verification</Link>}</div></li>)}</ol>
        <p className="rounded-xl bg-muted/40 p-3 text-sm leading-6">Venue rental income belongs to this venue. Your $10/month PULSE feature subscriptions are separate purchases, managed in <Link to="/player/payments" className="font-semibold underline underline-offset-4">Payments & purchases</Link>.</p>
      </section>
      <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-busy={busy === 'save_venue'}>
        <h2 className="font-sans text-lg font-semibold">
          Court rates & checkout policy
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Set an all-inclusive hourly rate in USD. Bookings are prorated by
          duration. $0 means a free court; the “premium” badge does not add a
          hidden surcharge.
        </p>
        {dirty && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3" role="status">
          <p className="text-sm">{conflict ? 'Saved settings changed elsewhere. Your draft is preserved; reload saved settings before editing again.' : 'Unsaved changes — save before leaving this page.'}</p>
          <Button variant="outline" disabled={!!busy} onClick={() => setResetOpen(true)}>Discard draft</Button>
        </div>}
        <fieldset disabled={!!busy} className="min-w-0">
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.courts.map((court: any) => (
            <div key={court.id} className="min-w-0 rounded-xl border p-4">
              <Label htmlFor={`rate-${court.id}`} className="block break-words leading-5">
                {court.name}
              </Label>
              {court.is_active === false && <p className="mt-1 text-xs text-muted-foreground">Inactive · not bookable</p>}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id={`rate-${court.id}`}
                  inputMode="decimal"
                  value={prices[court.id] || ""}
                  onChange={(e) =>
                    edit({ prices: { ...prices, [court.id]: e.target.value } })
                  }
                  className="h-11 min-w-0"
                  aria-invalid={!!errors[`rate-${court.id}`]}
                  aria-describedby={errors[`rate-${court.id}`] ? `rate-error-${court.id}` : undefined}
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  USD / hour
                </span>
              </div>
              {errors[`rate-${court.id}`] && <p id={`rate-error-${court.id}`} className="mt-2 text-sm text-destructive">{errors[`rate-${court.id}`]}</p>}
            </div>
          ))}
        </div>
        {!data.courts.length && (
          <p className="mt-4 text-sm text-muted-foreground">
            Add courts in facility settings before setting rental prices.
          </p>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-support">Venue support email</Label>
            <Input
              id="payment-support"
              type="email"
              value={email}
              onChange={(e) => edit({ email: e.target.value })}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'payment-email-error' : undefined}
              maxLength={254}
            />
            {errors.email && <p id="payment-email-error" className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-timezone">Venue time zone</Label>
            <Input
              id="payment-timezone"
              placeholder="America/New_York"
              value={timezone}
              onChange={(e) => edit({ timezone: e.target.value })}
              aria-invalid={!!errors.timezone}
              aria-describedby={errors.timezone ? 'payment-timezone-error' : undefined}
            />
            {errors.timezone && <p id="payment-timezone-error" className="text-sm text-destructive">{errors.timezone}</p>}
            <p className="text-xs text-muted-foreground">
              Use the venue’s location, not the player’s device time zone.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <Label htmlFor="payment-policy">Cancellation & refund policy</Label>
          <Textarea
            id="payment-policy"
            value={policy}
            onChange={(e) => edit({ policy: e.target.value })}
            aria-invalid={!!errors.policy}
            aria-describedby={errors.policy ? 'payment-policy-error' : 'payment-policy-hint'}
            maxLength={2000}
            rows={5}
            placeholder="Explain deadlines, refund eligibility, weather closures and how players contact you."
          />
          {errors.policy && <p id="payment-policy-error" className="text-sm text-destructive">{errors.policy}</p>}
          <p id="payment-policy-hint" className="text-xs leading-5 text-muted-foreground">
            Players must agree before paying. Each purchase retains the policy
            they accepted, even if you change it later. Minimum 20 characters · {policy.trim().length}/2,000.
          </p>
        </div>
        <label className="mt-5 flex items-start gap-3 text-sm leading-6">
          <Checkbox
            checked={taxes}
            onCheckedChange={(v) => edit({ taxes: v === true })}
            aria-invalid={!!errors.taxes}
            aria-describedby={errors.taxes ? 'payment-taxes-error' : undefined}
            className="mt-1"
          />
          <span>
            I confirm my rates include any applicable taxes. My venue is
            responsible for determining and remitting its taxes.
          </span>
        </label>
        {errors.taxes && <p id="payment-taxes-error" className="mt-2 text-sm text-destructive">{errors.taxes}</p>}
        <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border p-4">
          <div>
            <Label htmlFor="accept-payments">
              Accept paid court reservations
            </Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Requires a verified venue and a live Stripe connection. Saving a
              draft does not start charging players. A court with a saved price stays unavailable for free reservations while payments are off. Set its price to $0 if it should be free.
            </p>
          </div>
          <Switch
            id="accept-payments"
            checked={accepting}
            onCheckedChange={value => edit({ accepting: value })}
            disabled={!!busy || (!accepting && !readiness.canEnable)}
            className="shrink-0"
          />
        </div>
        <Button
          className="mt-5 h-11 rounded-xl"
          disabled={!!busy || !dirty || conflict}
          onClick={() => {
            setShowErrors(true);
            if (Object.keys(validatePaymentDraft(draftState.draft!)).length) {
              toast.error('Check the highlighted fields before saving.');
              return;
            }
            void action("save_venue", {
              cancellation_policy: policy,
              support_email: email,
              timezone,
              tax_inclusive_acknowledged: taxes,
              accepting_payments: accepting,
              rates: Object.entries(prices).map(([id, price]) => ({
                id,
                price,
              })),
            });
          }}
        >
          {busy === "save_venue" && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save prices & policy
        </Button>
        </fieldset>
      </section>
      <AlertDialog open={newAccountOpen} onOpenChange={setNewAccountOpen}><AlertDialogContent className="max-h-[90dvh] overflow-y-auto font-sans"><AlertDialogHeader><AlertDialogTitle>Create a separate Stripe account?</AlertDialogTitle><AlertDialogDescription>This will prepare a new Stripe business account for {data.venue.name}. Its funds, bank account and payout settings are separate from PULSE and your other venues. If this venue already uses Stripe, cancel and choose Connect existing Stripe account instead. No subscription or payment starts here.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void action('onboard', { create_new_account: true })}>Create venue account</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-sans text-lg font-semibold">
            Requests to resolve
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Canceling a reservation and refunding money are separate decisions. A
          refund request keeps the court reserved until the refund succeeds.
        </p>
        {data.mode === 'off' ? <p className="mt-4 text-sm text-muted-foreground">Payment requests will appear here when payments are available.</p> : requests.isPending ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading payment requests…</p> : requests.isError ? (
          <p role="alert" className="mt-4 text-sm">
            Couldn’t load requests.{" "}
            <Button variant="link" onClick={() => requests.refetch()}>
              Retry
            </Button>
          </p>
        ) : !requests.data?.requests?.length ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No open payment requests.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {requests.data.requests.map((request: any) => !request.payment_orders ? <p key={request.id} role="alert" className="rounded-xl border p-4 text-sm">Payment details are unavailable for this request. Refresh before taking action.</p> : (
              <div key={request.id} className="rounded-xl border p-4">
                <p className="break-words font-semibold">
                  {request.payment_orders.description}
                </p>
                <p className="mt-1 text-sm">
                  {formatMoney(Math.max(0, request.payment_orders.amount_cents - (request.payment_orders.refunded_cents ?? 0)))} remaining ·{" "}
                  {request.status === "refund_pending"
                    ? "Refund pending — reservation retained"
                    : "Cancellation requested"}
                </p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                  {request.note}
                </p>
                <Label htmlFor={`resolve-${request.id}`} className="mt-4 block">
                  Your response to the player
                </Label>
                <Textarea
                  id={`resolve-${request.id}`}
                  className="mt-2"
                  value={resolution[request.id] || ""}
                  onChange={(e) =>
                    setResolution({
                      ...resolution,
                      [request.id]: e.target.value,
                    })
                  }
                  maxLength={1000}
                  disabled={!!busy}
                  aria-describedby={`resolve-hint-${request.id}`}
                />
                <p id={`resolve-hint-${request.id}`} className="mt-2 text-xs leading-5 text-muted-foreground">Write at least 5 characters explaining your decision. The player will see this response.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {decisions.filter(([decision]) => request.status !== 'refund_pending' || decision === 'refund_pending').map(([decision, label, impact]) => (
                    <Button
                      key={decision}
                      variant={
                        decision === "refund_pending" ? "default" : "outline"
                      }
                      disabled={
                        !!busy ||
                        requests.isFetching ||
                        (resolution[request.id] || "").trim().length < 5
                      }
                      className="h-auto min-h-11 whitespace-normal text-left"
                      onClick={() => setConfirmation({ orderId: request.order_id, decision, label, impact, note: resolution[request.id].trim(), description: request.payment_orders.description, remaining: Math.max(0, request.payment_orders.amount_cents - (request.payment_orders.refunded_cents ?? 0)) })}
                    >
                      {request.status === 'refund_pending' ? 'Retry pending refund' : label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}>
        <AlertDialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.label}?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">{confirmation?.impact}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="min-w-0 rounded-xl bg-muted/40 p-4 text-sm leading-6">
            <p className="break-words font-semibold">{confirmation?.description}</p>
            {confirmation?.decision === 'refund_pending' && <p>Remaining payment: {formatMoney(confirmation.remaining)}</p>}
            <p className="mt-3 text-muted-foreground">Your response to the player</p>
            <p className="whitespace-pre-wrap break-words">{confirmation?.note}</p>
          </div>
          {!confirmationCurrent && <p role="alert" className="text-sm text-destructive">This request has changed. Go back and review its current status before taking action.</p>}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={!!busy}>Go back</AlertDialogCancel>
            <AlertDialogAction className="h-auto min-h-11 whitespace-normal" disabled={!!busy || requests.isError || requests.isFetching || !confirmationCurrent} onClick={event => {
              event.preventDefault();
              if (confirmation) void action('resolve_cancellation', { order_id: confirmation.orderId, decision: confirmation.decision, note: confirmation.note, confirm: true });
            }}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirmation?.label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl font-sans">
          <AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your rates, policy and payment preferences will return to the latest saved settings.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { dispatch({ type: 'reset' }); setShowErrors(false); }}>Discard draft</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
