import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { venueRpc as rpc, venueDate } from "@/lib/venues/customerRecords";
import { Button } from "@/components/ui/button";
import { useAuthState } from "@/hooks/useAuthState";
export function VenueWaitlistOffer({
  eventId,
  paid,
  timeZone,
  onAccepted,
}: {
  eventId: string;
  paid: boolean;
  timeZone?: string | null;
  onAccepted: () => void;
}) {
  const client = useQueryClient();
  const { user } = useAuthState();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["venue-waitlist-offer", eventId, user?.id],
    enabled: !!user,
    queryFn: () =>
      rpc<{ id: string; status: string; expires_at: string } | null>(
        "venue_waitlist_offer",
        { p_event: eventId }
      ),
    refetchInterval: 15000,
  });
  async function respond(accept: boolean) {
    if (!q.data) return;
    setBusy(true);
    setError("");
    try {
      await rpc("venue_waitlist_respond", {
        p_offer: q.data.id,
        p_accept: accept,
      });
      await client.invalidateQueries();
      if (accept) onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your offer.");
    } finally {
      setBusy(false);
    }
  }
  if (q.error)
    return (
      <p role="alert" className="rounded-xl border p-3 text-sm">
        Your waitlist offer could not be checked.{" "}
        <button className="underline" onClick={() => void q.refetch()}>
          Try again
        </button>
      </p>
    );
  if (!q.data) return null;
  const expired = Date.parse(q.data.expires_at) <= Date.now();
  return (
    <section
      className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4"
      aria-label="Your waitlist offer"
    >
      <h3 className="font-semibold">
        {q.data.status === "checkout"
          ? "Your place is held during checkout"
          : expired
          ? "This waitlist offer has expired"
          : "A place is reserved for you"}
      </h3>
      <p className="text-sm">
        {q.data.status === "checkout"
          ? "Complete your existing payment to confirm your place."
          : `Claim by ${venueDate(
              q.data.expires_at,
              timeZone || "America/New_York"
            )}. ${
              paid
                ? "Use secure checkout below to confirm."
                : "Accept to confirm your registration."
            }`}
      </p>
      {q.data.status === "offered" && !expired && (
        <div className="flex gap-2">
          {!paid && (
            <Button disabled={busy} onClick={() => void respond(true)}>
              Accept place
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void respond(false)}
          >
            Decline offer
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
