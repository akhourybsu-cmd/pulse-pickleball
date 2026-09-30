import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: "owner" } }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
import { useGroupSettings } from "@/hooks/useGroupSettings";
let client: QueryClient,
  renderer: ReactTestRenderer,
  first: ReturnType<typeof useGroupSettings>,
  second: ReturnType<typeof useGroupSettings>;
let stored = { chat_enabled: true, files_enabled: true };
function Harness() {
  first = useGroupSettings("group");
  second = useGroupSettings("group");
  return null;
}
beforeEach(async () => {
  vi.clearAllMocks();
  stored = { chat_enabled: true, files_enabled: true };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["group-detail", "group", "owner"], { settings: stored });
  client.setQueryData(["groups", "owner"], []);
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: async () => ({ data: { settings: { ...stored } }, error: null }),
  };
  mocks.from.mockReturnValue(builder);
  mocks.rpc.mockImplementation(async (_name, { p_patch }) => {
    stored = { ...stored, ...p_patch };
    return { data: stored, error: null };
  });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  client.clear();
});
it("refreshes all mounted settings consumers and marks the shared community and directory data stale", async () => {
  await act(async () => {
    expect(await first.updateSetting("chat_enabled", false)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(second.settings.chat_enabled).toBe(false);
  expect(second.settings.files_enabled).toBe(true);
  expect(
    client.getQueryState(["group-detail", "group", "owner"])?.isInvalidated,
  ).toBe(true);
  expect(client.getQueryState(["groups", "owner"])?.isInvalidated).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith("patch_group_settings", {
    p_group_id: "group",
    p_patch: { chat_enabled: false },
  });
});
it("does not display a saved change when the server rejects it", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: new Error("Owner access required"),
  });
  await act(async () => {
    expect(await first.updateSetting("chat_enabled", false)).toBe(false);
  });
  expect(second.settings.chat_enabled).toBe(true);
  expect(mocks.toast).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Settings not saved",
      variant: "destructive",
    }),
  );
});
