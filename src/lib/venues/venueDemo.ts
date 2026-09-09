// Deliberately fictional, in-memory data. This module has no API or storage access.
export type VenueDemoFeature = "court_booking" | "facility_tools";
export const demoCourts = ["Court 1", "Court 2", "Court 3"] as const;
export const demoTimes = ["9:00 AM", "10:00 AM", "11:00 AM"] as const;
export const demoHourlyRate = 24;
export const demoMaintenanceSlot = "0-2";
export const demoPrograms: Record<string, string> = {
  "0-0": "Beginner clinic",
  "1-1": "Doubles practice",
  "2-0": "Open play",
};

export type VenueDemoState = {
  selected: string | null;
  reservations: string[];
  maintenance: boolean;
};
export const newVenueDemo = (): VenueDemoState => ({
  selected: null,
  reservations: [],
  maintenance: false,
});

export function demoSlotDetails(id: string | null) {
  if (!id || !/^[0-2]-[0-2]$/.test(id)) return null;
  const [time, court] = id.split("-").map(Number);
  return { id, court: demoCourts[court], time: demoTimes[time], rate: demoHourlyRate };
}

export function demoSlotStatus(state: VenueDemoState, id: string) {
  if (!demoSlotDetails(id)) return "Unavailable";
  if (demoPrograms[id]) return demoPrograms[id];
  if (state.maintenance && id === demoMaintenanceSlot) return "Maintenance";
  if (state.reservations.includes(id)) return "Demo reservation";
  return "Available";
}

export type VenueDemoAction =
  | { type: "select"; id: string }
  | { type: "reserve" }
  | { type: "toggle-maintenance" }
  | { type: "reset" };

export function venueDemoReducer(state: VenueDemoState, action: VenueDemoAction): VenueDemoState {
  switch (action.type) {
    case "reset":
      return newVenueDemo();
    case "select":
      return demoSlotStatus(state, action.id) === "Available"
        ? { ...state, selected: action.id }
        : state;
    case "reserve":
      if (!state.selected || demoSlotStatus(state, state.selected) !== "Available") return state;
      return { ...state, reservations: [...state.reservations, state.selected] };
    case "toggle-maintenance":
      // Even the demo must not suggest that staff can overwrite a reservation.
      if (state.reservations.includes(demoMaintenanceSlot)) return state;
      return {
        ...state,
        maintenance: !state.maintenance,
        selected: state.selected === demoMaintenanceSlot ? null : state.selected,
      };
  }
}
