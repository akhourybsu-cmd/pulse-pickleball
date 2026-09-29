import { VenueAdminPageHeader } from "@/components/venue/VenueAdminPageHeader";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import { venueRpc as rpc, venueDate } from "@/lib/venues/customerRecords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
interface Station {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}
export default function VenueCheckinStations() {
  const { groupId = "" } = useParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const venue = group?.venue_id;
  const [hours, setHours] = useState(8),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const q = useQuery({
    queryKey: ["venue-checkin-stations", venue, user?.id],
    enabled: !!venue && !!user,
    queryFn: () => rpc<Station[]>("venue_kiosk_manage", { p_venue: venue }),
    refetchInterval: 30000,
  });
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await q.refetch();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update check-in stations.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <VenueAdminPageHeader
        title="Player check-in stations"
        description="Players scan a venue-branded QR screen, acknowledge required documents and check in for their own confirmed visits."
      />
      <section className="rounded-2xl border bg-card p-5">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act(() =>
              rpc("venue_kiosk_create", { p_venue: venue, p_hours: hours }),
            );
          }}
        >
          <label className="text-sm">
            Station lifetime (hours)
            <Input
              type="number"
              min={1}
              max={24}
              required
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            />
          </label>
          <Button type="submit" disabled={busy || !venue}>
            {busy ? "Preparing…" : "Create check-in station"}
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          Use a dedicated signed-out browser on the kiosk. Its screen shows your
          venue and check-in QR, and each player completes check-in privately on
          their phone. Guests without a PULSE account can use the individual
          visit link from their player record.
        </p>
      </section>
      {(error || q.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || q.error?.message}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {q.isPending ? (
        <p>Loading stations…</p>
      ) : q.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((k) => {
            const active = !k.revoked_at && new Date(k.expires_at) > new Date();
            const url = `${window.location.origin}/venue-kiosk/${k.token}`;
            return (
              <article key={k.id} className="rounded-2xl border bg-card p-5">
                <h2 className="font-semibold">
                  {active
                    ? "Active station"
                    : k.revoked_at
                      ? "Revoked station"
                      : "Expired station"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Expires{" "}
                  {venueDate(
                    k.expires_at,
                    group?.venue?.timezone || "America/New_York",
                  )}
                </p>
                {active && (
                  <>
                    <div className="my-4 inline-block rounded-xl bg-white p-3">
                      <QRCodeSVG value={url} size={150} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Scan this setup code on the kiosk device. The kiosk
                      displays the separate player check-in code.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline">Open kiosk</Button>
                      </a>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(url)
                            .then(() => setNotice("Kiosk link copied."))
                            .catch(() =>
                              setError(
                                "Copy failed. Open the kiosk link instead.",
                              ),
                            )
                        }
                      >
                        Copy link
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            rpc("venue_kiosk_manage", {
                              p_venue: venue,
                              p_revoke: k.id,
                            }),
                          )
                        }
                      >
                        Revoke
                      </Button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          No check-in stations yet.
        </p>
      )}
    </main>
  );
}
