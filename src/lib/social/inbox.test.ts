import { describe, it, expect } from "vitest";
import {
  dmToConversation,
  groupToConversation,
  sortConversations,
  filterConversations,
  messagePreview,
  totalUnread,
  type DmSource,
  type GroupSource,
} from "./inbox";

const ME = "me-id";

const dm = (over: Partial<DmSource> = {}): DmSource => ({
  id: "dm1",
  updated_at: "2026-01-01T10:00:00Z",
  participant: { display_name: "Alex", full_name: "Alex R", avatar_url: null },
  lastMessage: { content: "hey there", sender_id: "other", created_at: "2026-01-01T10:00:00Z" },
  unreadCount: 0,
  isMuted: false,
  ...over,
});

const group = (over: Partial<GroupSource> = {}): GroupSource => ({
  id: "g1", name: "Pulse Admin Team", icon_url: null, member_count: 5,
  updated_at: "2026-01-01T09:00:00Z", unread_count: 0, ...over,
});

describe("social inbox — normalization", () => {
  it("normalizes a DM (route, title, activity, no 'You:' for incoming)", () => {
    const c = dmToConversation(dm(), ME);
    expect(c).toMatchObject({ type: "dm", title: "Alex", route: "/player/messages/dm1" });
    expect(c.lastMessagePreview).toBe("hey there");
    expect(c.lastActivityAt).toBe("2026-01-01T10:00:00Z");
  });

  it("prefixes 'You:' when the current user sent the last DM", () => {
    const c = dmToConversation(dm({ lastMessage: { content: "on my way", sender_id: ME, created_at: "2026-01-01T10:00:00Z" } }), ME);
    expect(c.lastMessagePreview).toBe("You: on my way");
  });

  it("handles a DM with no messages yet", () => {
    const c = dmToConversation(dm({ lastMessage: null }), ME);
    expect(c.lastMessagePreview).toBeNull();
    expect(c.lastActivityAt).toBe("2026-01-01T10:00:00Z"); // falls back to updated_at
  });

  it("normalizes a group with a sender-prefixed preview + community route", () => {
    const c = groupToConversation(group({ unread_count: 2 }), {
      content: "schedule is ready", image_url: null, created_at: "2026-01-01T11:00:00Z",
      senderName: "Alex", senderIsMe: false,
    });
    expect(c).toMatchObject({ type: "group", title: "Pulse Admin Team", unreadCount: 2, participantCount: 5, relatedCommunityId: "g1" });
    expect(c.route).toBe("/player/community/group/g1?tab=chat");
    expect(c.lastMessagePreview).toBe("Alex: schedule is ready");
    expect(c.lastActivityAt).toBe("2026-01-01T11:00:00Z");
  });

  it("shows a photo preview for an attachment-only group message", () => {
    const c = groupToConversation(group(), { content: "", image_url: "x.jpg", created_at: "2026-01-01T11:00:00Z", senderName: "Sam", senderIsMe: false });
    expect(c.lastMessagePreview).toBe("Sam: 📷 Photo");
  });

  it("gracefully handles a group with no chat activity", () => {
    const c = groupToConversation(group({ updated_at: "2026-01-01T08:00:00Z" }), null);
    expect(c.lastMessagePreview).toBeNull();
    expect(c.lastActivityAt).toBe("2026-01-01T08:00:00Z");
  });

  it("messagePreview handles empty / attachment", () => {
    expect(messagePreview("hi")).toBe("hi");
    expect(messagePreview("   ")).toBe("");
    expect(messagePreview("", true)).toBe("📷 Photo");
  });
});

describe("social inbox — sort + filter", () => {
  const list = [
    dmToConversation(dm({ id: "a", lastMessage: { content: "old", sender_id: "x", created_at: "2026-01-01T09:00:00Z" }, unreadCount: 0 }), ME),
    dmToConversation(dm({ id: "b", lastMessage: { content: "newest", sender_id: "x", created_at: "2026-01-01T12:00:00Z" }, unreadCount: 3, isMuted: true }), ME),
    groupToConversation(group({ id: "c", name: "Ladder Crew", unread_count: 1 }), { content: "mid", image_url: null, created_at: "2026-01-01T10:30:00Z", senderName: "Jo", senderIsMe: false }),
  ];

  it("sorts by latest activity first", () => {
    expect(sortConversations(list).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("unread filter returns only unread", () => {
    expect(filterConversations(list, "unread", "").map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  it("muted filter returns only muted", () => {
    expect(filterConversations(list, "muted", "").map((c) => c.id)).toEqual(["b"]);
  });

  it("search matches title and preview", () => {
    expect(filterConversations(list, "all", "ladder").map((c) => c.id)).toEqual(["c"]);
    expect(filterConversations(list, "all", "newest").map((c) => c.id)).toEqual(["b"]);
  });

  it("totalUnread sums across dm + group", () => {
    expect(totalUnread(list)).toBe(4);
  });
});
