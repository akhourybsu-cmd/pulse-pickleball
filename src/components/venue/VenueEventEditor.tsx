import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { venueCalendarNow } from "@/lib/venues/timezone";
import {
  programWindows,
  endAfterDuration,
  allocateAvailableCourts,
} from "@/lib/venues/programScheduling";
import { fetchProgramAvailability } from "@/lib/venues/programAvailability";
import { eventSchedule, EVENT_LABELS } from "@/lib/venues/eventPresentation";
import { formatMoney } from "@/lib/payments";
import {
  type EventDocument,
  type EventDraft,
  type ManagedEvent,
  type EventWorkspace,
  validateEventDocument,
  eventManagementRpc,
} from "@/lib/venues/eventManagement";
import type { RecurringFrequency } from "@/components/community/event-wizard/types";
import type { ReactNode } from "react";

export function EventField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      {label}
      {children}
      {hint && (
        <span className="text-xs font-normal leading-5 text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}
const selectStyle =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";
export function VenueEventEditor({
  workspace,
  draft,
  event,
  initial,
  onSave,
  onClose,
  working,
}: {
  workspace: EventWorkspace;
  draft?: EventDraft;
  event?: ManagedEvent;
  initial?: EventDocument;
  onSave: (document: EventDocument, publish: boolean) => Promise<void>;
  onClose: () => void;
  working: boolean;
}) {
  const tz = workspace.venue.timezone;
  const seed = initial ?? draft?.document;
  const first = seed?.occurrences?.[0];
  const start = first?.start_time ?? event?.start_time;
  const end = first?.end_time ?? event?.end_time;
  const dateTime = start
    ? venueCalendarNow(tz, new Date(start))
    : venueCalendarNow(tz, new Date(Date.now() + 86400000));
  const [title, setTitle] = useState(seed?.title ?? event?.title ?? "");
  const [description, setDescription] = useState(
    seed?.description ?? event?.description ?? ""
  );
  const [kind, setKind] = useState<EventDocument["event_format"]>(
    seed?.event_format ?? event?.event_format ?? "open_play"
  );
  const [date, setDate] = useState(format(dateTime, "yyyy-MM-dd"));
  const [time, setTime] = useState(start ? format(dateTime, "HH:mm") : "18:00");
  const [duration, setDuration] = useState(
    start && end
      ? (new Date(end).getTime() - new Date(start).getTime()) / 60000
      : 90
  );
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    seed?.frequency ?? "weekly"
  );
  const [count, setCount] = useState(seed?.occurrences?.length ?? 1);
  const [capacity, setCapacity] = useState(
    seed?.capacity ?? event?.capacity ?? 16
  );
  const [price, setPrice] = useState(
    ((seed?.price_cents ?? event?.price_cents ?? 0) / 100).toFixed(2)
  );
  const [courtIds, setCourtIds] = useState(
    seed?.court_ids ?? event?.court_ids ?? []
  );
  const [courtCount, setCourtCount] = useState(courtIds.length || 1);
  const [waitlist, setWaitlist] = useState(
    seed?.waitlist_enabled ?? event?.waitlist_enabled ?? true
  );
  const [waitlistLimit, setWaitlistLimit] = useState(
    String(seed?.waitlist_limit ?? event?.waitlist_limit ?? "")
  );
  const [min, setMin] = useState(
    String(seed?.skill_level_min ?? event?.skill_level_min ?? "")
  );
  const [max, setMax] = useState(
    String(seed?.skill_level_max ?? event?.skill_level_max ?? "")
  );
  const [cutoff, setCutoff] = useState(
    seed?.close_minutes ??
      (event?.registration_closes_at
        ? Math.round(
            (new Date(event.start_time).getTime() -
              new Date(event.registration_closes_at).getTime()) /
              60000
          )
        : 0)
  );
  const [paused, setPaused] = useState(
    seed?.registration_paused ?? event?.registration_paused ?? false
  );
  const [policy, setPolicy] = useState(
    seed?.cancellation_policy ?? event?.cancellation_policy ?? ""
  );
  const [games, setGames] = useState(
    seed?.rr_games_per_player ?? event?.rr_games_per_player ?? 3
  );
  const [rotation, setRotation] = useState(
    seed?.rotation_style ?? event?.rotation_style ?? ""
  );
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"occurrence" | "following" | "all">(
    "occurrence"
  );
  const [skipDates, setSkipDates] = useState<string[]>([]);
  const series = useQuery({
    queryKey: ["venue-series-preview", event?.id, scope],
    enabled: !!event,
    queryFn: () =>
      eventManagementRpc<NonNullable<EventDocument["series_preview"]>>(
        "venue_series_preview",
        { p_event: event!.id, p_scope: scope }
      ),
    refetchOnWindowFocus: false,
  });
  const windows = useMemo(
    () =>
      programWindows(
        date,
        time,
        endAfterDuration(time, duration),
        frequency,
        event ? 1 : count,
        tz
      ),
    [date, time, duration, frequency, count, tz, event]
  );
  const availability = useQuery({
    queryKey: [
      "event-editor-courts",
      workspace.venue.id,
      event?.id,
      windows.map((w) => w.start.toISOString() + w.end.toISOString()),
    ],
    enabled: windows.length > 0,
    queryFn: () =>
      fetchProgramAvailability(workspace.venue.id, windows, event?.id),
    staleTime: 0,
    refetchInterval: 30000,
  });
  const busy = new Set(
    (availability.data ?? [])
      .filter(
        (s) =>
          !s.parent_event_id ||
          !series.data?.some((e) => e.id === s.parent_event_id)
      )
      .filter((s) =>
        windows.some(
          (w) =>
            new Date(s.start_time) < w.end &&
            s.end_time &&
            new Date(s.end_time) > w.start
        )
      )
      .map((s) => s.venue_court_id!)
  );
  const chosen = courtIds.filter(
    (id) => workspace.courts.some((c) => c.id === id) && !busy.has(id)
  );
  const locked = !!event && (event.going > 0 || event.pending > 0);
  async function save(publish: boolean) {
    setError("");
    const d: EventDocument = {
      edit_scope: scope,
      series_preview: series.data,
      skip_dates: skipDates,
      frequency,
      title: title.trim(),
      description,
      event_format: kind,
      capacity,
      price_cents: Math.round(Number(price) * 100),
      court_ids: courtIds,
      occurrences: windows.map((w) => ({
        start_time: w.start.toISOString(),
        end_time: w.end.toISOString(),
      })),
      close_minutes: cutoff,
      registration_paused: paused,
      cancellation_policy: policy.trim() || null,
      waitlist_enabled: waitlist,
      waitlist_limit: waitlistLimit === "" ? null : Number(waitlistLimit),
      skill_level_min: min === "" ? null : Number(min),
      skill_level_max: max === "" ? null : Number(max),
      rotation_style: rotation || null,
      rr_games_per_player: kind === "round_robin" ? games : null,
    };
    try {
      if (!/^\d+(\.\d{1,2})?$/.test(price))
        throw new Error("Enter a price with no more than two decimal places.");
      if (publish || event) {
        if (event && (!series.data || series.isError || series.isFetching))
          throw new Error("Preview the affected occurrences before saving.");
        validateEventDocument(d);
        if (availability.isPending || availability.isError)
          throw new Error(
            "Court availability must be checked before publishing."
          );
        if (chosen.length !== courtCount || courtIds.length !== courtCount)
          throw new Error("Select the requested number of available courts.");
      }
      await onSave(d, publish);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The event could not be saved."
      );
    }
  }
  return (
    <section className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {event ? "Published event" : draft ? "Saved draft" : "New event"}
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {event ? "Edit this occurrence" : "Build your event"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Times use {tz || "the venue time zone"}. Drafts do not block courts.
          </p>
        </div>
        <Button variant="ghost" disabled={working} onClick={onClose}>
          Close
        </Button>
      </div>
      <fieldset disabled={working} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <EventField label="Event name">
            <Input
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Evening open play"
            />
          </EventField>
          <EventField label="Event type">
            <select
              className={selectStyle}
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              {[
                "open_play",
                "clinic",
                "practice",
                "round_robin",
                "social",
                "other",
              ].map((k) => (
                <option key={k} value={k}>
                  {EVENT_LABELS[k]}
                </option>
              ))}
            </select>
          </EventField>
        </div>
        <EventField label="Description">
          <Textarea
            maxLength={5000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What players can expect, what to bring, and how the session works."
          />
        </EventField>
        <div className="grid gap-4 sm:grid-cols-3">
          <EventField label="Date">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </EventField>
          <EventField label="Start time">
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </EventField>
          <EventField label="Duration (minutes)">
            <Input
              type="number"
              min={15}
              max={720}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </EventField>
        </div>
        {!event && (
          <div className="grid gap-4 sm:grid-cols-2">
            <EventField
              label="Number of sessions"
              hint="All dates publish together, or none do if a court is unavailable."
            >
              <Input
                type="number"
                min={1}
                max={12}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(12, Number(e.target.value))))
                }
              />
            </EventField>
            <EventField label="Repeat">
              <select
                className={selectStyle}
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as RecurringFrequency)
                }
              >
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="biweekly">Every two weeks</option>
              </select>
            </EventField>
          </div>
        )}
        <section className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <EventField label="Courts needed">
              <Input
                className="w-24"
                type="number"
                min={1}
                max={workspace.courts.length || 1}
                value={courtCount}
                onChange={(e) => setCourtCount(Number(e.target.value))}
              />
            </EventField>
            <Button
              type="button"
              variant="outline"
              disabled={availability.isPending || availability.isError}
              onClick={() =>
                setCourtIds(
                  allocateAvailableCourts(
                    workspace.courts,
                    busy,
                    courtCount,
                    courtIds
                  )
                )
              }
            >
              Assign available courts
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {workspace.courts.map((c) => (
              <label
                key={c.id}
                className="flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={courtIds.includes(c.id)}
                  disabled={busy.has(c.id)}
                  onChange={(e) =>
                    setCourtIds(
                      e.target.checked
                        ? [...courtIds, c.id]
                        : courtIds.filter((id) => id !== c.id)
                    )
                  }
                />
                {c.name || `Court ${c.court_number}`}
                {busy.has(c.id) && " · Unavailable"}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {availability.isPending
              ? "Checking every date…"
              : availability.isError
              ? "Availability could not be verified."
              : `${chosen.length} of ${courtCount} courts selected for the full duration of every date.`}{" "}
            Open courts remain available for reservations.
          </p>
          {availability.isError && (
            <Button variant="ghost" onClick={() => void availability.refetch()}>
              Retry availability
            </Button>
          )}
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
          <EventField label="Player capacity">
            <Input
              type="number"
              min={1}
              max={5000}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </EventField>
          <EventField
            label="Price per player (USD)"
            hint={
              locked
                ? "Price is locked while players are registered or checking out."
                : "0 is free. Paid prices include applicable taxes."
            }
          >
            <Input
              disabled={locked}
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </EventField>
          <EventField
            label="Close registration before start"
            hint="Minutes before the event; 0 closes at start."
          >
            <Input
              type="number"
              min={0}
              max={43200}
              value={cutoff}
              onChange={(e) => setCutoff(Number(e.target.value))}
            />
          </EventField>
        </div>
        {Number(price) > 0 && !workspace.accepting_event_payments && (
          <p className="rounded-xl bg-amber-500/10 p-3 text-sm leading-6">
            Event payments are not enabled. You can save this price, but players
            cannot purchase places until the owner completes payment setup and
            enables event payments.
          </p>
        )}
        {kind === "round_robin" && (
          <EventField
            label="Games per player"
            hint="Copied into the round robin when you set it up for match play."
          >
            <Input
              type="number"
              min={1}
              max={20}
              value={games}
              onChange={(e) => setGames(Number(e.target.value))}
            />
          </EventField>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <EventField label="Minimum skill (optional)">
            <Input
              type="number"
              min={0}
              max={8}
              step="0.25"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </EventField>
          <EventField label="Maximum skill (optional)">
            <Input
              type="number"
              min={0}
              max={8}
              step="0.25"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </EventField>
          <EventField label="Play format">
            <select
              className={selectStyle}
              value={rotation}
              onChange={(e) => setRotation(e.target.value)}
            >
              <option value="">No set rotation</option>
              {[
                ["paddle_stack", "Paddle stack"],
                ["timed_rotation", "Timed rotation"],
                ["winners_stay", "Winners stay"],
                ["organized_games", "Organized games"],
                ["coach_led", "Coach led"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </EventField>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={waitlist}
              onChange={(e) => setWaitlist(e.target.checked)}
            />
            Enable waitlist
          </label>
          {waitlist && (
            <EventField label="Waitlist limit (optional)">
              <Input
                className="w-32"
                type="number"
                min={0}
                max={5000}
                value={waitlistLimit}
                onChange={(e) => setWaitlistLimit(e.target.value)}
              />
            </EventField>
          )}
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={paused}
              onChange={(e) => setPaused(e.target.checked)}
            />
            Pause new registrations
          </label>
        </div>
        <EventField
          label="Event cancellation policy (optional)"
          hint="Leave blank to use the venue's saved payment policy. Paid checkouts keep the policy accepted at purchase."
        >
          <Textarea
            rows={3}
            maxLength={2000}
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
          />
        </EventField>
        <section className="rounded-2xl bg-muted/40 p-4">
          <h3 className="text-sm font-semibold">
            Review schedule ·{" "}
            {Number(price) > 0
              ? `${formatMoney(Math.round(Number(price) * 100))} per player`
              : "Free"}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {windows.map((w) => {
              const s = eventSchedule(
                w.start.toISOString(),
                w.end.toISOString(),
                tz
              );
              return (
                <li key={w.start.toISOString()}>
                  {s?.label} · {s?.time} {s?.zone}
                </li>
              );
            })}
          </ul>
          {!windows.length && (
            <p className="mt-2 text-sm">
              Choose a start time and duration that end on the same day.
            </p>
          )}
        </section>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 p-3 text-sm"
          >
            {error}
          </p>
        )}
        {event && (
          <section className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">Apply changes to</h3>
            <select
              className={selectStyle}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as typeof scope);
                setSkipDates([]);
              }}
            >
              <option value="occurrence">This occurrence</option>
              {event.series_id && (
                <>
                  <option value="following">
                    This and following occurrences
                  </option>
                  <option value="all">
                    All upcoming occurrences in this series
                  </option>
                </>
              )}
            </select>
            <p className="text-xs text-muted-foreground">
              Completed and started events stay in your history. Times shift in
              the venue’s time zone. Every affected court and registration is
              checked together; a conflict saves none of the changes.
            </p>
            {series.isPending ? (
              <p>Loading occurrences…</p>
            ) : series.error ? (
              <p role="alert">
                {series.error.message}{" "}
                <button
                  onClick={() => void series.refetch()}
                  className="underline"
                >
                  Retry
                </button>
              </p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {series.data?.length} occurrence(s) will be updated. Check a
                  date below to cancel it as a holiday or series exception.
                </p>
                <div className="max-h-44 space-y-2 overflow-auto">
                  {series.data
                    ?.slice()
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((e) => {
                      const day = format(
                        venueCalendarNow(tz, new Date(e.start_time)),
                        "yyyy-MM-dd"
                      );
                      return (
                        <label key={e.id} className="flex gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={skipDates.includes(day)}
                            onChange={(x) =>
                              setSkipDates(
                                x.target.checked
                                  ? [...skipDates, day]
                                  : skipDates.filter((d) => d !== day)
                              )
                            }
                          />
                          {eventSchedule(e.start_time, null, tz)?.label} ·
                          Cancel this date
                        </label>
                      );
                    })}
                </div>
              </>
            )}
          </section>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          {!event && (
            <Button variant="outline" onClick={() => void save(false)}>
              Save draft
            </Button>
          )}
          <Button
            disabled={!workspace.facility_enabled}
            onClick={() => void save(true)}
          >
            {working
              ? "Saving…"
              : event
              ? "Save event"
              : `Publish ${
                  windows.length > 1 ? `${windows.length} events` : "event"
                }`}
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
