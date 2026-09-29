import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import { venueRpc as rpc } from "@/lib/venues/customerRecords";
import { localVenueDay, priceCents } from "@/lib/venues/deskSales";
import { formatMoney } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Rules {
  minimum_minutes: number;
  maximum_minutes: number;
  booking_days: number;
  member_booking_days: number;
  lead_minutes: number;
  cancellation_hours: number;
  updated_at: string;
}
interface Rate {
  id: string;
  name: string;
  court_id: string | null;
  days: number[];
  start_minute: number;
  end_minute: number;
  hourly_cents: number;
  updated_at: string;
}
interface PolicyWorkspace {
  can_manage: boolean;
  rules: Rules | null;
  rates: Rate[];
  closures: { id: string; day: string; reason: string }[];
  courts: { id: string; name: string; hourly_rate: number | null }[];
}
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(
    minute % 60
  ).padStart(2, "0")}`;
const minutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const fields = [
  ["minimum_minutes", "Minimum booking (minutes)", 30, 240, 30],
  ["maximum_minutes", "Maximum booking (minutes)", 30, 240, 240],
  ["booking_days", "Standard booking window (days)", 1, 180, 30],
  ["member_booking_days", "Member booking window (days)", 1, 180, 30],
  ["lead_minutes", "Minimum notice (minutes)", 35, 10080, 35],
  ["cancellation_hours", "Cancellation request notice (hours)", 0, 720, 24],
] as const;
export default function VenueBookingPolicies() {
  const { groupId = "" } = useParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const venue = group?.venue_id;
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [working, setWorking] = useState(false),
    [editing, setEditing] = useState<Rate | true | null>(null);
  const q = useQuery({
    queryKey: ["venue-booking-policies", venue, user?.id],
    enabled: !!venue && !!user,
    queryFn: () =>
      rpc<PolicyWorkspace>("venue_booking_policy_workspace", {
        p_venue: venue,
      }),
  });
  const w = q.data;
  async function act(fn: () => Promise<void>) {
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await q.refetch();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save booking settings."
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {group?.venue?.name || group?.name}
        </p>
        <h1 className="text-2xl font-bold">Booking rules & rates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control booking windows, member access, peak pricing and holiday
          closures.
        </p>
      </header>
      {(error || q.error) && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm"
        >
          {error || q.error?.message}
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
        <p>Loading booking settings…</p>
      ) : w && !q.isError ? (
        <>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Reservations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These rules apply to player bookings. Your desk can arrange
              current walk-ins. Existing paid reservations keep the terms
              accepted at purchase.
            </p>
            <form
              key={w.rules?.updated_at || "new"}
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const rules = Object.fromEntries(
                  fields.map(([key]) => [key, Number(f.get(key))])
                );
                void act(async () => {
                  await rpc("venue_booking_rules_save", {
                    p_venue: venue,
                    p_expected: w.rules?.updated_at || null,
                    p_rules: rules,
                  });
                  setNotice("Booking rules saved.");
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(([key, label, min, max, fallback]) => (
                  <label key={key} className="block text-sm">
                    {label}
                    <Input
                      name={key}
                      type="number"
                      required
                      min={min}
                      max={max}
                      step={key.includes("imum_minutes") ? 30 : 1}
                      defaultValue={w.rules?.[key] ?? fallback}
                      disabled={!w.can_manage}
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Member windows apply while a paid membership covers the booking.
                Cancellation requests remain subject to the venue’s published
                refund policy.
              </p>
              {w.can_manage && (
                <Button type="submit" disabled={working}>
                  {working ? "Saving…" : "Save booking rules"}
                </Button>
              )}
            </form>
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Peak & off-peak rates</h2>
                <p className="text-sm text-muted-foreground">
                  Outside these windows, courts use their base price from
                  Payments. Rates are calculated across the full booking.
                </p>
              </div>
              {w.can_manage && (
                <Button
                  onClick={() => {
                    setEditing(true);
                    setError("");
                  }}
                >
                  Add rate window
                </Button>
              )}
            </div>
            {w.rates.map((r) => (
              <article
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5"
              >
                <div>
                  <h3 className="font-semibold">
                    {r.name} · {formatMoney(r.hourly_cents)}/hour
                  </h3>
                  <p className="text-sm">
                    {r.days.map((d) => dayNames[d]).join(", ")} ·{" "}
                    {time(r.start_minute)}–{time(r.end_minute)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {w.courts.find((c) => c.id === r.court_id)?.name ||
                      "All courts"}{" "}
                    · {group?.venue?.timezone || "America/New_York"}
                  </p>
                </div>
                {w.can_manage && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      disabled={working}
                      onClick={() =>
                        void act(async () => {
                          await rpc("venue_rate_save", {
                            p_venue: venue,
                            p_id: r.id,
                            p_expected: r.updated_at,
                            p_rate: null,
                          });
                          setNotice("Rate window removed.");
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </article>
            ))}
            {!w.rates.length && (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                No rate windows yet. Your existing court prices apply.
              </p>
            )}
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Holiday closures</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Close a full venue day. Scheduled court allocations and active
              checkouts must be resolved first.
            </p>
            {w.can_manage && (
              <form
                className="mt-4 flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  void act(async () => {
                    await rpc("venue_holiday_save", {
                      p_venue: venue,
                      p_day: f.get("day"),
                      p_reason: f.get("reason"),
                    });
                    form.reset();
                    setNotice(
                      "Closure saved. New bookings and court allocations are blocked for that date."
                    );
                  });
                }}
              >
                <label className="text-sm">
                  Date
                  <Input
                    name="day"
                    type="date"
                    required
                    min={localVenueDay(
                      group?.venue?.timezone || "America/New_York"
                    )}
                  />
                </label>
                <label className="min-w-48 flex-1 text-sm">
                  Reason
                  <Input name="reason" required minLength={3} maxLength={500} />
                </label>
                <Button type="submit" disabled={working}>
                  Close date
                </Button>
              </form>
            )}
            {w.closures.map((c) => (
              <div
                key={c.id}
                className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
              >
                <p className="text-sm">
                  <strong>{c.day}</strong> · {c.reason}
                </p>
                {w.can_manage && (
                  <Button
                    variant="outline"
                    disabled={working}
                    onClick={() =>
                      void act(async () => {
                        await rpc("venue_holiday_save", {
                          p_venue: venue,
                          p_day: c.day,
                          p_reason: null,
                        });
                        setNotice("Date reopened.");
                      })
                    }
                  >
                    Reopen date
                  </Button>
                )}
              </div>
            ))}
          </section>
          <Dialog
            open={!!editing}
            onOpenChange={(v) => !v && !working && setEditing(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing === true ? "Add rate window" : "Edit rate window"}
                </DialogTitle>
                <DialogDescription>
                  Use venue-local times. A court-specific rate takes precedence
                  over an all-court rate.
                </DialogDescription>
              </DialogHeader>
              {editing && (
                <form
                  key={editing === true ? "new" : editing.id}
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void act(async () => {
                      await rpc("venue_rate_save", {
                        p_venue: venue,
                        p_id: editing === true ? null : editing.id,
                        p_expected:
                          editing === true ? null : editing.updated_at,
                        p_rate: {
                          name: f.get("name"),
                          court_id: f.get("court") || null,
                          days: f.getAll("days").map(Number),
                          start_minute: minutes(String(f.get("start"))),
                          end_minute:
                            f.get("end_midnight") === "on"
                              ? 1440
                              : minutes(String(f.get("end"))),
                          hourly_cents: priceCents(f.get("price")),
                        },
                      });
                      setEditing(null);
                      setNotice("Rate window saved.");
                    });
                  }}
                >
                  <label className="block text-sm">
                    Name
                    <Input
                      name="name"
                      required
                      maxLength={100}
                      defaultValue={editing === true ? "" : editing.name}
                    />
                  </label>
                  <label className="block text-sm">
                    Court
                    <select
                      name="court"
                      className="h-10 w-full rounded-md border bg-background px-3"
                      defaultValue={
                        editing === true ? "" : editing.court_id || ""
                      }
                    >
                      <option value="">All courts</option>
                      {w.courts.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend className="mb-2 text-sm">Days</legend>
                    <div className="flex flex-wrap gap-3">
                      {dayNames.map((name, i) => (
                        <label
                          key={name}
                          className="flex items-center gap-1 text-sm"
                        >
                          <input
                            name="days"
                            type="checkbox"
                            value={i}
                            defaultChecked={
                              editing === true ? true : editing.days.includes(i)
                            }
                          />
                          {name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm">
                      Starts
                      <Input
                        name="start"
                        type="time"
                        required
                        defaultValue={
                          editing === true
                            ? "17:00"
                            : time(editing.start_minute)
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Ends
                      <Input
                        name="end"
                        type="time"
                        required
                        defaultValue={
                          editing === true
                            ? "21:00"
                            : time(
                                editing.end_minute === 1440
                                  ? 0
                                  : editing.end_minute
                              )
                        }
                      />
                    </label>
                  </div>
                  <label className="flex gap-2 text-sm">
                    <input
                      name="end_midnight"
                      type="checkbox"
                      defaultChecked={
                        editing !== true && editing.end_minute === 1440
                      }
                    />
                    End at midnight (24:00)
                  </label>
                  <label className="block text-sm">
                    Hourly price ($)
                    <Input
                      name="price"
                      required
                      type="number"
                      min="1"
                      step="0.01"
                      max="999999.99"
                      defaultValue={
                        editing === true
                          ? ""
                          : (editing.hourly_cents / 100).toFixed(2)
                      }
                    />
                  </label>
                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <Button type="submit" disabled={working}>
                    {working ? "Saving…" : "Save rate window"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </main>
  );
}
