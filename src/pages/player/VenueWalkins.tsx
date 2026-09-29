import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import { QRCodeSVG } from "qrcode.react";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import {
  venueRpc as rpc,
  venueDate,
  type VenueCustomer,
} from "@/lib/venues/customerRecords";
import { localVenueDay, type DeskWorkspace } from "@/lib/venues/deskSales";
import { paymentApi, formatMoney } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface WalkinVisit {
  id: string;
  customer_id: string;
  event_id: string | null;
  court_id: string | null;
  title: string;
  first_name: string;
  last_name: string;
  start_time: string;
  end_time: string;
  status: string;
  method: string;
  amount_cents: number;
  version: number;
  missing_documents: number;
  canceled_reason: string | null;
}
interface WalkinDay {
  timezone: string;
  visits: WalkinVisit[];
  events: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    price_cents: number;
  }[];
  courts: { id: string; name: string }[];
}
const selectClass = "h-11 w-full rounded-md border bg-background px-3 text-sm";
export default function VenueWalkins() {
  const { groupId = "" } = useParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const client = useQueryClient();
  const venue = group?.venue_id,
    tz = group?.venue?.timezone || "America/New_York";
  const [params, setParams] = useSearchParams();
  const day = params.get("day") || localVenueDay(tz),
    customer = params.get("player") || "";
  const [kind, setKind] = useState(params.get("court") ? "court" : "event"),
    [event, setEvent] = useState(params.get("event") || ""),
    [court, setCourt] = useState(params.get("court") || "");
  const [start, setStart] = useState(params.get("start") || `${day}T09:00`),
    [duration, setDuration] = useState(Number(params.get("minutes")) || 60),
    [method, setMethod] = useState("stripe"),
    [entitlement, setEntitlement] = useState(""),
    [search, setSearch] = useState("");
  const [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [checkout, setCheckout] = useState(""),
    [cancel, setCancel] = useState<WalkinVisit | null>(null);
  const [request, setRequest] = useState(() => crypto.randomUUID());
  useEffect(() => {
    setRequest(crypto.randomUUID());
    setCheckout("");
  }, [kind, event, court, start, duration, customer, method, entitlement]);
  const q = useQuery({
    queryKey: ["venue-walkins", venue, user?.id, day],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<WalkinDay>("venue_walkin_day", { p_venue: venue, p_day: day }),
    refetchInterval: working ? false : 15000,
  });
  const directory = useQuery({
    queryKey: ["venue-customers", venue, user?.id, search, 0],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<{ players: VenueCustomer[] }>("venue_customer_directory", {
        p_venue: venue,
        p_search: search,
        p_page: 0,
      }),
  });
  const passes = useQuery({
    queryKey: ["venue-desk", venue, user?.id, day, customer],
    enabled: !!venue && !!user && !!customer,
    queryFn: () =>
      rpc<DeskWorkspace>("venue_desk_workspace", {
        p_venue: venue,
        p_day: day,
        p_customer: customer,
      }),
  });
  const times = useMemo(() => {
    const d = fromZonedTime(start, tz);
    return Number.isNaN(d.getTime())
      ? { start_time: null, end_time: null }
      : {
          start_time: d.toISOString(),
          end_time: new Date(d.getTime() + duration * 60000).toISOString(),
        };
  }, [start, duration, tz]);
  const args = {
    p_customer: customer,
    p_event: kind === "event" ? event : null,
    p_court: kind === "court" ? court : null,
    p_start: kind === "court" ? times.start_time : null,
    p_end: kind === "court" ? times.end_time : null,
  };
  const quote = useQuery({
    queryKey: ["venue-walkin-quote", user?.id, args],
    enabled:
      !!customer && !!(kind === "event" ? event : court && times.start_time),
    queryFn: () =>
      rpc<{
        amount_cents: number;
        policy: string;
        title: string;
        start_time: string;
        end_time: string;
      }>("venue_walkin_quote", args),
    retry: false,
    staleTime: 0,
  });
  const cost = quote.data?.amount_cents;
  const payment = cost === 0 ? "free" : method;
  async function act(fn: () => Promise<void>) {
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await Promise.all(
        [
          "venue-walkins",
          "venue-desk",
          "venue-customer",
          "venue-attendance",
          "venue-day",
          "venue-program",
          "venue-program-roster",
          "venue-walkin-quote",
        ].map((k) => client.invalidateQueries({ queryKey: [k] }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the visit.");
    } finally {
      setWorking(false);
    }
  }
  const p = q.data;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {group?.venue?.name || group?.name}
          </p>
          <h1 className="text-2xl font-bold">Walk-ins & visits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register guests, reserve their space and keep the day’s attendance
            current.
          </p>
        </div>
        <Link to={`/player/community/group/${groupId}/ops?day=${day}`}>
          <Button variant="outline">Open operations calendar</Button>
        </Link>
      </header>
      {(error || q.error || directory.error) && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm"
        >
          {error || q.error?.message || directory.error?.message}
          <Button variant="link" onClick={() => void q.refetch()}>
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
        <p role="status">Loading venue visits…</p>
      ) : p && !q.isError ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,410px)_minmax(0,1fr)]">
          <section className="space-y-4">
            <form
              className="space-y-4 rounded-2xl border bg-card p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const confirmed =
                  new FormData(e.currentTarget).get("confirmed") === "on";
                void act(async () => {
                  if (!quote.data || quote.isError || quote.isFetching)
                    throw new Error("Refresh and review the visit total.");
                  if (payment === "stripe") {
                    const result = await paymentApi<{ url: string }>(
                      "venue_walkin_checkout",
                      {
                        customer_id: customer,
                        event_id: args.p_event,
                        court_id: args.p_court,
                        start_time: args.p_start,
                        end_time: args.p_end,
                        amount_cents: cost,
                        request_key: request,
                        accept_terms: confirmed,
                      }
                    );
                    setCheckout(result.url);
                    setNotice(
                      "Space is held while the player completes checkout."
                    );
                  } else {
                    await rpc("venue_walkin_book", {
                      ...args,
                      p_method: payment,
                      p_entitlement: payment === "pass" ? entitlement : null,
                      p_expected: cost,
                      p_request: request,
                      p_cash_received: payment === "cash" && confirmed,
                    });
                    setNotice(
                      "Visit booked. Complete required documents, then check the player in."
                    );
                    setRequest(crypto.randomUUID());
                  }
                });
              }}
            >
              <h2 className="text-lg font-bold">Add a visit</h2>
              <label className="block text-sm">
                Search venue players
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email or phone"
                />
              </label>
              <label className="block text-sm">
                Player
                <select
                  className={selectClass}
                  required
                  value={customer}
                  onChange={(e) =>
                    setParams({
                      ...Object.fromEntries(params),
                      player: e.target.value,
                    })
                  }
                >
                  <option value="">Choose player or guest</option>
                  {directory.data?.players.slice(0, 50).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.user_id ? "" : " (guest)"}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                className="inline-block text-sm underline"
                to={`/player/community/group/${groupId}/players`}
              >
                Add a new guest or update contact details
              </Link>
              <label className="block text-sm">
                Visit type
                <select
                  className={selectClass}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="event">Join a scheduled event</option>
                  <option value="court">Reserve a court</option>
                </select>
              </label>
              {kind === "event" ? (
                <label className="block text-sm">
                  Event
                  <select
                    className={selectClass}
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    required
                  >
                    <option value="">Choose an event for {day}</option>
                    {p.events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} · {venueDate(ev.start_time, tz)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="block text-sm">
                    Court
                    <select
                      required
                      className={selectClass}
                      value={court}
                      onChange={(e) => setCourt(e.target.value)}
                    >
                      <option value="">Choose court</option>
                      {p.courts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Start · {tz}
                    <Input
                      type="datetime-local"
                      required
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      step={1800}
                    />
                  </label>
                  <label className="block text-sm">
                    Duration (minutes)
                    <Input
                      required
                      type="number"
                      min={30}
                      max={240}
                      step={30}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    />
                  </label>
                </>
              )}
              {quote.isFetching ? (
                <p role="status" className="text-sm">
                  Checking space and price…
                </p>
              ) : quote.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {quote.error.message}
                </p>
              ) : (
                quote.data && (
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="font-semibold">{quote.data.title}</p>
                    <p className="text-sm">
                      {venueDate(quote.data.start_time, tz)}–
                      {new Intl.DateTimeFormat("en-US", {
                        timeZone: tz,
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(quote.data.end_time))}
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {cost === 0 ? "Free" : formatMoney(cost || 0)}
                    </p>
                  </div>
                )
              )}
              {cost !== 0 && (
                <label className="block text-sm">
                  Payment
                  <select
                    className={selectClass}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="stripe">Stripe checkout link / QR</option>
                    <option value="cash">Cash received</option>
                    <option value="pass">Use a prepaid pass</option>
                  </select>
                </label>
              )}
              {payment === "pass" && (
                <label className="block text-sm">
                  Player pass
                  <select
                    className={selectClass}
                    value={entitlement}
                    onChange={(e) => setEntitlement(e.target.value)}
                    required
                  >
                    <option value="">Choose an eligible pass</option>
                    {passes.data?.entitlements
                      .filter(
                        (e) =>
                          !e.revoked_at &&
                          e.remaining_units > 0 &&
                          new Date(e.expires_at) > new Date() &&
                          (kind === "court"
                            ? e.kind === "court_hours"
                            : [
                                "visit_pass",
                                "guest_pass",
                                "lesson_pack",
                              ].includes(e.kind))
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} · {Number(e.remaining_units)}{" "}
                          {kind === "court" ? "hours" : "uses"} remaining
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {quote.data?.policy && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">
                    Venue payment policy
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {quote.data.policy}
                  </p>
                </details>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="confirmed"
                  key={payment + request}
                  required
                  className="mt-1"
                />
                {payment === "cash"
                  ? "I received the cash amount shown."
                  : payment === "pass"
                  ? "Apply this player’s prepaid benefit to this visit."
                  : "I reviewed the visit details and venue policy with the player."}
              </label>
              <Button
                type="submit"
                disabled={
                  working ||
                  !quote.data ||
                  quote.isFetching ||
                  quote.isError ||
                  directory.isError
                }
              >
                {working
                  ? "Saving…"
                  : payment === "stripe"
                  ? "Reserve space & create checkout"
                  : "Book visit"}
              </Button>
            </form>
            {checkout && (
              <article className="rounded-2xl border bg-card p-5">
                <h2 className="font-semibold">Player checkout</h2>
                <div className="my-4 inline-block rounded-xl bg-white p-4">
                  <QRCodeSVG value={checkout} size={180} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Attendance becomes available after payment is confirmed.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(checkout)
                      .then(() => setNotice("Checkout link copied."))
                      .catch(() => setError("Copy failed. Use the QR code."))
                  }
                >
                  Copy checkout link
                </Button>
              </article>
            )}
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-bold">Day’s desk visits</h2>
              <label className="text-sm">
                Venue day
                <Input
                  type="date"
                  value={day}
                  onChange={(e) =>
                    setParams({
                      ...Object.fromEntries(params),
                      day: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            {p.visits.length ? (
              p.visits.map((v) => (
                <article key={v.id} className="rounded-2xl border bg-card p-5">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">
                        {v.first_name} {v.last_name}
                      </h3>
                      <p className="text-sm">{v.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {venueDate(v.start_time, tz)} ·{" "}
                        {v.method === "pass"
                          ? "Prepaid pass"
                          : v.method === "free"
                          ? "Free"
                          : v.method}{" "}
                        · {v.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    {v.status === "checked_in" && (
                      <span className="text-sm font-semibold">Checked in</span>
                    )}
                  </div>
                  {!!v.missing_documents && (
                    <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">
                      Required venue documents need acknowledgment.
                    </p>
                  )}
                  {v.canceled_reason && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {v.canceled_reason}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={`/player/community/group/${groupId}/players?player=${v.customer_id}`}
                    >
                      <Button variant="outline" size="sm">
                        Player & documents
                      </Button>
                    </Link>
                    {v.method !== "free" && (
                      <Link
                        to={`/player/community/group/${groupId}/desk?player=${v.customer_id}&day=${day}`}
                      >
                        <Button variant="outline" size="sm">
                          Payment / pass
                        </Button>
                      </Link>
                    )}
                    {["expected", "checked_in", "no_show"].includes(
                      v.status
                    ) && (
                      <>
                        {v.status !== "checked_in" && (
                          <Button
                            size="sm"
                            disabled={working || !!v.missing_documents}
                            onClick={() =>
                              void act(async () => {
                                await rpc("venue_visit_status", {
                                  p_visit: v.id,
                                  p_status: "checked_in",
                                  p_expected: v.version,
                                });
                                setNotice("Player checked in.");
                              })
                            }
                          >
                            Check in
                          </Button>
                        )}
                        {v.status === "expected" &&
                          new Date(v.end_time) <= new Date() && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={working}
                              onClick={() =>
                                void act(async () => {
                                  await rpc("venue_visit_status", {
                                    p_visit: v.id,
                                    p_status: "no_show",
                                    p_expected: v.version,
                                  });
                                  setNotice("No-show recorded.");
                                })
                              }
                            >
                              No-show
                            </Button>
                          )}
                        {v.status !== "expected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={working}
                            onClick={() =>
                              void act(async () => {
                                await rpc("venue_visit_status", {
                                  p_visit: v.id,
                                  p_status: "expected",
                                  p_expected: v.version,
                                });
                                setNotice("Attendance reset.");
                              })
                            }
                          >
                            Undo attendance
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={working}
                          onClick={() => setCancel(v)}
                        >
                          Cancel visit
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                No front-desk visits for this day. Online event registrations
                are in Operations.
              </p>
            )}
          </section>
        </div>
      ) : null}
      <Dialog
        open={!!cancel}
        onOpenChange={(v) => !v && !working && setCancel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel visit</DialogTitle>
            <DialogDescription>
              Release this space and return prepaid units. Collected cash or
              card payments are flagged for the owner’s refund review.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const reason = new FormData(e.currentTarget).get("reason");
              void act(async () => {
                if (!cancel) return;
                await rpc("venue_visit_status", {
                  p_visit: cancel.id,
                  p_status: "canceled",
                  p_expected: cancel.version,
                  p_reason: reason,
                });
                setCancel(null);
                setNotice(
                  "Visit canceled. Review any collected payment in Front desk."
                );
              });
            }}
          >
            <label className="block text-sm">
              Reason
              <Input name="reason" required minLength={5} maxLength={1000} />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={working}>
              Cancel visit
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
