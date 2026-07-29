/**
 * PULSE Skill Assessment — organizer-card helpers (pure).
 *
 * Defense-in-depth for the organizer surface. The server RPC already strips
 * contradictions + internal meta before returning a card, but if the client
 * ever holds a full snapshot (e.g. the player's own), these guarantee the
 * organizer view can never render private internals, and centralise the
 * "review recommended" rule so UI and copy stay consistent.
 */
import type { ScoringSnapshot } from "./scoring";

/** What an organizer is allowed to see — never contradictions or meta. */
export type OrganizerCard = Omit<ScoringSnapshot, "contradictions" | "meta">;

/** Confidence at/below which placement should be double-checked. */
export const REVIEW_CONFIDENCE_FLOOR = 60;

/**
 * Whether an organizer should be nudged to confirm placement. True when
 * confidence is limited, the profile is provisional, or the scoring found
 * internal inconsistencies — WITHOUT ever surfacing the inconsistency
 * details themselves (which could imply dishonesty).
 */
export function reviewRecommended(input: {
  confidence: number | null | undefined;
  contradictionSeverity?: number | null;
  provisional?: boolean | null;
}): boolean {
  return (
    (input.confidence ?? 0) < REVIEW_CONFIDENCE_FLOOR ||
    (input.contradictionSeverity ?? 0) > 0 ||
    !!input.provisional
  );
}

/** Strip everything an organizer must not see from a full snapshot. */
export function sanitizeForOrganizer(snapshot: ScoringSnapshot): OrganizerCard {
  // Destructure the private keys out; return only the rest.
  const rest = { ...snapshot } as Partial<ScoringSnapshot>;
  delete rest.contradictions;
  delete rest.meta;
  return rest as OrganizerCard;
}

/** Short, non-accusatory guidance line for a limited-confidence card. */
export function confidenceGuidance(reviewRec: boolean, provisional: boolean): string | null {
  if (provisional) return "Provisional — placement confirmation suggested";
  if (reviewRec) return "Limited assessment confidence — organizer review recommended";
  return null;
}
