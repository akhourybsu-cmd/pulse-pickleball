import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  read: vi.fn(),
  channel: vi.fn(),
  remove: vi.fn(),
  events: new Map<string, (payload: unknown) => void>(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.remove,
  },
}));
import { usePlayerPulse } from "@/hooks/usePlayerPulse";
let renderer: ReactTestRenderer,
  client: QueryClient,
  state: ReturnType<typeof usePlayerPulse>;
function Harness() {
  state = usePlayerPulse("a");
  return (
    <div>
      {state.isError ? "error" : state.isLoading ? "loading" : "loaded"}
    </div>
  );
}
async function mount() {
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.events.clear();
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  mocks.read.mockResolvedValue({
    data: [
      {
        match_id: "known",
        team: 1,
        rating_before: 3,
        rating_after: 3.01,
        rating_change: 0.01,
        matches: {
          match_date: "2026-10-01",
          created_at: "2026-10-01T12:00:00Z",
          status: "approved",
          voided: false,
          count_for_rating: true,
          team1_score: 11,
          team2_score: 7,
          source: "manual",
        },
      },
    ],
    error: null,
  });
  mocks.from.mockImplementation(() => {
    const b = {
      select: () => b,
      eq: () => b,
      not: () => b,
      order: () => b,
      range: () => b,
      abortSignal: () => b,
      single: () =>
        Promise.resolve({ data: { current_rating: 3.01 }, error: null }),
      then: (a: unknown, z: unknown) => mocks.read().then(a, z),
    };
    return b;
  });
  mocks.channel.mockImplementation(() => {
    const c = {
      on: (
        _event: string,
        filter: { table: string },
        fn: (payload: unknown) => void
      ) => {
        mocks.events.set(filter.table, fn);
        return c;
      },
      subscribe: () => c,
    };
    return c;
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  client.clear();
  vi.useRealTimers();
});
it("coalesces a rating replay into one refresh and ignores other players' unrelated matches", async () => {
  await mount();
  expect(state.data?.matchCount).toBe(1);
  vi.useFakeTimers();
  const before = mocks.read.mock.calls.length;
  mocks.events.get("matches")!({ new: { id: "unrelated" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(mocks.read).toHaveBeenCalledTimes(before);
  mocks.events.get("match_participants")!({});
  mocks.events.get("profiles")!({});
  mocks.events.get("matches")!({ new: { id: "known" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(mocks.read).toHaveBeenCalledTimes(before + 1);
});
it("cancels a scheduled refresh and removes realtime listeners on leaving the page", async () => {
  await mount();
  vi.useFakeTimers();
  const before = mocks.read.mock.calls.length;
  mocks.events.get("match_participants")!({});
  act(() => renderer.unmount());
  await vi.advanceTimersByTimeAsync(500);
  expect(mocks.read).toHaveBeenCalledTimes(before);
  expect(mocks.remove).toHaveBeenCalled();
});
it("turns a stalled read into a retryable error rather than an endless loading state", async () => {
  mocks.read.mockImplementation(() => new Promise(() => {}));
  vi.useFakeTimers();
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30020);
  });
  expect(client.getQueryState(["player-pulse", "a", "v2"])?.status).toBe(
    "error"
  );
  vi.useRealTimers();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(state.isError).toBe(true);
  expect(state.data).toBeUndefined();
});
