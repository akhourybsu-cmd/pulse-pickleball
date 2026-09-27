import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, GroupMember } from "@/hooks/useGroups";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), read: vi.fn() }));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: "player" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => ({ abortSignal: () => mocks.insert(row) }),
      select: () => {
        const query = {
          eq: () => query,
          maybeSingle: () => query,
          abortSignal: () => mocks.read(),
        };
        return query;
      },
    }),
  },
}));
import { CommunityJoinAction } from "@/components/community/CommunityJoinAction";
let renderer: ReactTestRenderer;
let cache: QueryClient;
const group = {
  id: "rally",
  name: "Rally Haus Sports",
  visibility: "public",
  join_method: "open",
} as Group;
function mount(overrides: Partial<Group> = {}, status?: string) {
  cache = new QueryClient();
  act(() => {
    renderer = create(
      <QueryClientProvider client={cache}>
        <CommunityJoinAction
          group={{ ...group, ...overrides }}
          membership={status ? ({ status } as GroupMember) : null}
        />
      </QueryClientProvider>
    );
  });
}
async function join() {
  await act(async () => renderer.root.findByType("button").props.onClick());
}
const text = () => JSON.stringify(renderer.toJSON());
beforeEach(() => {
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.read.mockReset();
});
afterEach(() => {
  act(() => renderer.unmount());
  cache.clear();
});
describe("joining after signup from a public community page", () => {
  it("gives a new player a working join action without an invitation", async () => {
    mount();
    expect(text()).toContain("Join the community");
    await join();
    expect(mocks.insert).toHaveBeenCalledWith({
      group_id: "rally",
      user_id: "player",
      role: "member",
      status: "active",
    });
    expect(renderer.toJSON()).toBeNull();
  });
  it("requests approval instead of granting membership", async () => {
    mount({ join_method: "request_to_join" });
    await join();
    expect(mocks.insert.mock.calls[0][0].status).toBe("pending");
    expect(text()).toContain("pending approval");
  });
  it.each(["active", "pending", "banned"])(
    "does not assume a duplicate membership row is active: %s",
    async (status) => {
      mocks.insert.mockResolvedValue({ error: { code: "23505" } });
      mocks.read.mockResolvedValue({ data: { status }, error: null });
      mount();
      await join();
      if (status === "active") expect(renderer.toJSON()).toBeNull();
      else
        expect(text()).toContain(
          status === "pending" ? "pending approval" : "cannot join"
        );
    }
  );
  it.each(["pending", "banned"])(
    "does not write for an existing %s membership",
    (status) => {
      mount({}, status);
      expect(renderer.root.findAllByType("button")).toHaveLength(0);
      expect(mocks.insert).not.toHaveBeenCalled();
    }
  );
  it.each([{ join_method: "invite_only" }, { visibility: "private" }])(
    "requires an invitation when access settings require one",
    (settings) => {
      mount(settings as Partial<Group>);
      expect(text()).toContain("invitation link");
      expect(renderer.root.findAllByType("button")).toHaveLength(0);
    }
  );
  it("keeps a failed join retryable instead of claiming success", async () => {
    mocks.insert.mockRejectedValueOnce(new Error("Offline"));
    mount();
    await join();
    expect(text()).toContain("Please try again");
    await join();
    expect(renderer.toJSON()).toBeNull();
  });
});
