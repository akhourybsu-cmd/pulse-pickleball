import { bracketSizeFor, seedOrder, seedIsBye } from './seeding';

/**
 * Single-elimination bracket generation and advancement.
 *
 * Replaces BracketGenerationDialog's round-one-only stub, which:
 *   • paired adjacent seeds (1v2) instead of 1vN,
 *   • detected byes with `i % 2` on the match index (meaningless) and then
 *     DROPPED the bye team from the draw entirely,
 *   • never created rounds 2+, and never advanced a winner.
 *
 * Design note — no schema change required. In a standard bracket the winner of
 * round r match m always feeds round r+1, match ceil(m/2), taking side A when m
 * is odd and side B when m is even. Advancement is therefore a pure function of
 * (round, matchNumber), so we don't need feeder columns on tournaments_matches.
 *
 * Byes are modelled the way real bracket software does it: a first-round pairing
 * against an empty slot is NOT emitted as a playable match. The seeded team is
 * placed directly into its round-two slot. Match numbers still follow bracket
 * position, so the advancement math above stays valid.
 */

export interface GeneratedMatch {
  /** 1-indexed. Round 1 is the first round actually played. */
  round: number;
  /** 1-indexed position within the round; also the bracket slot. */
  matchNumber: number;
  /** Team id, or null when the slot is still waiting on a feeder match. */
  teamA: string | null;
  teamB: string | null;
}

export interface SingleEliminationDraw {
  bracketSize: number;
  /** Number of rounds actually played, e.g. 8 teams -> 3. */
  rounds: number;
  byes: number;
  matches: GeneratedMatch[];
}

/** Where the winner of a given match goes. `null` when it was the final. */
export function nextSlot(
  round: number,
  matchNumber: number,
  totalRounds: number,
): { round: number; matchNumber: number; side: 'A' | 'B' } | null {
  if (round >= totalRounds) return null;
  return {
    round: round + 1,
    matchNumber: Math.ceil(matchNumber / 2),
    side: matchNumber % 2 === 1 ? 'A' : 'B',
  };
}

/**
 * Build a full single-elimination draw from teams already ordered by seed
 * (index 0 = seed 1). Emits every round; later-round slots are null until a
 * winner advances into them.
 */
export function generateSingleElimination(seededTeamIds: string[]): SingleEliminationDraw {
  const teamCount = seededTeamIds.length;
  if (teamCount < 2) {
    return { bracketSize: bracketSizeFor(teamCount), rounds: 0, byes: 0, matches: [] };
  }

  const bracketSize = bracketSizeFor(teamCount);
  const rounds = Math.log2(bracketSize);
  const order = seedOrder(bracketSize);
  const byes = bracketSize - teamCount;

  const teamForSeed = (seed: number): string | null =>
    seedIsBye(seed, teamCount) ? null : seededTeamIds[seed - 1];

  const matches: GeneratedMatch[] = [];

  // Round 2+ are created empty up front so the whole bracket is visible and
  // advancement has somewhere to write. Indexed [round][matchNumber] for the
  // bye pre-placement below.
  const laterRounds = new Map<string, GeneratedMatch>();
  for (let r = 2; r <= rounds; r++) {
    const count = bracketSize / 2 ** r;
    for (let m = 1; m <= count; m++) {
      const match: GeneratedMatch = { round: r, matchNumber: m, teamA: null, teamB: null };
      laterRounds.set(`${r}:${m}`, match);
    }
  }

  // Round 1 — walk the seed order two slots at a time.
  for (let i = 0; i < bracketSize; i += 2) {
    const matchNumber = i / 2 + 1;
    const teamA = teamForSeed(order[i]);
    const teamB = teamForSeed(order[i + 1]);

    if (teamA && teamB) {
      matches.push({ round: 1, matchNumber, teamA, teamB });
      continue;
    }

    // Bye: don't emit an unplayable match — advance the real team straight
    // into the round-two slot this pairing feeds.
    const advancing = teamA ?? teamB;
    if (!advancing) continue; // both empty (only possible in a malformed draw)

    const target = nextSlot(1, matchNumber, rounds);
    if (target) {
      const next = laterRounds.get(`${target.round}:${target.matchNumber}`);
      if (next) {
        if (target.side === 'A') next.teamA = advancing;
        else next.teamB = advancing;
      }
    }
  }

  for (let r = 2; r <= rounds; r++) {
    const count = bracketSize / 2 ** r;
    for (let m = 1; m <= count; m++) {
      matches.push(laterRounds.get(`${r}:${m}`)!);
    }
  }

  return { bracketSize, rounds, byes, matches };
}
