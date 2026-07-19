/**
 * Resolve a league match side's display name.
 *
 * League Play defaults to individual players, so a side should read as
 * the player name(s) ("Ava & Liam", or just "Ava" for singles) whenever
 * there's no named team. Only fall back to the placeholder when a side
 * genuinely has nobody assigned yet.
 *
 *   sideName(teamName, [p1, p2])            -> "Team name" | "Ava & Liam" | "TBD"
 *   sideName(null, [p1, p2], "Side A")      -> "Ava & Liam" | "Side A"
 */
export function sideName(
  teamName: string | null | undefined,
  playerNames: Array<string | null | undefined>,
  fallback = "TBD",
): string {
  if (teamName && teamName.trim()) return teamName.trim();
  const names = playerNames
    .map((n) => (n ?? "").trim())
    .filter((n) => n.length > 0);
  if (names.length) return names.join(" & ");
  return fallback;
}
