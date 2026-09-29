import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { VenueRoundRobinCard } from "@/components/venue/VenueRoundRobinCard";
import type { VenueRoundRobin } from "@/lib/venues/competitions";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const event = {id:"scheduled",title:"Friday round robin",start_time:"2099-11-06T23:00:00Z",end_time:"2099-11-07T01:00:00Z",capacity:16,confirmed:8,playing:8,price_cents:2000,games_per_player:5,courts:[{id:"court",name:"Court 5",court_number:5}]} as VenueRoundRobin;
const render = (patch:Partial<VenueRoundRobin>={}) => renderToStaticMarkup(<MemoryRouter><VenueRoundRobinCard event={{...event,...patch}} groupId="venue-group" timezone="America/New_York" busy={false} onSetup={() => {}} /></MemoryRouter>);
it("shows a precise venue-local date, time, physical court, price and confirmed count before setup", () => {
  const html=render();
  for(const text of ["November 6, 2099","6:00 PM – 8:00 PM","EST","Play court 1: Court 5","$20.00 / player","5","games / player","Set up round robin"]) expect(html).toContain(text);
  expect(html).toContain("/events/manage?event=scheduled");
});
it("opens the existing competition after setup and retains venue navigation", () => {
  const html=render({round_robin_id:"rr-linked",roster_locked_at:"2099-11-06",status:"draft"});
  expect(html).toContain("/player/community/group/venue-group/competitions/round-robins/rr-linked"); expect(html).toContain("Manage round robin"); expect(html).not.toContain("Set up round robin");
});
it("warns about post-preparation withdrawals and makes canceled events read-only", () => {
  expect(render({round_robin_id:"rr-linked",roster_locked_at:"2099-11-06",roster_withdrawals:1,roster_additions:0})).toContain("Review the playing roster");
  const canceled=render({round_robin_id:"rr-linked",canceled_at:"2099-11-06",status:"voided"});
  expect(canceled).toContain("View round robin"); expect(canceled).not.toContain("Set up round robin");
});
it("uses the verified caller identity when authorizing service-client schedule requests", () => {
  const generate=readFileSync('supabase/functions/generate-round-robin-schedule/index.ts','utf8');
  expect(generate).toContain('"can_manage_round_robin", { p_event: eventId, p_user: authData.user.id }');
  const manage=readFileSync('supabase/functions/rr-manage-participant/index.ts','utf8');
  expect(manage).toContain('"can_manage_round_robin", { p_event: event.id, p_user: user.id }');
});
