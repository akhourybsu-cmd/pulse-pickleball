import { describe, expect, it } from "vitest";
import {
  normalizeBinaryGender,
  participantGenderEligibility,
  requiredGenderForFormat,
  resolveGuestGenderForCreate,
  rosterGenderIssue,
} from "./participantGender";

describe("round-robin participant gender rules", () => {
  it("preserves open-format eligibility for every stored gender value", () => {
    expect(participantGenderEligibility("open", null).eligible).toBe(true);
    expect(participantGenderEligibility("open", "other").eligible).toBe(true);
    expect(participantGenderEligibility("open", "female").eligible).toBe(true);
  });

  it("requires a binary scheduling gender for mixed play", () => {
    expect(participantGenderEligibility("mixed", "male").eligible).toBe(true);
    expect(participantGenderEligibility("mixed", "female").eligible).toBe(true);
    expect(participantGenderEligibility("mixed", null)).toMatchObject({
      eligible: false,
      normalizedGender: null,
    });
    expect(participantGenderEligibility("mixed", "prefer_not_to_say").eligible).toBe(false);
  });

  it("allows only the matching gender in men's and women's play", () => {
    expect(participantGenderEligibility("male", "male").eligible).toBe(true);
    expect(participantGenderEligibility("male", "female").eligible).toBe(false);
    expect(participantGenderEligibility("female", "female").eligible).toBe(true);
    expect(participantGenderEligibility("female", undefined).eligible).toBe(false);
  });

  it("automatically resolves the fixed event gender for new guests", () => {
    expect(requiredGenderForFormat("male")).toBe("male");
    expect(requiredGenderForFormat("female")).toBe("female");
    expect(requiredGenderForFormat("mixed")).toBeNull();
    expect(resolveGuestGenderForCreate("male", "female")).toBe("male");
    expect(resolveGuestGenderForCreate("female", null)).toBe("female");
    expect(resolveGuestGenderForCreate("open", "male")).toBeNull();
  });

  it("normalizes explicit mixed guest choices without inventing one", () => {
    expect(normalizeBinaryGender(" FEMALE ")).toBe("female");
    expect(resolveGuestGenderForCreate("mixed", "male")).toBe("male");
    expect(resolveGuestGenderForCreate("mixed", null)).toBeNull();
  });

  it("rejects stale or incompatible selected rosters", () => {
    expect(rosterGenderIssue("male", ["male", "male", "male", "male", "female"]))
      .toContain("every selected player");
    expect(rosterGenderIssue("mixed", ["male", "male", "female", null]))
      .toContain("needs male or female gender");
    expect(rosterGenderIssue("mixed", ["male", "male", "female", "female"]))
      .toBeNull();
    expect(rosterGenderIssue("open", [null, "other", "female"]))
      .toBeNull();
  });
});
