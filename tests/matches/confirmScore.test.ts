import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmMatchScore } from "@/lib/confirmMatchScore";
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock }));
beforeEach(() => {
  vi.clearAllMocks();
  for (const method of [mock.from, mock.update, mock.eq, mock.select])
    method.mockReturnValue(mock);
  mock.maybeSingle.mockResolvedValue({
    data: { match_id: "match" },
    error: null,
  });
  mock.rpc.mockResolvedValue({
    data: { verified_by: ["viewer"] },
    error: null,
  });
});
describe("score confirmation", () => {
  it("only updates the selected match and the current player’s approval row", async () => {
    await confirmMatchScore("match", "viewer", true);
    expect(mock.from).toHaveBeenCalledWith("match_approvals");
    expect(mock.eq.mock.calls).toEqual([
      ["match_id", "match"],
      ["player_id", "viewer"],
    ]);
    expect(mock.update).toHaveBeenCalledWith({
      approved: true,
      approved_at: expect.any(String),
    });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("does not claim success if access rules or removal prevent an update", async () => {
    mock.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(confirmMatchScore("match", "viewer", true)).rejects.toThrow(
      "not saved"
    );
  });
  it("uses the server verification RPC for completed matches and surfaces errors", async () => {
    mock.rpc.mockResolvedValue({ error: new Error("Not a participant") });
    await expect(confirmMatchScore("match", "viewer", false)).rejects.toThrow(
      "Not a participant"
    );
    expect(mock.rpc).toHaveBeenCalledWith("verify_match", {
      p_match_id: "match",
    });
    expect(mock.update).not.toHaveBeenCalled();
  });
});
