/**
 * Individual Doubles Ladder — pure scheduling & movement engine.
 * =============================================================================
 * NO database, network, notification, or UI concerns live here. Every function
 * is deterministic: the same inputs always produce the same outputs, so the
 * persistence layer (Phase 4) can call these inside a transaction and trust
 * the result, and the whole thing is exhaustively unit-testable.
 *
 * Core model (see the feature spec):
 *   • The ladder is an ORDERED list of individually-ranked player ids.
 *   • Players are split into GROUPS OF FOUR by ladder position
 *     (1–4 = group 1 / court 1, 5–8 = group 2, …).
 *   • Within a group [A,B,C,D] (A = highest starting position) a BATCH is
 *     exactly three rotating-partner games:
 *        1. A+B vs C+D
 *        2. A+C vs B+D
 *        3. A+D vs B+C
 *     → every player partners each other player once and opposes each twice.
 *   • After a batch, players are ranked WITHIN their group, then the default
 *     one-up / one-down movement crosses the group winner up and the loser
 *     down, producing the next ladder order.
 *
 * Terminology mirrors the spec: League ▸ Week ▸ Batch ▸ Group(of 4) ▸ Match.
 */

export type PlayerId = string;

/** A single doubles game inside a batch. Scores are null until played. */
export interface LadderGameResult {
  /** 1 | 2 | 3 within the group's rotation. */
  game: number;
  sideA: [PlayerId, PlayerId];
  sideB: [PlayerId, PlayerId];
  scoreA: number | null;
  scoreB: number | null;
}

/** Per-player result inside one batch group, with finish + reasoning fields. */
export interface PlayerBatchStats {
  playerId: PlayerId;
  /** Index within the group at batch start (0 = highest of the four). */
  startPosition: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  /** 1..4 finishing rank within the group after tie-breakers. */
  finishPosition: number;
}

export type MovementDirection = "up" | "stay" | "down";

export interface MovementResult {
  playerId: PlayerId;
  direction: MovementDirection;
  /** Set when a would-be move is impossible: "top" (1st, no higher group) or
   *  "bottom" (4th, no lower group). direction is "stay" in both cases. */
  capped: "top" | "bottom" | null;
}

export interface BatchOutcome {
  /** The new full ladder order after applying movement. */
  nextOrder: PlayerId[];
  /** Ranked stats per group, groups in ladder order, players in finish order. */
  rankedByGroup: PlayerBatchStats[][];
  /** Movement label per player, keyed for quick UI lookup. */
  movements: Record<PlayerId, MovementResult>;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export class LadderError extends Error {}

/**
 * Split an ordered ladder into consecutive groups of four. Throws when the
 * count isn't divisible by four or contains duplicates — malformed groups of
 * 2/3/5 are never produced (see spec: groups of exactly four).
 */
export function groupIntoFours(order: PlayerId[]): PlayerId[][] {
  if (order.length === 0 || order.length % 4 !== 0) {
    throw new LadderError(
      `Ladder groups require a player count divisible by four (got ${order.length}).`,
    );
  }
  if (new Set(order).size !== order.length) {
    throw new LadderError("Ladder order contains duplicate players.");
  }
  const groups: PlayerId[][] = [];
  for (let i = 0; i < order.length; i += 4) groups.push(order.slice(i, i + 4));
  return groups;
}

// ---------------------------------------------------------------------------
// Matchups (the three-game rotation)
// ---------------------------------------------------------------------------

/**
 * The three rotating-partner games for one group of four [A,B,C,D]:
 *   A+B vs C+D · A+C vs B+D · A+D vs B+C
 */
export function batchMatchups(group: PlayerId[]): LadderGameResult[] {
  if (group.length !== 4) {
    throw new LadderError("A ladder group must have exactly four players.");
  }
  const [a, b, c, d] = group;
  return [
    { game: 1, sideA: [a, b], sideB: [c, d], scoreA: null, scoreB: null },
    { game: 2, sideA: [a, c], sideB: [b, d], scoreA: null, scoreB: null },
    { game: 3, sideA: [a, d], sideB: [b, c], scoreA: null, scoreB: null },
  ];
}

/** Games per player for N batches (each batch = 3). */
export function gamesPerPlayer(batches: number): number {
  return Math.max(0, Math.floor(batches)) * 3;
}

/** A batch is complete only when every game has a valid, non-tied final score. */
export function isBatchComplete(games: LadderGameResult[]): boolean {
  if (games.length === 0) return false;
  return games.every(
    (g) => g.scoreA != null && g.scoreB != null && g.scoreA !== g.scoreB,
  );
}

// ---------------------------------------------------------------------------
// Ranking within a group
// ---------------------------------------------------------------------------

/**
 * Rank the four players in a group from their three games.
 *
 * Order: wins → point differential → total points scored → head-to-head
 * (only for an exact two-way tie, since it's ambiguous otherwise) →
 * organizer tiebreak resolution (`resolvedOrder`, e.g. a skinny-singles
 * result) → starting ladder position (higher start keeps the higher finish
 * on an exact tie). Fully deterministic.
 *
 * `resolvedOrder` is an organizer-supplied ordering of tied players (the ones
 * a skinny-singles/coin-flip decided). It only ever breaks a tie between
 * players who are otherwise dead-even on wins/diff/points — it can never move
 * a player past someone they actually out-performed.
 */
export function rankGroup(
  group: PlayerId[],
  games: LadderGameResult[],
  resolvedOrder?: PlayerId[],
): PlayerBatchStats[] {
  if (group.length !== 4) {
    throw new LadderError("A ladder group must have exactly four players.");
  }

  const stats = new Map<PlayerId, PlayerBatchStats>();
  group.forEach((pid, idx) => {
    stats.set(pid, {
      playerId: pid, startPosition: idx,
      gamesPlayed: 0, wins: 0, losses: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0, finishPosition: 0,
    });
  });

  for (const g of games) {
    if (g.scoreA == null || g.scoreB == null || g.scoreA === g.scoreB) continue;
    const aWon = g.scoreA > g.scoreB;
    const record = (pid: PlayerId, pf: number, pa: number, won: boolean) => {
      const s = stats.get(pid);
      if (!s) return; // ignore ids not in this group (defensive)
      s.gamesPlayed += 1;
      s.pointsFor += pf;
      s.pointsAgainst += pa;
      if (won) s.wins += 1; else s.losses += 1;
    };
    g.sideA.forEach((pid) => record(pid, g.scoreA!, g.scoreB!, aWon));
    g.sideB.forEach((pid) => record(pid, g.scoreB!, g.scoreA!, !aWon));
  }
  stats.forEach((s) => { s.pointDiff = s.pointsFor - s.pointsAgainst; });

  // Head-to-head between a specific pair: net wins across the (up to two)
  // games where they were opponents. Returns >0 when y outranks x.
  const headToHead = (x: PlayerBatchStats, y: PlayerBatchStats): number => {
    let xWins = 0, yWins = 0;
    for (const g of games) {
      if (g.scoreA == null || g.scoreB == null || g.scoreA === g.scoreB) continue;
      const xA = g.sideA.includes(x.playerId);
      const xB = g.sideB.includes(x.playerId);
      const yA = g.sideA.includes(y.playerId);
      const yB = g.sideB.includes(y.playerId);
      const opponents = (xA && yB) || (xB && yA);
      if (!opponents) continue;
      const aWon = g.scoreA > g.scoreB;
      const xWon = (xA && aWon) || (xB && !aWon);
      if (xWon) xWins += 1; else yWins += 1;
    }
    return yWins - xWins;
  };

  const tieKey = (s: PlayerBatchStats) => `${s.wins}|${s.pointDiff}|${s.pointsFor}`;

  // Organizer tiebreak resolution: index in `resolvedOrder`, or +Infinity for
  // players it doesn't mention (they fall through to startPosition).
  const resolvedIdx = (pid: PlayerId): number => {
    const i = resolvedOrder ? resolvedOrder.indexOf(pid) : -1;
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };

  // Base deterministic order. resolvedOrder outranks startPosition so an
  // organizer decision wins an otherwise-even tie; players not covered by a
  // resolution still fall back to startPosition.
  const ranked = Array.from(stats.values()).sort((a, b) =>
    b.wins - a.wins
    || b.pointDiff - a.pointDiff
    || b.pointsFor - a.pointsFor
    || resolvedIdx(a.playerId) - resolvedIdx(b.playerId)
    || a.startPosition - b.startPosition,
  );

  // Second pass: only for an EXACT two-way tie on (wins,diff,points), let
  // head-to-head override the startPosition ordering. Skipped for 3+ way ties
  // where pairwise H2H is not mathematically meaningful.
  for (let i = 0; i + 1 < ranked.length; ) {
    let j = i + 1;
    while (j < ranked.length && tieKey(ranked[j]) === tieKey(ranked[i])) j += 1;
    if (j - i === 2) {
      const h = headToHead(ranked[i], ranked[i + 1]);
      if (h > 0) {
        const tmp = ranked[i]; ranked[i] = ranked[i + 1]; ranked[i + 1] = tmp;
      }
    }
    i = j;
  }

  ranked.forEach((s, idx) => { s.finishPosition = idx + 1; });
  return ranked;
}

// ---------------------------------------------------------------------------
// Tiebreak detection (organizer input required)
// ---------------------------------------------------------------------------

/** A movement boundary a tie makes ambiguous. */
export type TieBoundary = "promotion" | "relegation";

/**
 * A group whose result can't be resolved by scores alone AND where the tie
 * straddles a movement boundary — so the organizer must say who advances
 * (e.g. by a skinny-singles game). Ties that don't affect who moves up/down
 * (e.g. 2nd vs 3rd, both stay) are NOT surfaced.
 */
export interface TieBreakNeed {
  groupIndex: number;
  /** Which boundaries this group's tie makes ambiguous. */
  boundaries: TieBoundary[];
  /** The dead-even players, in the engine's provisional order (a suggestion). */
  tiedPlayerIds: PlayerId[];
}

/**
 * Detect ties that require an organizer decision. A cluster of players who are
 * exactly even on wins/diff/points needs a decision when it spans the 1st/2nd
 * boundary (who gets promoted) in a non-top group, or the 3rd/4th boundary
 * (who gets relegated) in a non-bottom group.
 */
export function detectTieBreaks(
  order: PlayerId[],
  gamesByGroup: LadderGameResult[][],
): TieBreakNeed[] {
  const groups = groupIntoFours(order);
  if (gamesByGroup.length !== groups.length) {
    throw new LadderError(
      `Expected results for ${groups.length} group(s), got ${gamesByGroup.length}.`,
    );
  }
  const key = (s: PlayerBatchStats) => `${s.wins}|${s.pointDiff}|${s.pointsFor}`;
  const needs: TieBreakNeed[] = [];

  groups.forEach((g, gi) => {
    const ranked = rankGroup(g, gamesByGroup[gi]); // provisional (start-pos fallback)
    const isTop = gi === 0;
    const isBottom = gi === groups.length - 1;

    let i = 0;
    while (i < ranked.length) {
      let j = i + 1;
      while (j < ranked.length && key(ranked[j]) === key(ranked[i])) j += 1;
      if (j - i > 1) {
        const startPos = i + 1; // 1-indexed finish position of the cluster's top
        const endPos = j;       // 1-indexed finish position of the cluster's bottom
        const boundaries: TieBoundary[] = [];
        if (!isTop && startPos <= 1 && endPos >= 2) boundaries.push("promotion");
        if (!isBottom && endPos >= 4 && startPos <= 3) boundaries.push("relegation");
        if (boundaries.length) {
          needs.push({
            groupIndex: gi,
            boundaries,
            tiedPlayerIds: ranked.slice(i, j).map((r) => r.playerId),
          });
        }
      }
      i = j;
    }
  });
  return needs;
}

// ---------------------------------------------------------------------------
// Movement (one-up / one-down crossover)
// ---------------------------------------------------------------------------

/**
 * Apply the default one-up / one-down movement to groups already in finishing
 * order (index 0 = 1st … index 3 = 4th) and return the next full ladder order
 * plus a per-player movement label.
 *
 * Rules:
 *   • 1st in a group moves up one group; 4th moves down one group;
 *     2nd & 3rd stay.
 *   • Top group's 1st can't move up (capped: "top"); bottom group's 4th can't
 *     move down (capped: "bottom").
 *   • A receiving group is rebuilt as:
 *       [ demoted-from-above, …stayers-in-finish-order, promoted-from-below ]
 *     so a demoted player enters at the TOP of the lower group and a promoted
 *     player enters at the BOTTOM of the higher group, preserving the
 *     competitive finishing order.
 */
export function applyMovement(
  finishOrderGroups: PlayerId[][],
): { order: PlayerId[]; movements: Record<PlayerId, MovementResult> } {
  const n = finishOrderGroups.length;
  finishOrderGroups.forEach((g) => {
    if (g.length !== 4) throw new LadderError("Each group must have four players.");
  });

  const movements: Record<PlayerId, MovementResult> = {};
  const upFrom: (PlayerId | null)[] = [];   // player promoted OUT of group g
  const downFrom: (PlayerId | null)[] = []; // player demoted OUT of group g
  const stayers: PlayerId[][] = [];         // stayers of group g, in finish order

  for (let g = 0; g < n; g++) {
    const [f1, f2, f3, f4] = finishOrderGroups[g];
    const isTop = g === 0;
    const isBottom = g === n - 1;

    const up = isTop ? null : f1;
    const down = isBottom ? null : f4;
    upFrom[g] = up;
    downFrom[g] = down;

    const stay: PlayerId[] = [];
    // 1st: moves up unless top (then stays, capped).
    if (isTop) { stay.push(f1); movements[f1] = { playerId: f1, direction: "stay", capped: "top" }; }
    else { movements[f1] = { playerId: f1, direction: "up", capped: null }; }
    // 2nd & 3rd always stay.
    stay.push(f2); movements[f2] = { playerId: f2, direction: "stay", capped: null };
    stay.push(f3); movements[f3] = { playerId: f3, direction: "stay", capped: null };
    // 4th: moves down unless bottom (then stays, capped).
    if (isBottom) { stay.push(f4); movements[f4] = { playerId: f4, direction: "stay", capped: "bottom" }; }
    else { movements[f4] = { playerId: f4, direction: "down", capped: null }; }

    stayers[g] = stay;
  }

  // Rebuild each group: demoted-from-above + stayers + promoted-from-below.
  const nextGroups: PlayerId[][] = [];
  for (let g = 0; g < n; g++) {
    const incomingAbove = g > 0 ? downFrom[g - 1] : null;      // came DOWN into g
    const incomingBelow = g < n - 1 ? upFrom[g + 1] : null;    // came UP into g
    const group: PlayerId[] = [];
    if (incomingAbove) group.push(incomingAbove);
    group.push(...stayers[g]);
    if (incomingBelow) group.push(incomingBelow);
    if (group.length !== 4) {
      throw new LadderError(`Movement produced a malformed group of ${group.length}.`);
    }
    nextGroups.push(group);
  }

  return { order: nextGroups.flat(), movements };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Full batch → next-ladder computation. Given the ladder order at the START of
 * a batch and the played games per group, produce the ranked results, the
 * per-player movement, and the next ladder order. Pure and deterministic.
 *
 * `gamesByGroup[i]` are the games for the i-th group of `groupIntoFours(order)`.
 *
 * `tieResolutions[i]` is an optional organizer ordering of the tied players in
 * group i (see `detectTieBreaks`). It only breaks otherwise-even ties.
 */
export function computeBatchOutcome(
  order: PlayerId[],
  gamesByGroup: LadderGameResult[][],
  tieResolutions?: Record<number, PlayerId[]>,
): BatchOutcome {
  const groups = groupIntoFours(order);
  if (gamesByGroup.length !== groups.length) {
    throw new LadderError(
      `Expected results for ${groups.length} group(s), got ${gamesByGroup.length}.`,
    );
  }
  const rankedByGroup = groups.map((g, i) =>
    rankGroup(g, gamesByGroup[i], tieResolutions?.[i]));
  const finishOrderGroups = rankedByGroup.map((rows) =>
    rows.slice().sort((a, b) => a.finishPosition - b.finishPosition).map((r) => r.playerId),
  );
  const { order: nextOrder, movements } = applyMovement(finishOrderGroups);
  return { nextOrder, rankedByGroup, movements };
}

/**
 * Invariant check for a computed next order vs the previous order. Returns the
 * list of problems (empty = valid). The persistence layer should assert this
 * before saving a snapshot.
 */
export function validateLadderTransition(prev: PlayerId[], next: PlayerId[]): string[] {
  const problems: string[] = [];
  if (prev.length !== next.length) {
    problems.push(`Player count changed: ${prev.length} → ${next.length}.`);
  }
  if (new Set(next).size !== next.length) {
    problems.push("Next order contains a duplicate player.");
  }
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  for (const p of prevSet) if (!nextSet.has(p)) problems.push(`Player dropped: ${p}.`);
  for (const p of nextSet) if (!prevSet.has(p)) problems.push(`Player appeared: ${p}.`);
  return problems;
}
