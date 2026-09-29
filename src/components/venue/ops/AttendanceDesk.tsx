import { VenueWaiverStatus } from "../VenueWaiverStatus";
import { ArrivalPlayerDialog } from "./ArrivalPlayerDialog";
import { RentalParty } from "../RentalParty";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clock3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  attendanceCsv,
  attendanceStatus,
  attendanceTotals,
  type AttendanceDay,
  type AttendanceStatus,
  type VenueAttendee,
} from "@/lib/venues/attendance";
import { eventManagementRpc as rpc } from "@/lib/venues/eventManagement";
import { parseVenueDay, venueDayKey } from "@/lib/venues/navigation";
import { formatSlotTime } from "@/lib/venues/availability";
import { venueCalendarNow } from "@/lib/venues/timezone";
import { cn } from "@/lib/utils";

export interface AttendanceDeskProps {
  data?: AttendanceDay;
  day: Date;
  timeZone?: string | null;
  loading: boolean;
  failed: boolean;
  refreshing: boolean;
  updatedAt: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDayChange: (day: Date) => void;
  onRefresh: () => Promise<unknown>;
  kiosk?: boolean;
}
export function AttendanceDesk({
  data,
  day,
  timeZone,
  loading,
  failed,
  refreshing,
  updatedAt,
  selectedId,
  onSelect,
  onDayChange,
  onRefresh,
  kiosk,
}: AttendanceDeskProps) {
  const [player, setPlayer] = useState<string | null>(null);
  const [party, setParty] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AttendanceStatus | "all">("all");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [closing, setClosing] = useState<{
    event: string;
    ids: string[];
  } | null>(null);
  useEffect(() => {
    setSearch("");
    setFilter("all");
    setError("");
    setNotice("");
    setClosing(null);
  }, [selectedId, data?.day]);
  const events = data?.events ?? [];
  const selected = selectedId
    ? events.find((e) => e.id === selectedId)
    : (events.find(
        (e) =>
          !e.canceled_at &&
          Date.parse(e.end_time) > Date.parse(data?.server_now ?? ""),
      ) ?? events[0]);
  const totals = attendanceTotals(events);
  const selectedTotals = attendanceTotals(selected ? [selected] : []);
  const ended =
    !!selected &&
    Date.parse(selected.end_time) <= Date.parse(data?.server_now ?? "");
  const canAct =
    !busy && !failed && !loading && !!selected && !selected.canceled_at;
  const dayKey = venueDayKey(day);
  const changeDay = (offset: number) => {
    const next = new Date(day);
    next.setDate(next.getDate() + offset);
    onDayChange(next);
  };
  async function act(action: () => Promise<unknown>, success: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Attendance could not be saved. Refresh and try again.",
      );
    } finally {
      try {
        await onRefresh();
      } finally {
        locked.current = false;
        setBusy(false);
        setClosing(null);
      }
    }
  }
  const mark = (attendee: VenueAttendee, status: AttendanceStatus) =>
    void act(
      () =>
        attendee.walk_in
          ? rpc("venue_visit_status", {
              p_visit: attendee.id,
              p_status: status,
              p_expected: attendee.version,
            })
          : rpc("record_venue_attendance", {
              p_event: selected!.id,
              p_rsvp: attendee.id,
              p_status: status,
              p_expected_version: attendee.version,
            }),
      `${attendee.name} · ${
        status === "checked_in"
          ? "checked in"
          : status === "no_show"
            ? "marked no-show"
            : "attendance reset"
      }`,
    );
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", attendanceCsv(data)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `venue-attendance-${data.day}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const needle = search.trim().toLocaleLowerCase();
  const matches = events.filter(
    (e) =>
      !e.canceled_at &&
      (e.title.toLocaleLowerCase().includes(needle) ||
        e.attendees.some((a) => a.name.toLocaleLowerCase().includes(needle))),
  );
  const roster =
    selected?.attendees.filter(
      (a) =>
        (filter === "all" ||
          (!a.pending_payment && attendanceStatus(a) === filter)) &&
        (!needle ||
          selected.title.toLocaleLowerCase().includes(needle) ||
          a.name.toLocaleLowerCase().includes(needle)),
    ) ?? [];
  return (
    <section
      id="venue-attendance-desk"
      className="space-y-5"
      aria-label="Venue arrivals"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {kiosk
              ? day.toLocaleDateString([], {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })
              : "Welcome your players"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {kiosk
              ? "Choose a program, rental or lesson to check in players."
              : `Venue arrivals · ${
                  timeZone ?? data?.timezone ?? "Venue time"
                }`}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5",
            kiosk ? "w-full flex-nowrap sm:w-auto" : "flex-wrap",
          )}
        >
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Previous operating day"
            disabled={busy}
            onClick={() => changeDay(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            aria-label="Operating date"
            className={cn(
              "h-11 min-w-0",
              kiosk ? "w-0 flex-1 sm:w-auto sm:flex-none" : "w-auto",
            )}
            value={dayKey}
            disabled={busy}
            onChange={(e) => {
              const next = parseVenueDay(e.target.value);
              if (next) onDayChange(next);
            }}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Next operating day"
            disabled={busy}
            onClick={() => changeDay(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className={cn("h-11 shrink-0 px-2", kiosk && "max-[360px]:hidden")}
            disabled={busy}
            onClick={() => onDayChange(venueCalendarNow(timeZone))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Refresh attendance"
            disabled={refreshing || busy}
            onClick={() => void onRefresh()}
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
          </Button>
          {!kiosk && (
            <Button
              variant="outline"
              className="h-11"
              disabled={!data || failed || loading}
              onClick={download}
            >
              <Download className="mr-2 h-4 w-4" />
              Daily report
            </Button>
          )}
        </div>
      </div>
      {!kiosk && (
        <p className="text-sm font-medium">
          {day.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
      {loading ? (
        <p role="status" className="rounded-2xl border p-8">
          Loading the day’s registrations…
        </p>
      ) : failed || !data ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 p-6"
        >
          <p>
            Attendance could not be confirmed. Refresh before checking players
            in.
          </p>
          <Button className="mt-3" onClick={() => void onRefresh()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
            {[
              {
                value: totals.registrations,
                label: "Confirmed places",
                hint: "Across programs, rentals & lessons",
                featured: false,
              },
              {
                value: totals.checkedIn,
                label: "Checked in",
                hint: "Arrivals recorded",
                featured: true,
              },
              {
                value: totals.expected,
                label: "Unmarked",
                hint: "Awaiting arrival or review",
                featured: false,
              },
              {
                value: totals.noShows,
                label: "No-shows",
                hint: "Recorded after activities end",
                featured: false,
              },
            ].map(({ value, label, hint, featured }) => (
              <div
                key={label}
                className={cn(
                  "rounded-2xl border bg-card px-4 py-3 sm:px-5",
                  featured &&
                    "border-primary bg-primary text-primary-foreground",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      !featured && "text-muted-foreground",
                    )}
                  >
                    {label}
                  </p>
                  {featured && <Check className="h-4 w-4" aria-hidden />}
                </div>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                  {value}
                </p>
                <p
                  className={cn(
                    "mt-1 hidden text-xs sm:block",
                    !featured && "text-muted-foreground",
                  )}
                >
                  {hint}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              Totals count player visits across programs, rentals and lessons.
            </p>
            <p>
              {refreshing
                ? "Updating attendance…"
                : updatedAt
                  ? `Updated ${formatSlotTime(new Date(updatedAt), timeZone)}`
                  : "Refreshes automatically"}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
            <Input
              className="h-[52px] rounded-xl bg-card pl-12 text-base"
              aria-label="Search activities or players"
              placeholder="Find an activity or player…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)]">
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <h3 className="text-sm font-semibold">Day’s activities</h3>
                <span className="text-xs text-muted-foreground">
                  {(needle ? matches : events).length} scheduled
                </span>
              </div>
              <nav
                aria-label="Day’s activities"
                className="flex snap-x gap-3 overflow-x-auto pb-2 lg:max-h-[620px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1"
              >
                {(needle ? matches : events).map((e) => {
                  const t = attendanceTotals([e]);
                  const inProgress =
                    !e.canceled_at &&
                    Date.parse(e.start_time) <= Date.parse(data.server_now) &&
                    Date.parse(e.end_time) > Date.parse(data.server_now);
                  const eventStatus = e.canceled_at
                    ? "Canceled"
                    : inProgress
                      ? "In progress"
                      : Date.parse(e.end_time) <= Date.parse(data.server_now)
                        ? "Ended"
                        : "Upcoming";
                  return (
                    <button
                      type="button"
                      key={e.id}
                      disabled={busy}
                      aria-current={selected?.id === e.id ? "true" : undefined}
                      onClick={() => onSelect(e.id)}
                      className={cn(
                        "w-[min(280px,85%)] shrink-0 snap-start rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 lg:w-full",
                        selected?.id === e.id &&
                          "border-ring bg-accent text-accent-foreground shadow-[inset_4px_0_0_hsl(var(--ring))]",
                      )}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-medium capitalize text-muted-foreground">
                          {e.event_format.replace(/_/g, " ")}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 font-medium",
                            inProgress
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          {eventStatus}
                        </span>
                      </div>
                      <p className="text-base font-semibold tabular-nums">
                        {formatSlotTime(new Date(e.start_time), timeZone)} –{" "}
                        {formatSlotTime(new Date(e.end_time), timeZone)}
                      </p>
                      <p className="mt-1.5 text-base font-semibold leading-snug">
                        {e.title}
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {e.courts.join(" · ") || "No courts assigned"}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                        <span>
                          {t.checkedIn}/{t.registrations} checked in
                        </span>
                        <span>
                          {e.waitlisted > 0
                            ? `${e.waitlisted} waitlisted`
                            : `${t.expected} unmarked`}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${
                              t.registrations
                                ? (100 * t.checkedIn) / t.registrations
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
                {!(needle ? matches : events).length && (
                  <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {needle
                      ? "No matching activities or players on this date."
                      : "No programs, rentals or lessons scheduled for this day."}
                  </p>
                )}
              </nav>
            </div>
            <div className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
              {selected ? (
                <>
                  <div className="border-b p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Arrival check-in
                        </p>
                        <h3 className="break-words text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                          {selected.title}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
                          <span className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {new Date(selected.start_time).toLocaleDateString(
                              [],
                              {
                                timeZone: timeZone ?? data.timezone,
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                          <span className="flex items-center gap-2 tabular-nums">
                            <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {formatSlotTime(
                              new Date(selected.start_time),
                              timeZone,
                            )}{" "}
                            –{" "}
                            {formatSlotTime(
                              new Date(selected.end_time),
                              timeZone,
                            )}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {selected.courts.join(" / ") || "No courts assigned"}
                        </p>
                        {selected.activity_kind === "rental" && (
                          <Button
                            className="mt-3"
                            variant="outline"
                            onClick={() => setParty(true)}
                          >
                            Manage booking party
                          </Button>
                        )}
                      </div>
                      <div
                        className="rounded-xl bg-muted px-3 py-2 text-right"
                        aria-label={`${selectedTotals.checkedIn} of ${selectedTotals.registrations} checked in`}
                      >
                        <p className="text-xl font-semibold tabular-nums">
                          {selectedTotals.checkedIn}
                          <span className="text-sm font-medium text-muted-foreground">
                            {" "}
                            / {selectedTotals.registrations}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          checked in
                        </p>
                      </div>
                    </div>
                    {selected.canceled_at && (
                      <p className="mt-3 text-sm text-destructive">
                        Canceled event · attendance is read-only.
                      </p>
                    )}
                    <div
                      className="mt-4 flex flex-wrap gap-1.5"
                      aria-label="Filter attendance"
                    >
                      {(
                        ["all", "expected", "checked_in", "no_show"] as const
                      ).map((value) => (
                        <Button
                          key={value}
                          className="min-h-11 rounded-full px-3"
                          size="sm"
                          variant={filter === value ? "default" : "outline"}
                          onClick={() => setFilter(value)}
                          aria-pressed={filter === value}
                        >
                          {value === "all"
                            ? "All players"
                            : value === "expected"
                              ? "Unmarked"
                              : value === "checked_in"
                                ? "Checked in"
                                : "No-shows"}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div
                    aria-live="polite"
                    role="status"
                    className={cn(
                      notice &&
                        "px-5 pt-4 text-sm text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {notice}
                  </div>
                  {error && (
                    <p
                      role="alert"
                      className="px-5 pt-4 text-sm text-destructive"
                    >
                      {error}
                    </p>
                  )}
                  <ul className="max-h-[520px] divide-y overflow-y-auto px-5">
                    {roster.map((a) => {
                      const status = attendanceStatus(a);
                      return (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-4"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold",
                                status === "checked_in" &&
                                  "border-primary bg-primary text-primary-foreground",
                              )}
                            >
                              {status === "checked_in" ? (
                                <Check className="h-5 w-5" />
                              ) : (
                                a.name.slice(0, 1).toLocaleUpperCase()
                              )}
                            </span>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "break-words font-semibold",
                                  kiosk && "text-lg",
                                )}
                              >
                                {a.name}
                              </p>
                              <VenueWaiverStatus waiver={a.waiver} />
                              {a.pending_payment && (
                                <p className="mt-1 text-sm font-semibold text-amber-700">
                                  Payment required before check-in
                                </p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                {status === "checked_in"
                                  ? `Checked in · ${formatSlotTime(
                                      new Date(a.checked_in_at!),
                                      timeZone,
                                    )}`
                                  : status === "no_show"
                                    ? "No-show"
                                    : a.pending_payment
                                      ? "Awaiting payment"
                                      : ended
                                        ? "Attendance needs review"
                                        : "Expected"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {a.customer_id && (
                              <Button
                                variant="outline"
                                className="h-12"
                                onClick={() => setPlayer(a.customer_id!)}
                              >
                                Player & waiver
                              </Button>
                            )}
                            {status !== "checked_in" && (
                              <Button
                                className="h-12 min-w-28"
                                disabled={
                                  !canAct ||
                                  a.pending_payment ||
                                  !!a.missing_documents
                                }
                                onClick={() => mark(a, "checked_in")}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Check in
                              </Button>
                            )}
                            {status === "expected" &&
                              !a.pending_payment &&
                              ended && (
                                <Button
                                  variant="outline"
                                  className="h-12"
                                  disabled={!canAct}
                                  onClick={() => mark(a, "no_show")}
                                >
                                  No-show
                                </Button>
                              )}
                            {status !== "expected" && (
                              <Button
                                variant="outline"
                                className="h-12"
                                disabled={!canAct}
                                aria-label={`Undo attendance for ${a.name}`}
                                onClick={() => mark(a, "expected")}
                              >
                                Undo
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {!roster.length && (
                    <p className="p-8 text-sm text-muted-foreground">
                      {selected.attendees.length
                        ? "No players match this view."
                        : "No confirmed registrations yet."}
                    </p>
                  )}
                  <div className="border-t p-5 text-xs text-muted-foreground">
                    <p>
                      {selected.activity_kind === "rental"
                        ? "Check in each assigned player individually. Payment and required waivers must be complete."
                        : `${selected.waitlisted} waitlisted. Only confirmed registrations can check in.`}
                    </p>
                    {ended &&
                      selectedTotals.expected > 0 &&
                      !selected.canceled_at && (
                        <Button
                          variant="outline"
                          className="mt-3 min-h-11"
                          disabled={!canAct}
                          onClick={() =>
                            setClosing({
                              event: selected.id,
                              ids: selected.attendees
                                .filter(
                                  (a) =>
                                    !a.pending_payment &&
                                    attendanceStatus(a) === "expected",
                                )
                                .map((a) => a.id),
                            })
                          }
                        >
                          Close attendance · {selectedTotals.expected} unmarked
                        </Button>
                      )}
                    {!ended && (
                      <p className="mt-2">
                        No-shows can be recorded after this activity ends.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="p-8 text-sm text-muted-foreground">
                  {selectedId
                    ? "Choose an activity on this date or refresh attendance."
                    : "Choose a program, rental or lesson to open its player list."}
                </p>
              )}
            </div>
          </div>
        </>
      )}
      <Dialog
        open={!!closing}
        onOpenChange={(open) => {
          if (!open && !busy) setClosing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this activity’s attendance?</DialogTitle>
            <DialogDescription>
              Mark the remaining {closing?.ids.length} confirmed players as
              no-shows. Checked-in players stay unchanged. You can correct
              individual records afterward.
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={!canAct || !closing}
            onClick={() =>
              closing &&
              void act(
                () =>
                  selected?.activity_kind === "rental"
                    ? rpc("close_venue_arrival_attendance", {
                        p_venue: data!.venue_id,
                        p_activity: closing.event,
                        p_expected_ids: closing.ids,
                      })
                    : rpc("close_venue_event_attendance", {
                        p_event: closing.event,
                        p_expected_ids: closing.ids,
                      }),
                "Attendance closed. Remaining players marked as no-shows.",
              )
            }
          >
            {busy ? "Saving…" : `Mark ${closing?.ids.length ?? 0} no-shows`}
          </Button>
        </DialogContent>
      </Dialog>
      {party && selected && (
        <Dialog open onOpenChange={setParty}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Booking party</DialogTitle>
              <DialogDescription>
                Manage players assigned to this private booking.
              </DialogDescription>
            </DialogHeader>
            <RentalParty
              booking={selected.id}
              timeZone={timeZone || undefined}
            />
          </DialogContent>
        </Dialog>
      )}
      {player && (
        <ArrivalPlayerDialog
          customer={player}
          timeZone={timeZone || "America/New_York"}
          close={() => {
            setPlayer(null);
            void onRefresh();
          }}
        />
      )}
    </section>
  );
}
