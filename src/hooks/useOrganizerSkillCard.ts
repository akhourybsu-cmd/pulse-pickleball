import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";
import type { OrganizerCard } from "@/lib/skill/organizerCard";

/**
 * Fetches an authorized organizer's SANITIZED view of a player's skill card
 * via the get_player_skill_card RPC. Authorization + sanitization happen at
 * the data layer; the client only renders what the server returns. If the
 * RPC denies access (RLS/authorization), we surface `denied` and render
 * nothing — never a partial leak.
 */

export type ReviewStatus =
  | "review_recommended" | "reviewed" | "appropriate" | "too_low" | "too_high";

export interface OrganizerCardData {
  playerId: string;
  level: number | null;
  band: string | null;
  lowerBound: number | null;
  upperBound: number | null;
  confidence: number | null;
  confidenceLabel: string | null;
  provisional: boolean;
  completedAt: string | null;
  primaryStyle: string | null;
  secondaryStyle: string | null;
  preferredSide: string | null;
  handedness: string | null;
  reviewRecommended: boolean;
  latestReviewStatus: ReviewStatus | null;
  /** Server-sanitized snapshot (no contradictions/meta). */
  card: OrganizerCard | null;
}

export type OrganizerCardState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "denied" }
  | { status: "none" }
  | { status: "ready"; data: OrganizerCardData };

interface RpcRow {
  player_id: string;
  self_assessed_level: number | null;
  self_assessed_band: string | null;
  lower_bound: number | null;
  upper_bound: number | null;
  confidence_score: number | null;
  confidence_label: string | null;
  provisional_status: boolean | null;
  self_assessed_at: string | null;
  primary_style: string | null;
  secondary_style: string | null;
  preferred_side: string | null;
  handedness: string | null;
  review_recommended: boolean | null;
  latest_review_status: ReviewStatus | null;
  card: OrganizerCard | null;
}

function mapRow(r: RpcRow): OrganizerCardData {
  return {
    playerId: r.player_id,
    level: r.self_assessed_level,
    band: r.self_assessed_band,
    lowerBound: r.lower_bound,
    upperBound: r.upper_bound,
    confidence: r.confidence_score,
    confidenceLabel: r.confidence_label,
    provisional: !!r.provisional_status,
    completedAt: r.self_assessed_at,
    primaryStyle: r.primary_style,
    secondaryStyle: r.secondary_style,
    preferredSide: r.preferred_side,
    handedness: r.handedness,
    reviewRecommended: !!r.review_recommended,
    latestReviewStatus: r.latest_review_status,
    card: r.card,
  };
}

export function useOrganizerSkillCard(playerId: string, leagueId?: string | null) {
  const [state, setState] = useState<OrganizerCardState>(
    isSkillAssessmentEnabled() ? { status: "loading" } : { status: "disabled" },
  );

  const fetchCard = useCallback(async () => {
    if (!isSkillAssessmentEnabled()) { setState({ status: "disabled" }); return; }
    const { data, error } = await supabase.rpc(
      "get_player_skill_card" as never,
      { p_player_id: playerId, p_league_id: leagueId ?? null } as never,
    );
    if (error) { setState({ status: "denied" }); return; } // authorization enforced server-side
    const rows = (data ?? []) as unknown as RpcRow[];
    const row = Array.isArray(rows) ? rows[0] : (rows as RpcRow | null);
    if (!row || row.self_assessed_level == null) { setState({ status: "none" }); return; }
    setState({ status: "ready", data: mapRow(row) });
  }, [playerId, leagueId]);

  useEffect(() => {
    let cancelled = false;
    if (!isSkillAssessmentEnabled()) { setState({ status: "disabled" }); return; }
    setState({ status: "loading" });
    (async () => { if (!cancelled) await fetchCard(); })();
    return () => { cancelled = true; };
  }, [fetchCard]);

  /** Record a non-destructive organizer review (never changes the player's level). */
  const recordReview = useCallback(async (
    status: ReviewStatus,
    note: string | null,
    attemptId?: string | null,
  ): Promise<boolean> => {
    if (!leagueId) { toast.error("A league context is required to record a review."); return false; }
    const { error } = await supabase.rpc(
      "record_skill_review" as never,
      { p_player_id: playerId, p_league_id: leagueId, p_review_status: status, p_note: note, p_attempt_id: attemptId ?? null } as never,
    );
    if (error) { toast.error(error.message || "Couldn't save the review"); return false; }
    toast.success("Review recorded");
    await fetchCard();
    return true;
  }, [playerId, leagueId, fetchCard]);

  return { state, recordReview, refetch: fetchCard };
}
