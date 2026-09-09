import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CreditCard,
  LockKeyhole,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { VenuePaymentsPanel } from "@/components/venue/VenuePaymentsPanel";
import {
  formatMoney,
  openStripe,
  paymentApi,
  paymentStatus,
  type PaymentConfig,
  type PaymentOrder,
} from "@/lib/payments";

export default function Payments() {
  const [params] = useSearchParams();
  const venueId = params.get("venue");
  const [page, setPage] = useState(0);
  const [merchant, setMerchant] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOrder, setCancelOrder] = useState<PaymentOrder | null>(null);
  const [reason, setReason] = useState("");
  const config = useQuery({
    queryKey: ["payment-config"],
    queryFn: () => paymentApi<PaymentConfig>("status"),
    staleTime: 60_000,
  });
  const history = useQuery({
    queryKey: ["payment-history", venueId, page],
    queryFn: () =>
      paymentApi<{
        orders: PaymentOrder[];
        has_more: boolean;
        legacy_leagues: any[];
        legacy_tournaments: any[];
      }>("history", { venue_id: venueId, page }),
    staleTime: 15_000,
  });
  const wallet = useQuery({
    queryKey: ["payment-wallet"],
    queryFn: () =>
      paymentApi<{
        merchants: { account_id: string; merchant_name: string }[];
      }>("wallet"),
    enabled: !!config.data && config.data.mode !== "off" && !venueId,
  });
  const reconciled = useRef("");
  useEffect(() => {
    const order = params.get("order");
    if (
      !order ||
      config.data?.mode === "off" ||
      !config.data ||
      reconciled.current === order
    )
      return;
    reconciled.current = order;
    paymentApi("reconcile", { order_id: order })
      .then(() => history.refetch())
      .catch((error) => toast.error(error.message));
  }, [params, config.data]); // Confirmation is server-verified; a return URL is not proof of payment.
  const action = async (name: string, values: Record<string, unknown> = {}) => {
    setBusy(name);
    try {
      const result = await paymentApi<any>(name, values);
      if (result.url) openStripe(result.url);
      else {
        await history.refetch();
        toast.success(
          name === "request_cancellation"
            ? "Request sent to the venue. Your reservation remains active until they resolve it."
            : "Purchase status refreshed"
        );
        setCancelOrder(null);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 pb-24 font-sans sm:px-6 lg:py-9">
      <header>
        <Link
          to="/player/profile"
          className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Profile
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-sans text-3xl font-semibold tracking-tight sm:text-4xl">
              {venueId ? "Venue finances" : "Payments & purchases"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {venueId
                ? "Your rental collections, checkout policies and player requests. PULSE add-on bills are separate."
                : "Secure payment methods and a clear record of what you paid for, who received it, and any refunds."}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => history.refetch()}
            disabled={history.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>
      {config.data?.mode === "test" && (
        <div
          role="status"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6"
        >
          Test payments only. No real money, venue reservations or paid add-ons
          are created. Test purchases are labeled below.
        </div>
      )}
      {config.data?.mode === "off" && (
        <div className="rounded-2xl border bg-muted/30 p-4 text-sm leading-6">
          Payment setup is in progress. Purchase records remain available, but
          new checkouts and card setup are not enabled.
        </div>
      )}
      {config.isError && (
        <p role="alert" className="rounded-xl border p-4 text-sm">
          Couldn’t check payment availability.{" "}
          <Button variant="link" onClick={() => config.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {venueId && <VenuePaymentsPanel venueId={venueId} />}
      <div
        className={
          venueId
            ? ""
            : "grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"
        }
      >
        {!venueId && (
          <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-sans text-lg font-semibold">
              Saved payment methods
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Stripe stores your card details. PULSE never stores card numbers
              or security codes. Cards are saved separately for each merchant.
            </p>
            {wallet.isError ? (
              <p role="alert" className="mt-4 text-sm">
                Couldn’t load payment methods.{" "}
                <Button variant="link" onClick={() => wallet.refetch()}>
                  Retry
                </Button>
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                <Label htmlFor="payment-merchant">Manage cards for</Label>
                <Select
                  value={
                    merchant || wallet.data?.merchants[0]?.account_id || ""
                  }
                  onValueChange={setMerchant}
                  disabled={!wallet.data}
                >
                  <SelectTrigger id="payment-merchant">
                    <SelectValue placeholder="Payment setup pending" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallet.data?.merchants.map((m) => (
                      <SelectItem key={m.account_id} value={m.account_id}>
                        {m.merchant_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="h-11 w-full rounded-xl"
                  disabled={!!busy || !wallet.data}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Save a card securely with Stripe for the selected merchant? No purchase is made."
                      )
                    )
                      void action("save_card", {
                        account_id:
                          merchant || wallet.data?.merchants[0]?.account_id,
                        accept_terms: true,
                        request_key: crypto.randomUUID(),
                      });
                  }}
                >
                  Add a payment method
                </Button>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl"
                  disabled={!!busy || !wallet.data}
                  onClick={() =>
                    action("billing_portal", {
                      account_id:
                        merchant || wallet.data?.merchants[0]?.account_id,
                    })
                  }
                >
                  Manage cards & subscriptions
                </Button>
              </div>
            )}
            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
              Adding a card does not authorize a purchase. You confirm each
              checkout or agree to clearly displayed subscription terms.
            </p>
          </section>
        )}
        <section className="min-w-0 space-y-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            <h2 className="font-sans text-lg font-semibold">
              {venueId ? "Rental purchase history" : "Purchase history"}
            </h2>
          </div>
          {history.isPending ? (
            <p role="status" className="rounded-2xl border p-6 text-sm">
              Loading purchases…
            </p>
          ) : history.isError ? (
            <div role="alert" className="rounded-2xl border p-5">
              <p className="text-sm">{history.error.message}</p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => history.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              {!history.data.orders.length && (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 font-semibold">No new purchases yet</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Payments for venue tools and court rentals will appear here
                    with their merchant and status.
                  </p>
                </div>
              )}
              {history.data.orders.map((order) => (
                <article
                  key={order.id}
                  className="min-w-0 rounded-2xl border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {order.merchant_name}{" "}
                        {!order.livemode && (
                          <span className="ml-1 rounded bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
                            Test
                          </span>
                        )}
                      </p>
                      <h3 className="mt-2 break-words font-sans font-semibold leading-6">
                        {order.description}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()} ·{" "}
                        {order.billing_cadence === "monthly"
                          ? "Monthly subscription"
                          : "One-time purchase"}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-semibold tabular-nums">
                      {formatMoney(order.amount_cents, order.currency)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                      {paymentStatus(order)}
                    </span>
                    {order.refunded_cents > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Refunded {formatMoney(order.refunded_cents)}
                      </span>
                    )}
                  </div>
                  {order.start_time && (
                    <p className="mt-3 text-sm leading-6">
                      Court time: {new Date(order.start_time).toLocaleString()}{" "}
                      –{" "}
                      {order.end_time &&
                        new Date(order.end_time).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                      <span className="text-xs text-muted-foreground">
                        (your local time)
                      </span>
                    </p>
                  )}
                  {order.policy_snapshot && (
                    <details className="mt-4 text-sm">
                      <summary className="cursor-pointer font-medium">
                        Purchase & cancellation terms
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap leading-6 text-muted-foreground">
                        {order.policy_snapshot}
                      </p>
                    </details>
                  )}
                  {order.payment_cancellation_requests && (
                    <div className="mt-4 rounded-xl bg-muted/30 p-3 text-sm leading-6">
                      <p className="font-medium">
                        Cancellation:{" "}
                        {order.payment_cancellation_requests.status.replace(
                          "_",
                          " "
                        )}
                      </p>
                      {order.payment_cancellation_requests.resolution_note && (
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {order.payment_cancellation_requests.resolution_note}
                        </p>
                      )}
                    </div>
                  )}
                  {!venueId && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {order.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            disabled={!!busy}
                            onClick={() =>
                              action("resume", { order_id: order.id })
                            }
                          >
                            Continue checkout
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!busy}
                            onClick={() =>
                              action("reconcile", { order_id: order.id })
                            }
                          >
                            Check payment
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!!busy}
                            onClick={() =>
                              action("cancel_checkout", { order_id: order.id })
                            }
                          >
                            Cancel unpaid checkout
                          </Button>
                        </>
                      ) : (
                        order.payment_intent_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!busy}
                            onClick={() =>
                              action("receipt", { order_id: order.id })
                            }
                          >
                            View receipt
                          </Button>
                        )
                      )}
                      {order.kind === "court_rental" &&
                        ["paid", "partially_refunded"].includes(order.status) &&
                        !order.canceled_at && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCancelOrder(order);
                              setReason("");
                            }}
                          >
                            Request cancellation
                          </Button>
                        )}
                    </div>
                  )}
                </article>
              ))}
              {(history.data.has_more || page > 0) && (
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1}
                  </span>
                  <Button
                    variant="outline"
                    disabled={!history.data.has_more}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
              {!!(
                history.data.legacy_leagues?.length ||
                history.data.legacy_tournaments?.length
              ) && (
                <details className="rounded-2xl border p-5">
                  <summary className="cursor-pointer font-semibold">
                    Earlier app purchases
                  </summary>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Records from the earlier payment system. Some tournament
                    amounts and individual division purchases were not recorded
                    in PULSE; those receipts require Stripe reconciliation.
                  </p>
                  <div className="mt-4 space-y-3">
                    {history.data.legacy_leagues.map((item) => (
                      <p
                        key={item.id}
                        className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm"
                      >
                        <span>League slot · {item.status}</span>
                        <span>
                          {item.amount_cents == null
                            ? "Amount not recorded"
                            : formatMoney(
                                item.amount_cents,
                                item.currency || "usd"
                              )}
                        </span>
                      </p>
                    ))}
                    {history.data.legacy_tournaments.map((item) => (
                      <p key={item.id} className="border-t pt-3 text-sm">
                        {item.name} · {item.payment_status} · Amount not
                        recorded
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </section>
      </div>
      <Dialog
        open={!!cancelOrder}
        onOpenChange={(value) => {
          if (!busy && !value) setCancelOrder(null);
        }}
      >
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="font-sans">
              Request a cancellation
            </DialogTitle>
            <DialogDescription>
              The venue reviews your request under the policy you accepted. This
              does not immediately cancel the reservation or guarantee a refund.
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {cancelOrder?.policy_snapshot}
          </p>
          <Label htmlFor="cancel-reason">Reason for your request</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
          />
          <Button
            disabled={!!busy || reason.trim().length < 5}
            onClick={() =>
              action("request_cancellation", {
                order_id: cancelOrder?.id,
                note: reason,
              })
            }
          >
            Send request to venue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
