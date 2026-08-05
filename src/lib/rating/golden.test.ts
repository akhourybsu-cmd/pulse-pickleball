import { describe, it, expect } from "vitest";
import { computeGolden } from "./golden";

// These are the validation oracle for the SQL port (see docs/placement-golive.md).
// If the engine math changes intentionally, update these AND the runbook table.
describe("placement golden fixture (SQL validation oracle)", () => {
  it("produces the locked expected trajectory", () => {
    const g = computeGolden();
    expect(g.rows.map((r) => r.ratingAfter)).toEqual([3.45, 3.6, 3.675, 3.6036, 3.653]);
    expect(g.placedRating).toBe(3.653);
  });
});
