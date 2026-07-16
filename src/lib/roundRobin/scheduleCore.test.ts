import { describe, it, expect } from "vitest";
import {
  SeededRandom,
  calculateMetrics,
  regenerateRounds,
  seatsOf,
  type CoreMatch,
  type SeatId,
} from "./scheduleCore";

const seats = (letters: string): SeatId[] => letters.split("").map((c) => `p:${c}`);

function assertValidRound(matches: CoreMatch[], roundNo: number, roster: SeatId[]) {
  const inRound = matches.filter((m) => m.round_no === roundNo);
  const seen = new Set<SeatId>();
  for (const m of inRound) {
    for (const s of seatsOf(m)) {
      expect(seen.has(s), `${s} appears twice in round ${roundNo}`).toBe(false);
      seen.add(s);
    }
    if (!m.is_bye) {
      const occ = seatsOf(m);
      expect(occ.length).toBe(4);
      expect(new Set(occ).size).toBe(4);
    }
  }
  // Everyone who exists is accounted for exactly once per round.
  for (const p of roster) expect(seen.has(p)).toBe(true);
}

describe("SeededRandom", () => {
  it("is deterministic for a given seed", () => {
    const a = new SeededRandom("event-123");
    const b = new SeededRandom("event-123");
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = Array.from({ length: 10 }, ((r) => () => r.next())(new SeededRandom("seed-a")));
    const b = Array.from({ length: 10 }, ((r) => () => r.next())(new SeededRandom("seed-b")));
    expect(a).not.toEqual(b);
  });
});

describe("calculateMetrics", () => {
  it("computes courts/byes for an odd roster", () => {
    const m = calculateMetrics(5, 1, 3);
    expect(m.matchesPerRound).toBe(1);
    expect(m.onCourtPerRound).toBe(4);
    expect(m.byesPerRound).toBe(1);
    expect(m.rounds).toBeGreaterThanOrEqual(3);
  });

  it("computes zero byes for a full even roster", () => {
    const m = calculateMetrics(8, 2, 2);
    expect(m.matchesPerRound).toBe(2);
    expect(m.onCourtPerRound).toBe(8);
    expect(m.byesPerRound).toBe(0);
  });
});

describe("regenerateRounds", () => {
  it("produces valid rounds with correct byes for an odd roster", () => {
    const roster = seats("ABCDE");
    const matches = regenerateRounds({
      seed: "evt",
      seatIds: roster,
      numCourts: 1,
      gamesPerPlayer: 3,
      startFromRound: 1,
      totalRounds: 4,
    });
    const rounds = [...new Set(matches.map((m) => m.round_no))];
    expect(rounds.length).toBeGreaterThanOrEqual(3);
    for (const r of rounds) assertValidRound(matches, r, roster);
  });

  it("is deterministic for identical inputs", () => {
    const opts = {
      seed: "evt",
      seatIds: seats("ABCDEFGH"),
      numCourts: 2,
      gamesPerPlayer: 3,
      startFromRound: 1,
      totalRounds: 4,
    };
    expect(regenerateRounds(opts)).toEqual(regenerateRounds({ ...opts }));
  });

  it("throws with fewer than four players", () => {
    expect(() =>
      regenerateRounds({
        seed: "evt",
        seatIds: seats("ABC"),
        numCourts: 1,
        gamesPerPlayer: 2,
        startFromRound: 1,
        totalRounds: 2,
      }),
    ).toThrow(/at least 4/);
  });

  it("continues rotation from frozen matches without repeating a player in-round", () => {
    const roster = seats("ABCDEF");
    const frozen: CoreMatch[] = [
      { round_no: 1, court_no: 1, a1: "p:A", a2: "p:B", b1: "p:C", b2: "p:D", is_bye: false },
      { round_no: 1, court_no: 2, a1: "p:E", a2: null, b1: null, b2: null, is_bye: true },
      { round_no: 1, court_no: 3, a1: "p:F", a2: null, b1: null, b2: null, is_bye: true },
    ];
    const generated = regenerateRounds({
      seed: "evt",
      seatIds: roster,
      numCourts: 1,
      gamesPerPlayer: 3,
      startFromRound: 2,
      totalRounds: 4,
      frozenMatches: frozen,
    });
    expect(generated.every((m) => m.round_no >= 2)).toBe(true);
    for (const r of [...new Set(generated.map((m) => m.round_no))]) {
      assertValidRound(generated, r, roster);
    }
  });
});
