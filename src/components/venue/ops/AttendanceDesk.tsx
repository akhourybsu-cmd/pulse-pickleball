import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  Users,
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
    : events.find(
        (e) =>
          !e.canceled_at &&
          Date.parse(e.end_time) > Date.parse(data?.server_now ?? "")
      ) ?? events[0];
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
          : "Attendance could not be saved. Refresh and try again."
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
        rpc("record_venue_attendance", {
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
      }`
    );
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", attendanceCsv(data)], {
        type: "text/csv;charset=utf-8",
      })
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
        e.attendees.some((a) => a.name.toLocaleLowerCase().includes(needle)))
  );
  const roster =
    selected?.attendees.filter(
      (a) =>
        (filter === "all" || attendanceStatus(a) === filter) &&
        (!needle ||
          selected.title.toLocaleLowerCase().includes(needle) ||
          a.name.toLocaleLowerCase().includes(needle))
    ) ?? [];
  return (
    <section
      id="venue-attendance-desk"
      className="space-y-5"
      aria-label="Event attendance"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Welcome your players
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Event attendance · {timeZone ?? data?.timezone ?? "Venue time"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Previous operating day"
            disabled={busy}
            onClick={() => changeDay(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            aria-label="Operating date"
            className="h-11 w-auto"
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
            className="h-11 w-11"
            aria-label="Next operating day"
            disabled={busy}
            onClick={() => changeDay(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-11"
            disabled={busy}
            onClick={() => onDayChange(venueCalendarNow(timeZone))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
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
      <p className="text-sm font-medium">
        {day.toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
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
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              [
                totals.registrations,
                "Confirmed places",
                "Across all active events",
              ],
              [totals.checkedIn, "Checked in", "Arrivals recorded"],
              [totals.expected, "Unmarked", "Awaiting arrival or review"],
              [totals.noShows, "No-shows", "Recorded after events end"],
            ].map(([value, label, hint]) => (
              <div key={label} className="rounded-2xl border bg-card px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Totals count event registrations; a player in two events counts
            twice.{" "}
            {updatedAt
              ? `Updated ${formatSlotTime(
                  new Date(updatedAt),
                  timeZone
                )} · refreshes every 15 seconds.`
              : ""}
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-12 pl-10"
              aria-label="Search events or players"
              placeholder="Find an event or player…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)]">
            <nav
              aria-label="Day’s events"
              className="max-h-[540px] space-y-2 overflow-y-auto pr-1"
            >
              {(needle ? matches : events).map((e) => {
                const t = attendanceTotals([e]);
                return (
                  <button
                    type="button"
                    key={e.id}
                    disabled={busy}
                    aria-current={selected?.id === e.id ? "true" : undefined}
                    onClick={() => onSelect(e.id)}
                    className={cn(
                      "w-full rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/50",
                      selected?.id === e.id &&
                        "border-primary ring-1 ring-primary"
                    )}
                  >
                    <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {formatSlotTime(new Date(e.start_time), timeZone)} –{" "}
                      {formatSlotTime(new Date(e.end_time), timeZone)}
                      {e.canceled_at
                        ? " · Canceled"
                        : Date.parse(e.start_time) <=
                            Date.parse(data.server_now) &&
                          Date.parse(e.end_time) > Date.parse(data.server_now)
                        ? " · In progress"
                        : Date.parse(e.end_time) <= Date.parse(data.server_now)
                        ? " · Ended"
                        : ""}
                    </p>
                    <p className="mt-2 text-base font-semibold">{e.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.courts.join(" · ") || "No courts assigned"}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <span>
                        {t.checkedIn}/{t.registrations} checked in
                      </span>
                      <span>
                        {e.waitlisted > 0
                          ? `${e.waitlisted} waitlisted`
                          : e.event_format.replace(/_/g, " ")}
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
                    ? "No matching events or players on this date."
                    : "No events scheduled for this day. Court rentals are shown in the court calendar."}
                </p>
              )}
            </nav>
            <div className="min-w-0 rounded-2xl border bg-card">
              {selected ? (
                <>
                  <div className="border-b p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {selected.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selected.courts.join(" · ") || "No courts assigned"}{" "}
                          · {selected.attendees.length} confirmed
                        </p>
                      </div>
                      <Users className="h-5 w-5 text-muted-foreground" />
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
                          className="min-h-11"
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
                        "px-5 pt-4 text-sm text-emerald-700 dark:text-emerald-300"
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
                          <div>
                            <p
                              className={cn(
                                "font-semibold",
                                kiosk && "text-lg"
                              )}
                            >
                              {a.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {status === "checked_in"
                                ? `Checked in · ${formatSlotTime(
                                    new Date(a.checked_in_at!),
                                    timeZone
                                  )}`
                                : status === "no_show"
                                ? "No-show"
                                : ended
                                ? "Attendance needs review"
                                : "Expected"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {status !== "checked_in" && (
                              <Button
                                className="h-12 min-w-28"
                                disabled={!canAct}
                                onClick={() => mark(a, "checked_in")}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Check in
                              </Button>
                            )}
                            {status === "expected" && ended && (
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
                      {selected.waitlisted} waitlisted · only confirmed
                      registrations can check in.
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
                                  (a) => attendanceStatus(a) === "expected"
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
                        No-shows can be recorded after this event ends.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="p-8 text-sm text-muted-foreground">
                  {selectedId
                    ? "This event is not on this date. Choose an event or refresh attendance."
                    : "Choose a scheduled event to open its registration roster."}
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
            <DialogTitle>Close this event’s attendance?</DialogTitle>
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
                  rpc("close_venue_event_attendance", {
                    p_event: closing.event,
                    p_expected_ids: closing.ids,
                  }),
                "Attendance closed. Remaining players marked as no-shows."
              )
            }
          >
            {busy ? "Saving…" : `Mark ${closing?.ids.length ?? 0} no-shows`}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
