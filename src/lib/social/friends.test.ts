import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  emptyFriends,
  fetchFriendsSnapshot,
  friendName,
  friendsKey,
  matchesFriend,
  normalizeRelationships,
  optimisticFriendChange,
  placeholderProfile,
  restoreFriendTarget,
  type FriendWithProfile,
} from "./friends";

const now = "2026-09-07T12:00:00Z";
const row = (
  target: string,
  status: FriendWithProfile["status"] = "pending"
): FriendWithProfile => ({
  id: `request-${target}`,
  user_id: target,
  friend_id: "me",
  status,
  created_at: now,
  accepted_at: null,
  profile: { ...placeholderProfile(target), display_name: target },
});

describe("friend list search and normalization", () => {
  it("searches full names, display names, and handles regardless of case or accents", () => {
    const profile = {
      ...placeholderProfile("a"),
      display_name: "Jo",
      full_name: "José María Rivera",
      handle: "court-ace",
    };
    for (const search of ["JOSE", "rivera maria", "@court-ace", " jo ", ""])
      expect(matchesFriend(profile, search)).toBe(true);
    expect(matchesFriend(profile, "jane")).toBe(false);
  });
  it("uses readable fallbacks without blank names", () => {
    expect(friendName({ display_name: " ", full_name: " Alex " })).toBe("Alex");
    expect(friendName(placeholderProfile("missing"))).toBe("Player");
  });
  it("deduplicates reciprocal legacy rows and prefers accepted over pending", () => {
    const rows = normalizeRelationships(
      [row("a"), { ...row("a", "accepted"), id: "accepted" }, row("b")],
      []
    );
    expect(rows.map((value) => value.id)).toEqual(["accepted", "request-b"]);
  });
  it("never surfaces a canonical block as a friend or pending request", () => {
    expect(
      normalizeRelationships([row("a", "accepted"), row("b")], ["a", "b"])
    ).toEqual([]);
    expect(
      normalizeRelationships([row("a", "accepted"), row("a", "blocked")], [])[0]
        .status
    ).toBe("blocked");
  });
  it("isolates account caches", () => {
    expect(friendsKey("alice")).not.toEqual(friendsKey("bob"));
  });
});

describe("optimistic friend actions", () => {
  it("immediately shows an outbound request with its profile", () => {
    const state = optimisticFriendChange(
      emptyFriends(),
      { action: "send", targetId: "a", profile: row("a").profile },
      "me",
      now
    );
    expect(state.relationships[0]).toMatchObject({
      status: "pending",
      user_id: "me",
      friend_id: "a",
      profile: { display_name: "a" },
    });
    expect(
      optimisticFriendChange(
        state,
        { action: "send", targetId: "a" },
        "me",
        now
      ).relationships
    ).toHaveLength(1);
  });
  it("accepts a request in place without changing its direction or identity", () => {
    const state = { ...emptyFriends(), relationships: [row("a")] };
    const result = optimisticFriendChange(
      state,
      { action: "accept", targetId: "a" },
      "me",
      now
    );
    expect(result.relationships[0]).toMatchObject({
      id: "request-a",
      user_id: "a",
      friend_id: "me",
      status: "accepted",
      accepted_at: now,
    });
    expect(state.relationships[0].status).toBe("pending");
  });
  it.each(["decline", "cancel", "remove"] as const)(
    "%s affects only the intended person",
    (action) => {
      const state = { ...emptyFriends(), relationships: [row("a"), row("b")] };
      expect(
        optimisticFriendChange(state, { action, targetId: "a" }, "me", now)
          .relationships
      ).toEqual([row("b")]);
    }
  );
  it("blocks atomically in the shared snapshot", () => {
    const state = {
      ...emptyFriends(),
      relationships: [row("a", "accepted"), row("b")],
    };
    expect(
      optimisticFriendChange(
        state,
        { action: "block", targetId: "a" },
        "me",
        now
      )
    ).toEqual({ relationships: [row("b")], blockedIds: ["a"] });
  });
  it("a failed accept does not undo another successful accept", () => {
    const initial = { ...emptyFriends(), relationships: [row("a"), row("b")] };
    const one = optimisticFriendChange(
      initial,
      { action: "accept", targetId: "a" },
      "me",
      now
    );
    const both = optimisticFriendChange(
      one,
      { action: "accept", targetId: "b" },
      "me",
      now
    );
    const restored = restoreFriendTarget(both, initial, "a");
    expect(
      restored.relationships.find((value) => value.profile.id === "a")?.status
    ).toBe("pending");
    expect(
      restored.relationships.find((value) => value.profile.id === "b")?.status
    ).toBe("accepted");
  });
  it("a failed block does not resurrect a different removed friend", () => {
    const initial = {
      ...emptyFriends(),
      relationships: [row("a", "accepted"), row("b", "accepted")],
    };
    const blocked = optimisticFriendChange(
      initial,
      { action: "block", targetId: "a" },
      "me",
      now
    );
    const removed = optimisticFriendChange(
      blocked,
      { action: "remove", targetId: "b" },
      "me",
      now
    );
    expect(restoreFriendTarget(removed, initial, "a")).toEqual({
      relationships: [row("a", "accepted")],
      blockedIds: [],
    });
  });
  it("a failed send removes only its temporary row", () => {
    const initial = { ...emptyFriends(), relationships: [row("b")] };
    const sent = optimisticFriendChange(
      initial,
      { action: "send", targetId: "a" },
      "me",
      now
    );
    expect(restoreFriendTarget(sent, initial, "a")).toEqual(initial);
  });
});

function fakeClient(
  relationships: FriendWithProfile[],
  blocks: string[] = [],
  missingProfiles = false,
  failTable?: string
) {
  const requests: URL[] = [];
  const client = createClient<Database>(
    "https://friends-test.supabase.co",
    "public-test-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: vi.fn(async (input, init) => {
          if (init?.signal?.aborted)
            throw new DOMException("Aborted", "AbortError");
          const url = new URL(String(input));
          requests.push(url);
          const table = url.pathname.split("/").at(-1);
          if (table === failTable)
            return new Response(
              JSON.stringify({ message: "Database unavailable" }),
              { status: 503 }
            );
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const limit = Number(url.searchParams.get("limit") ?? 1000);
          const data =
            table === "friendships"
              ? relationships.slice(offset, offset + limit)
              : table === "user_blocks"
              ? blocks
                  .map((id, index) => ({
                    id: `block-${index}`,
                    blocker_id: index % 2 ? "me" : id,
                    blocked_id: index % 2 ? id : "me",
                  }))
                  .slice(offset, offset + limit)
              : missingProfiles
              ? []
              : relationships
                  .map((value) => value.profile)
                  .filter(
                    (profile) =>
                      url.searchParams.get("id")?.includes(`"${profile.id}"`) ||
                      url.searchParams
                        .get("id")
                        ?.slice(4, -1)
                        .split(",")
                        .includes(profile.id)
                  );
          return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
          });
        }),
      },
    }
  );
  return { client, requests };
}

describe("loading complete friend snapshots", () => {
  it("pages beyond the API row limit and batches profile lookups", async () => {
    const rows = Array.from({ length: 1201 }, (_, i) =>
      row(`player-${i}`, "accepted")
    );
    const { client, requests } = fakeClient(rows);
    const snapshot = await fetchFriendsSnapshot(
      client,
      "me",
      new AbortController().signal
    );
    expect(snapshot.relationships).toHaveLength(1201);
    expect(snapshot.relationships[1200].profile.display_name).toBe(
      "player-1200"
    );
    expect(
      requests.filter((url) => url.pathname.endsWith("/friendships"))
    ).toHaveLength(3);
    expect(
      requests.filter((url) => url.pathname.endsWith("/profiles_public"))
    ).toHaveLength(7);
  });
  it("loads blocks in both directions and across pages", async () => {
    const { client } = fakeClient(
      [row("b1000", "accepted"), row("b1001")],
      Array.from({ length: 1002 }, (_, i) => `b${i}`)
    );
    const snapshot = await fetchFriendsSnapshot(
      client,
      "me",
      new AbortController().signal
    );
    expect(snapshot.blockedIds).toHaveLength(1002);
    expect(snapshot.relationships).toEqual([]);
  });
  it("keeps a removable connection when a public profile is unavailable", async () => {
    const { client } = fakeClient([row("missing", "accepted")], [], true);
    const snapshot = await fetchFriendsSnapshot(
      client,
      "me",
      new AbortController().signal
    );
    expect(snapshot.relationships[0].id).toBe("request-missing");
    expect(snapshot.relationships[0].profile).toEqual(
      placeholderProfile("missing")
    );
  });
  it("does not request profiles for an empty circle", async () => {
    const { client, requests } = fakeClient([]);
    expect(
      await fetchFriendsSnapshot(client, "me", new AbortController().signal)
    ).toEqual(emptyFriends());
    expect(requests).toHaveLength(2);
  });
  it.each(["friendships", "user_blocks", "profiles_public"])(
    "surfaces %s failures instead of claiming the list is empty",
    async (table) => {
      const { client } = fakeClient([row("a")], [], false, table);
      await expect(
        fetchFriendsSnapshot(client, "me", new AbortController().signal)
      ).rejects.toBeTruthy();
    }
  );
});
