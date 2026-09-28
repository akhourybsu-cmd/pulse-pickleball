import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  categoryLabels,
  DEMO_TIME_ZONE,
  demoPhotos,
  demoPhotoUrl,
  demoPrograms,
  isRallyHausDemo,
  nextDemoOccasions,
  rallyHausSchedule,
  RALLY_HAUS_GROUP_ID,
  RALLY_HAUS_VENUE_ID,
} from "@/lib/venues/rallyHausDemo";
import RallyHausDemoPage from "@/components/venue/RallyHausDemoPage";

vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ isAuthenticated: false }),
}));
const group = {
  id: RALLY_HAUS_GROUP_ID,
  name: "Rally Haus Sports",
  icon_url: null,
  venue: null,
};
const render = (query = "") =>
  renderToStaticMarkup(
    <MemoryRouter
      initialEntries={["/venues/rally-haus-sports-d99d7de3" + query]}
    >
      <RallyHausDemoPage group={group} />
    </MemoryRouter>
  );

describe("Rally Haus showcase scope and rolling calendar", () => {
  it("requires the exact venue and community and preserves a live escape route", () => {
    expect(
      isRallyHausDemo(
        RALLY_HAUS_VENUE_ID,
        RALLY_HAUS_GROUP_ID,
        new URLSearchParams()
      )
    ).toBe(true);
    for (const [venue, community] of [
      [null, RALLY_HAUS_GROUP_ID],
      ["other", RALLY_HAUS_GROUP_ID],
      [RALLY_HAUS_VENUE_ID, "other"],
    ]) {
      expect(isRallyHausDemo(venue, community!, new URLSearchParams())).toBe(
        false
      );
    }
    expect(
      isRallyHausDemo(
        RALLY_HAUS_VENUE_ID,
        RALLY_HAUS_GROUP_ID,
        new URLSearchParams("demo=off")
      )
    ).toBe(false);
  });
  it("provides all 18 programs, ten categories, open and full sessions, and local photos", () => {
    const sessions = rallyHausSchedule(new Date("2026-09-27T12:00:00Z"));
    expect(new Set(sessions.map((s) => s.key)).size).toBe(132);
    expect(new Set(sessions.map((s) => s.day)).size).toBe(14);
    expect(new Set(sessions.map((s) => s.id)).size).toBe(18);
    expect(new Set(demoPrograms.map((s) => s.category)).size).toBe(
      Object.keys(categoryLabels).length
    );
    expect(demoPrograms.some((p) => p.capacity === p.attending)).toBe(true);
    expect(demoPrograms.some((p) => p.price === 0)).toBe(true);
    for (const photo of demoPhotos)
      expect(existsSync("public" + demoPhotoUrl(photo.id))).toBe(true);
    for (const p of demoPrograms)
      expect(demoPhotos.some((photo) => photo.id === p.image)).toBe(true);
  });
  it("retains Eastern wall times across daylight saving and stable keys on the same day", () => {
    const now = new Date("2026-10-31T23:30:00Z");
    const sessions = rallyHausSchedule(now);
    const morning = sessions.filter((s) => s.id === "morning");
    expect(morning[0].start).toContain("T12:00:00");
    expect(morning[1].start).toContain("T13:00:00");
    for (const s of morning)
      expect(
        new Date(s.start).toLocaleTimeString("en-US", {
          timeZone: DEMO_TIME_ZONE,
          hour: "numeric",
          minute: "2-digit",
        })
      ).toBe("8:00 AM");
    expect(sessions.map((s) => s.key)).toEqual(
      rallyHausSchedule(new Date("2026-11-01T03:30:00Z")).map((s) => s.key)
    );
    expect(sessions.every((s) => Date.parse(s.end) > Date.parse(s.start))).toBe(
      true
    );
  });
  it("shows one upcoming occurrence of each special event, including after late-night rollover", () => {
    const now = new Date("2026-09-28T03:59:00Z");
    const occasions = nextDemoOccasions(rallyHausSchedule(now), now);
    expect(occasions.length).toBe(10);
    expect(new Set(occasions.map((s) => s.id)).size).toBe(10);
    expect(occasions.every((s) => Date.parse(s.end) > now.getTime())).toBe(
      true
    );
  });
});

describe("Rally Haus showcase surfaces", () => {
  it("keeps weekly events on the same future dates as the horizon advances", () => {
    const a = rallyHausSchedule(new Date("2026-09-27T12:00:00Z"));
    const b = rallyHausSchedule(new Date("2026-09-28T12:00:00Z"));
    expect(a.filter((s) => s.day === "2026-10-03").map((s) => s.key)).toEqual(
      b.filter((s) => s.day === "2026-10-03").map((s) => s.key)
    );
    expect(
      a
        .filter((s) => s.id === "tournament")
        .every(
          (s) =>
            new Date(s.start).toLocaleDateString("en-US", {
              weekday: "long",
              timeZone: DEMO_TIME_ZONE,
            }) === "Saturday"
        )
    ).toBe(true);
  });
  it("identifies samples and provides a live venue link without made-up member counts", () => {
    const html = render();
    expect(html).toContain("DEMO VENUE");
    expect(html).toContain("demo=off");
    expect(html).toContain("Coming up at the Haus");
    expect(html).toContain("Rally Haus Weekend Classic");
    expect(html).toContain("All 10 photos");
    expect(html).toContain("do not depict Rally Haus");
    expect(html).not.toContain("community members");
  });
  it("separates daily play from special events, and honors filters and invalid values", () => {
    const clinics = render("?tab=play&demoCategory=clinic");
    expect(clinics).toContain("Your First Rally");
    expect(clinics).not.toContain("Rally Haus Weekend Classic");
    const leagues = render("?tab=events&demoEventFilter=league");
    expect(leagues).toContain("Rally Together Doubles League");
    expect(leagues).toContain("Climb the Ladder");
    expect(leagues).not.toContain("Paddles &amp; Pizza Social");
    expect(render("?tab=play&demoCategory=invalid")).toContain(
      "Rise &amp; Rally Open Play"
    );
    expect(render("?tab=events&demoEventFilter=invalid")).toContain(
      "Rally Haus Weekend Classic"
    );
  });
  it("provides community samples and a reservation sandbox without a payment form", () => {
    expect(render("?tab=feed")).toContain(
      "All posts and poll results below are sample content"
    );
    expect(render("?tab=feed")).toContain("Create a free account");
    const book = render("?tab=book");
    expect(book).toContain("Court 6");
    expect(book).toContain(
      "Nothing here reserves a real court or takes payment"
    );
    expect(book).not.toContain("stripe");
  });
});
