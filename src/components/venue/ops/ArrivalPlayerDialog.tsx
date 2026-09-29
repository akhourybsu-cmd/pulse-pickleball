import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  venueRpc as rpc,
  venueDate,
  type VenueCustomerProfile,
} from "@/lib/venues/customerRecords";
import { useAuthState } from "@/hooks/useAuthState";
import { VenueWaiverStatus } from "../VenueWaiverStatus";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function ArrivalPlayerDialog({
  customer,
  timeZone,
  close,
}: {
  customer: string;
  timeZone: string;
  close: () => void;
}) {
  const { user } = useAuthState();
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["venue-customer", customer, user?.id],
    queryFn: () =>
      rpc<VenueCustomerProfile>("venue_customer_profile", {
        p_customer: customer,
      }),
    refetchInterval: 10000,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Player & venue waiver</DialogTitle>
          <DialogDescription>
            Review arrival requirements and recent visits without leaving the
            kiosk.
          </DialogDescription>
        </DialogHeader>
        {q.data && (
          <>
            <h3 className="text-lg font-semibold">
              {q.data.player.first_name} {q.data.player.last_name}
            </h3>
            <VenueWaiverStatus waiver={q.data.waiver} />
            <ul className="space-y-2 text-sm">
              {q.data.documents.map((d) => (
                <li key={d.id}>
                  {d.title} · v{d.version}
                  <br />
                  <strong>
                    {d.accepted_at
                      ? `Signed ${venueDate(d.accepted_at, timeZone)}`
                      : d.required
                        ? "Not signed · required before check-in"
                        : "Optional"}
                  </strong>
                </li>
              ))}
            </ul>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const token = await rpc<string>("venue_visit_link", {
                    p_customer: customer,
                  });
                  setLink(`${window.location.origin}/venue-visit/${token}`);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not open signing link.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Show player signing QR
            </Button>
            {link && (
              <div className="space-y-3">
                <div className="mx-auto w-fit rounded-xl bg-white p-3">
                  <QRCodeSVG value={link} size={190} />
                </div>
                <p className="text-sm">
                  Ask the player to scan and sign on their own phone. This
                  status refreshes automatically.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(link)
                      .catch(() =>
                        setError(
                          "Copy failed. Ask the player to scan the QR code.",
                        ),
                      )
                  }
                >
                  Copy private signing link
                </Button>
              </div>
            )}
            <h3 className="font-semibold">Recent venue history</h3>
            <ul className="space-y-2 text-sm">
              {[...q.data.registrations, ...(q.data.visits || [])]
                .sort((a, b) => b.start_time.localeCompare(a.start_time))
                .slice(0, 10)
                .map((v) => (
                  <li key={v.id}>
                    {v.title} · {venueDate(v.start_time, timeZone)}
                    <br />
                    <span className="text-muted-foreground">
                      {v.checked_in_at
                        ? "Checked in"
                        : v.no_show_at
                          ? "No-show"
                          : v.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
            </ul>
          </>
        )}
        {q.isPending && <p>Loading player...</p>}
        {(error || q.error) && <p role="alert">{error || q.error?.message}</p>}
      </DialogContent>
    </Dialog>
  );
}
