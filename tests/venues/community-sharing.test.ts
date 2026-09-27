import { afterEach, describe, expect, it, vi } from "vitest";
import {
  communityInvitePath,
  communityInviteUrl,
  communityShareData,
  communityUrl,
  shareCommunity,
} from "@/lib/communityShare";
afterEach(() => vi.unstubAllGlobals());
describe("community invitations", () => {
  it("creates branded external links even inside a native WebView", () => {
    vi.stubGlobal("window", { location: { origin: "capacitor://localhost" } });
    expect(communityInviteUrl(" A/B # ")).toBe(
      "https://pulsepb.com/player/community/join/A%2FB%20%23"
    );
    expect(communityInvitePath("ONE")).toBe("/player/community/join/ONE");
    expect(communityUrl("group")).toBe(
      "https://pulsepb.com/player/community/group/group"
    );
  });
  it.each([
    "Rally House Sports",
    "11-0 Pickleball",
    "Court Advisory Committee",
  ])("names %s accurately without duplicating its URL", (name) => {
    const data = communityShareData(name, communityInviteUrl("ABCD"));
    expect(data.title).toBe(`Join ${name}`);
    expect(data.text).toContain(`Join ${name} on PULSE.`);
    expect(data.text).not.toContain(data.url);
  });
  it("opens native sharing and treats cancellation as cancellation", async () => {
    const writeText = vi.fn();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    const data = communityShareData(
      "11-0 Pickleball",
      communityInviteUrl("ABCD")
    );
    expect(await shareCommunity(data)).toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
    share.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    expect(await shareCommunity(data)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });
  it("copies the complete invitation when sharing is unavailable, and reports clipboard failure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const data = communityShareData(
      "Rally House Sports",
      communityInviteUrl("ABCD")
    );
    expect(await shareCommunity(data)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(`${data.text}\n${data.url}`);
    writeText.mockRejectedValue(new Error("Clipboard blocked"));
    await expect(shareCommunity(data)).rejects.toThrow("Clipboard blocked");
  });
});
