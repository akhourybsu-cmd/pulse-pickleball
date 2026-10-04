import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  identities: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
  toast: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUserIdentities: mocks.identities,
      linkIdentity: mocks.link,
      unlinkIdentity: mocks.unlink,
    },
  },
}));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: "a", email: "fixture@example.test" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));
vi.mock("sonner", () => ({
  toast: { error: mocks.toast, success: mocks.toast },
}));
vi.mock("@/lib/authEmail", () => ({ sendAuthEmail: mocks.send }));
import { LinkedAccounts } from "@/components/profile/LinkedAccounts";
import { PasswordSettings } from "@/components/profile/PasswordSettings";
let renderer: ReactTestRenderer, client: QueryClient;
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
};
const buttons = () => renderer.root.findAllByType("button");
async function mount(child = <LinkedAccounts />) {
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>{child}</QueryClientProvider>
    );
  });
  await flush();
}
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  mocks.identities.mockResolvedValue({
    data: { identities: [{ id: "email", provider: "email" }] },
    error: null,
  });
  mocks.link.mockResolvedValue({ data: {}, error: null });
  mocks.unlink.mockResolvedValue({ error: null });
  mocks.send.mockResolvedValue(undefined);
  vi.stubGlobal("window", { location: { origin: "https://pulsepb.com" } });
});
afterEach(() => {
  act(() => renderer?.unmount());
  client.clear();
  vi.unstubAllGlobals();
});
it("shows an identity load failure with retry instead of offering incorrect link actions", async () => {
  mocks.identities.mockRejectedValueOnce(new Error("Offline"));
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "Couldn’t load your sign-in methods"
  );
  expect(
    buttons()
      .filter((b) => b.props.children !== "Try again")
      .every((b) => b.props.disabled)
  ).toBe(true);
  await act(async () => {
    buttons()
      .find((b) => b.props.children === "Try again")!
      .props.onClick();
  });
  await flush();
  expect(buttons().every((b) => !b.props.disabled)).toBe(true);
});
it("returns OAuth linking to security and releases controls when no redirect occurs", async () => {
  await mount();
  await act(async () => {
    await buttons()[0].props.onClick();
  });
  expect(mocks.link).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: "https://pulsepb.com/player/profile/security" },
  });
  expect(buttons().every((b) => !b.props.disabled)).toBe(true);
});
it("protects the last sign-in method and leaves failed unlink attempts visible", async () => {
  mocks.identities.mockResolvedValue({
    data: { identities: [{ id: "google", provider: "google" }] },
    error: null,
  });
  await mount();
  expect(buttons()[0].props.disabled).toBe(true);
  act(() => renderer.unmount());
  mocks.identities.mockResolvedValue({
    data: {
      identities: [
        { id: "google", provider: "google" },
        { id: "email", provider: "email" },
      ],
    },
    error: null,
  });
  client.clear();
  await mount();
  mocks.unlink.mockResolvedValueOnce({ error: new Error("Offline") });
  await act(async () => {
    await buttons()[0].props.onClick();
  });
  expect(JSON.stringify(renderer.toJSON())).toContain("Unlink");
  expect(buttons()[0].props.disabled).toBe(false);
});
it("sends at most one reset email per click burst and recovers from a failed request", async () => {
  await mount(<PasswordSettings />);
  let reject!: (error: Error) => void;
  mocks.send.mockImplementationOnce(
    () => new Promise((_, fail) => (reject = fail))
  );
  let pending!: Promise<void>;
  act(() => {
    const click = buttons()[0].props.onClick;
    pending = click();
    click();
  });
  expect(mocks.send).toHaveBeenCalledTimes(1);
  await act(async () => {
    reject(new Error("Offline"));
    await pending;
  });
  await flush();
  expect(buttons()[0].props.disabled).toBe(false);
  await act(async () => {
    buttons()[0].props.onClick();
  });
  await flush();
  expect(mocks.send).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(renderer.toJSON())).toContain("Check your inbox");
});
