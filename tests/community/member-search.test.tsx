import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ error: false, retry: vi.fn() }));
vi.mock("@/hooks/useGroupMembers", () => ({
  useGroupMembers: () => ({
    members: Array.from({ length: 48 }, (_, i) => ({
      id: String(i),
      user_id: String(i),
      role: "member",
      status: "active",
      joined_at: "2026-01-01T12:00:00Z",
      profile: {
        full_name: i === 47 ? "Zoe Last" : `Player ${i}`,
        display_name: null,
        avatar_url: null,
      },
    })),
    pendingMembers: [],
    loading: false,
    isError: state.error,
    refetch: state.retry,
  }),
}));
vi.mock("@/hooks/useFriends", () => ({
  useFriends: () => ({
    sendFriendRequest: vi.fn(),
    getFriendshipStatus: () => "none",
  }),
}));
vi.mock("@/hooks/useDirectMessages", () => ({
  useDirectMessages: () => ({ startConversation: vi.fn() }),
}));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  AvatarImage: () => null,
}));
import { GroupMembers } from "@/components/community/GroupMembers";
let view: ReactTestRenderer;
beforeEach(() => {
  state.error = false;
  state.retry.mockReset();
});
afterEach(() => act(() => view.unmount()));
function mount() {
  act(() => {
    view = create(
      <MemoryRouter>
        <GroupMembers
          groupId="group"
          isAdmin={false}
          isOwner={false}
          currentUserId="me"
        />
      </MemoryRouter>
    );
  });
}
const content = () => JSON.stringify(view.toJSON());
it("searches beyond the first page, clears safely and handles no matches", () => {
  mount();
  expect(content()).not.toContain("Zoe Last");
  act(() =>
    view.root.findByType("input").props.onChange({ target: { value: " zoe " } })
  );
  expect(content()).toContain("Zoe Last");
  expect(content()).not.toContain("Show more members");
  act(() =>
    view.root
      .findByType("input")
      .props.onChange({ target: { value: "Nobody matching" } })
  );
  expect(content()).toContain("No members match");
  act(() =>
    view.root.findByType("input").props.onChange({ target: { value: "" } })
  );
  expect(content()).toContain("Show more members");
});
it("shows a working retry without a misleading empty roster", () => {
  state.error = true;
  mount();
  expect(content()).toContain("We couldn’t load");
  expect(content()).not.toContain("No members to display");
  act(() =>
    view.root
      .findAllByType("button")
      .find((button) => button.children.includes("Try again"))!
      .props.onClick()
  );
  expect(state.retry).toHaveBeenCalledOnce();
});
