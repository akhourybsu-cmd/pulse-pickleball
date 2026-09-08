import { describe, it, expect } from "vitest";
import {
  SeededRandom,
  calculateMetrics,
  regenerateRounds,
  seatsOf,
  type CoreMatch,
  type SeatId,
} from "./scheduleCore";

const seats = (letters: string): SeatId[] =>
  letters.split("").map((c) => `p:${c}`);

function assertValidRound(
  matches: CoreMatch[],
  roundNo: number,
  roster: SeatId[]
) {
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
    const a = Array.from(
      { length: 10 },
      (
        (r) => () =>
          r.next()
      )(new SeededRandom("seed-a"))
    );
    const b = Array.from(
      { length: 10 },
      (
        (r) => () =>
          r.next()
      )(new SeededRandom("seed-b"))
    );
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

  it("reports requested courts that the roster cannot fill", () => {
    const m = calculateMetrics(6, 3, 3);
    expect(m.usableCourts).toBe(1);
    expect(m.unusedCourts).toBe(2);
    expect(m.onCourtPerRound).toBe(4);
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
      })
    ).toThrow(/at least 4/);
  });

  it("rejects zero courts and duplicate identities", () => {
    const base = {
      seed: "evt",
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    };
    expect(() =>
      regenerateRounds({
        ...base,
        seatIds: seats("ABCD"),
        numCourts: 0,
      })
    ).toThrow(/at least 1 court/);
    expect(() =>
      regenerateRounds({
        ...base,
        seatIds: ["p:A", "p:B", "p:C", "p:A"],
        numCourts: 1,
      })
    ).toThrow(/unique/);
  });

  it("continues rotation from frozen matches without repeating a player in-round", () => {
    const roster = seats("ABCDEF");
    const frozen: CoreMatch[] = [
      {
        round_no: 1,
        court_no: 1,
        a1: "p:A",
        a2: "p:B",
        b1: "p:C",
        b2: "p:D",
        is_bye: false,
      },
      {
        round_no: 1,
        court_no: 2,
        a1: "p:E",
        a2: null,
        b1: null,
        b2: null,
        is_bye: true,
      },
      {
        round_no: 1,
        court_no: 3,
        a1: "p:F",
        a2: null,
        b1: null,
        b2: null,
        is_bye: true,
      },
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

  it("treats totalRounds as authoritative so a capacity increase can shrink a schedule", () => {
    const roster = seats("ABCDEFGH");
    const generated = regenerateRounds({
      seed: "evt",
      seatIds: roster,
      numCourts: 2,
      gamesPerPlayer: 8,
      startFromRound: 3,
      totalRounds: 4,
    });
    expect([...new Set(generated.map((match) => match.round_no))]).toEqual([
      3, 4,
    ]);
  });

  it("rotates a single playable match across surplus courts", () => {
    const generated = regenerateRounds({
      seed: "court-rotation",
      seatIds: seats("ABCD"),
      numCourts: 3,
      gamesPerPlayer: 3,
      startFromRound: 1,
      totalRounds: 3,
    });
    const usedCourts = new Set(
      generated.filter((match) => !match.is_bye).map((match) => match.court_no)
    );
    expect(usedCourts.size).toBe(3);
  });

  it("accounts for every player in every uneven mixed round", () => {
    const roster = seats("ABCDEFGH");
    const genders = new Map<SeatId, string>(
      roster.map((seatId, index) => [seatId, index < 5 ? "male" : "female"])
    );
    const generated = regenerateRounds({
      seed: "mixed",
      seatIds: roster,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
      format: "mixed",
      genders,
    });
    for (const roundNo of [1, 2]) assertValidRound(generated, roundNo, roster);
  });

  it.each([
    ["male", "male"],
    ["female", "female"],
  ] as const)("directly enforces a valid %s roster", (format, gender) => {
    const roster = seats("ABCDEFGH");
    const genders = new Map<SeatId, string>(
      roster.map((seatId) => [seatId, gender])
    );
    const generated = regenerateRounds({
      seed: `${format}-valid`,
      seatIds: roster,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
      format,
      genders,
    });
    for (const roundNo of [1, 2]) assertValidRound(generated, roundNo, roster);
  });

  it.each([
    ["male", "female", /Men's play/],
    ["female", "male", /Women's play/],
  ] as const)("directly rejects an invalid %s roster", (format, wrongGender, message) => {
    const roster = seats("ABCD");
    const genders = new Map<SeatId, string>(
      roster.map((seatId) => [seatId, format])
    );
    genders.set("p:D", wrongGender);
    expect(() =>
      regenerateRounds({
        seed: `${format}-invalid`,
        seatIds: roster,
        numCourts: 1,
        gamesPerPlayer: 1,
        startFromRound: 1,
        totalRounds: 1,
        format,
        genders,
      })
    ).toThrow(message);
  });

  it("maintains structural validity and a one-game spread across a configuration matrix", () => {
    for (let playerCount = 4; playerCount <= 20; playerCount += 1) {
      const roster = Array.from({ length: playerCount }, (_, index) =>
        `p:${index}`
      );
      for (let courtCount = 1; courtCount <= 5; courtCount += 1) {
        const metrics = calculateMetrics(playerCount, courtCount, 4);
        const generated = regenerateRounds({
          seed: `matrix:${playerCount}:${courtCount}`,
          seatIds: roster,
          numCourts: courtCount,
          gamesPerPlayer: 4,
          startFromRound: 1,
          totalRounds: metrics.rounds,
        });

        for (let roundNo = 1; roundNo <= metrics.rounds; roundNo += 1) {
          assertValidRound(generated, roundNo, roster);
          const playing = generated.filter(
            (match) => match.round_no === roundNo && !match.is_bye
          );
          expect(playing.length).toBe(metrics.matchesPerRound);
          expect(new Set(playing.map((match) => match.court_no)).size).toBe(
            playing.length
          );
          expect(
            playing.every(
              (match) => match.court_no >= 1 && match.court_no <= courtCount
            )
          ).toBe(true);
        }

        const games = new Map(roster.map((seatId) => [seatId, 0]));
        generated
          .filter((match) => !match.is_bye)
          .flatMap(seatsOf)
          .forEach((seatId) => games.set(seatId, games.get(seatId)! + 1));
        const totals = [...games.values()];
        expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1);
      }
    }
  });
});
