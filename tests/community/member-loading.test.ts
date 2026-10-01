import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  members: { data: [] as unknown[], error: null as unknown },
  profiles: { data: [] as unknown[], error: null as unknown },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mock.from },
}));
import { fetchGroupMembers } from "@/hooks/useGroupMembers";
beforeEach(() => {
  mock.members = { data: [], error: null };
  mock.profiles = { data: [], error: null };
  mock.from.mockReset().mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => Promise.resolve(mock.members),
      in: () => Promise.resolve(mock.profiles),
    };
    return query;
  });
});
describe("complete and recoverable community rosters", () => {
  it("does not query an empty profile id list", async () => {
    expect(await fetchGroupMembers("group")).toEqual({
      members: [],
      pendingMembers: [],
    });
    expect(mock.from).toHaveBeenCalledTimes(1);
  });
  it("retains a membership when its public profile is unavailable", async () => {
    mock.members.data = [{ id: "member", user_id: "player", status: "active" }];
    const result = await fetchGroupMembers("group");
    expect(result.members).toHaveLength(1);
    expect(result.members[0].profile).toMatchObject({
      full_name: "Player",
      avatar_url: null,
    });
  });
  it("reports profile request failures instead of claiming the roster is empty", async () => {
    mock.members.data = [{ user_id: "player", status: "active" }];
    mock.profiles.error = new Error("Offline");
    await expect(fetchGroupMembers("group")).rejects.toThrow("Offline");
  });
  it("keeps pending requests separate and excludes banned memberships", async () => {
    mock.members.data = ["active", "pending", "banned"].map((status) => ({
      id: status,
      user_id: status,
      status,
    }));
    mock.profiles.data = ["active", "pending", "banned"].map((id) => ({
      id,
      full_name: id,
    }));
    const result = await fetchGroupMembers("group");
    expect(result.members.map((member) => member.id)).toEqual(["active"]);
    expect(result.pendingMembers.map((member) => member.id)).toEqual([
      "pending",
    ]);
  });
});
