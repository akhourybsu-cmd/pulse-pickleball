import { VenueTheme } from '@/components/venue/VenueTheme';
import { VenueBrandMark } from '@/components/venue/VenueBrandMark';
import type { VenueBrand } from '@/lib/venues/branding';
import { VenueServiceContact, type VenueContact } from '@/components/venue/VenueServiceContact';
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { venueRpc } from "@/lib/venues/customerRecords";
import { formatMoney } from "@/lib/payments";
import { providerName } from '@/lib/venues/paymentProviders';
export default function VenuePaymentReceipt() {
  const { token } = useParams();
  const q = useQuery({
    queryKey: ["venue-sale-receipt", token],
    queryFn: () =>
      venueRpc<{
        brand?: VenueBrand;
        venue_contact?: VenueContact;
        venue_name: string;
        description: string;
        quantity: number;
        amount_cents: number;
        refunded_cents: number;
        status: string;
        method: string;
        provider?: string;
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
    <VenueTheme brand={r?.brand}><main className="min-h-dvh bg-background px-4 py-12 text-foreground">
      <article className="mx-auto max-w-lg space-y-5 rounded-2xl border bg-card p-6">
        {r&&<VenueBrandMark name={r.venue_name} logoUrl={r.brand?.logo_url} logoCrop={r.brand?.logo_crop} logoShape={r.brand?.logo_shape} logoImageFit={r.brand?.logo_image_fit} logoBackgroundColor={r.brand?.logo_background_color} secondaryColor={r.brand?.secondary_color} className="h-16 w-16 text-[64px]"/>}
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
                  your purchase history. See the venue for membership information.
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
            <p className="text-sm text-muted-foreground">Payment provider: {providerName(r.provider || r.method)}</p>
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
            <VenueServiceContact contact={r.venue_contact} topic="this payment, a refund or your booking"/>
            <section className="border-t pt-4">
              <h2 className="font-semibold">Venue policy</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {r.policy}
              </p>
            </section>
          </>
        )}
      </article>
    </main></VenueTheme>
  );
}
