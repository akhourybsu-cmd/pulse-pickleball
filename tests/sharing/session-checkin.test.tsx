import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string },
    loading: false,
    isAuthenticated: false,
  },
  session: vi.fn(),
  attendance: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/hooks/useAuthState", () => ({ useAuthState: () => state.auth }));
vi.mock("@/components/Logo", () => ({ Logo: () => <span>PULSE</span> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      let payload: unknown;
      const builder = {
        select: () => builder,
        eq: () => builder,
        abortSignal: () => builder,
        maybeSingle: () => builder,
        upsert: (value: unknown) => {
          payload = value;
          return builder;
        },
        then(
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown
        ) {
          const call =
            table === "sessions"
              ? state.session
              : payload
              ? () => state.insert(payload)
              : state.attendance;
          return Promise.resolve().then(call).then(resolve, reject);
        },
      };
      return builder;
    },
  },
}));
import QRCheckIn from "@/pages/QRCheckIn";
let root: ReactTestRenderer, cache: QueryClient, path: string;
function Location() {
  const location = useLocation();
  path = location.pathname + location.search;
  return null;
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
async function mount(entry = "/qr-checkin?session=session-id") {
  cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await act(async () => {
    root = create(
      <QueryClientProvider client={cache}>
        <MemoryRouter initialEntries={[entry]}>
          <Location />
          <Routes>
            <Route path="/qr-checkin" element={<QRCheckIn />} />
            <Route path="*" element={<p>Destination</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
  await flush();
}
const visible = () => JSON.stringify(root.toJSON());
const button = (label: string) =>
  root.root
    .findAllByType("button")
    .find((node) => JSON.stringify(node.children).includes(label))!;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state.auth, {
    user: null,
    loading: false,
    isAuthenticated: false,
  });
  state.session.mockResolvedValue({
    data: {
      id: "session-id",
      name: "Evening play",
      start_time: "18:30:00",
      courts: null,
    },
    error: null,
  });
  state.attendance.mockResolvedValue({ data: null, error: null });
  state.insert.mockResolvedValue({ data: null, error: null });
});
afterEach(() => {
  act(() => root?.unmount());
  cache?.clear();
});
it("finishes loading for an expired or missing session instead of spinning forever", async () => {
  state.session.mockResolvedValue({ data: null, error: null });
  await mount();
  expect(visible()).toContain("Session unavailable");
  expect(visible()).not.toContain("Loading session");
});
it("handles a missing session parameter without a backend lookup", async () => {
  await mount("/qr-checkin");
  expect(visible()).toContain("Session unavailable");
  expect(state.session).not.toHaveBeenCalled();
});
it("shows a recoverable lookup failure and retries the same session", async () => {
  state.session.mockRejectedValueOnce(new TypeError("Offline"));
  await mount();
  expect(visible()).toContain("Connection interrupted");
  await act(async () => button("Try again").props.onClick());
  await flush();
  expect(visible()).toContain("Evening play");
});
it("preserves the session through the sign-in link without checking in a guest", async () => {
  await mount();
  await act(async () => button("Sign in to check in").props.onClick());
  expect(new URLSearchParams(path.split("?")[1]).get("redirect")).toBe(
    "/qr-checkin?session=session-id"
  );
  expect(state.insert).not.toHaveBeenCalled();
});
it("recognizes an existing check-in without creating a duplicate", async () => {
  Object.assign(state.auth, { user: { id: "player" }, isAuthenticated: true });
  state.attendance.mockResolvedValue({
    data: { id: "attendance" },
    error: null,
  });
  await mount();
  await flush();
  expect(visible()).toContain("You're checked in");
  expect(state.insert).not.toHaveBeenCalled();
});
it("deduplicates repeated check-in clicks and recovers after a failed write", async () => {
  Object.assign(state.auth, { user: { id: "player" }, isAuthenticated: true });
  state.insert.mockRejectedValueOnce(new TypeError("Offline"));
  await mount();
  await flush();
  const click = button("Check in").props.onClick;
  await act(async () => {
    click();
    click();
  });
  await flush();
  expect(state.insert).toHaveBeenCalledTimes(1);
  expect(visible()).toContain("could not confirm your check-in");
  await act(async () => button("Check in").props.onClick());
  await flush();
  expect(visible()).toContain("You're checked in");
  expect(state.insert).toHaveBeenLastCalledWith(
    expect.objectContaining({
      session_id: "session-id",
      player_id: "player",
      status: "active",
    })
  );
});
