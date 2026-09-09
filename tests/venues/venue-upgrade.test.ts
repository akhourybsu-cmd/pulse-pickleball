import { describe, expect, it } from "vitest";
import { venueUpgradeState } from "@/lib/venues/venueUpgrade";

describe("venue upgrade guidance", () => {
  const owner = { isOwner: true, verified: true };
  it("requires the actual owner, not merely management access", () => {
    expect(
      venueUpgradeState({
        ...owner,
        isOwner: false,
        config: { mode: "live", cadence: "monthly", livemode: true },
      })
    ).toMatchObject({ ready: false, label: "Venue owner required" });
  });
  it("routes an unverified owner to free verification before payment", () => {
    expect(
      venueUpgradeState({
        ...owner,
        verified: false,
        config: { mode: "live", cadence: "monthly", livemode: true },
      })
    ).toMatchObject({ ready: false, label: "Verify ownership first" });
  });
  it("explains disabled checkout without hiding upgrade information", () => {
    const result = venueUpgradeState({
      ...owner,
      config: { mode: "off", cadence: "monthly", livemode: false },
    });
    expect(result.ready).toBe(false);
    expect(result.message).toContain("review upgrades now");
    expect(result.message).toContain("cannot be purchased yet");
  });
  it("fails closed on pending, missing or failed configuration", () => {
    expect(venueUpgradeState({ ...owner, pending: true }).ready).toBe(false);
    expect(venueUpgradeState({ ...owner, error: true }).ready).toBe(false);
    expect(venueUpgradeState(owner).ready).toBe(false);
  });
  it("distinguishes test checkout from a live $10 monthly subscription", () => {
    expect(
      venueUpgradeState({
        ...owner,
        config: { mode: "test", cadence: "monthly", livemode: false },
      })
    ).toMatchObject({ ready: true, label: "Test checkout · $10/month" });
    expect(
      venueUpgradeState({
        ...owner,
        config: { mode: "live", cadence: "monthly", livemode: true },
      })
    ).toMatchObject({ ready: true, label: "Continue · $10/month" });
  });
});
