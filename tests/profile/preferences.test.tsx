import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  toast: vi.fn(),
  user: "a",
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: mocks.user } }),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toast, success: mocks.toast },
}));
import { useMessagingPrivacy } from "@/hooks/useMessagingSafety";
let renderer: ReactTestRenderer,
  client: QueryClient,
  state: ReturnType<typeof useMessagingPrivacy>;
function Harness() {
  state = useMessagingPrivacy();
  return null;
}
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
};
async function mount() {
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );
  });
  await flush();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = "a";
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  mocks.read.mockResolvedValue({
    data: { dm_privacy: "friends" },
    error: null,
  });
  mocks.write.mockResolvedValue({
    data: { dm_privacy: "nobody" },
    error: null,
  });
  mocks.from.mockImplementation(() => {
    const b = {
      select: () => b,
      eq: () => b,
      upsert: () => b,
      abortSignal: () => b,
      maybeSingle: mocks.read,
      single: mocks.write,
    };
    return b;
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  client.clear();
  vi.useRealTimers();
});
it("does not pretend a failed privacy save succeeded", async () => {
  await mount();
  mocks.write.mockResolvedValueOnce({
    data: null,
    error: new Error("Offline"),
  });
  await act(async () => {
    expect(await state.update("nobody")).toBe(false);
  });
  expect(state.privacy).toBe("friends");
  expect(state.saving).toBe(false);
  await act(async () => {
    expect(await state.update("nobody")).toBe(true);
  });
  await flush();
  expect(state.privacy).toBe("nobody");
});
it("reports a failed initial load and prevents changing an unknown preference", async () => {
  mocks.read.mockRejectedValueOnce(new Error("Offline"));
  await mount();
  expect(state.error).toBe(true);
  expect(state.loading).toBe(false);
  await act(async () => {
    expect(await state.update("nobody")).toBe(false);
  });
  expect(mocks.write).not.toHaveBeenCalled();
  await act(async () => {
    await state.refetch();
  });
  await flush();
  expect(state.error).toBe(false);
});
it("rejects an empty save confirmation and prevents overlapping changes", async () => {
  await mount();
  let resolve!: (value: unknown) => void;
  mocks.write.mockImplementationOnce(
    () => new Promise((done) => (resolve = done))
  );
  let pending!: Promise<boolean>;
  act(() => {
    pending = state.update("nobody");
    void state.update("friends");
  });
  expect(mocks.write).toHaveBeenCalledTimes(1);
  expect(state.saving).toBe(true);
  await act(async () => {
    resolve({ data: null, error: null });
    expect(await pending).toBe(false);
  });
  expect(state.privacy).toBe("friends");
  expect(state.saving).toBe(false);
});
it("uses the cached preference when returning and separates another account", async () => {
  await mount();
  await act(async () => {
    await state.update("nobody");
  });
  await flush();
  act(() => renderer.unmount());
  await mount();
  expect(state.privacy).toBe("nobody");
  expect(mocks.read).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
  mocks.user = "b";
  await mount();
  expect(state.privacy).toBe("friends");
  expect(mocks.read).toHaveBeenCalledTimes(2);
});
it("releases the saving state after an unresponsive auth/network request", async () => {
  await mount();
  vi.useFakeTimers();
  mocks.write.mockReturnValueOnce(new Promise(() => {}));
  let pending!: Promise<boolean>;
  act(() => {
    pending = state.update("nobody");
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_001);
    expect(await pending).toBe(false);
  });
  expect(state.saving).toBe(false);
  expect(state.privacy).toBe("friends");
});
