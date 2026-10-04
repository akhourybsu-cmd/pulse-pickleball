import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
  user: "a",
}));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: mocks.user }, refresh: mocks.refresh }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));
vi.mock("@/lib/saveProfileChange", () => ({ saveProfileChange: mocks.save }));
vi.mock("@/components/match-wizard/CityAutocomplete", () => ({
  CityAutocomplete: () => null,
}));
vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children, ...props }: any) => (
    <section {...props}>{children}</section>
  ),
  AccordionItem: ({ children }: any) => <article>{children}</article>,
  AccordionTrigger: ({ children }: any) => <header>{children}</header>,
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/profile/ProfileBasicsTab", () => ({
  ProfileIdentitySection: ({ formData, onFormChange }: any) => (
    <input
      aria-label="Display name"
      value={formData.display_name || ""}
      onChange={(e) => onFormChange({ display_name: e.target.value })}
    />
  ),
  ProfileLocationSection: ({ formData, onFormChange }: any) => (
    <input
      aria-label="Town"
      value={formData.town || ""}
      onChange={(e) => onFormChange({ town: e.target.value })}
    />
  ),
}));
vi.mock("@/components/profile/TournamentInfoTab", () => ({
  TournamentInfoTab: () => null,
}));
vi.mock("@/components/profile/PlayStyleTab", () => ({
  PlayStyleTab: () => null,
}));
import EditProfile from "@/pages/EditProfile";
import { clearAccountSession } from "@/lib/accountSession";
let renderer: ReactTestRenderer, client: QueryClient;
const profile = {
  id: "a",
  display_name: "Alex",
  first_name: "Alex",
  last_name: "Player",
  name_locked: true,
  town: "Boston",
};
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
};
async function mount() {
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <EditProfile />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
  await flush();
}
const field = (name: string) =>
  renderer.root.findByProps({ "aria-label": name });
const buttons = () => renderer.root.findAllByType("button");
const save = () =>
  buttons().filter((button) => button.props.children === "Save")[0];
beforeEach(() => {
  clearAccountSession();
  vi.clearAllMocks();
  mocks.user = "a";
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  mocks.read.mockResolvedValue({ data: profile, error: null });
  mocks.save.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(undefined);
  mocks.from.mockImplementation(() => {
    const b = {
      select: () => b,
      eq: () => b,
      abortSignal: () => b,
      single: mocks.read,
    };
    return b;
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  client.clear();
  clearAccountSession();
});
it("retains a draft and open sections when leaving and returning without another profile request", async () => {
  await mount();
  act(() =>
    field("Display name").props.onChange({
      target: { value: "Unfinished name" },
    })
  );
  act(() =>
    renderer.root
      .findByType("section")
      .props.onValueChange(["location", "identity"])
  );
  act(() => renderer.unmount());
  await mount();
  expect(field("Display name").props.value).toBe("Unfinished name");
  expect(renderer.root.findByType("section").props.value).toEqual([
    "location",
    "identity",
  ]);
  expect(mocks.read).toHaveBeenCalledTimes(1);
});
it("merges fresh server data without overwriting edited fields", async () => {
  await mount();
  act(() =>
    field("Display name").props.onChange({ target: { value: "Draft name" } })
  );
  act(() => {
    client.setQueryData(["account-profile", "a"], {
      ...profile,
      display_name: "Remote name",
      town: "Cambridge",
    });
  });
  await flush();
  expect(field("Display name").props.value).toBe("Draft name");
  expect(field("Town").props.value).toBe("Cambridge");
});
it("keeps unsaved edits after a failed save and clears only confirmed fields after retry", async () => {
  await mount();
  act(() =>
    field("Display name").props.onChange({ target: { value: "Updated" } })
  );
  act(() => field("Town").props.onChange({ target: { value: "Providence" } }));
  mocks.save.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => {
    await save().props.onClick();
  });
  expect(field("Display name").props.value).toBe("Updated");
  await act(async () => {
    await save().props.onClick();
  });
  act(() => renderer.unmount());
  await mount();
  expect(field("Display name").props.value).toBe("Updated");
  expect(field("Town").props.value).toBe("Providence");
  expect(client.getQueryData(["account-profile", "a"])).toMatchObject({
    display_name: "Updated",
    town: "Boston",
  });
});
it("deduplicates saves and preserves text typed while the earlier value is saving", async () => {
  await mount();
  let resolve!: () => void;
  mocks.save.mockImplementationOnce(
    () => new Promise<void>((done) => (resolve = done))
  );
  act(() =>
    field("Display name").props.onChange({ target: { value: "First" } })
  );
  let pending!: Promise<void>;
  act(() => {
    const click = save().props.onClick;
    pending = click();
    void click();
  });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  act(() =>
    field("Display name").props.onChange({ target: { value: "Still typing" } })
  );
  await act(async () => {
    resolve();
    await pending;
  });
  expect(field("Display name").props.value).toBe("Still typing");
  expect(client.getQueryData(["account-profile", "a"])).toMatchObject({
    display_name: "First",
  });
});
it("recovers from a failed initial load rather than remaining on a loading screen", async () => {
  mocks.read.mockResolvedValueOnce({ data: null, error: new Error("Offline") });
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "couldn’t load your profile"
  );
  await act(async () => {
    buttons()
      .find((b) => b.props.children === "Try again")!
      .props.onClick();
  });
  await flush();
  expect(field("Display name").props.value).toBe("Alex");
});
it("keeps drafts isolated between accounts and clearly labels tournaments as upcoming", async () => {
  await mount();
  act(() =>
    field("Display name").props.onChange({ target: { value: "Private draft" } })
  );
  act(() => renderer.unmount());
  mocks.user = "b";
  await mount();
  expect(field("Display name").props.value).toBe("Alex");
  expect(JSON.stringify(renderer.toJSON())).toContain(
    "Tournament registration is not available yet"
  );
  expect(JSON.stringify(renderer.toJSON())).not.toContain(
    "ready for tournament registration!"
  );
});
