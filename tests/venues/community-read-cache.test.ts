import { QueryClient } from "@tanstack/react-query";
import { it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: state.rpc },
}));
import { markCommunityRead } from "@/hooks/useMarkCommunityRead";
it("clears the acknowledged directory badge and reconciles the server without marking chat read", async () => {
  const client = new QueryClient();
  const key = ["groups", "joined", "viewer", true];
  client.setQueryData(key, [
    {
      id: "venue",
      unread_count: 3,
      membership: { last_read_at: "old", last_chat_read_at: "chat" },
    },
    { id: "other", unread_count: 2 },
  ]);
  client.setQueryData(
    ["groups", "joined", "other-user", true],
    [{ id: "venue", unread_count: 4 }],
  );
  client.setQueryData(["group-detail", "venue", "viewer"], {
    membership: { last_read_at: "old", last_chat_read_at: "chat" },
  });
  state.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({ data: "2026-09-30T12:00:00Z", error: null }),
  });
  await markCommunityRead(client, "venue", "viewer");
  expect(client.getQueryData(key)).toMatchObject([
    { id: "venue", unread_count: 0, membership: { last_chat_read_at: "chat" } },
    { id: "other", unread_count: 2 },
  ]);
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(
    client.getQueryData(["groups", "joined", "other-user", true]),
  ).toMatchObject([{ unread_count: 4 }]);
  client.clear();
});
it("retains unread activity when acknowledgement fails", async () => {
  const client = new QueryClient();
  const key = ["groups", "joined", "viewer", true];
  client.setQueryData(key, [{ id: "venue", unread_count: 3 }]);
  state.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({ data: null, error: new Error("offline") }),
  });
  await expect(markCommunityRead(client, "venue", "viewer")).rejects.toThrow(
    "offline",
  );
  expect(client.getQueryData(key)).toMatchObject([{ unread_count: 3 }]);
  client.clear();
});
