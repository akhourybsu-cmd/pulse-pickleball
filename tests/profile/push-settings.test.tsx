import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
  subscription: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: "a" } }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toast } }));
let renderer: ReactTestRenderer,
  state: ReturnType<
    typeof import("@/hooks/usePushSubscription").usePushSubscription
  >;
let usePush: typeof import("@/hooks/usePushSubscription").usePushSubscription;
function Harness() {
  state = usePush();
  return null;
}
const sub = {
  endpoint: "https://push.example.test/fixture",
  options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
  toJSON: () => ({ keys: { p256dh: "fixture", auth: "fixture" } }),
  unsubscribe: vi.fn(),
};
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "AQID");
  usePush = (await import("@/hooks/usePushSubscription")).usePushSubscription;
  mocks.subscription.mockResolvedValue(sub);
  sub.unsubscribe.mockResolvedValue(true);
  mocks.read.mockResolvedValue({ data: null, error: null });
  mocks.write.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.from.mockImplementation(() => {
    let mode = "read";
    const b: any = {
      select: () => b,
      eq: () => b,
      delete: () => {
        mode = "delete";
        return b;
      },
      upsert: () => {
        mode = "write";
        return b;
      },
      abortSignal: () => b,
      maybeSingle: mocks.read,
      then: (resolve: any, reject: any) =>
        (mode === "delete" ? mocks.remove() : mocks.write()).then(
          resolve,
          reject
        ),
    };
    return b;
  });
  const notification = {
    permission: "granted",
    requestPermission: vi.fn().mockResolvedValue("granted"),
  };
  vi.stubGlobal("window", { Notification: notification, PushManager: {} });
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("navigator", {
    serviceWorker: {
      ready: Promise.resolve({
        pushManager: { getSubscription: mocks.subscription },
      }),
    },
    userAgent: "fixture",
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function mount() {
  await act(async () => {
    renderer = create(<Harness />);
  });
}
it("does not call an unrecorded browser subscription enabled", async () => {
  await mount();
  expect(state.state).toBe("disabled");
  mocks.read.mockResolvedValueOnce({ data: { id: "registered" }, error: null });
  await act(async () => {
    await state.refresh();
  });
  expect(state.state).toBe("enabled");
});
it("reports a failed server save and leaves enable available for retry", async () => {
  await mount();
  mocks.write.mockResolvedValueOnce({ error: new Error("Offline") });
  await act(async () => {
    expect(await state.enable()).toBe(false);
  });
  expect(state.state).toBe("disabled");
  expect(state.busy).toBe(false);
  expect(state.error).toBeTruthy();
  await act(async () => {
    expect(await state.enable()).toBe(true);
  });
  expect(state.state).toBe("enabled");
  expect(state.error).toBeNull();
});
it("does not discard a device subscription when the server removal fails", async () => {
  mocks.read.mockResolvedValue({ data: { id: "registered" }, error: null });
  await mount();
  mocks.remove.mockResolvedValueOnce({ error: new Error("Offline") });
  await act(async () => {
    expect(await state.disable()).toBe(false);
  });
  expect(sub.unsubscribe).not.toHaveBeenCalled();
  expect(state.busy).toBe(false);
  await act(async () => {
    expect(await state.disable()).toBe(true);
  });
  expect(state.state).toBe("disabled");
});
it("recovers when the service worker never becomes ready", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", {
    serviceWorker: { ready: new Promise(() => {}) },
  });
  await mount();
  expect(state.state).toBe("loading");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8001);
  });
  expect(state.state).toBe("disabled");
  expect(state.error).toContain("Could not check");
});
