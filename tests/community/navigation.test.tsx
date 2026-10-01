import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter, useNavigate, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { useCommunityTabs } from "@/hooks/useCommunityTabs";
import { communityAbilities, communityTab } from "@/lib/community/navigation";

let view: ReactTestRenderer;
let tabs: ReturnType<typeof useCommunityTabs>;
let navigate: ReturnType<typeof useNavigate>;
let search = "";
function Harness({ chat = true }: { chat?: boolean }) {
  tabs = useCommunityTabs(chat);
  navigate = useNavigate();
  search = useLocation().search;
  return null;
}
afterEach(() => {
  if (view) act(() => view.unmount());
});

describe("community navigation", () => {
  it.each([
    ["events", "schedule"],
    ["play", "schedule"],
    ["files", "more"],
    ["about", "more"],
    ["unknown", "feed"],
    ["chat", "chat"],
  ])("opens %s links in %s", (input, expected) =>
    expect(communityTab(input)).toBe(expected)
  );
  it("keeps deep links, tab clicks, browser back and forward in sync without losing visited panels", () => {
    act(() => {
      view = create(
        <MemoryRouter initialEntries={["/group?tab=events&view=community"]}>
          <Harness />
        </MemoryRouter>
      );
    });
    expect(tabs.activeTab).toBe("schedule");
    act(() => tabs.handleTabChange("members"));
    expect(search).toContain("tab=members");
    expect(search).toContain("view=community");
    act(() => navigate(-1));
    expect(tabs.activeTab).toBe("schedule");
    act(() => navigate(1));
    expect(tabs.activeTab).toBe("members");
    act(() => navigate("/group?tab=chat"));
    expect(tabs.activeTab).toBe("chat");
    expect([...tabs.visitedTabs]).toEqual(["schedule", "members", "chat"]);
  });
  it("does not add history for reselecting the current tab", () => {
    act(() => {
      view = create(
        <MemoryRouter
          initialEntries={["/group?tab=feed", "/group?tab=members"]}
          initialIndex={1}
        >
          <Harness />
        </MemoryRouter>
      );
    });
    act(() => tabs.handleTabChange("members"));
    act(() => navigate(-1));
    expect(tabs.activeTab).toBe("feed");
  });
  it("closes a disabled chat even if it was selected from a link", () => {
    act(() => {
      view = create(
        <MemoryRouter initialEntries={["/group?tab=chat"]}>
          <Harness chat={false} />
        </MemoryRouter>
      );
    });
    expect(tabs.activeTab).toBe("feed");
    expect(tabs.visitedTabs.has("chat")).toBe(false);
  });
});

describe("community actions follow settings and membership", () => {
  it.each(["pending", "banned"])(
    "allows no member actions for %s viewers",
    (status) => {
      expect(
        Object.values(communityAbilities({}, { status, role: "owner" })).every(
          (value) => !value
        )
      ).toBe(true);
    }
  );
  it("allows no actions for guests", () =>
    expect(Object.values(communityAbilities({})).every((value) => !value)).toBe(
      true
    ));
  it("honors disabled member posts, events, chat and uploads", () => {
    expect(
      communityAbilities(
        {
          allow_member_posts: false,
          allow_member_events: false,
          allow_member_chat: false,
          allow_member_uploads: false,
        },
        { status: "active", role: "member" }
      )
    ).toEqual({
      post: false,
      lfg: false,
      event: false,
      chat: true,
      sendChat: false,
      files: true,
      upload: false,
    });
  });
  it("honors disabled features for owners too", () => {
    const result = communityAbilities(
      { chat_enabled: false, files_enabled: false, allow_member_posts: false },
      { status: "active", role: "owner" }
    );
    expect(result).toMatchObject({
      post: true,
      event: true,
      chat: false,
      sendChat: false,
      files: false,
      upload: false,
    });
  });
  it("uses the same event permission alternatives as the server for moderators", () => {
    const membership = { status: "active", role: "moderator" };
    expect(
      communityAbilities(
        { moderators_can_create_events: false, allow_member_events: false },
        membership
      ).event
    ).toBe(false);
    expect(
      communityAbilities(
        { moderators_can_create_events: false, allow_member_events: true },
        membership
      ).event
    ).toBe(true);
  });
});
