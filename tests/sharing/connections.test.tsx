import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  fetch: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: state.rpc },
}));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: "me" }, loading: false }),
}));
vi.mock("sonner", () => ({
  toast: { success: state.success, error: vi.fn() },
}));
vi.mock("@/lib/social/friends", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchFriendsSnapshot: state.fetch,
}));
import { useFriends } from "@/hooks/useFriends";
import { emptyFriends } from "@/lib/social/friends";

let api: ReturnType<typeof useFriends>,
  root: ReactTestRenderer,
  cache: QueryClient;
function Capture() {
  api = useFriends({ realtime: false });
  return null;
}
function request(value: unknown) {
  const result = Promise.resolve(value);
  return Object.assign(result, { abortSignal: () => result });
}
beforeEach(async () => {
  vi.clearAllMocks();
  state.fetch.mockResolvedValue(emptyFriends());
  state.rpc.mockImplementation(() => request({ data: "pending", error: null }));
  cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await act(async () => {
    root = create(
      <QueryClientProvider client={cache}>
        <Capture />
      </QueryClientProvider>
    );
  });
});
afterEach(() => {
  act(() => root.unmount());
  cache.clear();
  vi.useRealTimers();
});

it("deduplicates connection requests from repeated clicks", async () => {
  let finish!: (value: unknown) => void;
  state.rpc.mockImplementation(() =>
    request(
      new Promise((resolve) => {
        finish = resolve;
      })
    )
  );
  let first!: Promise<boolean>;
  await act(async () => {
    first = api.sendFriendRequest("friend");
  });
  expect(await api.sendFriendRequest("friend")).toBe(false);
  await act(async () => {
    finish({ data: "pending", error: null });
    expect(await first).toBe(true);
  });
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("does not leave the action pending while a background connection refresh is stalled", async () => {
  state.fetch.mockImplementation(() => new Promise(() => {}));
  let finished = false;
  await act(async () => {
    void api.sendFriendRequest("friend").then(() => {
      finished = true;
    });
  });
  expect(finished).toBe(true);
  expect(state.success).toHaveBeenCalledWith("Friend request sent");
});
it("rejects a missing confirmation without a false success toast", async () => {
  state.rpc.mockImplementation(() => request({ data: null, error: null }));
  await act(async () => {
    expect(await api.sendFriendRequest("friend")).toBe(false);
  });
  expect(state.success).not.toHaveBeenCalled();
});
it("releases the connection action after a stalled request and permits a retry", async () => {
  vi.useFakeTimers();
  state.rpc.mockImplementationOnce(() => request(new Promise(() => {})));
  let result!: Promise<boolean>;
  await act(async () => {
    result = api.sendFriendRequest("friend");
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000);
  });
  expect(await result).toBe(false);
  await act(async () => {
    expect(await api.sendFriendRequest("friend")).toBe(true);
  });
});

it('shows a confirmed reciprocal connection immediately while refresh is pending', async () => {
  state.fetch.mockImplementation(() => new Promise(() => {}));
  state.rpc.mockImplementation(() => request({ data: 'accepted', error: null }));
  await act(async () => { expect(await api.sendFriendRequest('friend')).toBe(true); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  expect(api.getFriendshipStatus('friend')).toBe('accepted');
  expect(state.success).toHaveBeenCalledWith("You're now friends!");
});
