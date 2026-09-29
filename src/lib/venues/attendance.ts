export interface VenueAttendee {
  walk_in?: boolean;
  missing_documents?: number;
  id: string;
  name: string;
  checked_in_at: string | null;
  no_show_at: string | null;
  version: number;
}
export interface AttendanceEvent {
  id: string;
  title: string;
  event_format: string;
  start_time: string;
  end_time: string;
  canceled_at: string | null;
  capacity: number | null;
  courts: string[];
  waitlisted: number;
  attendees: VenueAttendee[];
}
export interface AttendanceDay {
  venue_id: string;
  timezone: string;
  day: string;
  server_now: string;
  events: AttendanceEvent[];
}
export type AttendanceStatus = "expected" | "checked_in" | "no_show";
export function attendanceStatus(a: VenueAttendee): AttendanceStatus {
  return a.checked_in_at ? "checked_in" : a.no_show_at ? "no_show" : "expected";
}
export function attendanceTotals(events: AttendanceEvent[]) {
  const players = events
    .filter((e) => !e.canceled_at)
    .flatMap((e) => e.attendees);
  const checkedIn = players.filter(
    (a) => attendanceStatus(a) === "checked_in"
  ).length;
  const noShows = players.filter(
    (a) => attendanceStatus(a) === "no_show"
  ).length;
  return {
    registrations: players.length,
    checkedIn,
    noShows,
    expected: players.length - checkedIn - noShows,
  };
}
/** Formula-safe CSV; totals count registrations, including players in multiple events. */
export function attendanceCsv(day: AttendanceDay) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  const rows: unknown[][] = [
    [
      "Date",
      "Time zone",
      "Event",
      "Starts (UTC)",
      "Ends (UTC)",
      "Courts",
      "Status",
      "Confirmed",
      "Checked in",
      "Unmarked",
      "No-shows",
      "Waitlist",
    ],
  ];
  for (const e of day.events) {
    const t = attendanceTotals([e]);
    rows.push([
      day.day,
      day.timezone,
      e.title,
      e.start_time,
      e.end_time,
      e.courts.join("; "),
      e.canceled_at ? "Canceled" : "Scheduled",
      t.registrations,
      t.checkedIn,
      t.expected,
      t.noShows,
      e.waitlisted,
    ]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
