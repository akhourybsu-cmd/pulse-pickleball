import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScheduleImpactPreview } from "../../src/components/round-robin/ScheduleImpactPreview";
import { planCreationSchedulePreview } from "../../src/lib/roundRobin/creationSchedulePreview";
import { calculateScheduleMetrics } from "../../src/components/round-robin/wizard/hooks/useWizardSteps";

describe("equal games organizer preview", () => {
  it("shows equal counts and variable rests before generating", () => {
    const plan = planCreationSchedulePreview({ participants: Array.from({ length: 18 }, (_, i) => ({ id: String(i) })),
      numCourts: 4, gamesPerPlayer: 4, equalGames: true, format: "open" });
    const html = renderToStaticMarkup(<ScheduleImpactPreview playerCount={18} courtCount={4} gamesPerPlayer={4} equalGames plan={plan} />);
    expect(html).toContain("Everyone finishes with 4 actual games.");
    expect(html).toContain("2–6");
    expect(html).toContain("0-game spread");
    expect(html).not.toContain("All courts active");
  });
  it("explains a rounded target for count-only setup", () => {
    const html = renderToStaticMarkup(<ScheduleImpactPreview playerCount={18} courtCount={4} gamesPerPlayer={5} equalGames />);
    expect(html).toContain("The schedule uses 6 games each.");
    expect(html).toContain("6 games each · requested 5");
    expect(calculateScheduleMetrics(18, 4, 5, true).rounds).toBe(7);
  });
  it("shows an actionable mixed-roster conflict instead of claiming equal games", () => {
    const plan = planCreationSchedulePreview({ participants: Array.from({ length: 8 }, (_, i) => ({ id: String(i), gender: i < 5 ? "male" : "female" })),
      numCourts: 2, gamesPerPlayer: 3, equalGames: true, format: "mixed" });
    const html = renderToStaticMarkup(<ScheduleImpactPreview playerCount={8} courtCount={2} gamesPerPlayer={3} equalGames plan={plan} />);
    expect(html).toContain("Balance the roster, choose Open doubles, or turn off Equal games.");
    expect(html).not.toContain("Everyone finishes with");
  });
});
