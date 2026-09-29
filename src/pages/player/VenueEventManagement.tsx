import { useVenueAdminLayout } from '@/components/venue/VenueAdminLayout';
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  CreditCard,
  Plus,
  Users,
} from "lucide-react";
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
import { VenueEventEditor } from "@/components/venue/VenueEventEditor";
import {
  eventManagementRpc as rpc,
  type EventWorkspace,
  type EventDocument,
  type EventDraft,
  type ManagedEvent,
  type EventAttendee,
} from "@/lib/venues/eventManagement";
import { eventSchedule, EVENT_LABELS } from "@/lib/venues/eventPresentation";
import { formatMoney, paymentApi } from "@/lib/payments";
import { useAuthState } from "@/hooks/useAuthState";

export default function VenueEventManagement() {
  const inVenueConsole = useVenueAdminLayout();
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuthState();
  const client = useQueryClient();
  const [range, setRange] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<{
    draft?: EventDraft;
    event?: ManagedEvent;
    initial?: EventDocument;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [canceling, setCanceling] = useState<ManagedEvent | null>(null);
  const [reason, setReason] = useState("");
  const [paymentConfirm, setPaymentConfirm] = useState(false);
  const bounds = () => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() + (range === "past" ? -180 : -1));
    const to = new Date(now);
    to.setDate(now.getDate() + (range === "past" ? 1 : 180));
    return { p_from: from.toISOString(), p_to: to.toISOString() };
  };
  const query = useQuery({
    queryKey: ["venue-event-management", groupId, user?.id, range],
    enabled: !!groupId && !!user,
    queryFn: () =>
      rpc<EventWorkspace>("get_venue_event_management", {
        p_group: groupId,
        ...bounds(),
      }),
    refetchInterval: editing || working ? false : 30000,
    refetchOnWindowFocus: !editing && !working,
  });
  const w = query.data;
  const selected = w?.events.find((e) => e.id === params.get("event"));
  const attendees = useQuery({
    queryKey: ["venue-event-attendees", selected?.id, user?.id],
    enabled: !!selected,
    queryFn: () =>
      rpc<EventAttendee[]>("get_venue_event_attendees", {
        p_event: selected!.id,
      }),
    refetchInterval: working ? false : 30000,
  });
  useEffect(() => {
    if (params.get("new") === "1" && w && !editing) {
      const start = params.get("start"),
        end = params.get("end"),
        court = params.get("court");
      const initial =
        start && end && !isNaN(Date.parse(start)) && !isNaN(Date.parse(end))
          ? {
              title: "",
              description: "",
              event_format: "open_play" as const,
              capacity: 16,
              price_cents: 0,
              court_ids: court ? [court] : [],
              occurrences: [{ start_time: start, end_time: end }],
              close_minutes: 0,
              registration_paused: false,
              cancellation_policy: null,
              waitlist_enabled: true,
              waitlist_limit: null,
              skill_level_min: null,
              skill_level_max: null,
            }
          : undefined;
      setEditing({ initial });
      setParams({}, { replace: true });
    }
  }, [w, params, editing, setParams]);
  async function refresh() {
    await query.refetch();
    for (const key of [
      "venue-event-attendees",
      "venue-attendance",
      "venue-program",
      "venue-program-roster",
      "venue-day",
      "group-events",
      "venue-upcoming-programs",
      "venue-occasions",
    ])
      void client.invalidateQueries({ queryKey: [key] });
  }
  async function act(action: () => Promise<void>) {
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The action could not be completed."
      );
    } finally {
      setWorking(false);
    }
  }
  async function save(document: EventDocument, publish: boolean) {
    if (!w || working) return;
    setWorking(true);
    setError("");
    try {
      if (editing?.event) {
        const e = editing.event;
        await rpc("update_venue_program", {
          p_event: e.id,
          p_expected: e.updated_at,
          p_courts: document.court_ids,
          p_changes: {
            ...document,
            ...document.occurrences[0],
            registration_closes_at: new Date(
              Date.parse(document.occurrences[0].start_time) -
                document.close_minutes * 60000
            ).toISOString(),
          },
        });
        setNotice(
          "Event updated. Court allocations and registration details are saved."
        );
      } else {
        const d = await rpc<EventDraft>("save_venue_event_draft", {
          p_venue: w.venue.id,
          p_group: groupId,
          p_id: editing?.draft?.id ?? null,
          p_document: document,
          p_expected: editing?.draft?.updated_at ?? null,
        });
        setEditing({ draft: d });
        if (publish) {
          const ids = await rpc<string[]>("publish_venue_event_draft", {
            p_id: d.id,
            p_expected: d.updated_at,
          });
          setNotice(
            `${ids.length} event${
              ids.length === 1 ? "" : "s"
            } published with dedicated courts.`
          );
        } else setNotice("Draft saved. No courts are reserved yet.");
      }
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The event could not be saved."
      );
      throw e;
    } finally {
      setWorking(false);
    }
  }
  const base = `/player/community/group/${groupId}`;
  if (query.isPending)
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p role="status">Loading event management…</p>
      </main>
    );
  if (query.isError || !w)
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <Button asChild variant="ghost">
          <Link to={base}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to venue
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Event management unavailable</h1>
        <p role="alert">
          {query.error?.message || "Your venue access could not be confirmed."}
        </p>
        <Button onClick={() => void query.refetch()}>Try again</Button>
      </main>
    );
  const events = w.events.filter(
    (e) =>
      (!search || e.title.toLowerCase().includes(search.toLowerCase())) &&
      (filter === "all" ||
        (filter === "canceled"
          ? !!e.canceled_at
          : filter === "paused"
          ? e.registration_paused && !e.canceled_at
          : !e.canceled_at && !e.registration_paused))
  );
  const total = w.events.reduce(
    (a, e) => ({
      players: a.players + e.going,
      pending: a.pending + e.pending,
      collected: a.collected + e.collected_cents,
    }),
    { players: 0, pending: 0, collected: 0 }
  );
  const duplicate = (e: ManagedEvent) => {
    setParams({});
    setEditing({
      initial: {
        title: `${e.title} (copy)`,
        description: e.description ?? "",
        event_format: e.event_format,
        capacity: e.capacity ?? 16,
        price_cents: e.price_cents ?? 0,
        court_ids: e.court_ids,
        occurrences: [],
        close_minutes: 0,
        registration_paused: false,
        cancellation_policy: e.cancellation_policy ?? null,
        waitlist_enabled: e.waitlist_enabled,
        waitlist_limit: e.waitlist_limit,
        skill_level_min: e.skill_level_min,
        skill_level_max: e.skill_level_max,
        rotation_style: e.rotation_style,
        rr_games_per_player: e.rr_games_per_player,
      },
    });
  };
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 font-sans sm:px-7 sm:py-8 [&_h1]:font-sans [&_h2]:font-sans">
      <header className={inVenueConsole ? "flex flex-wrap items-center justify-between gap-4" : "rounded-3xl bg-[#17251f] p-6 text-white sm:p-8"}>
        {!inVenueConsole && <div><h1 className="text-3xl font-semibold">Events & registrations</h1><p className="mt-2">Plan your schedule, courts, pricing and players.</p></div>}
          <Button
            className="min-h-11"
            disabled={working}
            onClick={() => {
              setParams({});
              setEditing({});
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create event
          </Button>
      </header>
      <nav className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to={`${base}/competitions`}>Round robins & leagues</Link></Button>
        <Button asChild variant="outline">
          <Link to={`${base}/ops?view=courts`}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Court calendar
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={base}>View venue</Link>
        </Button>
        {w.is_owner && (
          <Button asChild variant="outline">
            <Link to={inVenueConsole ? `${base}/payments` : `/player/payments?venue=${w.venue.id}`}>
              <CreditCard className="mr-2 h-4 w-4" />
              Payments & refunds
            </Link>
          </Button>
        )}
      </nav>
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm"
        >
          {error}
        </p>
      )}
      {!w.facility_enabled && (
        <p className="rounded-xl border p-4 text-sm">
          Enable facility operations in venue settings to publish and allocate
          courts. You can prepare drafts now.
        </p>
      )}
      {editing ? (
        <VenueEventEditor
          key={editing.event?.id ?? editing.draft?.id ?? "new"}
          workspace={w}
          {...editing}
          working={working}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Events", w.events.length],
              ["Confirmed players", total.players],
              ["In checkout", total.pending],
              ["Collected after refunds", formatMoney(total.collected)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            Totals cover the selected date range, up to 500 events. Collections
            exclude test payments and do not deduct processing fees.
          </p>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5">
            <div>
              <h2 className="font-semibold">
                Event payments ·{" "}
                {w.accepting_event_payments ? "Enabled" : "Off"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Paid places use the venue’s Stripe account and saved
                cancellation policy.
              </p>
            </div>
            {w.is_owner ? (
              <Button
                variant="outline"
                disabled={working}
                onClick={() => {
                  setError("");
                  setPaymentConfirm(true);
                }}
              >
                {w.accepting_event_payments
                  ? "Pause event payments"
                  : "Enable event payments"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                The venue owner manages Stripe and refunds.
              </p>
            )}
          </section>
          {w.drafts.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">
                Drafts{" "}
                <span className="text-muted-foreground">{w.drafts.length}</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {w.drafts.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-dashed bg-card p-4"
                  >
                    <h3 className="font-semibold">{d.document.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.document.price_cents
                        ? `${formatMoney(d.document.price_cents)} / player`
                        : "Free"}{" "}
                      · Courts not reserved
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing({ draft: d })}
                      >
                        Continue editing
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={working}
                        onClick={() =>
                          void act(async () => {
                            await rpc("archive_venue_event_draft", {
                              p_id: d.id,
                              p_expected: d.updated_at,
                            });
                            setNotice("Draft archived.");
                          })
                        }
                      >
                        Archive draft
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                className="min-w-48 flex-1"
                aria-label="Search events"
                placeholder="Search events"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Date range"
                className="rounded-xl border bg-background px-3 text-sm"
                value={range}
                onChange={(e) => {
                  setRange(e.target.value);
                  setParams({});
                }}
              >
                <option value="upcoming">Next 6 months</option>
                <option value="past">Past 6 months</option>
              </select>
              <select
                aria-label="Event status"
                className="rounded-xl border bg-background px-3 text-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="open">Registration open</option>
                <option value="paused">Paused</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            {events.length ? (
              events.map((e) => {
                const s = eventSchedule(
                  e.start_time,
                  e.end_time,
                  w.venue.timezone
                );
                return (
                  <button
                    key={e.id}
                    onClick={() => setParams({ event: e.id })}
                    className={`grid w-full gap-4 rounded-2xl border bg-card p-5 text-left transition hover:border-primary/50 sm:grid-cols-[1fr_auto] ${
                      selected?.id === e.id
                        ? "border-primary ring-1 ring-primary/20"
                        : ""
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {EVENT_LABELS[e.event_format]} ·{" "}
                        {e.canceled_at
                          ? "Canceled"
                          : new Date(e.end_time ?? e.start_time) < new Date()
                          ? "Completed"
                          : e.registration_paused
                          ? "Paused"
                          : "Published"}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold">{e.title}</h3>
                      <p className="mt-2 text-sm font-medium">
                        {s?.label} · {s?.time} {s?.zone}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {e.court_ids
                          .map(
                            (id) =>
                              w.courts.find((c) => c.id === id)?.name ?? "Court"
                          )
                          .join(", ") || "Courts released"}
                      </p>
                    </div>
                    <div className="space-y-2 text-sm sm:text-right">
                      <p className="font-bold">
                        {e.price_cents
                          ? `${formatMoney(e.price_cents)} / player`
                          : "Free"}
                      </p>
                      <p>
                        {e.going} / {e.capacity} confirmed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.waitlisted} waitlisted · {e.pending} checking out
                      </p>
                      <p className="text-xs">
                        {formatMoney(e.collected_cents)} collected
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                No events match this view. Create an event or choose another
                date range.
              </p>
            )}
          </section>
        </>
      )}
      <Dialog
        open={!!selected && !editing}
        onOpenChange={(open) => {
          if (!open && !working) setParams({});
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              Registration, attendance and payment records for this occurrence.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {selected && (
            <>
              <div className="flex flex-wrap gap-2">
                {selected.event_format === "round_robin" && !selected.canceled_at && <Button disabled={working} onClick={() => void act(async () => { const id = await rpc<string>("setup_venue_round_robin", { p_event: selected.id }); navigate(`/round-robin/${id}?venueGroup=${groupId}`); })}>Set up / manage round robin</Button>}
                {!selected.canceled_at &&
                  new Date(selected.end_time ?? selected.start_time) >
                    new Date() && (
                    <Button onClick={() => setEditing({ event: selected })}>
                      Edit event
                    </Button>
                  )}
                <Button variant="outline" onClick={() => duplicate(selected)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </Button>
                {!selected.canceled_at && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setError("");
                      setReason("");
                      setCanceling(selected);
                    }}
                  >
                    Cancel event
                  </Button>
                )}
              </div>
              {selected.canceled_at && (
                <p className="rounded-xl bg-muted p-3 text-sm">
                  Canceled: {selected.cancellation_reason}
                </p>
              )}
              <h3 className="mt-2 flex items-center gap-2 font-semibold">
                <Users className="h-4 w-4" />
                Registrations & check-in
              </h3>
              {attendees.isPending ? (
                <p role="status">Loading registrations…</p>
              ) : attendees.isError ? (
                <div>
                  <p role="alert">Registrations could not be loaded.</p>
                  <Button
                    variant="outline"
                    onClick={() => void attendees.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : attendees.data?.length ? (
                <ul className="divide-y">
                  {attendees.data.map((a, i) => (
                    <li
                      key={a.id ?? a.order_id ?? i}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <div>
                        <p className="font-semibold">{a.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.status === "going"
                            ? (a.no_show_at ? "No-show" : "Confirmed")
                            : a.status === "checkout"
                            ? "Payment record"
                            : a.status.replace(/_/g, " ")}
                          {a.payment_status
                            ? ` · ${
                                a.livemode ? "" : "Test · "
                              }${a.payment_status.replace(
                                /_/g,
                                " "
                              )} · ${formatMoney(
                                (a.amount_cents ?? 0) - (a.refunded_cents ?? 0)
                              )} net`
                            : ""}
                          {a.refund_state && a.refund_state !== "none"
                            ? ` · Refund ${a.refund_state}`
                            : ""}
                        </p>
                      </div>
                      {a.status === "going" && !selected.canceled_at && (
                        <Button
                          size="sm"
                          variant={a.checked_in_at ? "default" : "outline"}
                          disabled={working}
                          onClick={() =>
                            void act(async () => {
                              await rpc("record_venue_attendance", {
                                p_event: selected.id,
                                p_rsvp: a.id,
                                p_status: a.checked_in_at ? "expected" : "checked_in",
                                p_expected_version: a.attendance_version,
                              });
                            })
                          }
                        >
                          {a.checked_in_at ? "Checked in · Undo" : "Check in"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-5 text-sm text-muted-foreground">
                  No registrations yet.
                </p>
              )}
              {w.is_owner && (
                <Button asChild variant="outline">
                  <Link to={inVenueConsole ? `${base}/payments` : `/player/payments?venue=${w.venue.id}`}>
                    Review payments & refund requests
                  </Link>
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!canceling}
        onOpenChange={(open) => {
          if (!open && !working) setCanceling(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {canceling?.title}?</DialogTitle>
            <DialogDescription>
              This closes registration and releases all assigned courts.
              Registration and payment records are retained. Paid registrations
              are queued for the owner to review and refund; refunds are not
              issued automatically.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Textarea
            aria-label="Cancellation reason"
            placeholder="Reason for cancellation"
            minLength={5}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="destructive"
            disabled={working || reason.trim().length < 5}
            onClick={() =>
              void act(async () => {
                await rpc("cancel_venue_program", {
                  p_event: canceling!.id,
                  p_expected: canceling!.updated_at,
                  p_reason: reason.trim(),
                });
                setCanceling(null);
                setNotice(
                  "Event canceled. Review any paid registrations in Payments & refunds."
                );
              })
            }
          >
            {working ? "Canceling…" : "Cancel event & release courts"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={paymentConfirm}
        onOpenChange={(open) => {
          if (!working) setPaymentConfirm(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {w.accepting_event_payments ? "Pause" : "Enable"} event payments?
            </DialogTitle>
            <DialogDescription>
              {w.accepting_event_payments
                ? "New event checkouts will stop. Existing checkouts and purchases keep their records."
                : "Players will be able to buy places at your published event prices. Stripe verification, tax-inclusive pricing and a saved venue cancellation policy are required."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button asChild variant="outline">
            <Link to={inVenueConsole ? `${base}/payments` : `/player/payments?venue=${w.venue.id}`}>
              Review Stripe & payment policies
            </Link>
          </Button>
          <Button
            disabled={working}
            onClick={() =>
              void act(async () => {
                await paymentApi("save_event_payment_settings", {
                  venue_id: w.venue.id,
                  accepting: !w.accepting_event_payments,
                });
                setPaymentConfirm(false);
                setNotice(
                  w.accepting_event_payments
                    ? "New event payments paused."
                    : "Event payments enabled."
                );
              })
            }
          >
            Confirm {w.accepting_event_payments ? "pause" : "enable"}
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
