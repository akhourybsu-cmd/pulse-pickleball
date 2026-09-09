import { describe, expect, it } from "vitest";
import { demoSlotDetails, demoSlotStatus, newVenueDemo, venueDemoReducer } from "@/lib/venues/venueDemo";

describe("isolated venue feature demo", () => {
  it("starts with no reservations or maintenance and a fictional rental rate", () => {
    expect(newVenueDemo()).toEqual({ selected: null, reservations: [], maintenance: false });
    expect(demoSlotDetails("0-2")).toEqual({ id: "0-2", court: "Court 3", time: "9:00 AM", rate: 24 });
    expect(demoSlotDetails("real-venue-id")).toBeNull();
  });
  it("selects and simulates a reservation visible to both views", () => {
    const selected = venueDemoReducer(newVenueDemo(), { type: "select", id: "1-0" });
    const reserved = venueDemoReducer(selected, { type: "reserve" });
    expect(demoSlotStatus(reserved, "1-0")).toBe("Demo reservation");
    expect(selected.reservations).toEqual([]);
    expect(venueDemoReducer(reserved, { type: "reserve" })).toEqual(reserved);
  });
  it("does not reserve without an available selection or accept invalid slots", () => {
    const initial = newVenueDemo();
    expect(venueDemoReducer(initial, { type: "reserve" })).toBe(initial);
    for (const id of ["0-0", "1-1", "2-0", "3-0", "0-3", "-1-2", "other"]) {
      expect(venueDemoReducer(initial, { type: "select", id })).toBe(initial);
    }
  });
  it("blocks the same sample slot in booking and operations, clearing stale selections", () => {
    const selected = venueDemoReducer(newVenueDemo(), { type: "select", id: "0-2" });
    const blocked = venueDemoReducer(selected, { type: "toggle-maintenance" });
    expect(blocked.selected).toBeNull();
    expect(demoSlotStatus(blocked, "0-2")).toBe("Maintenance");
    expect(venueDemoReducer(blocked, { type: "select", id: "0-2" })).toBe(blocked);
    expect(venueDemoReducer(blocked, { type: "reserve" })).toBe(blocked);
    expect(demoSlotStatus(venueDemoReducer(blocked, { type: "toggle-maintenance" }), "0-2")).toBe("Available");
  });
  it("never overwrites a demo reservation with maintenance", () => {
    const selected = venueDemoReducer(newVenueDemo(), { type: "select", id: "0-2" });
    const reserved = venueDemoReducer(selected, { type: "reserve" });
    expect(venueDemoReducer(reserved, { type: "toggle-maintenance" })).toBe(reserved);
  });
  it("keeps unrelated reservations and programs when adding maintenance", () => {
    const selected = venueDemoReducer(newVenueDemo(), { type: "select", id: "2-2" });
    const reserved = venueDemoReducer(selected, { type: "reserve" });
    const blocked = venueDemoReducer(reserved, { type: "toggle-maintenance" });
    expect(demoSlotStatus(blocked, "2-2")).toBe("Demo reservation");
    expect(demoSlotStatus(blocked, "0-0")).toBe("Beginner clinic");
  });
  it("resets all sample edits and does not share state between demo sessions", () => {
    const original = newVenueDemo();
    const changed = venueDemoReducer(original, { type: "toggle-maintenance" });
    expect(venueDemoReducer(changed, { type: "reset" })).toEqual(original);
    expect(newVenueDemo()).toEqual(original);
  });
});
