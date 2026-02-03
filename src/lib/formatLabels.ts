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

const GENDER_LABELS: Record<string, string> = {
  men: "Men's",
  women: "Women's",
  mixed: "Mixed",
  open: "Open",
};

const PLAY_TYPE_LABELS: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
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

/**
 * Format gender for display
 */
export function formatGenderLabel(gender: string | null | undefined): string {
  if (!gender) return "Open";
  return GENDER_LABELS[gender] || "Open";
}

/**
 * Format play type for display
 */
export function formatPlayTypeLabel(playType: string | null | undefined): string {
  if (!playType) return "";
  return PLAY_TYPE_LABELS[playType] || "";
}

/**
 * Format skill level range for display
 */
export function formatSkillLevelRange(min: number | null | undefined, max: number | null | undefined): string {
  if (!min && !max) return "All Levels";
  if (min && max && min === max) return min.toFixed(1);
  if (min && max) return `${min.toFixed(1)} - ${max.toFixed(1)}`;
  if (min) return `${min.toFixed(1)}+`;
  if (max) return `≤${max.toFixed(1)}`;
  return "All Levels";
}

/**
 * Format age group for display
 */
export function formatAgeGroupLabel(
  ageGroup: string | null | undefined, 
  ageMin: number | null | undefined, 
  ageMax: number | null | undefined
): string {
  if (ageGroup === "junior") return "Junior";
  if (ageGroup === "adult") return "Adult";
  if (ageGroup === "senior" && ageMin) return `${ageMin}+`;
  if (ageMin && ageMax) return `${ageMin}-${ageMax}`;
  if (ageMin) return `${ageMin}+`;
  if (ageMax) return `Under ${ageMax}`;
  return "All Ages";
}
