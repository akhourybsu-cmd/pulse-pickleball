import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useAuthState } from "@/hooks/useAuthState";
import { venueRpc as rpc } from "@/lib/venues/customerRecords";
import { localVenueDay } from "@/lib/venues/deskSales";
import { formatMoney } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Report = {
  timezone: string;
  from: string;
  to: string;
  gross_cents: number;
  refunded_cents: number;
  net_cents: number;
  cash_cents: number;
  stripe_cents: number;
  registrations: number;
  checked_in: number;
  no_shows: number;
  unique_players: number;
  repeat_players: number;
  returning_attendees: number;
  available_hours: number;
  booked_hours: number;
  courts: {
    id: string;
    name: string;
    available_hours: number;
    booked_hours: number;
  }[];
  daily: {
    day: string;
    gross_cents: number;
    refunded_cents: number;
    net_cents: number;
  }[];
  programs: {
    event_format: string;
    registrations: number;
    checked_in: number;
    no_shows: number;
  }[];
  time_slots: {
    weekday: number;
    hour: number;
    registrations: number;
    checked_in: number;
  }[];
};
const count = (n: number) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
export function reportCsv(r: Report) {
  const rows: unknown[][] = [
    ["Venue operating report", r.from, r.to, r.timezone],
    ["Gross USD", r.gross_cents / 100],
    ["Refunds against these sales USD", r.refunded_cents / 100],
    ["Net before fees USD", r.net_cents / 100],
    ["Registrations", r.registrations],
    ["Check-ins", r.checked_in],
    ["No-shows", r.no_shows],
    ["Unique players", r.unique_players],
    ["Repeat attendees", r.returning_attendees],
    [],
    ["Court", "Booked hours", "Available hours"],
    ...r.courts.map((c) => [c.name, c.booked_hours, c.available_hours]),
    [],
    ["Date", "Gross USD", "Refunds USD", "Net USD"],
    ...r.daily.map((d) => [
      d.day,
      d.gross_cents / 100,
      d.refunded_cents / 100,
      d.net_cents / 100,
    ]),
    [],
    ["Program", "Registrations", "Check-ins", "No-shows"],
    ...r.programs.map((p) => [
      p.event_format,
      p.registrations,
      p.checked_in,
      p.no_shows,
    ]),
    [],
    ["Weekday (Sunday=0)", "Hour", "Registrations", "Check-ins"],
    ...r.time_slots.map((t) => [
      t.weekday,
      t.hour,
      t.registrations,
      t.checked_in,
    ]),
  ];
  return rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v ?? "");
          if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replace(/"/g, '""') + '"';
        })
        .join(",")
    )
    .join("\r\n");
}
export default function VenueReports() {
  const { groupId = "" } = useParams();
  const { group } = useGroupDetail(groupId);
  const { user } = useAuthState();
  const venue = group?.venue_id;
  const tz = group?.venue?.timezone || "America/New_York";
  const today = localVenueDay(tz);
  const [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today);
  const q = useQuery({
    queryKey: ["venue-report", venue, user?.id, from, to],
    enabled: !!venue && !!user && !!from && !!to,
    queryFn: () =>
      rpc<Report>("venue_operating_report", {
        p_venue: venue,
        p_from: from,
        p_to: to,
      }),
  });
  const r = q.data;
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {group?.venue?.name || group?.name}
        </p>
        <h1 className="text-2xl font-bold">Venue reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue, attendance and court use in your venue’s time zone.
        </p>
      </header>
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
        <Button
          variant="outline"
          disabled={!r || q.isFetching}
          onClick={() => {
            if (!r) return;
            const url = URL.createObjectURL(
              new Blob([reportCsv(r)], { type: "text/csv;charset=utf-8;" })
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `venue-report-${from}-${to}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Refresh
        </Button>
      </div>
      {q.error && (
        <p role="alert" className="text-destructive">
          {q.error.message}
        </p>
      )}
      {q.isPending ? (
        <p>Loading report…</p>
      ) : (
        r && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Net revenue", formatMoney(Number(r.net_cents))],
                ["Check-ins", count(r.checked_in)],
                ["No-shows", count(r.no_shows)],
                [
                  "Court utilization",
                  Number(r.available_hours) > 0
                    ? `${Math.round(
                        (Number(r.booked_hours) / Number(r.available_hours)) *
                          100
                      )}%`
                    : "—",
                ],
                ["Gross collections", formatMoney(Number(r.gross_cents))],
                ["Refunds", formatMoney(Number(r.refunded_cents))],
                ["Unique players", count(r.unique_players)],
                ["Repeat attendees", count(r.returning_attendees)],
              ].map(([label, value]) => (
                <article key={label} className="rounded-2xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {value}
                  </p>
                </article>
              ))}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Collections use payment dates. Refunds are amounts refunded to
              date against those sales; net is before processing fees. Cash:{" "}
              {formatMoney(Number(r.cash_cents))} · Stripe:{" "}
              {formatMoney(Number(r.stripe_cents))}. Attendance includes
              recorded event registrations and desk visits. Utilization compares
              confirmed court blocks with the current active courts, opening
              hours and holiday closures; pending checkouts are excluded.
            </p>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 text-lg font-semibold">Court use</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {r.courts.map((c) => (
                  <div key={c.id}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span>
                        {count(c.booked_hours)} / {count(c.available_hours)}{" "}
                        hours
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            Number(c.available_hours) > 0
                              ? (Number(c.booked_hours) /
                                  Number(c.available_hours)) *
                                  100
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="overflow-x-auto rounded-2xl border bg-card p-5">
                <h2 className="mb-3 text-lg font-semibold">
                  Program attendance
                </h2>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Program</th>
                      <th className="p-2">Booked</th>
                      <th className="p-2">In</th>
                      <th className="p-2">No-show</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.programs.map((p) => (
                      <tr className="border-t" key={p.event_format}>
                        <th className="p-2 font-medium">
                          {p.event_format.replace(/_/g, " ")}
                        </th>
                        <td className="p-2">{p.registrations}</td>
                        <td className="p-2">{p.checked_in}</td>
                        <td className="p-2">{p.no_shows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!r.programs.length && (
                  <p className="text-sm text-muted-foreground">
                    No registrations in this range.
                  </p>
                )}
              </section>
              <section className="overflow-x-auto rounded-2xl border bg-card p-5">
                <h2 className="mb-3 text-lg font-semibold">
                  Popular arrival times
                </h2>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Venue time</th>
                      <th className="p-2">Booked</th>
                      <th className="p-2">In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.time_slots.map((t) => (
                      <tr className="border-t" key={`${t.weekday}-${t.hour}`}>
                        <th className="p-2 font-medium">
                          {
                            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                              t.weekday
                            ]
                          }{" "}
                          · {String(t.hour).padStart(2, "0")}:00
                        </th>
                        <td className="p-2">{t.registrations}</td>
                        <td className="p-2">{t.checked_in}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!r.time_slots.length && (
                  <p className="text-sm text-muted-foreground">
                    No arrivals in this range.
                  </p>
                )}
              </section>
            </div>
          </>
        )
      )}
    </main>
  );
}
