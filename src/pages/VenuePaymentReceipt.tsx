import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { venueRpc } from "@/lib/venues/customerRecords";
import { formatMoney } from "@/lib/payments";
export default function VenuePaymentReceipt() {
  const { token } = useParams();
  const q = useQuery({
    queryKey: ["venue-sale-receipt", token],
    queryFn: () =>
      venueRpc<{
        venue_name: string;
        description: string;
        quantity: number;
        amount_cents: number;
        refunded_cents: number;
        status: string;
        method: string;
        billing_cadence: string;
        policy: string;
        booking_status?: string | null;
        refund_review?: boolean;
      }>("venue_sale_receipt", { p_token: token }),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 3000 : false,
    retry: false,
  });
  const r = q.data;
  return (
    <main className="min-h-dvh bg-background px-4 py-12 text-foreground">
      <article className="mx-auto max-w-lg space-y-5 rounded-2xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Venue purchase</p>
        <h1 className="text-2xl font-bold">
          {r?.venue_name || "Your receipt"}
        </h1>
        {q.isPending && <p role="status">Loading receipt…</p>}
        {q.error && <p role="alert">{q.error.message}</p>}
        {r && (
          <>
            <div>
              <h2 className="text-lg font-semibold">
                {r.description} × {r.quantity}
              </h2>
              <p className="mt-3 text-3xl font-bold">
                {formatMoney(r.amount_cents)}
              </p>
              {r.billing_cadence === "monthly" && (
                <p className="text-sm">
                  Renews monthly until canceled. Manage your subscription in
                  PULSE → Payments & purchases.
                </p>
              )}
            </div>
            <p role="status" className="rounded-xl bg-muted/60 p-4 font-medium">
              {r.status === "pending"
                ? "Awaiting payment confirmation. If you completed checkout, this page will update automatically."
                : r.status === "paid"
                ? "Payment confirmed. Thank you."
                : r.status === "expired"
                ? "Checkout expired. Ask the venue for a new checkout."
                : r.status.replace(/_/g, " ")}
            </p>
            {r.refunded_cents > 0 && (
              <p>{formatMoney(r.refunded_cents)} refunded</p>
            )}
            {r.booking_status && (
              <p className="text-sm">
                Booking: {r.booking_status.replace(/_/g, " ")}
              </p>
            )}
            {r.refund_review && (
              <p role="status" className="rounded-xl border p-3 text-sm">
                The venue is reviewing this canceled booking’s payment. Contact
                the venue for refund status.
              </p>
            )}
            <section className="border-t pt-4">
              <h2 className="font-semibold">Venue policy</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {r.policy}
              </p>
            </section>
          </>
        )}
      </article>
    </main>
  );
}
