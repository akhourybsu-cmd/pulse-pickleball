/**
 * Bracket seeding — the standard (a.k.a. "snake"/"fold") seed order.
 *
 * The existing BracketGenerationDialog paired *adjacent* seeds (1v2, 3v4 …),
 * which is wrong: it puts the top two seeds against each other in round one.
 * Proper seeding pairs 1vN, 2v(N-1) … and lays them out so that the two top
 * seeds can only meet in the final, the top four only in the semis, and so on.
 *
 * Everything here is pure and deterministic so it can be unit-tested without a
 * database, and reused by both the client and (later) an edge function.
 */

/** Smallest power of two >= teamCount. A 6-team draw runs on an 8 bracket. */
export function bracketSizeFor(teamCount: number): number {
  if (teamCount <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(teamCount));
}

/**
 * Seed positions for a power-of-two bracket, in slot order.
 *
 * Built by repeated folding: a bracket of size 2n is the bracket of size n with
 * each seed `s` immediately followed by its mirror `2n + 1 - s`.
 *
 *   1 → [1]
 *   2 → [1, 2]
 *   4 → [1, 4, 2, 3]
 *   8 → [1, 8, 4, 5, 2, 7, 3, 6]
 *
 * Consecutive pairs are the first-round matchups, so size 8 gives
 * (1v8) (4v5) (2v7) (3v6) — 1 and 2 land in opposite halves.
 */
export function seedOrder(bracketSize: number): number[] {
  if (bracketSize < 1) return [];
  let order = [1];
  while (order.length < bracketSize) {
    const size = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s, size + 1 - s);
    }
    order = next;
  }
  return order;
}

/**
 * How many byes a draw needs. Byes always go to the TOP seeds — seeds
 * 1..byeCount skip round one.
 */
export function byeCountFor(teamCount: number): number {
  return bracketSizeFor(teamCount) - teamCount;
}

/**
 * True when this seed receives a first-round bye. A "seed" above the real team
 * count is an empty slot, and the team it would have faced advances free.
 */
export function seedIsBye(seed: number, teamCount: number): boolean {
  return seed > teamCount;
}
