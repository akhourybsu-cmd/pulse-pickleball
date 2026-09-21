import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { persistRosterAdditions, type RosterAdditionRow } from "./persistRosterAdditions";

function batch(count: number): RosterAdditionRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `roster-${index}`,
    event_id: "event-1",
    player_id: index % 2 ? null : `player-${index}`,
    guest_player_id: index % 2 ? `guest-${index}` : null,
    guest_name: index % 2 ? `Guest ${index}` : null,
    status: "active",
  }));
}

function transport(response: () => Response = () => new Response(null, { status: 201 })) {
  const requests: Request[] = [];
  const client = createClient<Database>("https://fixture.supabase.co", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return response();
      },
    },
  });
  return { client, requests };
}

describe("persistRosterAdditions REST contract", () => {
  it.each([1, 12])("adds %i new players/guests in one insert without conflict-update planning", async count => {
    const { client, requests } = transport();
    const rows = batch(count);
    await persistRosterAdditions(client, rows, false);

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(new URL(requests[0].url).pathname).toBe("/rest/v1/round_robin_players");
    expect(new URL(requests[0].url).searchParams.has("on_conflict")).toBe(false);
    expect(requests[0].headers.get("Prefer") ?? "").not.toContain("resolution=merge-duplicates");
    expect(await requests[0].json()).toEqual(rows);
  });

  it("keeps returning players and new arrivals in one atomic upsert with their original roster IDs", async () => {
    const { client, requests } = transport();
    const rows = batch(12);
    rows[0].id = "existing-removed-roster-row";
    await persistRosterAdditions(client, rows, true);

    expect(requests).toHaveLength(1);
    expect(new URL(requests[0].url).searchParams.get("on_conflict")).toBe("id");
    expect(requests[0].headers.get("Prefer")).toContain("resolution=merge-duplicates");
    expect(await requests[0].json()).toEqual(rows);
  });

  it.each([false, true])("surfaces a database timeout without retrying or splitting the batch (reactivations: %s)", async hasReactivations => {
    const failure = { code: "57014", message: "canceling statement due to statement timeout", details: null, hint: null };
    const { client, requests } = transport(() => new Response(JSON.stringify(failure), {
      status: 500, headers: { "Content-Type": "application/json" },
    }));

    await expect(persistRosterAdditions(client, batch(12), hasReactivations)).rejects.toMatchObject(failure);
    expect(requests).toHaveLength(1);
  });

  it("does not send an empty selection", async () => {
    const { client, requests } = transport();
    await persistRosterAdditions(client, [], false);
    expect(requests).toHaveLength(0);
  });
});
