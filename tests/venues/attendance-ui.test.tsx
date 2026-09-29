import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AttendanceDesk,
  type AttendanceDeskProps,
} from "@/components/venue/ops/AttendanceDesk";
import {
  attendanceCsv,
  attendanceTotals,
  type AttendanceDay,
} from "@/lib/venues/attendance";
import { venueAdminHref, venueAdminItems } from "@/lib/venues/adminNavigation";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const data: AttendanceDay = {
  venue_id: "v",
  day: "2026-09-28",
  timezone: "America/New_York",
  server_now: "2026-09-28T16:00:00Z",
  events: [
    {
      id: "e",
      title: "Skills clinic",
      event_format: "clinic",
      start_time: "2026-09-28T12:00:00Z",
      end_time: "2026-09-28T14:00:00Z",
      canceled_at: null,
      capacity: 10,
      courts: ["Court 1", "Court 5"],
      waitlisted: 2,
      attendees: [
        {
          id: "a",
          name: "Alex S.",
          checked_in_at: "2026-09-28T12:00:00Z",
          no_show_at: null,
          version: 1,
        },
        {
          id: "b",
          name: "Jordan K.",
          checked_in_at: null,
          no_show_at: null,
          version: 0,
        },
      ],
    },
  ],
};
const render = (props: Partial<AttendanceDeskProps> = {}) =>
  renderToStaticMarkup(
    <AttendanceDesk
      data={data}
      day={new Date(2026, 8, 28)}
      timeZone={data.timezone}
      loading={false}
      failed={false}
      refreshing={false}
      updatedAt={0}
      selectedId="e"
      onSelect={() => {}}
      onDayChange={() => {}}
      onRefresh={async () => {}}
      {...props}
    />
  );
describe("front desk presentation", () => {
  it("shows exact venue-local times, courts, initials and attendance controls", () => {
    const html = render();
    for (const text of [
      "8:00 AM",
      "10:00 AM",
      "Court 1",
      "Court 5",
      "Alex S.",
      "Jordan K.",
      "Close attendance",
      "2 waitlisted",
      "Check in",
      "Undo",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("Surname");
  });
  it("hides stale rosters and disables action when verification fails", () => {
    const html = render({ failed: true });
    expect(html).toContain("Attendance could not be confirmed");
    expect(html).not.toContain("Alex S.");
    expect(html).not.toContain("Close attendance");
  });
  it("does not offer event close before the event ends", () => {
    expect(
      render({ data: { ...data, server_now: "2026-09-28T12:30:00Z" } })
    ).not.toContain("Close attendance");
  });
  it("keeps kiosk controls focused and handles an empty day honestly", () => {
    expect(render({ kiosk: true })).not.toContain("Daily report");
    const html = render({ data: { ...data, events: [] } });
    expect(html).toContain("No events scheduled");
    expect(html).not.toContain("Alex S.");
  });
  it("counts registrations once per event, excludes cancellations and distinguishes unmarked from no-shows", () => {
    expect(
      attendanceTotals([
        ...data.events,
        { ...data.events[0], id: "second" },
        { ...data.events[0], id: "canceled", canceled_at: "2026-09-28" },
      ])
    ).toEqual({ registrations: 4, checkedIn: 2, noShows: 0, expected: 2 });
  });
  it("exports date, time zone and event totals without player data or spreadsheet formulas", () => {
    const csv = attendanceCsv({
      ...data,
      events: [{ ...data.events[0], title: '=HYPERLINK("url")' }],
    });
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("America/New_York");
    expect(csv).toContain("2026-09-28");
    expect(csv).not.toContain("Alex");
  });
  it("limits staff navigation to operations and keeps all manager tools under the venue", () => {
    expect(
      venueAdminItems({
        manage: false,
        programs: false,
        operate: true,
        community: false,
        facility: true,
      }).map((i) => i.value)
    ).toEqual(["ops"]);
    const items = venueAdminItems({
      manage: true,
      programs: true,
      operate: true,
      community: true,
      facility: true,
    });
    for (const item of items)
      expect(venueAdminHref("g", item.value)).toMatch(
        /^\/player\/community\/group\/g\//
      );
    expect(items.map((i) => i.value)).toEqual(
      expect.arrayContaining([
        "events",
        "competitions",
        "ops",
        "profile",
        "staff",
        "integrations",
      ])
    );
  });
});
