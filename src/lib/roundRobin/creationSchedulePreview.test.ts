import { describe, expect, it } from "vitest";
import { planCreationSchedulePreview } from "./creationSchedulePreview";

describe("planCreationSchedulePreview", () => {
  it("uses exact mixed-gender capacity for a selected roster", () => {
    const participants = Array.from({ length: 8 }, (_, index) => ({
      id: `player-${index + 1}`,
      gender: index < 5 ? "male" : "female",
    }));

    const plan = planCreationSchedulePreview({
      participants,
      numCourts: 2,
      gamesPerPlayer: 3,
      format: "mixed",
    });

    expect(plan?.ok).toBe(true);
    expect(plan?.capacity).toMatchObject({
      requestedCourts: 2,
      usableCourts: 1,
      matchesPerRound: 1,
      unusedCourts: 1,
      futureRounds: 8,
    });
    expect(plan?.fairness.playersBelowTarget).toBe(0);
  });

  it("returns a blocking plan when an exact mixed roster lacks gender data", () => {
    const plan = planCreationSchedulePreview({
      participants: [
        { id: "m1", gender: "male" },
        { id: "m2", gender: "male" },
        { id: "f1", gender: "female" },
        { id: "unknown", gender: null },
      ],
      numCourts: 1,
      gamesPerPlayer: 3,
      format: "mixed",
    });

    expect(plan).toMatchObject({
      ok: false,
      code: "mixed_roster_gender_missing",
    });
  });
});
