/**
 * Mapping of technical database values to human-readable labels
 */
const FORMAT_LABELS: Record<string, string> = {
  round_robin: "Round Robin",
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  swiss: "Swiss",
  pool_play: "Pool Play",
  bracket: "Bracket",
  ladder: "Ladder",
  doubles: "Doubles",
  singles: "Singles",
  mixed_doubles: "Mixed Doubles",
};

/**
 * Converts snake_case database values to Title Case display labels
 * @param value - The raw database value (e.g., "round_robin")
 * @returns Human-readable label (e.g., "Round Robin")
 */
export function formatTournamentLabel(value: string | null | undefined): string {
  if (!value) return "";
  
  // Check if we have a specific mapping
  if (FORMAT_LABELS[value]) {
    return FORMAT_LABELS[value];
  }
  
  // Fallback: convert snake_case to Title Case
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
