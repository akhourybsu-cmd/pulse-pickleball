import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthState } from "@/hooks/useAuthState";
import { paymentApi } from "@/lib/payments";
import {
  paymentProviders,
  providerName,
  securePaymentUrl,
  type ProviderConnection,
  type ProviderWorkspace,
} from "@/lib/venues/paymentProviders";

export function VenuePaymentConnections({
  venueId,
  onStripe,
}: {
  venueId: string;
  onStripe: () => void;
}) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [returned] = useState(() =>
    params.get("payment_provider") === "square"
      ? {
          code: params.get("code"),
          state: params.get("state"),
          error: params.get("error"),
        }
      : null,
  );
  const handled = useRef(false);
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ProviderConnection | null>(null);
  const [locations, setLocations] = useState<
    { id: string; name: string; country: string }[]
  >([]);
  const [location, setLocation] = useState("");
  const scope = `${venueId}:${user?.id}`;
  const current = useRef(scope);
  current.current = scope;
  const query = useQuery({
    queryKey: ["venue-payment-providers", venueId, user?.id],
    queryFn: () =>
      paymentApi<ProviderWorkspace>("provider_workspace", {
        venue_id: venueId,
      }),
    enabled: !!user,
    staleTime: 30_000,
  });
  const refresh = async () => {
    await query.refetch();
    await client.invalidateQueries({ queryKey: ["venue-desk"] });
  };
  const act = async (
    action: string,
    values: Record<string, unknown> = {},
    success = "Payment settings updated.",
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const result = await paymentApi<any>(action, {
        venue_id: venueId,
        ...values,
      });
      if (current.current !== scope) return;
      if (result.url) {
        window.location.assign(securePaymentUrl(result.url));
        return;
      }
      if (!result || !Object.values(result).some((v) => v === true))
        throw new Error(
          "The change was not confirmed. Refresh before trying again.",
        );
      setMessage(success);
      await refresh();
      return result;
    } catch (e) {
      if (current.current === scope)
        setError(
          e instanceof Error
            ? e.message
            : "Payment settings could not be updated.",
        );
    } finally {
      lock.current = false;
      if (current.current === scope) setBusy("");
    }
  };
  useEffect(() => {
    if (!returned || handled.current || !user) return;
    handled.current = true;
    setParams({ venue: venueId }, { replace: true });
    if (returned.error) {
      setError(
        "Square connection was canceled. You can connect again when ready.",
      );
      return;
    }
    void act(
      "provider_complete",
      { code: returned.code, state: returned.state },
      "Square account connected. Select its payment location, then choose whether to use it at the desk.",
    );
  }, [returned, user, venueId]);
  const chooseLocation = async (c: ProviderConnection) => {
    if (lock.current) return;
    lock.current = true;
    setBusy("locations");
    setError("");
    try {
      const result = await paymentApi<{ locations: typeof locations }>(
        "provider_locations",
        { venue_id: venueId, connection_id: c.id },
      );
      if (current.current !== scope) return;
      setLocations(result.locations);
      setLocation(c.location_id || "");
      setSelected(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy("");
    }
  };
  const w = query.data;
  return (
    <section className="space-y-6" aria-label="Payment connections">
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Payment connections
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Your business. Your payment provider.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Keep venue purchases, player records and refunds together. Choose
              a supported account for each payment channel.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!!busy || query.isFetching}
            onClick={() => query.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh connections
          </Button>
        </div>
        {w && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              [
                "Online reservations",
                "Stripe",
                "Court reservations and paid event registration",
              ],
              [
                "Front-desk payments",
                providerName(w.desk_provider),
                "Purchases, walk-ins and booking deposits",
              ],
              [
                "Cash",
                "Recorded at the desk",
                "Separate cash reconciliation and refunds",
              ],
            ].map(([label, value, detail]) => (
              <div key={label} className="rounded-xl bg-muted/40 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold">{value}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Monthly memberships and PULSE add-on subscriptions use Stripe.
          Changing the desk default applies to new one-time payments; previous
          purchases keep their original provider.
        </p>
      </div>
      {query.isPending && <p role="status">Loading payment connections…</p>}
      {(error || query.isError) && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          {error ||
            (query.error as Error)?.message ||
            "Could not load payment connections."}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl border bg-muted/30 p-4 text-sm">
          {message}
        </p>
      )}
      {w && (
        <div className="grid gap-4 lg:grid-cols-2">
          {paymentProviders.map((provider) => {
            const c =
              w.connections.find(
                (c) => c.provider === provider.id && c.livemode,
              ) || w.connections.find((c) => c.provider === provider.id);
            const ownershipReview = !!c && c.connected_by !== user?.id;
            const connected =
              provider.id === "stripe"
                ? w.stripe_connected
                : !!c && !ownershipReview && c.status === "connected";
            const planned = provider.availability === "planned";
            const requested = w.requests.includes(provider.id);
            const status = planned
              ? "Not yet available"
              : ownershipReview
                ? "Ownership review needed"
                : c && !c.livemode
                  ? "Test connection"
                  : connected
                    ? "Connected"
                    : c?.status === "paused"
                      ? "Paused"
                      : c
                        ? "Needs attention"
                        : provider.id === "square" && !w.square_available
                          ? "Platform setup needed"
                          : "Not connected";
            return (
              <article
                key={provider.id}
                className="flex min-w-0 flex-col rounded-2xl border bg-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{provider.name}</h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                    {connected && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {status}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {provider.description}
                </p>
                {!!provider.capabilities.length && (
                  <ul
                    className="mt-3 flex flex-wrap gap-2"
                    aria-label={`${provider.name} capabilities`}
                  >
                    {provider.capabilities.map((label) => (
                      <li
                        key={label}
                        className="rounded-md bg-muted/50 px-2 py-1 text-xs"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
                {c && (
                  <div className="mt-4 rounded-xl bg-muted/30 p-3 text-sm">
                    <p className="font-medium">{c.merchant_name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {c.location_name || "Choose a payment location"}
                    </p>
                  </div>
                )}
                {ownershipReview && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    This account belongs to a previous venue owner. Contact
                    PULSE to arrange a financial account transfer.
                  </p>
                )}
                {provider.id === "square" && w.square_issue && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {w.square_issue}
                  </p>
                )}
                {provider.id === "square" && (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    This connection supports checkout links and QR codes. Square
                    terminal pairing and online self-service bookings are not
                    enabled in this release.
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  {provider.id === "stripe" ? (
                    <>
                      <Button variant="outline" onClick={onStripe}>
                        Manage Stripe & policies
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>
                      {w.desk_provider !== "stripe" && (
                        <Button
                          variant="outline"
                          disabled={!!busy || !w.stripe_connected}
                          onClick={() =>
                            act(
                              "provider_set_desk",
                              { provider: "stripe" },
                              "New desk payments will use Stripe. Existing Square purchases remain with Square.",
                            )
                          }
                        >
                          Use at front desk
                        </Button>
                      )}
                    </>
                  ) : provider.id === "square" ? (
                    <>
                      <Button
                        disabled={
                          !!busy || !w.square_available || ownershipReview
                        }
                        variant={c ? "outline" : "default"}
                        onClick={() => act("provider_connect")}
                      >
                        {busy === "provider_connect" && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {c ? "Reconnect Square" : "Connect Square"}
                      </Button>
                      {c && !ownershipReview && (
                        <>
                          <Button
                            variant="outline"
                            disabled={!!busy}
                            onClick={() => chooseLocation(c)}
                          >
                            Choose location
                          </Button>
                          <Button
                            variant="outline"
                            disabled={!!busy}
                            onClick={() =>
                              act(
                                "provider_check",
                                { connection_id: c.id },
                                "Square location verified and enabled for new collections.",
                              )
                            }
                          >
                            {c.status === "paused"
                              ? "Resume collections"
                              : "Verify connection"}
                          </Button>
                          {connected &&
                            c.livemode &&
                            w.desk_provider !== "square" && (
                              <Button
                                disabled={!!busy}
                                onClick={() =>
                                  act(
                                    "provider_set_desk",
                                    { provider: "square" },
                                    "New one-time desk payments will use Square.",
                                  )
                                }
                              >
                                Use at front desk
                              </Button>
                            )}
                          {connected && (
                            <Button
                              variant="outline"
                              disabled={!!busy}
                              onClick={() =>
                                act(
                                  "provider_pause",
                                  { connection_id: c.id, confirm: true },
                                  "New Square collections paused. Historical refunds and payment recovery remain available.",
                                )
                              }
                            >
                              Pause collections
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={!!busy || requested}
                      onClick={() =>
                        act(
                          "provider_request",
                          { provider: provider.id },
                          `${provider.name} interest saved for this venue.`,
                        )
                      }
                    >
                      {requested ? "Interest recorded" : "I use this provider"}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Square payment location</DialogTitle>
            <DialogDescription>
              Payments are collected by this Square business at the selected
              location.
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm font-medium" htmlFor="square-location">
            Location
          </label>
          <select
            id="square-location"
            className="h-11 w-full rounded-xl border bg-background px-3"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">Select location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} · {l.country}
              </option>
            ))}
          </select>
          {!locations.length && (
            <p role="status" className="text-sm">
              No active USD card-processing locations were found. Complete
              location setup in Square, then try again.
            </p>
          )}
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button
            disabled={!location || !!busy}
            onClick={async () => {
              const result = await act(
                "provider_location",
                { connection_id: selected?.id, location_id: location },
                "Payment location saved. You can now select Square for front-desk checkout.",
              );
              if (result) setSelected(null);
            }}
          >
            Save payment location
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
