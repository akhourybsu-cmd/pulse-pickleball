import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { QRCodeSVG } from "qrcode.react";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import {
  venueRpc as rpc,
  venueDate,
  type VenueCustomer,
} from "@/lib/venues/customerRecords";
import {
  localVenueDay,
  priceCents,
  type DeskWorkspace,
} from "@/lib/venues/deskSales";
import { paymentApi, formatMoney } from "@/lib/payments";
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
type Coach = {
  id: string;
  name: string;
  bio: string;
  hourly_cents: number;
  active: boolean;
  updated_at: string;
  availability: { weekday: number; start_minute: number; end_minute: number }[];
};
type Appointment = {
  id: string;
  kind: string;
  title: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  coach_id: string | null;
  court_ids: string[];
  start_time: string;
  end_time: string;
  total_cents: number;
  deposit_cents: number;
  paid_cents: number;
  status: string;
  version: number;
  quote_token: string;
  quote_expires_at: string;
  agreed_at: string | null;
  policy: string;
  notes: string;
  pending_sale_id: string | null;
  visit_method: string | null;
};
type Workspace = {
  can_manage: boolean;
  coaches: Coach[];
  courts: { id: string; name: string }[];
  appointments: Appointment[];
};
const selectClass = "h-11 w-full rounded-md border bg-background px-3 text-sm";
export default function VenueAppointments() {
  const { groupId = "" } = useParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const client = useQueryClient();
  const venue = group?.venue_id,
    tz = group?.venue?.timezone || "America/New_York",
    base = `/player/community/group/${groupId}`;
  const [params] = useSearchParams();
  const [from, setFrom] = useState(params.get("day") || localVenueDay(tz)),
    [to, setTo] = useState(
      params.get("day") ||
        localVenueDay(tz, new Date(Date.now() + 30 * 86400000))
    ),
    [tab, setTab] = useState("bookings");
  const [editing, setEditing] = useState<Appointment | true | null>(null),
    [coachEdit, setCoachEdit] = useState<Coach | true | null>(null),
    [collect, setCollect] = useState<Appointment | null>(null),
    [cancel, setCancel] = useState<Appointment | null>(null),
    [share, setShare] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [checkout, setCheckout] = useState("");
  const q = useQuery({
    queryKey: ["venue-appointments", venue, user?.id, from, to],
    enabled: !!venue && !!user && !!from && !!to,
    queryFn: () =>
      rpc<Workspace>("venue_appointments_workspace", {
        p_venue: venue,
        p_from: from,
        p_to: to,
      }),
    refetchInterval: editing || coachEdit || collect || busy ? false : 15000,
  });
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await q.refetch();
      for (const key of [
        "venue-day",
        "venue-walkins",
        "venue-desk",
        "venue-customer",
        "venue-report",
      ])
        void client.invalidateQueries({ queryKey: [key] });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update the booking."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {group?.venue?.name || group?.name}
        </p>
        <h1 className="text-2xl font-bold">Lessons & private bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Coach availability, personal lessons, event quotes and deposits share
          your court calendar.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "bookings" ? "default" : "outline"}
          onClick={() => setTab("bookings")}
        >
          Bookings & quotes
        </Button>
        <Button
          variant={tab === "coaches" ? "default" : "outline"}
          onClick={() => setTab("coaches")}
        >
          Coaches
        </Button>
        <Link to={`${base}/walk-ins`}>
          <Button variant="outline">Daily check-in</Button>
        </Link>
      </div>
      {(error || q.error) && (
        <p role="alert" className="text-destructive">
          {error || q.error?.message}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {q.isPending ? (
        <p>Loading bookings…</p>
      ) : (
        q.data && (
          <>
            {tab === "bookings" ? (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-sm">
                    From
                    <Input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Through
                    <Input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                  {q.data.can_manage && (
                    <Button
                      onClick={() => {
                        setError("");
                        setEditing(true);
                      }}
                    >
                      Create booking quote
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {q.data.appointments.map((a) => {
                    const { user } = useAuthState();
                    const due =
                      a.visit_method === "pass"
                        ? 0
                        : a.status === "draft"
                        ? a.deposit_cents
                        : Math.max(0, a.total_cents - Number(a.paid_cents));
                    return (
                      <article
                        className="space-y-3 rounded-2xl border bg-card p-5"
                        key={a.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">
                              {a.kind === "lesson" ? "Lesson" : "Private event"}
                            </p>
                            <h2 className="mt-1 text-lg font-semibold">
                              {a.title}
                            </h2>
                          </div>
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                            {a.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium">
                          {venueDate(a.start_time, tz)} –{" "}
                          {formatInTimeZone(a.end_time, tz, "h:mm a")}
                        </p>
                        <p className="text-sm">
                          {a.first_name} {a.last_name} ·{" "}
                          {a.court_ids
                            .map(
                              (id) =>
                                q.data!.courts.find((c) => c.id === id)?.name ||
                                "Court"
                            )
                            .join(", ")}
                          {a.coach_id
                            ? ` · ${
                                q.data.coaches.find((c) => c.id === a.coach_id)
                                  ?.name || "Coach"
                              }`
                            : ""}
                        </p>
                        <p className="text-sm">
                          <strong>{formatMoney(a.total_cents)}</strong> total ·{" "}
                          {a.visit_method === "pass"
                            ? "Paid with lesson package"
                            : `${formatMoney(
                                Number(a.paid_cents)
                              )} collected · ${formatMoney(due)} ${
                                a.status === "draft"
                                  ? "deposit due"
                                  : "remaining"
                              }`}
                        </p>
                        {a.status === "draft" && (
                          <p className="text-xs text-muted-foreground">
                            {a.agreed_at
                              ? "Customer acknowledged this quote."
                              : "Awaiting quote acknowledgment."}{" "}
                            Courts are checked again when you confirm or start
                            checkout.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {a.status === "draft" && q.data.can_manage && (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setError("");
                                setEditing(a);
                              }}
                            >
                              Edit quote
                            </Button>
                          )}
                          {a.status !== "canceled" && (
                            <Button
                              variant="outline"
                              onClick={() => setShare(a)}
                            >
                              View / share quote
                            </Button>
                          )}
                          {(a.status === "draft" ||
                            (a.status === "confirmed" && due > 0)) &&
                            !a.pending_sale_id && (
                              <Button
                                disabled={busy}
                                onClick={() => {
                                  setError("");
                                  setCheckout("");
                                  setCollect(a);
                                }}
                              >
                                {due === 0
                                  ? "Confirm booking"
                                  : a.status === "draft"
                                  ? "Collect deposit / confirm"
                                  : "Collect balance"}
                              </Button>
                            )}
                          {a.pending_sale_id && (
                            <Link to={`${base}/desk?player=${a.customer_id}`}>
                              <Button variant="outline">
                                Manage pending payment
                              </Button>
                            </Link>
                          )}
                          {a.status !== "canceled" && a.status !== "held" && (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setError("");
                                setCancel(a);
                              }}
                            >
                              Cancel booking
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!q.data.appointments.length && (
                  <p className="rounded-2xl border p-8 text-center text-muted-foreground">
                    No lessons or private bookings in this date range.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Weekly availability is interpreted in {tz}. Existing
                    confirmed lessons keep their agreed time and price.
                  </p>
                  {q.data.can_manage && (
                    <Button
                      onClick={() => {
                        setError("");
                        setCoachEdit(true);
                      }}
                    >
                      Add coach
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {q.data.coaches.map((c) => (
                    <article
                      key={c.id}
                      className="space-y-3 rounded-2xl border bg-card p-5"
                    >
                      <h2 className="text-lg font-semibold">
                        {c.name}
                        {!c.active && " · Inactive"}
                      </h2>
                      <p className="text-sm">{c.bio}</p>
                      <p className="font-medium">
                        {formatMoney(c.hourly_cents)} / hour, including court
                      </p>
                      <ul className="text-sm text-muted-foreground">
                        {c.availability.map((s, i) => (
                          <li key={i}>
                            {
                              [
                                "Sunday",
                                "Monday",
                                "Tuesday",
                                "Wednesday",
                                "Thursday",
                                "Friday",
                                "Saturday",
                              ][s.weekday]
                            }{" "}
                            · {minutesTime(s.start_minute)}–
                            {minutesTime(s.end_minute)}
                          </li>
                        ))}
                      </ul>
                      {q.data.can_manage && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setError("");
                            setCoachEdit(c);
                          }}
                        >
                          Edit coach
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
                {!q.data.coaches.length && (
                  <p className="rounded-2xl border p-8 text-center text-muted-foreground">
                    Add a coach and their available hours to offer private
                    lessons.
                  </p>
                )}
              </>
            )}
            {editing && (
              <AppointmentForm
                key={editing === true ? "new" : editing.id}
                venue={venue!}
                tz={tz}
                workspace={q.data}
                initial={editing === true ? undefined : editing}
                busy={busy}
                error={error}
                close={() => !busy && setEditing(null)}
                save={(doc, request) =>
                  void act(async () => {
                    const a = await rpc<Appointment>("venue_appointment_save", {
                      p_venue: venue,
                      p_id: editing === true ? null : editing.id,
                      p_expected: editing === true ? null : editing.version,
                      p_document: doc,
                      p_request: request,
                    });
                    setFrom(localVenueDay(tz, new Date(a.start_time)));
                    setTo(localVenueDay(tz, new Date(a.start_time)));
                    setEditing(null);
                    setNotice(
                      "Quote saved. Confirm it or collect the deposit to reserve the courts."
                    );
                  })
                }
              />
            )}
            {coachEdit && (
              <CoachForm
                initial={coachEdit === true ? undefined : coachEdit}
                busy={busy}
                error={error}
                close={() => !busy && setCoachEdit(null)}
                save={(doc) =>
                  void act(async () => {
                    await rpc("venue_coach_save", {
                      p_venue: venue,
                      p_id: coachEdit === true ? null : coachEdit.id,
                      p_expected:
                        coachEdit === true ? null : coachEdit.updated_at,
                      p_document: doc,
                    });
                    setCoachEdit(null);
                    setNotice("Coach availability saved.");
                  })
                }
              />
            )}
            {collect && (
              <CollectionForm
                appointment={collect}
                venue={venue!}
                tz={tz}
                busy={busy}
                error={error}
                checkout={checkout}
                close={() => !busy && setCollect(null)}
                submit={(method, pass, request, cash, terms) =>
                  void act(async () => {
                    const amount =
                      collect.status === "draft"
                        ? collect.deposit_cents
                        : Math.max(
                            0,
                            collect.total_cents - Number(collect.paid_cents)
                          );
                    if (method === "stripe") {
                      const result = await paymentApi<{ url: string }>(
                        "venue_appointment_checkout",
                        {
                          appointment_id: collect.id,
                          version: collect.version,
                          amount_cents: amount,
                          request_key: request,
                          accept_terms: terms,
                        }
                      );
                      setCheckout(result.url);
                    } else {
                      await rpc("venue_appointment_collect", {
                        p_id: collect.id,
                        p_expected: collect.version,
                        p_method: method,
                        p_amount: amount,
                        p_request: request,
                        p_cash_received: cash,
                        p_terms: terms,
                        p_entitlement: method === "pass" ? pass : null,
                      });
                      setCollect(null);
                      setNotice(
                        "Booking confirmed. Courts and any coach time are reserved."
                      );
                    }
                  })
                }
              />
            )}
            <Dialog
              open={!!cancel}
              onOpenChange={(open) => !open && !busy && setCancel(null)}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel booking</DialogTitle>
                  <DialogDescription>
                    Release courts and coach time. Unused lesson credit is
                    returned; collected payments are flagged for refund review.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const reason = new FormData(e.currentTarget).get("reason");
                    void act(async () => {
                      await rpc("venue_appointment_cancel", {
                        p_id: cancel!.id,
                        p_expected: cancel!.version,
                        p_reason: reason,
                      });
                      setCancel(null);
                      setNotice(
                        "Booking canceled. Review any collected payments in Front desk."
                      );
                    });
                  }}
                >
                  <label className="block text-sm">
                    Reason
                    <Textarea
                      name="reason"
                      required
                      minLength={5}
                      maxLength={1000}
                    />
                  </label>
                  {error && (
                    <p role="alert" className="text-destructive">
                      {error}
                    </p>
                  )}
                  <Button disabled={busy}>Cancel booking</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog
              open={!!share}
              onOpenChange={(open) => !open && setShare(null)}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share booking quote</DialogTitle>
                  <DialogDescription>
                    The private link includes the agreed price, schedule and
                    venue policy.
                  </DialogDescription>
                </DialogHeader>
                {share && (
                  <>
                    <div className="mx-auto rounded-xl bg-white p-3">
                      <QRCodeSVG
                        value={`${window.location.origin}/venue-quote/${share.quote_token}`}
                        size={180}
                      />
                    </div>
                    <a
                      className="break-all underline"
                      href={`/venue-quote/${share.quote_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open customer quote
                    </a>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(
                            `${window.location.origin}/venue-quote/${share.quote_token}`
                          )
                          .then(() => setNotice("Quote link copied."))
                          .catch(() =>
                            setError(
                              "Copy failed. Open the quote link instead."
                            )
                          )
                      }
                    >
                      Copy quote link
                    </Button>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </>
        )
      )}
    </main>
  );
}
const minutesTime = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(
    2,
    "0"
  )}`;
function CoachForm({
  initial,
  busy,
  error,
  close,
  save,
}: {
  initial?: Coach;
  busy: boolean;
  error: string;
  close: () => void;
  save: (d: unknown) => void;
}) {
  const [slots, setSlots] = useState(initial?.availability || []);
  const [localError, setError] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit coach" : "Add coach"}</DialogTitle>
          <DialogDescription>
            Set the hourly lesson price, including the court, and weekly
            availability.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            try {
              const f = new FormData(e.currentTarget);
              save({
                name: f.get("name"),
                bio: f.get("bio"),
                hourly_cents: priceCents(f.get("price")),
                active: f.get("active") === "on",
                availability: slots,
              });
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Check the coach details."
              );
            }
          }}
        >
          <label className="block text-sm">
            Name
            <Input
              name="name"
              required
              maxLength={120}
              defaultValue={initial?.name}
            />
          </label>
          <label className="block text-sm">
            Bio
            <Textarea name="bio" maxLength={2000} defaultValue={initial?.bio} />
          </label>
          <label className="block text-sm">
            Lesson price per hour ($), including court
            <Input
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={(initial?.hourly_cents || 0) / 100}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              name="active"
              type="checkbox"
              defaultChecked={initial?.active ?? true}
            />
            Available for new lessons
          </label>
          <fieldset className="space-y-3">
            <legend className="mb-2 font-medium">Weekly availability</legend>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day, weekday) => {
                const slot = slots.find((s) => s.weekday === weekday);
                function change(
                  key: "start_minute" | "end_minute",
                  value: string
                ) {
                  const [h, m] = value.split(":").map(Number);
                  setSlots(
                    slots.map((s) =>
                      s.weekday === weekday ? { ...s, [key]: h * 60 + m } : s
                    )
                  );
                }
                return (
                  <div
                    key={day}
                    className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2"
                  >
                    <label className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!slot}
                        onChange={(e) =>
                          setSlots(
                            e.target.checked
                              ? [
                                  ...slots,
                                  {
                                    weekday,
                                    start_minute: 540,
                                    end_minute: 1020,
                                  },
                                ]
                              : slots.filter((s) => s.weekday !== weekday)
                          )
                        }
                      />
                      {day}
                    </label>
                    {slot && (
                      <>
                        <Input
                          aria-label={`${day} from`}
                          type="time"
                          required
                          value={minutesTime(slot.start_minute)}
                          onChange={(e) =>
                            change("start_minute", e.target.value)
                          }
                        />
                        <Input
                          aria-label={`${day} until`}
                          type="time"
                          required
                          value={minutesTime(slot.end_minute)}
                          onChange={(e) => change("end_minute", e.target.value)}
                        />
                      </>
                    )}
                  </div>
                );
              }
            )}
          </fieldset>
          {(error || localError) && (
            <p role="alert" className="text-destructive">
              {error || localError}
            </p>
          )}
          <Button disabled={busy}>Save coach</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function AppointmentForm({
  venue,
  tz,
  workspace,
  initial,
  busy,
  error,
  close,
  save,
}: {
  venue: string;
  tz: string;
  workspace: Workspace;
  initial?: Appointment;
  busy: boolean;
  error: string;
  close: () => void;
  save: (d: unknown, key: string) => void;
}) {
  const { user } = useAuthState();
  const [kind, setKind] = useState(initial?.kind || "lesson"),
    [customer, setCustomer] = useState(initial?.customer_id || ""),
    [search, setSearch] = useState(""),
    [coach, setCoach] = useState(initial?.coach_id || ""),
    [courts, setCourts] = useState(initial?.court_ids || []),
    [start, setStart] = useState(
      initial
        ? formatInTimeZone(initial.start_time, tz, "yyyy-MM-dd'T'HH:mm")
        : `${localVenueDay(tz, new Date(Date.now() + 86400000))}T09:00`
    ),
    [duration, setDuration] = useState(
      initial
        ? (Date.parse(initial.end_time) - Date.parse(initial.start_time)) /
            60000
        : 60
    ),
    [localError, setError] = useState("");
  const [request] = useState(() => crypto.randomUUID());
  const directory = useQuery({
    queryKey: ["venue-customers", venue, user?.id, search, 0],
    queryFn: () =>
      rpc<{ players: VenueCustomer[] }>("venue_customer_directory", {
        p_venue: venue,
        p_search: search,
        p_page: 0,
      }),
  });
  const lessonTotal = Math.round(
    ((workspace.coaches.find((c) => c.id === coach)?.hourly_cents || 0) *
      duration) /
      60
  );
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit quote" : "Create booking quote"}
          </DialogTitle>
          <DialogDescription>
            Quotes do not reserve inventory. Confirm or collect a deposit after
            the customer reviews the details.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            try {
              const f = new FormData(e.currentTarget);
              const date = fromZonedTime(start, tz);
              if (formatInTimeZone(date, tz, "yyyy-MM-dd'T'HH:mm") !== start)
                throw new Error(
                  "This local time is skipped by daylight saving. Choose another time."
                );
              save(
                {
                  customer_id: customer,
                  kind,
                  title: f.get("title"),
                  coach_id: kind === "lesson" ? coach : null,
                  court_ids: courts,
                  start_time: date.toISOString(),
                  end_time: new Date(
                    date.getTime() + duration * 60000
                  ).toISOString(),
                  total_cents:
                    kind === "lesson"
                      ? lessonTotal
                      : priceCents(f.get("total")),
                  deposit_cents:
                    kind === "lesson"
                      ? lessonTotal
                      : priceCents(f.get("deposit")),
                  notes: f.get("notes"),
                  tax_inclusive: f.get("tax") === "on",
                },
                request
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Check the booking details."
              );
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Booking type
              <select
                className={selectClass}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setCourts([]);
                }}
              >
                <option value="lesson">Private lesson</option>
                <option value="private_event">Private event</option>
              </select>
            </label>
            <label className="text-sm">
              Booking title
              <Input
                name="title"
                required
                maxLength={150}
                defaultValue={initial?.title}
              />
            </label>
          </div>
          <label className="block text-sm">
            Find a venue player or guest
            <Input
              value={search}
              placeholder="Search names or email"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Player or event contact"
            required
            className={selectClass}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          >
            <option value="">Choose player or event contact</option>
            {initial &&
              !directory.data?.players.some(
                (c) => c.id === initial.customer_id
              ) && (
                <option value={initial.customer_id}>
                  {initial.first_name} {initial.last_name}
                </option>
              )}
            {directory.data?.players.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Add guests or import community players in Players & waivers first.
          </p>
          {directory.error && <p role="alert">{directory.error.message}</p>}
          {kind === "lesson" && (
            <label className="block text-sm">
              Coach
              <select
                required
                className={selectClass}
                value={coach}
                onChange={(e) => setCoach(e.target.value)}
              >
                <option value="">Choose coach</option>
                {workspace.coaches
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {formatMoney(c.hourly_cents)} / hour
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Starts ({tz})
              <Input
                type="datetime-local"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Duration (minutes)
              <Input
                type="number"
                min={30}
                max={720}
                step={30}
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm">
              {kind === "lesson" ? "Choose one court" : "Choose courts"}
            </legend>
            <div className="flex flex-wrap gap-3">
              {workspace.courts.map((c) => (
                <label
                  key={c.id}
                  className="flex gap-2 rounded-xl border p-3 text-sm"
                >
                  <input
                    type={kind === "lesson" ? "radio" : "checkbox"}
                    name="court"
                    checked={courts.includes(c.id)}
                    onChange={(e) =>
                      setCourts(
                        kind === "lesson"
                          ? [c.id]
                          : e.target.checked
                          ? [...courts, c.id]
                          : courts.filter((id) => id !== c.id)
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          {kind === "lesson" ? (
            <p className="rounded-xl bg-muted p-3 font-medium">
              Lesson total: {formatMoney(lessonTotal)} · court included
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Total quote ($)
                <Input
                  name="total"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  defaultValue={(initial?.total_cents || 0) / 100}
                />
              </label>
              <label className="text-sm">
                Deposit to confirm ($)
                <Input
                  name="deposit"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  defaultValue={(initial?.deposit_cents || 0) / 100}
                />
              </label>
            </div>
          )}
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="tax" required />
            The quoted price includes applicable taxes.
          </label>
          <label className="block text-sm">
            Private staff notes
            <Textarea
              name="notes"
              maxLength={4000}
              defaultValue={initial?.notes}
            />
          </label>
          {(error || localError) && (
            <p role="alert" className="text-destructive">
              {error || localError}
            </p>
          )}
          <Button disabled={busy || !courts.length}>
            Save & check availability
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function CollectionForm({
  appointment: a,
  venue,
  tz,
  busy,
  error,
  checkout,
  close,
  submit,
}: {
  appointment: Appointment;
  venue: string;
  tz: string;
  busy: boolean;
  error: string;
  checkout: string;
  close: () => void;
  submit: (
    method: string,
    pass: string,
    request: string,
    cash: boolean,
    terms: boolean
  ) => void;
}) {
  const { user } = useAuthState();
  const amount =
    a.status === "draft"
      ? a.deposit_cents
      : Math.max(0, a.total_cents - Number(a.paid_cents));
  const [method, setMethod] = useState(amount === 0 ? "free" : "stripe"),
    [pass, setPass] = useState(""),
    [request] = useState(() => crypto.randomUUID());
  const q = useQuery({
    queryKey: ["appointment-passes", venue, user?.id, a.customer_id],
    enabled: a.kind === "lesson",
    queryFn: () =>
      rpc<DeskWorkspace>("venue_desk_workspace", {
        p_venue: venue,
        p_day: localVenueDay(tz),
        p_customer: a.customer_id,
      }),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {a.status === "draft"
              ? "Confirm booking"
              : "Collect remaining balance"}
          </DialogTitle>
          <DialogDescription>
            {a.title} · {formatMoney(amount)} due now
          </DialogDescription>
        </DialogHeader>
        {checkout ? (
          <>
            <div className="mx-auto rounded-xl bg-white p-3">
              <QRCodeSVG value={checkout} size={180} />
            </div>
            <a
              className="break-all underline"
              href={checkout}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open secure checkout
            </a>
            <p className="text-sm">
              The booking is held while checkout completes. Use Front desk to
              resume, cancel, or reconcile this payment.
            </p>
            <Button onClick={close}>Done</Button>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              submit(
                method,
                pass,
                request,
                f.get("cash") === "on",
                f.get("terms") === "on"
              );
            }}
          >
            <select
              aria-label="Collection method"
              className={selectClass}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {amount === 0 ? (
                <option value="free">Confirm with no deposit due</option>
              ) : (
                <>
                  <option value="stripe">Stripe payment link / QR</option>
                  <option value="cash">Cash received</option>
                  {a.kind === "lesson" && a.status === "draft" && (
                    <option value="pass">Lesson package</option>
                  )}
                </>
              )}
            </select>
            {method === "pass" && (
              <select
                aria-label="Lesson package"
                className={selectClass}
                required
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              >
                <option value="">Choose lesson package</option>
                {q.data?.entitlements
                  .filter(
                    (e) =>
                      e.kind === "lesson_pack" &&
                      !e.revoked_at &&
                      Number(e.remaining_units) > 0 &&
                      Date.parse(e.expires_at) >= Date.parse(a.end_time)
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {e.remaining_units} lessons
                    </option>
                  ))}
              </select>
            )}
            <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">
              {a.policy || "No payment policy applies to this free booking."}
            </p>
            <label className="flex gap-2 text-sm">
              <input name="terms" type="checkbox" required />
              The customer reviewed and accepted this quote and venue policy.
            </label>
            {method === "cash" && (
              <label className="flex gap-2 text-sm">
                <input name="cash" type="checkbox" required />I received this
                cash from the customer.
              </label>
            )}
            {(error || q.error) && (
              <p role="alert" className="text-destructive">
                {error || q.error?.message}
              </p>
            )}
            <Button disabled={busy}>
              {busy
                ? "Processing…"
                : method === "stripe"
                ? "Reserve & create checkout"
                : "Confirm booking / payment"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
