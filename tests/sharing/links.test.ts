import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publicAppUrl,
  playerProfileUrl,
  shareLink,
  copyText,
} from "@/lib/share";
import {
  stashPostAuthRedirect,
  consumePostAuthRedirect,
  clearPostAuthRedirect,
  isSharedPageReturnPath,
} from "@/lib/authRedirect";
import { communityAuthUrl } from "@/lib/communityAccess";

afterEach(() => vi.unstubAllGlobals());
describe("external share links", () => {
  it("uses the public app origin for player, venue and event links inside native shells", () => {
    vi.stubGlobal("window", { location: { origin: "capacitor://localhost" } });
    expect(playerProfileUrl("person")).toBe(
      "https://pulsepb.com/profile/person"
    );
    for (const path of [
      "/venue-visit/token",
      "/venue-quote/token",
      "/venue-kiosk/token",
      "/venue-check-in/token",
      "/player/matches?tab=pending",
    ]) {
      expect(publicAppUrl(path)).toBe(`https://pulsepb.com${path}`);
    }
    for (const path of [
      "//example.com",
      "/\\example.com",
      "https://example.com",
      "/a b",
    ])
      expect(() => publicAppUrl(path)).toThrow();
  });
  it("does not copy or report success after a cancelled native share", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new DOMException("", "AbortError")),
      clipboard: { writeText },
    });
    expect(await shareLink({ url: playerProfileUrl("person") })).toBe(
      "cancelled"
    );
    expect(writeText).not.toHaveBeenCalled();
  });
  it("falls back from failed native sharing without putting undefined in a copied profile link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new Error("Unsupported")),
      clipboard: { writeText },
    });
    expect(
      await shareLink({ title: "Profile", url: playerProfileUrl("person") })
    ).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      "https://pulsepb.com/profile/person"
    );
  });
  it("falls back when the browser exposes Clipboard but blocks it, and removes the temporary selection", async () => {
    const input = {
      value: "",
      style: {},
      setAttribute: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    };
    const focus = vi.fn(),
      execCommand = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Blocked")) },
    });
    vi.stubGlobal("document", {
      activeElement: { focus },
      createElement: () => input,
      body: { appendChild: vi.fn() },
      execCommand,
    });
    await copyText("Invitation");
    expect(input.value).toBe("Invitation");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(input.remove).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
});

describe("shared destination authentication", () => {
  it.each([
    "/player/leagues/join/FALL-26",
    "/qr-checkin?session=11111111-1111-4111-8111-111111111111",
    "/session/queue?session=11111111-1111-4111-8111-111111111111",
    "/events/11111111-1111-4111-8111-111111111111/add-match",
    "/profile/11111111-1111-4111-8111-111111111111",
    "/player/profile/11111111-1111-4111-8111-111111111111",
    "/u/avery",
    "/venue-check-in/token",
    "/claim-guest/token",
    "/round-robin/11111111-1111-4111-8111-111111111111?source=share",
  ])("retains %s until the destination acknowledges arrival", (path) => {
    const memory = () => {
      const values = new Map<string, string>();
      return {
        getItem: (key: string) => values.get(key),
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      };
    };
    vi.stubGlobal("sessionStorage", memory());
    vi.stubGlobal("localStorage", memory());
    expect(isSharedPageReturnPath(path)).toBe(true);
    stashPostAuthRedirect(path);
    expect(consumePostAuthRedirect()).toBe(path);
    expect(consumePostAuthRedirect()).toBe(path);
    clearPostAuthRedirect("/different-path");
    expect(consumePostAuthRedirect()).toBe(path);
    clearPostAuthRedirect(path);
    expect(consumePostAuthRedirect()).toBe("/player/dashboard");
    const url = new URL(communityAuthUrl(path), "https://pulsepb.com");
    expect(url.searchParams.get("mode")).toBe("signup");
    expect(url.searchParams.get("redirect")).toBe(path);
  });
});
