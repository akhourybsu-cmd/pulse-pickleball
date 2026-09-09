import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { paymentApi, openStripe, type PaymentConfig } from "@/lib/payments";
import { venueUpgradeState } from "@/lib/venues/venueUpgrade";

export function VenueAddonCheckout({
  venueId,
  moduleKey,
  title,
  verified,
  canPurchase,
}: {
  venueId: string;
  moduleKey: string;
  title: string;
  verified: boolean;
  canPurchase: boolean;
}) {
  const config = useQuery({
    queryKey: ["payment-config"],
    queryFn: () => paymentApi<PaymentConfig>("status"),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState(() => crypto.randomUUID());
  const availability = venueUpgradeState({
    isOwner: canPurchase,
    verified,
    config: config.data,
    pending: config.isPending,
    error: config.isError,
  });
  const ready = availability.ready;
  useEffect(() => {
    setAccepted(false);
  }, [config.data?.mode, config.data?.cadence, verified, canPurchase]);
  const checkout = async () => {
    if (!ready || !accepted || busy) return;
    setBusy(true);
    try {
      const result = await paymentApi<{ url: string }>("module_checkout", {
        venue_id: venueId,
        module_key: moduleKey,
        cadence: "monthly",
        accept_terms: accepted,
        request_key: request,
      });
      openStripe(result.url);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 space-y-3">
      <p className="text-2xl font-semibold tabular-nums">
        $10{" "}
        <span className="text-sm font-normal text-muted-foreground">
          USD / month per feature
        </span>
      </p>
      <Button
        className="h-11 w-full rounded-xl"
        disabled={busy}
        onClick={() => {
          setOpen(true);
          setAccepted(false);
          setRequest(crypto.randomUUID());
        }}
      >
        Review {title}
      </Button>
      {!ready && (
        <p className="text-xs leading-5 text-muted-foreground">
          {availability.message}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="font-sans">Add {title}</DialogTitle>
            <DialogDescription>
              Sold by PULSE Pickleball. Venue rental income is separate.
            </DialogDescription>
          </DialogHeader>
          <div
            role="status"
            className="rounded-xl bg-muted/50 p-3 text-sm leading-6"
          >
            {availability.message}
            {canPurchase && !verified && (
              <Button
                asChild
                variant="link"
                className="mt-2 flex h-auto justify-start whitespace-normal px-0 text-left"
              >
                <Link to={`/player/venue-requests?new=1&venue=${venueId}`}>
                  Start free ownership verification
                </Link>
              </Button>
            )}
            {canPurchase && verified && config.isError && (
              <Button variant="link" onClick={() => config.refetch()}>
                Retry payment check
              </Button>
            )}
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold">
              $10.00 <span className="text-sm font-normal">USD / month</span>
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This feature renews at $10 USD every month until canceled. Cancel
              before renewal through Profile → Payments & purchases. Access
              continues through your paid period. Other features are billed
              separately.
            </p>
          </div>
          {ready && (
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
              <Checkbox
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                className="mt-1"
              />
              <span>
                I agree to pay PULSE Pickleball $10 USD per month for this
                feature, with automatic renewal until I cancel.
              </span>
            </label>
          )}
          <Button
            className="h-12 rounded-xl"
            disabled={!ready || !accepted || busy}
            onClick={checkout}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LockKeyhole className="mr-2 h-4 w-4" />
            )}
            {availability.label}
          </Button>
          <Button variant="link" asChild>
            <Link to="/player/payments">Manage existing purchases</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
