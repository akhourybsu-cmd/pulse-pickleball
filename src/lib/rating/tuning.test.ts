import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS } from "./params";
import { buildMatrix, evaluate, sweep, establishedDamage } from "./tuning";

describe("placement tuning — parameter sweep", () => {
  const matrix = buildMatrix();

  it("placement beats current ELO on convergence across the full matrix", () => {
    const r = evaluate(DEFAULT_PARAMS, matrix);
    // Placement should be much closer to true by M5, and still ahead at M15.
    expect(r.maePlacement[5]).toBeLessThan(r.maeCurrent[5]);
    expect(r.maePlacement[15]).toBeLessThan(r.maeCurrent[15]);
    console.log(
      `\nMAE to true (lower=better) across ${matrix.length} scenarios:\n` +
        `           M5     M8     M15\n` +
        `current  ${r.maeCurrent[5].toFixed(3)}  ${r.maeCurrent[8].toFixed(3)}  ${r.maeCurrent[15].toFixed(3)}\n` +
        `placement ${r.maePlacement[5].toFixed(3)}  ${r.maePlacement[8].toFixed(3)}  ${r.maePlacement[15].toFixed(3)}`,
    );
  });

  it("recommends constants via grid search", () => {
    const { best, rows } = sweep(matrix);
    const top = rows.slice(0, 8);
    console.log(
      "\n=== Placement parameter sweep (top 8 by score = MAE@5 + 0.5·correctDrift) ===\n" +
        "  C_team  prior_w   MAE@5   MAE@15  correctDrift   score\n" +
        top
          .map(
            (r) =>
              `   ${r.teamResultConstant.toFixed(2)}    ${r.priorWeight.toFixed(1)}     ` +
              `${r.mae5.toFixed(3)}   ${r.mae15.toFixed(3)}     ${r.correctDrift.toFixed(3)}       ${r.score.toFixed(3)}`,
          )
          .join("\n") +
        `\n\nRECOMMEND: team_result_constant=${best.teamResultConstant}, prior_weight=${best.priorWeight}`,
    );
    expect(best.mae5).toBeLessThan(0.35); // materially calibrated by match 5
    expect(best.correctDrift).toBeLessThan(0.15); // correctly-rated players barely move
  });

  it("chooses an established-protection multiplier that limits unfair damage", () => {
    const rows = [0.25, 0.35, 0.5, 1.0].map((m) => ({ m, damage: establishedDamage(m) }));
    console.log(
      "\n=== Established-opponent protection (damage to a real 4.0 vs a hidden-strong newcomer) ===\n" +
        rows.map((r) => `   multiplier ${r.m.toFixed(2)}  →  rating damage ${r.damage.toFixed(3)}`).join("\n"),
    );
    // Protection must strictly reduce damage vs unprotected (1.0).
    const unprot = rows.find((r) => r.m === 1.0)!.damage;
    const prot = rows.find((r) => r.m === 0.35)!.damage;
    expect(prot).toBeLessThan(unprot);
  });
});
