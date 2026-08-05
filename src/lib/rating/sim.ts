/**
 * Placement simulation harness (Phase 1, no production writes).
 *
 * Builds controlled match histories for a focal new player against a pool of
 * established "anchor" opponents, then replays them under BOTH the current
 * engine (placementEnabled:false) and the placement engine (true) so we can
 * compare a player's rating trajectory before enabling anything.
 */

import { DEFAULT_PARAMS, type MatchType, type RatingParams } from "./params";
import {
  type MatchInput,
  type PlayerInit,
  type ReplayResult,
  focalRatingAtIndices,
  replayRatings,
} from "./engine";

export const FOCAL = "focal";

/** One scripted match in a focal player's history. */
export interface ScriptRow {
  partner: number; // partner's (anchor) rating
  opp1: number;
  opp2: number;
  fScore: number; // focal team score
  oScore: number; // opponent team score
  type?: MatchType;
}

/**
 * Build the player list + match list for a focal player's scripted history.
 * Every partner/opponent is a distinct established anchor pinned near the
 * requested rating (seedCount high so they're "established", so the focal
 * player's placement evidence is full-strength).
 */
export function buildFocalHistory(
  focalSelf: number | null,
  script: ScriptRow[],
): { players: PlayerInit[]; matches: MatchInput[] } {
  const players: PlayerInit[] = [{ id: FOCAL, selfRating: focalSelf }];
  const matches: MatchInput[] = [];
  const anchorId = (n: number, role: string) => `anc_${role}_${n}`;

  script.forEach((row, i) => {
    const pId = anchorId(i, "p");
    const o1Id = anchorId(i, "o1");
    const o2Id = anchorId(i, "o2");
    // Fresh established anchors per match keep each observation independent and
    // avoid anchor drift contaminating later matches.
    players.push(
      { id: pId, seedRating: row.partner, seedCount: 20 },
      { id: o1Id, seedRating: row.opp1, seedCount: 20 },
      { id: o2Id, seedRating: row.opp2, seedCount: 20 },
    );
    const day = String(i + 1).padStart(2, "0");
    matches.push({
      id: `m${day}`,
      date: `2026-01-${day}`,
      createdAt: `2026-01-${day}T00:00:00Z`,
      type: row.type ?? "casual",
      team1: [FOCAL, pId],
      team2: [o1Id, o2Id],
      team1Score: row.fScore,
      team2Score: row.oScore,
    });
  });

  return { players, matches };
}

export interface ScenarioComparison {
  name: string;
  current: Record<number, number | null>;
  placement: Record<number, number | null>;
  placedRating: number | null;
}

const INDICES = [1, 3, 5, 8, 15];

export function runScenario(
  name: string,
  focalSelf: number | null,
  script: ScriptRow[],
  overrides: Partial<RatingParams> = {},
): ScenarioComparison {
  const { players, matches } = buildFocalHistory(focalSelf, script);

  const currentParams: RatingParams = { ...DEFAULT_PARAMS, placementEnabled: false, ...overrides };
  const placementParams: RatingParams = { ...DEFAULT_PARAMS, placementEnabled: true, ...overrides };

  const cur: ReplayResult = replayRatings(matches, players, currentParams);
  const plc: ReplayResult = replayRatings(matches, players, placementParams);

  return {
    name,
    current: focalRatingAtIndices(cur, FOCAL, INDICES),
    placement: focalRatingAtIndices(plc, FOCAL, INDICES),
    placedRating: plc.players[FOCAL]?.placedRating ?? null,
  };
}

// ---- Scripted 15-match histories -----------------------------------------

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Win 11–loser; loser from the true gap (bigger edge → bigger margin). */
function scoreFromGap(teamTrue: number, oppTrue: number): { f: number; o: number } {
  const diff = teamTrue - oppTrue;
  const loser = Math.max(0, Math.min(9, Math.round(9 - Math.abs(diff) * 8)));
  return diff >= 0 ? { f: 11, o: loser } : { f: loser, o: 11 };
}

/** A focal player whose TRUE level is `trueRating`, vs opponents near `oppLvl`. */
export function trueLevelScript(trueRating: number, oppLvl: number, partnerLvl = oppLvl): ScriptRow[] {
  return Array.from({ length: 15 }, () => {
    const teamTrue = (trueRating + partnerLvl) / 2;
    const oppTrue = oppLvl;
    const s = scoreFromGap(teamTrue, oppTrue);
    return { partner: partnerLvl, opp1: oppLvl, opp2: oppLvl, fScore: s.f, oScore: s.o };
  });
}

/** Correctly self-rated: alternating close win/loss vs equal opponents. */
export function correctlyRatedScript(level: number): ScriptRow[] {
  return Array.from({ length: 15 }, (_, i) => ({
    partner: level,
    opp1: level,
    opp2: level,
    fScore: i % 2 === 0 ? 11 : 9,
    oScore: i % 2 === 0 ? 9 : 11,
  }));
}

export const SCENARIOS = {
  correct: () => runScenario("Correctly self-rated (3.5, true 3.5)", 3.5, correctlyRatedScript(3.5)),
  underrated: () =>
    runScenario("Underrated by ~1.0 (self 3.0, true 4.0)", 3.0, trueLevelScript(4.0, 3.7, 3.7)),
  overrated: () =>
    runScenario("Overrated by ~1.0 (self 4.0, true 3.0)", 4.0, trueLevelScript(3.0, 3.3, 3.3)),
} as const;

export function runComparison(): ScenarioComparison[] {
  return [SCENARIOS.correct(), SCENARIOS.underrated(), SCENARIOS.overrated()];
}

export function formatComparison(rows: ScenarioComparison[]): string {
  const idxHeader = INDICES.map((i) => `M${i}`.padStart(6)).join("");
  const lines: string[] = [];
  for (const row of rows) {
    lines.push(`\n■ ${row.name}`);
    lines.push(`   engine        ${idxHeader}`);
    const fmt = (rec: Record<number, number | null>) =>
      INDICES.map((i) => (rec[i] == null ? "   —" : r2(rec[i]!).toFixed(2)).toString().padStart(6)).join("");
    lines.push(`   current      ${fmt(row.current)}`);
    lines.push(`   placement    ${fmt(row.placement)}`);
    lines.push(`   placed @ M5: ${row.placedRating == null ? "—" : r2(row.placedRating).toFixed(2)}`);
  }
  return lines.join("\n");
}
