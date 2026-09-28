import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatMoney,
  openStripe,
  paymentApi,
  type CourtQuote,
} from "@/lib/payments";
import type { GroupEvent, GroupRsvpStatus } from "@/hooks/useGroupEvents";
export function VenueEventCheckout({
  event,
  canRsvp,
  onRsvp,
}: {
  event: GroupEvent;
  canRsvp: boolean;
  onRsvp: (
    id: string,
    status: "going" | "maybe" | "not_going" | "waitlist"
  ) => Promise<GroupRsvpStatus | void> | GroupRsvpStatus | void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const closed =
    !!event.canceled_at ||
    !!event.registration_paused ||
    Date.now() >= Date.parse(event.registration_closes_at ?? event.start_time);
  const confirmed = event.user_rsvp === "going";
  const pending = event.checkout_order_id;
  const available =
    event.capacity == null ||
    (event.rsvps?.going ?? 0) + (event.pending_places ?? 0) < event.capacity;
  const quote = useQuery({
    queryKey: [
      "event-payment-quote",
      event.id,
      event.price_cents,
      event.cancellation_policy,
      event.updated_at,
    ],
    enabled: canRsvp && !closed && !confirmed && !pending && available,
    queryFn: () =>
      paymentApi<CourtQuote>("event_quote", { event_id: event.id }),
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    setAccepted(false);
    key.current = crypto.randomUUID();
  }, [quote.data?.amount_cents, quote.data?.policy, quote.data?.livemode]);
  const pay = async () => {
    if (!accepted || !quote.data || working) return;
    setWorking(true);
    setError("");
    try {
      const result = await paymentApi<{ url: string }>("event_checkout", {
        event_id: event.id,
        amount_cents: quote.data.amount_cents,
        policy: quote.data.policy,
        accept_terms: true,
        request_key: key.current,
      });
      openStripe(result.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Checkout could not be started."
      );
    } finally {
      setWorking(false);
    }
  };
  async function waitlist() {
    setWorking(true);
    setError("");
    try {
      await onRsvp(event.id, "waitlist");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Waitlist could not be updated."
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <section
      className="space-y-4 rounded-2xl border bg-muted/20 p-4"
      aria-label="Event checkout"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <CreditCard className="h-4 w-4" />
          Your place
        </h3>
        <p className="font-semibold">
          {formatMoney(event.price_cents ?? 0)}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            / player
          </span>
        </p>
      </div>
      {confirmed ? (
        <>
          <p className="text-sm">
            Your registration is confirmed. View your receipt or request
            cancellation in Payments & purchases.
          </p>
          <Button asChild variant="outline">
            <Link to="/player/payments">Manage payment</Link>
          </Button>
        </>
      ) : pending ? (
        <>
          <p className="text-sm">
            You have a checkout in progress. Resume or cancel it in Payments &
            purchases.
          </p>
          <Button asChild>
            <Link to={`/player/payments?order=${pending}`}>Open checkout</Link>
          </Button>
        </>
      ) : closed ? (
        <p className="text-sm">
          {event.canceled_at
            ? "This event was canceled."
            : event.registration_paused
            ? "Registration is paused."
            : "Registration is closed."}
        </p>
      ) : !canRsvp ? (
        <p className="text-sm">Join this venue community before registering.</p>
      ) : !available ? (
        <>
          <p className="text-sm">
            All places are confirmed or held during checkout.
          </p>
          {event.user_rsvp === "waitlist" ? (
            <p className="text-sm font-medium">
              You’re on the waitlist. Check back for an opening; a paid checkout
              is required to confirm a place.
            </p>
          ) : (
            event.waitlist_enabled && (
              <Button
                variant="outline"
                disabled={
                  working ||
                  (event.waitlist_limit != null &&
                    (event.rsvps?.waitlist ?? 0) >= event.waitlist_limit)
                }
                onClick={() => void waitlist()}
              >
                Join waitlist · no charge
              </Button>
            )
          )}
        </>
      ) : quote.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking price and availability…
        </p>
      ) : quote.isError ? (
        <div>
          <p role="alert" className="text-sm">
            {quote.error.message}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              setAccepted(false);
              void quote.refetch();
            }}
          >
            Check again
          </Button>
        </div>
      ) : (
        quote.data && (
          <>
            {!quote.data.livemode && (
              <p className="rounded-lg bg-amber-500/10 p-3 text-sm font-medium">
                Test checkout · no real charge or event registration.
              </p>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              Sold by {quote.data.merchant_name}. Price includes applicable
              taxes. One place is held while you complete checkout.
            </p>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide">
                Cancellation policy
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {quote.data.policy}
              </p>
            </div>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
              <input
                className="mt-1.5"
                type="checkbox"
                checked={accepted}
                disabled={working}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              I agree to the cancellation policy and the{" "}
              {formatMoney(quote.data.amount_cents)} total.
            </label>
            <Button
              className="min-h-11 w-full"
              disabled={!accepted || working}
              onClick={() => void pay()}
            >
              {working
                ? "Opening checkout…"
                : `${
                    quote.data.livemode ? "Pay" : "Test payment"
                  } ${formatMoney(quote.data.amount_cents)} & register`}
            </Button>
          </>
        )
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
