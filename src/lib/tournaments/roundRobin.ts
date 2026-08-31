import type { GeneratedMatch } from './singleElimination';

/**
 * Round-robin scheduling for a tournament division (circle method).
 *
 * `round_robin` is the DEFAULT division format, yet nothing generated a
 * tournament round-robin schedule — the only generator wired up was the
 * elimination dialog. The one inline implementation lived inside
 * TournamentDivisionDetail and couldn't be tested or reused.
 *
 * Note this is deliberately separate from src/lib/roundRobin/* (the Round Robin
 * *events* feature). That one rotates partners among individual players; here
 * the teams are fixed pairs and every team plays every other team once.
 *
 * Circle method: hold one team fixed and rotate the rest. With an odd number of
 * teams a null placeholder is added, and whoever draws it sits that round out.
 */

export interface RoundRobinSchedule {
  rounds: number;
  /** Teams that sit out at least one round (odd team counts). */
  hasByes: boolean;
  matches: GeneratedMatch[];
}

export function generateRoundRobin(teamIds: string[]): RoundRobinSchedule {
  const n = teamIds.length;
  if (n < 2) return { rounds: 0, hasByes: false, matches: [] };

  // Odd count → add a placeholder; the team paired with it has a bye that round.
  const work: (string | null)[] = [...teamIds];
  const hasByes = n % 2 === 1;
  if (hasByes) work.push(null);

  const size = work.length;
  const rounds = size - 1;
  const half = size / 2;

  const fixed = work[0];
  let rotating = work.slice(1);

  const matches: GeneratedMatch[] = [];

  for (let r = 0; r < rounds; r++) {
    const arr = [fixed, ...rotating];
    let matchNumber = 1;

    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[size - 1 - i];
      if (!a || !b) continue; // someone drew the placeholder — bye this round

      // Alternate sides each round so the same team isn't always "team 1";
      // matters for anything that treats side A as the home/serving team.
      const flip = r % 2 === 1;
      matches.push({
        round: r + 1,
        matchNumber: matchNumber++,
        teamA: flip ? b : a,
        teamB: flip ? a : b,
      });
    }

    // Rotate everything except the fixed team, one position clockwise.
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return { rounds, hasByes, matches };
}

/** Total matches a full round robin will produce: n choose 2. */
export function roundRobinMatchCount(teamCount: number): number {
  if (teamCount < 2) return 0;
  return (teamCount * (teamCount - 1)) / 2;
}
