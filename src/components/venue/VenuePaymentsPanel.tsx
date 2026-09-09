import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatMoney, openStripe, paymentApi } from "@/lib/payments";

export function VenuePaymentsPanel({ venueId }: { venueId: string }) {
  const query = useQuery({
    queryKey: ["venue-payments", venueId],
    queryFn: () => paymentApi<any>("venue", { venue_id: venueId }),
    staleTime: 30_000,
  });
  const requests = useQuery({
    queryKey: ["venue-payment-requests", venueId],
    queryFn: () => paymentApi<any>("cancellations", { venue_id: venueId }),
    enabled: !!query.data && query.data.mode !== "off",
  });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("");
  const [taxes, setTaxes] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!query.data) return;
    const data = query.data;
    setPrices(
      Object.fromEntries(
        data.courts.map((court: any) => [
          court.id,
          Number(court.hourly_rate || 0).toFixed(2),
        ])
      )
    );
    setPolicy(data.settings?.cancellation_policy || "");
    setEmail(data.settings?.support_email || "");
    setTimezone(data.settings?.timezone || "");
    setTaxes(data.settings?.tax_inclusive_acknowledged || false);
    setAccepting(data.settings?.accepting_payments || false);
  }, [query.data]);
  const action = async (name: string, values: Record<string, unknown> = {}) => {
    setBusy(name);
    try {
      const result = await paymentApi<any>(name, {
        venue_id: venueId,
        ...values,
      });
      if (result.url) openStripe(result.url);
      else {
        toast.success("Payment settings updated");
        await query.refetch();
        if (query.data?.mode !== "off") await requests.refetch();
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
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
  const data = query.data;
  const connected =
    data.account?.charges_enabled &&
    data.account?.payouts_enabled &&
    !data.transferred;
  return (
    <div className="space-y-6 font-sans">
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="mt-3 font-sans text-xl font-semibold">
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
              disabled={!!busy || data.mode === "off" || data.transferred}
              onClick={() => action("onboard")}
            >
              {busy === "onboard" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {connected ? "Review Stripe setup" : "Connect Stripe"}
            </Button>
            {data.account && (
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => action("refresh_account")}
              >
                Check connection
              </Button>
            )}
          </div>
        </div>
        {connected && (
          <a
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            Open your Stripe dashboard <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </section>
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-sans text-lg font-semibold">
          Court rates & checkout policy
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Set an all-inclusive hourly rate in USD. Bookings are prorated by
          duration. $0 means a free court; the “premium” badge does not add a
          hidden surcharge.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.courts.map((court: any) => (
            <div key={court.id} className="min-w-0 rounded-xl border p-4">
              <Label htmlFor={`rate-${court.id}`} className="block truncate">
                {court.name}
              </Label>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id={`rate-${court.id}`}
                  inputMode="decimal"
                  value={prices[court.id] || ""}
                  onChange={(e) =>
                    setPrices({ ...prices, [court.id]: e.target.value })
                  }
                  className="min-w-0"
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  USD / hour
                </span>
              </div>
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
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-timezone">Venue time zone</Label>
            <Input
              id="payment-timezone"
              placeholder="America/New_York"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
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
            onChange={(e) => setPolicy(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Explain deadlines, refund eligibility, weather closures and how players contact you."
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Players must agree before paying. Each purchase retains the policy
            they accepted, even if you change it later.
          </p>
        </div>
        <label className="mt-5 flex items-start gap-3 text-sm leading-6">
          <Checkbox
            checked={taxes}
            onCheckedChange={(v) => setTaxes(v === true)}
            className="mt-1"
          />
          <span>
            I confirm my rates include any applicable taxes. My venue is
            responsible for determining and remitting its taxes.
          </span>
        </label>
        <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border p-4">
          <div>
            <Label htmlFor="accept-payments">
              Accept paid court reservations
            </Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Requires a verified venue and a live Stripe connection. Saving a
              draft does not start charging players.
            </p>
          </div>
          <Switch
            id="accept-payments"
            checked={accepting}
            onCheckedChange={setAccepting}
            disabled={!accepting && (data.mode !== "live" || !connected)}
          />
        </div>
        <Button
          className="mt-5 h-11 rounded-xl"
          disabled={!!busy || !taxes}
          onClick={() =>
            action("save_venue", {
              cancellation_policy: policy,
              support_email: email,
              timezone,
              tax_inclusive_acknowledged: taxes,
              accepting_payments: accepting,
              rates: Object.entries(prices).map(([id, price]) => ({
                id,
                price,
              })),
            })
          }
        >
          {busy === "save_venue" && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save prices & policy
        </Button>
      </section>
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
        {requests.isError ? (
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
            {requests.data.requests.map((request: any) => (
              <div key={request.id} className="rounded-xl border p-4">
                <p className="font-semibold">
                  {request.payment_orders.description}
                </p>
                <p className="mt-1 text-sm">
                  {formatMoney(request.payment_orders.amount_cents)} ·{" "}
                  {request.status === "refund_pending"
                    ? "Refund pending — reservation retained"
                    : "Cancellation requested"}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
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
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ["refund_pending", "Cancel & refund in full"],
                    ["cancel_without_refund", "Cancel without refund"],
                    ["declined", "Decline request"],
                  ].map(([decision, label]) => (
                    <Button
                      key={decision}
                      variant={
                        decision === "refund_pending" ? "default" : "outline"
                      }
                      disabled={
                        !!busy ||
                        (resolution[request.id] || "").trim().length < 5
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `${label}? ${
                              decision === "refund_pending"
                                ? "The remaining payment will be returned to the original payment method. Stripe fees may not be returned."
                                : decision === "cancel_without_refund"
                                ? "The court will be released. No money will be refunded."
                                : "The reservation and payment will remain unchanged."
                            }`
                          )
                        )
                          void action("resolve_cancellation", {
                            order_id: request.order_id,
                            decision,
                            note: resolution[request.id],
                            confirm: true,
                          });
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
