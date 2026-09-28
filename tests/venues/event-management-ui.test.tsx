import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { VenueEventCheckout } from "@/components/venue/VenueEventCheckout";
import { VenueEventCard } from "@/components/venue/VenueEventCard";
import {
  validateEventDocument,
  type EventDocument,
} from "@/lib/venues/eventManagement";
import type { GroupEvent } from "@/hooks/useGroupEvents";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const event = {
  id: "event",
  title: "Skills clinic",
  start_time: "2099-11-02T23:00:00Z",
  end_time: "2099-11-03T00:30:00Z",
  price_cents: 2500,
  capacity: 8,
  rsvps: { going: 6, waitlist: 0 },
  pending_places: 2,
  waitlist_enabled: true,
} as GroupEvent;
const checkout = (patch: Partial<GroupEvent> = {}) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <VenueEventCheckout
          event={{ ...event, ...patch }}
          canRsvp
          onRsvp={() => "waitlist"}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
it("counts checkout holds, offers a no-charge waitlist and never exposes free RSVP for a paid event", () => {
  const html = checkout();
  expect(html).toContain("$25.00");
  expect(html).toContain("All places are confirmed or held");
  expect(html).toContain("Join waitlist · no charge");
  expect(html).not.toContain("I’m in");
});
it("keeps existing checkouts and paid cancellations in the payment workspace", () => {
  expect(checkout({ checkout_order_id: "order" })).toContain(
    "/player/payments?order=order"
  );
  const registered = checkout({ user_rsvp: "going" });
  expect(registered).toContain("Manage payment");
  expect(registered).not.toContain("Join waitlist");
});
it("closes paused or canceled sales even if capacity remains", () => {
  expect(checkout({ registration_paused: true, pending_places: 0 })).toContain(
    "Registration is paused"
  );
  expect(checkout({ canceled_at: "2026-09-28" })).toContain(
    "This event was canceled"
  );
});
it("cards display a price and defer paid inventory confirmation to detail", () => {
  const html = renderToStaticMarkup(<VenueEventCard event={event} going={6} />);
  expect(html).toContain("$25.00 / player");
  expect(html).toContain("View availability");
  expect(html).not.toContain("2 spots left");
});
it("validates price, dates, courts and skill range before publication", () => {
  const document = {
    title: "Clinic",
    capacity: 8,
    price_cents: 2500,
    court_ids: ["court"],
    occurrences: [{ start_time: event.start_time, end_time: event.end_time! }],
    skill_level_min: null,
    skill_level_max: null,
  } as EventDocument;
  expect(() => validateEventDocument(document)).not.toThrow();
  for (const patch of [
    { price_cents: 50 },
    { price_cents: 1.5 },
    { capacity: 0 },
    { court_ids: [] },
    { occurrences: [] },
    { skill_level_min: 5, skill_level_max: 3 },
  ])
    expect(() => validateEventDocument({ ...document, ...patch })).toThrow();
});
