import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { venueRpc as rpc, venueDate } from "@/lib/venues/customerRecords";
import { formatMoney } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Quote = {
  venue_name: string;
  timezone: string;
  title: string;
  kind: string;
  coach: string | null;
  start_time: string;
  end_time: string;
  courts: number;
  total_cents: number;
  deposit_cents: number;
  policy: string;
  status: string;
  agreed_at: string | null;
  expires_at: string;
  version: number;
};
export default function VenueQuote() {
  const { token } = useParams();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["venue-quote", token],
    queryFn: () => rpc<Quote>("venue_appointment_quote", { p_token: token }),
    retry: false,
  });
  const a = q.data;
  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <article className="mx-auto max-w-xl space-y-5 rounded-2xl border bg-card p-6">
        <header>
          <p className="text-sm text-muted-foreground">
            {a?.venue_name || "Venue booking quote"}
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            {a?.title || "Your quote"}
          </h1>
        </header>
        {q.isPending && <p role="status">Loading quote…</p>}
        {(q.error || error) && (
          <p role="alert" className="text-destructive">
            {error || q.error?.message}
          </p>
        )}
        {a && (
          <>
            <p className="font-medium">
              {venueDate(a.start_time, a.timezone)}
              <br />
              Through {venueDate(a.end_time, a.timezone)}
            </p>
            <p className="text-sm">
              {a.courts} court{a.courts === 1 ? "" : "s"}
              {a.coach ? ` · Coach: ${a.coach}` : ""}
            </p>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm">Total quote</p>
              <p className="text-3xl font-bold">{formatMoney(a.total_cents)}</p>
              <p className="mt-2 text-sm">
                {formatMoney(a.deposit_cents)} deposit to confirm ·{" "}
                {formatMoney(a.total_cents - a.deposit_cents)} remaining after
                deposit
              </p>
            </div>
            <section>
              <h2 className="font-semibold">Venue policy</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {a.policy || "No payment policy applies to this free booking."}
              </p>
            </section>
            {a.status === "draft" ? (
              a.agreed_at ? (
                <p role="status" className="rounded-xl border p-4 text-sm">
                  Quote acknowledged. The venue will arrange payment and confirm
                  court availability with you. Your booking is confirmed when
                  the venue marks it confirmed.
                </p>
              ) : (
                <form
                  className="space-y-4 border-t pt-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    setBusy(true);
                    setError("");
                    try {
                      await rpc("venue_appointment_quote", {
                        p_token: token,
                        p_accept: true,
                        p_name: f.get("name"),
                        p_version: a.version,
                      });
                      await q.refetch();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Unable to acknowledge quote."
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="block text-sm">
                    Your name
                    <Input name="name" required minLength={2} maxLength={150} />
                  </label>
                  <label className="flex gap-2 text-sm">
                    <input type="checkbox" required />I reviewed this quote and
                    agree to the venue policy.
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Quote expires {venueDate(a.expires_at, a.timezone)}.
                    Acknowledging does not charge you or hold courts. The venue
                    will arrange secure payment and confirmation.
                  </p>
                  <Button disabled={busy}>Acknowledge quote</Button>
                </form>
              )
            ) : (
              <p role="status" className="rounded-xl border p-4 font-medium">
                {a.status === "confirmed"
                  ? "Booking confirmed"
                  : a.status === "held"
                  ? "Payment pending — booking held during checkout"
                  : "Booking canceled"}
              </p>
            )}
          </>
        )}
      </article>
    </main>
  );
}
