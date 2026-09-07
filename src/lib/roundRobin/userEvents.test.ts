import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

import { fetchUserRoundRobinEvents } from "./userEvents";

interface QueryResult {
  data: unknown[] | null;
  error: Error | null;
}

type Query = Promise<QueryResult> & {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
};

function query(result: QueryResult): Query {
  const chain = Promise.resolve(result) as Query;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  return chain;
}

const hostedEvent = {
  id: "hosted",
  name: "Hosted event",
  date: "2026-09-12",
  status: "draft",
  current_round: null,
  num_rounds: 4,
  num_courts: 2,
  organizer_id: "user-1",
  voided: false,
};

const participatingEvent = {
  ...hostedEvent,
  id: "playing",
  name: "Playing event",
  organizer_id: "user-2",
};

describe("fetchUserRoundRobinEvents", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("hydrates participation explicitly and de-duplicates events the user hosts", async () => {
    const registrations = query({
      data: [{ event_id: "hosted" }, { event_id: "playing" }, { event_id: "playing" }],
      error: null,
    });
    const hosted = query({ data: [hostedEvent], error: null });
    const participating = query({ data: [participatingEvent], error: null });
    let eventRead = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === "round_robin_players") return registrations;
      eventRead += 1;
      return eventRead === 1 ? hosted : participating;
    });

    const result = await fetchUserRoundRobinEvents("user-1");

    expect(result.map(({ event, role }) => [event.id, role])).toEqual([
      ["hosted", "host"],
      ["playing", "player"],
    ]);
    expect(registrations.eq).toHaveBeenCalledWith("active", true);
    expect(participating.in).toHaveBeenCalledWith("id", ["playing"]);
  });

  it("can include inactive registration history when explicitly requested", async () => {
    const registrations = query({ data: [], error: null });
    const hosted = query({ data: [], error: null });
    fromMock.mockImplementation((table: string) =>
      table === "round_robin_players" ? registrations : hosted,
    );

    await fetchUserRoundRobinEvents("user-1", { includeInactiveRegistrations: true });

    expect(registrations.eq).toHaveBeenCalledTimes(1);
    expect(registrations.eq).toHaveBeenCalledWith("player_id", "user-1");
  });

  it("surfaces base query failures instead of silently showing an empty state", async () => {
    const registrations = query({ data: [], error: null });
    const expected = new Error("round robin events unavailable");
    const hosted = query({ data: null, error: expected });
    fromMock.mockImplementation((table: string) =>
      table === "round_robin_players" ? registrations : hosted,
    );

    await expect(fetchUserRoundRobinEvents("user-1")).rejects.toBe(expected);
  });
});
