import { VenueAdminSubnav } from "@/components/venue/VenueAdminSubnav";
import { VenueAdminPageHeader } from "@/components/venue/VenueAdminPageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ShoppingBag, Package, Wallet, Plus } from "lucide-react";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  venueRpc as rpc,
  venueDate,
  type VenueCustomer,
} from "@/lib/venues/customerRecords";
import {
  PRODUCT_KINDS,
  localVenueDay,
  priceCents,
  type DeskWorkspace,
  type VenueProduct,
  type VenueSale,
  type VenueEntitlement,
} from "@/lib/venues/deskSales";
import { formatMoney, paymentApi } from "@/lib/payments";
import { VenueDeskFollowup } from "@/components/venue/VenueDeskFollowup";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
export default function VenueDesk() {
  const { groupId = "" } = useParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const client = useQueryClient();
  const venue = group?.venue_id;
  const timezone = group?.venue?.timezone || "America/New_York";
  const today = localVenueDay(timezone);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "sales";
  const customer = params.get("player") || "";
  const [day, setDay] = useState(params.get("day") || today),
    [search, setSearch] = useState(""),
    [product, setProduct] = useState(""),
    [quantity, setQuantity] = useState(1),
    [method, setMethod] = useState<"cash" | "stripe">("stripe");
  const [editing, setEditing] = useState<VenueProduct | true | null>(null),
    [refund, setRefund] = useState<VenueSale | null>(null),
    [redeem, setRedeem] = useState<VenueEntitlement | null>(null);
  const [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [checkout, setCheckout] = useState(""),
    [closing, setClosing] = useState(false);
  const [request, setRequest] = useState(() => crypto.randomUUID());
  useEffect(() => {
    setDay(params.get("day") || today);
  }, [today]);
  useEffect(() => {
    setRequest(crypto.randomUUID());
    setCheckout("");
  }, [customer, product, quantity, method]);
  const q = useQuery({
    queryKey: ["venue-desk", venue, user?.id, day, customer],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<DeskWorkspace>("venue_desk_workspace", {
        p_venue: venue,
        p_day: day,
        p_customer: customer || null,
      }),
    refetchInterval: working ? false : 15000,
  });
  const players = useQuery({
    queryKey: ["venue-customers", venue, user?.id, search, 0],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<{ players: VenueCustomer[] }>("venue_customer_directory", {
        p_venue: venue,
        p_search: search,
        p_page: 0,
      }),
  });
  const chosen = q.data?.products.find((p) => p.id === product);
  const total = (chosen?.price_cents || 0) * quantity;
  const w = q.data;
  const canWrite = !!w && !q.isError && !working;
  async function act(fn: () => Promise<void>) {
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await Promise.all(
        ["venue-desk", "venue-customer"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Action could not be completed.",
      );
    } finally {
      setWorking(false);
    }
  }
  const setTab = (next: string) =>
    setParams({ tab: next, ...(customer ? { player: customer } : {}) });
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <VenueAdminPageHeader
        title="Front desk & memberships"
        description="Sell passes, manage member benefits and reconcile your cash day."
      >
        <Button asChild variant="outline"><Link to={`/player/community/group/${groupId}/players`}>Player directory</Link></Button>
      </VenueAdminPageHeader>
      <VenueAdminSubnav
        label="Front desk"
        value={tab}
        onChange={setTab}
        items={[
          { value: "sales", label: "Sales", icon: ShoppingBag },
          { value: "catalog", label: "Products & memberships", icon: Package },
          { value: "cash", label: "Cash reconciliation", icon: Wallet },
        ]}
      />
      {(error || q.error || players.error) && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          {error || q.error?.message || players.error?.message}
          <Button
            variant="link"
            onClick={() => {
              void q.refetch();
              void players.refetch();
            }}
          >
            Retry
          </Button>
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {notice}
        </p>
      )}
      {q.isPending ? (
        <p role="status">Opening front desk…</p>
      ) : w && !q.isError ? (
        <>
          {tab === "catalog" ? (
            <section className="space-y-4">
              <div className="flex flex-wrap justify-between gap-3">
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Memberships can renew monthly through Stripe. One-time passes
                  work with cash or card. Court-hour packs use hours; lesson and
                  visit passes use sessions.
                </p>
                {w.can_manage && (
                  <Button onClick={() => setEditing(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add product
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {w.products.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-2xl border bg-card p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {PRODUCT_KINDS[p.kind]}
                      {!p.active ? " · Archived" : ""}
                    </p>
                    <h2 className="mt-2 text-lg font-bold">{p.name}</h2>
                    <p className="mt-3 text-2xl font-bold">
                      {formatMoney(p.price_cents)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {p.billing_cadence === "monthly" ? " / month" : ""}
                      </span>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {p.description}
                    </p>
                    <p className="mt-3 text-sm">
                      {p.kind === "membership"
                        ? `${p.member_discount_percent}% member court discount`
                        : p.kind === "merchandise" ||
                            p.kind === "equipment_rental"
                          ? p.stock === null
                            ? "Unlimited stock"
                            : `${p.stock} in stock`
                          : `${p.units} ${
                              p.kind === "court_hours"
                                ? "court hours"
                                : "visits / lessons"
                            }`}
                    </p>
                    {!["merchandise", "equipment_rental"].includes(p.kind) && (
                      <p className="text-xs text-muted-foreground">
                        {p.billing_cadence === "monthly"
                          ? "Benefits follow the paid billing period"
                          : `Valid ${p.valid_days} days from purchase`}
                      </p>
                    )}
                    {w.can_manage && (
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => setEditing(p)}
                      >
                        Edit product
                      </Button>
                    )}
                  </article>
                ))}
              </div>
              {!w.products.length && (
                <Empty>
                  No products yet. Add your venue’s membership plans, passes or
                  shop items.
                </Empty>
              )}
            </section>
          ) : tab === "cash" ? (
            <section className="space-y-4">
              <label className="block max-w-xs text-sm">
                Cash day · {timezone}
                <Input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  max={today}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Cash collected", w.cash_collected_cents],
                  ["Cash returned", w.cash_refunded_cents],
                  ["Expected net cash", w.cash_expected_cents],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border bg-card p-5">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <strong className="text-2xl">
                      {formatMoney(Number(value))}
                    </strong>
                  </div>
                ))}
              </div>
              {w.closing ? (
                <article className="rounded-2xl border bg-card p-5">
                  <h2 className="font-bold">Cash day closed</h2>
                  <p>
                    Counted {formatMoney(w.closing.counted_cents)} · Difference{" "}
                    {formatMoney(
                      w.closing.counted_cents - w.closing.expected_cents,
                    )}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {w.closing.note}
                  </p>
                </article>
              ) : w.can_manage ? (
                <Button onClick={() => setClosing(true)}>Close cash day</Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A venue manager closes the cash day.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Compare cash from sales minus cash returned. Exclude the opening
                float and unrelated cash movements.
              </p>
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]">
              <section className="space-y-4">
                <form
                  className="space-y-4 rounded-2xl border bg-card p-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chosen || !customer) return;
                    void act(async () => {
                      if (method === "cash") {
                        await rpc("venue_cash_sale", {
                          p_customer: customer,
                          p_product: product,
                          p_quantity: quantity,
                          p_expected: total,
                          p_request: request,
                          p_cash_received:
                            new FormData(e.currentTarget).get("confirmed") ===
                            "on",
                        });
                        setNotice(
                          "Cash payment recorded and player benefits issued.",
                        );
                        setRequest(crypto.randomUUID());
                      } else {
                        const result = await paymentApi<{ url: string }>(
                          "venue_sale_checkout",
                          {
                            customer_id: customer,
                            product_id: product,
                            quantity,
                            amount_cents: total,
                            request_key: request,
                            accept_terms: true,
                          },
                        );
                        setCheckout(result.url);
                        setNotice(
                          "Checkout is ready. The player pays on their own device.",
                        );
                      }
                    });
                  }}
                >
                  <h2 className="text-lg font-bold">New sale</h2>
                  <label className="block text-sm">
                    Find a player
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, email or phone"
                    />
                  </label>
                  <label className="block text-sm">
                    Player
                    <select
                      required
                      className={selectClass}
                      value={customer}
                      onChange={(e) =>
                        setParams({ tab, player: e.target.value })
                      }
                    >
                      <option value="">Choose player</option>
                      {players.data?.players.slice(0, 50).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                          {p.user_id ? "" : " (guest)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Product
                    <select
                      required
                      className={selectClass}
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                    >
                      <option value="">Choose product</option>
                      {w.products
                        .filter((p) => p.active)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {formatMoney(p.price_cents)}
                            {p.billing_cadence === "monthly" ? " / month" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Quantity
                    <Input
                      type="number"
                      min={1}
                      max={chosen?.kind === "membership" ? 1 : 100}
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                  <label className="block text-sm">
                    Payment method
                    <select
                      className={selectClass}
                      value={method}
                      onChange={(e) =>
                        setMethod(e.target.value as "cash" | "stripe")
                      }
                    >
                      <option value="stripe">Stripe checkout link / QR</option>
                      <option
                        value="cash"
                        disabled={chosen?.billing_cadence === "monthly"}
                      >
                        Cash received at the desk
                      </option>
                    </select>
                  </label>
                  <p className="text-2xl font-bold">
                    {formatMoney(total)}
                    {chosen?.billing_cadence === "monthly" && (
                      <span className="text-sm font-normal">
                        {" "}
                        / month until canceled
                      </span>
                    )}
                  </p>
                  {w.policy && (
                    <p className="whitespace-pre-wrap rounded-xl border p-3 text-sm">
                      {w.policy}
                    </p>
                  )}
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      key={`${method}-${request}`}
                      type="checkbox"
                      name="confirmed"
                      required
                      className="mt-1"
                    />
                    {method === "cash"
                      ? "I have received this cash amount."
                      : "I reviewed the total and venue policy with the player. They will complete payment in Stripe."}
                  </label>
                  <Button
                    type="submit"
                    disabled={
                      !canWrite ||
                      !customer ||
                      !chosen ||
                      players.isError ||
                      (method === "cash" && !!w.closing)
                    }
                  >
                    {working
                      ? "Preparing…"
                      : method === "cash"
                        ? "Record cash payment"
                        : "Create checkout"}
                  </Button>
                </form>
                {checkout && (
                  <article className="rounded-2xl border bg-card p-5">
                    <h3 className="font-semibold">Ready for the player</h3>
                    <div className="my-4 inline-block rounded-xl bg-white p-4">
                      <QRCodeSVG value={checkout} size={190} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Benefits activate after payment is confirmed.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(checkout)
                          .then(() => setNotice("Checkout link copied."))
                          .catch(() =>
                            setError("Could not copy. Use the QR code."),
                          )
                      }
                    >
                      Copy checkout link
                    </Button>
                  </article>
                )}
                {customer && (
                  <article className="space-y-3 rounded-2xl border bg-card p-5">
                    <h3 className="font-semibold">
                      Player memberships & passes
                    </h3>
                    {w.entitlements.length ? (
                      w.entitlements.map((e) => (
                        <div key={e.id} className="border-t pt-3">
                          <p className="font-medium">{e.name}</p>
                          <p className="text-sm">
                            {e.revoked_at
                              ? "Revoked"
                              : new Date(e.expires_at) <= new Date()
                                ? "Expired"
                                : e.kind === "membership"
                                  ? "Active membership"
                                  : `${e.remaining_units} of ${e.total_units} ${
                                      e.kind === "court_hours"
                                        ? "hours"
                                        : "uses"
                                    } left`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {venueDate(e.expires_at, timezone)}
                          </p>
                          {e.kind !== "membership" &&
                            !e.revoked_at &&
                            e.remaining_units > 0 &&
                            new Date(e.expires_at) > new Date() && (
                              <Button
                                className="mt-2"
                                variant="outline"
                                onClick={() => setRedeem(e)}
                              >
                                Record use
                              </Button>
                            )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No passes or memberships purchased yet.
                      </p>
                    )}
                  </article>
                )}
              </section>
              <section className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-lg font-bold">Sales</h2>
                  <label className="text-sm">
                    Venue day
                    <Input
                      type="date"
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                    />
                  </label>
                </div>
                {customer && (
                  <Button variant="link" onClick={() => setParams({ tab })}>
                    Show all players’ sales
                  </Button>
                )}
                {w.sales.length ? (
                  w.sales.map((s) => (
                    <article
                      key={s.id}
                      className="rounded-2xl border bg-card p-5"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">
                            {s.product_name} × {s.quantity}
                          </h3>
                          <p className="text-sm">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {venueDate(s.created_at, timezone)} ·{" "}
                            {s.method === "cash" ? "Cash" : "Stripe"} ·{" "}
                            {s.status.replace(/_/g, " ")}
                          </p>
                        </div>
                        <strong>
                          {formatMoney(s.amount_cents - s.refunded_cents)}
                        </strong>
                      </div>
                      {s.needs_refund_review && (
                        <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                          Canceled visit: owner payment review required.
                        </p>
                      )}
                      {s.refunded_cents > 0 && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatMoney(s.refunded_cents)} returned
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a
                          href={`/venue-payment/${s.receipt_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            Receipt
                          </Button>
                        </a>
                        {s.method === "stripe" && (
                          <Button
                            disabled={!canWrite}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void act(async () => {
                                await paymentApi("venue_sale_reconcile", {
                                  sale_id: s.id,
                                });
                                setNotice("Payment status refreshed.");
                              })
                            }
                          >
                            Refresh payment
                          </Button>
                        )}
                        {s.status === "pending" && s.method === "stripe" && (
                          <>
                            <Button
                              disabled={!canWrite}
                              size="sm"
                              onClick={() =>
                                void act(async () => {
                                  const r = await paymentApi<{ url: string }>(
                                    "venue_sale_resume",
                                    { sale_id: s.id },
                                  );
                                  setCheckout(r.url);
                                })
                              }
                            >
                              Show checkout
                            </Button>
                            <Button
                              disabled={!canWrite}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void act(async () => {
                                  await paymentApi("venue_sale_cancel", {
                                    sale_id: s.id,
                                  });
                                  setNotice("Checkout cancellation processed.");
                                })
                              }
                            >
                              Cancel checkout
                            </Button>
                          </>
                        )}
                        {w.is_owner &&
                          ["paid", "partially_refunded"].includes(s.status) && (
                            <Button
                              disabled={!canWrite}
                              size="sm"
                              variant="outline"
                              onClick={() => setRefund(s)}
                            >
                              Refund
                            </Button>
                          )}
                      </div>
                    </article>
                  ))
                ) : (
                  <Empty>
                    No sales for this day{customer ? " and player" : ""}.
                  </Empty>
                )}
                <p className="text-xs text-muted-foreground">
                  Showing up to 500 sales for the selected venue day.
                </p>
              </section>
            </div>
          )}
        </>
      ) : null}
      {w && !q.isError && tab === "sales" && (
        <VenueDeskFollowup workspace={w} onChanged={() => void q.refetch()} />
      )}
      <ProductEditor
        value={editing}
        working={working}
        error={error}
        onClose={() => !working && setEditing(null)}
        onSave={(doc) =>
          void act(async () => {
            await rpc("venue_product_save", {
              p_venue: venue,
              p_id: editing && editing !== true ? editing.id : null,
              p_expected:
                editing && editing !== true ? editing.updated_at : null,
              p_document: doc,
            });
            setEditing(null);
            setNotice(
              "Product saved. Existing purchases retain their original benefits and price.",
            );
          })
        }
      />
      <DeskAction
        title="Refund purchase"
        description={
          refund
            ? `${refund.product_name} · ${formatMoney(
                refund.amount_cents - refund.refunded_cents,
              )} refundable. A full refund revokes the associated membership or pass.`
            : ""
        }
        open={!!refund}
        close={() => !working && setRefund(null)}
        working={working}
        error={error}
        onSubmit={(data) =>
          void act(async () => {
            if (!refund) return;
            const amount = priceCents(data.get("amount"));
            const req = String(data.get("request"));
            if (refund.method === "cash")
              await rpc("venue_cash_refund", {
                p_sale: refund.id,
                p_amount: amount,
                p_reason: data.get("reason"),
                p_request: req,
                p_cash_returned: data.get("confirm") === "on",
              });
            else
              await paymentApi("venue_sale_refund", {
                sale_id: refund.id,
                amount_cents: amount,
                request_key: req,
                confirm_refund: data.get("confirm") === "on",
              });
            setRefund(null);
            setNotice(
              "Refund recorded. Card refunds may require processing time; refresh the payment for the final result.",
            );
          })
        }
      >
        {refund && (
          <>
            <label className="block text-sm">
              Refund amount ($)
              <Input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                max={(refund.amount_cents - refund.refunded_cents) / 100}
                defaultValue={(
                  (refund.amount_cents - refund.refunded_cents) /
                  100
                ).toFixed(2)}
                required
              />
            </label>
            <label className="block text-sm">
              Reason
              <Textarea name="reason" required minLength={5} maxLength={1000} />
            </label>
            <label className="flex gap-2 text-sm">
              <input name="confirm" type="checkbox" required />
              {refund.method === "cash"
                ? "I have returned this cash to the player."
                : "Issue this refund to the original card payment."}
            </label>
          </>
        )}
      </DeskAction>
      <DeskAction
        title="Record pass use"
        description={
          redeem
            ? `${redeem.name} · ${redeem.remaining_units} units available`
            : ""
        }
        open={!!redeem}
        close={() => !working && setRedeem(null)}
        working={working}
        error={error}
        onSubmit={(data) =>
          void act(async () => {
            if (!redeem) return;
            await rpc("venue_use_entitlement", {
              p_entitlement: redeem.id,
              p_units: Number(data.get("units")),
              p_request: data.get("request"),
              p_description: data.get("description"),
            });
            setRedeem(null);
            setNotice("Pass use recorded.");
          })
        }
      >
        <label className="block text-sm">
          Units used
          <Input
            name="units"
            type="number"
            min={redeem?.kind === "court_hours" ? 0.5 : 1}
            step={redeem?.kind === "court_hours" ? 0.5 : 1}
            max={redeem?.remaining_units}
            defaultValue={1}
            required
          />
        </label>
        <label className="block text-sm">
          Visit or booking reference
          <Input name="description" required minLength={3} maxLength={500} />
        </label>
      </DeskAction>
      <DeskAction
        title="Close cash day"
        description="Record the final net cash count for this venue day. Additional cash entries for a closed day are blocked."
        open={closing}
        close={() => !working && setClosing(false)}
        working={working}
        error={error}
        onSubmit={(data) =>
          void act(async () => {
            await rpc("venue_cash_close", {
              p_venue: venue,
              p_day: day,
              p_expected: w?.cash_expected_cents,
              p_counted: priceCents(data.get("counted")),
              p_note: data.get("note"),
            });
            setClosing(false);
            setNotice("Cash day closed with the recorded count.");
          })
        }
      >
        <label className="block text-sm">
          Counted cash from sales ($)
          <Input name="counted" type="number" min="0" step="0.01" required />
        </label>
        <label className="block text-sm">
          Reconciliation note
          <Textarea name="note" maxLength={2000} />
        </label>
      </DeskAction>
    </main>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
function DeskAction({
  title,
  description,
  open,
  close,
  working,
  error,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  close: () => void;
  working: boolean;
  error: string;
  onSubmit: (data: FormData) => void;
  children: React.ReactNode;
}) {
  const request = useMemo(() => crypto.randomUUID(), [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}
        >
          <input name="request" type="hidden" value={request} />
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={working}>
            {working ? "Saving…" : "Confirm"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function ProductEditor({
  value,
  working,
  error,
  onClose,
  onSave,
}: {
  value: VenueProduct | true | null;
  working: boolean;
  error: string;
  onClose: () => void;
  onSave: (doc: Record<string, unknown>) => void;
}) {
  const p = value && value !== true ? value : null;
  const [kind, setKind] = useState<string>("membership"),
    [issue, setIssue] = useState("");
  useEffect(() => {
    setKind(p?.kind || "membership");
    setIssue("");
  }, [value]);
  return (
    <Dialog open={!!value} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{p ? "Edit product" : "Create product"}</DialogTitle>
          <DialogDescription>
            Prices are in USD and include any applicable taxes. Existing
            purchases keep their original terms.
          </DialogDescription>
        </DialogHeader>
        {value && (
          <form
            key={p?.id || "new"}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setIssue("");
              const f = new FormData(e.currentTarget);
              try {
                onSave({
                  name: f.get("name"),
                  description: f.get("description"),
                  kind,
                  price_cents: priceCents(f.get("price")),
                  billing_cadence:
                    kind === "membership" ? f.get("cadence") : "one_time",
                  units:
                    kind === "membership" ? 1 : Number(f.get("units") || 1),
                  valid_days: Number(f.get("days") || 30),
                  member_discount_percent:
                    kind === "membership" ? Number(f.get("discount") || 0) : 0,
                  stock:
                    ["merchandise", "equipment_rental"].includes(kind) &&
                    f.get("stock") !== ""
                      ? Number(f.get("stock"))
                      : null,
                  active: f.get("active") === "on",
                  tax_inclusive_acknowledged: f.get("tax") === "on",
                });
              } catch (e) {
                setIssue(
                  e instanceof Error ? e.message : "Check the product fields.",
                );
              }
            }}
          >
            <label className="block text-sm">
              Name
              <Input
                name="name"
                defaultValue={p?.name || ""}
                required
                maxLength={150}
              />
            </label>
            <label className="block text-sm">
              Type
              <select
                className={selectClass}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {Object.entries(PRODUCT_KINDS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Description
              <Textarea
                name="description"
                defaultValue={p?.description || ""}
                maxLength={4000}
              />
            </label>
            <label className="block text-sm">
              Price ($)
              <Input
                name="price"
                type="number"
                min="1"
                max="999999.99"
                step="0.01"
                defaultValue={p ? (p.price_cents / 100).toFixed(2) : ""}
                required
              />
            </label>
            {kind === "membership" ? (
              <>
                <label className="block text-sm">
                  Billing
                  <select
                    className={selectClass}
                    name="cadence"
                    defaultValue={p?.billing_cadence || "one_time"}
                  >
                    <option value="one_time">One-time membership</option>
                    <option value="monthly">
                      Automatic monthly renewal through Stripe
                    </option>
                  </select>
                </label>
                <label className="block text-sm">
                  Member court discount (%)
                  <Input
                    name="discount"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={p?.member_discount_percent || 0}
                  />
                </label>
              </>
            ) : (
              !["merchandise", "equipment_rental"].includes(kind) && (
                <label className="block text-sm">
                  {kind === "court_hours"
                    ? "Court hours included"
                    : "Visits / lessons included"}
                  <Input
                    name="units"
                    type="number"
                    min={1}
                    max={10000}
                    defaultValue={p?.units || 1}
                    required
                  />
                </label>
              )
            )}
            {["merchandise", "equipment_rental"].includes(kind) ? (
              <label className="block text-sm">
                Available stock (blank for unlimited)
                <Input
                  name="stock"
                  type="number"
                  min={0}
                  defaultValue={p?.stock ?? ""}
                />
              </label>
            ) : (
              <label className="block text-sm">
                Validity for one-time purchases (days)
                <Input
                  name="days"
                  type="number"
                  min={1}
                  max={3660}
                  defaultValue={p?.valid_days || 30}
                  required
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                name="active"
                type="checkbox"
                defaultChecked={p?.active ?? true}
              />
              Available for sale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="tax" type="checkbox" required />
              Price includes any applicable taxes.
            </label>
            {(error || issue) && (
              <p role="alert" className="text-sm text-destructive">
                {issue || error}
              </p>
            )}
            <Button type="submit" disabled={working}>
              {working ? "Saving…" : "Save product"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
