import { useEffect, useRef, useState } from "react";
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
import { getErrorMessage } from "@/lib/getErrorMessage";

export function VenueAddonCheckout({
  venueId,
  moduleKey,
  title,
  verified,
  canPurchase,
  venueName,
  disabled = false,
}: {
  venueId: string;
  moduleKey: string;
  title: string;
  verified: boolean;
  canPurchase: boolean;
  venueName?: string;
  disabled?: boolean;
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
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const lock = useRef(false);
  const scope = `${venueId}:${moduleKey}:${config.data?.mode}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const availability = venueUpgradeState({
    isOwner: canPurchase,
    verified,
    config: config.data,
    pending: config.isPending,
    error: config.isError,
  });
  const ready = availability.ready && !disabled;
  useEffect(() => {
    setAccepted(false);
    setCheckoutError(null);
  }, [venueId, moduleKey, config.data?.mode, config.data?.cadence, verified, canPurchase]);
  useEffect(() => { setOpen(false); setRequest(crypto.randomUUID()); }, [venueId, moduleKey]);
  const checkout = async () => {
    if (!ready || !accepted || lock.current) return;
    lock.current = true;
    setBusy(true);
    setCheckoutError(null);
    try {
      const result = await paymentApi<{ url: string }>("module_checkout", {
        venue_id: venueId,
        module_key: moduleKey,
        cadence: "monthly",
        accept_terms: accepted,
        request_key: request,
      });
      if (currentScope.current !== scope) return;
      if (!result || typeof result.url !== 'string' || !result.url) throw new Error('Secure checkout did not return a link. Please try again; no purchase has been confirmed here.');
      openStripe(result.url);
    } catch (error) {
      if (currentScope.current === scope) {
        const message = getErrorMessage(error, 'Secure checkout could not open. Please try again.');
        setCheckoutError(message);
        toast.error(message);
      }
    } finally {
      lock.current = false;
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
        className="h-auto min-h-11 w-full whitespace-normal rounded-xl py-2"
        disabled={busy || disabled}
        onClick={() => {
          setOpen(true);
          setAccepted(false);
          setCheckoutError(null);
          setRequest(crypto.randomUUID());
        }}
      >
        Review {title}
      </Button>
      {!ready && (
        <p className="text-xs leading-5 text-muted-foreground">
          {disabled ? 'Save or discard your payment settings before starting a test purchase.' : availability.message}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="break-words pr-5 font-sans">Add {title}</DialogTitle>
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
            {venueName && <p className="mb-3 break-words text-sm font-semibold">For {venueName}</p>}
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
                disabled={busy}
              />
              <span>
                I agree to pay PULSE Pickleball $10 USD per month for this
                feature, with automatic renewal until I cancel.
              </span>
            </label>
          )}
          {checkoutError && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6">{checkoutError}</p>}
          {busy && <p role="status" className="text-sm text-muted-foreground">Opening secure checkout. Please keep this window open.</p>}
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
          {!busy && <Button variant="link" asChild>
            <Link to="/player/payments">Manage existing purchases</Link>
          </Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
