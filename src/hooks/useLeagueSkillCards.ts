import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";

/**
 * Bulk, organizer-authorized fetch of the compact PULSE Self-Assessed skill
 * cards for a league's members, keyed by player id. Backed by the
 * get_league_skill_cards RPC — authorization + sanitization live in the
 * database (league admins only). If the RPC denies access we simply return an
 * empty map and `denied: true`; the UI degrades to "no skill info", never a
 * partial leak and never a hard failure.
 *
 * This is a READ-ONLY, advisory data source for substitute matching. It never
 * touches the PULSE Performance Rating and returns no raw survey responses.
 */

export interface LeagueSkillCard {
  playerId: string;
  level: number | null;
  band: string | null;
  confidence: number | null;
  provisional: boolean;
  preferredSide: string | null;
  primaryStyle: string | null;
  secondaryStyle: string | null;
  reviewRecommended: boolean;
}

interface RpcRow {
  player_id: string;
  self_assessed_level: number | null;
  self_assessed_band: string | null;
  confidence: number | null;
  provisional_status: boolean | null;
  preferred_side: string | null;
  primary_style: string | null;
  secondary_style: string | null;
  review_recommended: boolean | null;
}

function mapRow(r: RpcRow): LeagueSkillCard {
  return {
    playerId: r.player_id,
    level: r.self_assessed_level,
    band: r.self_assessed_band,
    confidence: r.confidence,
    provisional: !!r.provisional_status,
    preferredSide: r.preferred_side,
    primaryStyle: r.primary_style,
    secondaryStyle: r.secondary_style,
    reviewRecommended: !!r.review_recommended,
  };
}

export interface LeagueSkillCardsState {
  enabled: boolean;
  loading: boolean;
  denied: boolean;
  cards: Map<string, LeagueSkillCard>;
  refetch: () => Promise<void>;
}

export function useLeagueSkillCards(leagueId: string | null | undefined): LeagueSkillCardsState {
  const enabled = isSkillAssessmentEnabled();
  const [loading, setLoading] = useState(enabled && !!leagueId);
  const [denied, setDenied] = useState(false);
  const [cards, setCards] = useState<Map<string, LeagueSkillCard>>(new Map());
  const cancelledRef = useRef(false);

  const fetchCards = useCallback(async () => {
    if (!enabled || !leagueId) { setCards(new Map()); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc(
      "get_league_skill_cards" as never,
      { p_league_id: leagueId } as never,
    );
    if (cancelledRef.current) return;
    if (error) { setDenied(true); setCards(new Map()); setLoading(false); return; }
    setDenied(false);
    const rows = (data ?? []) as unknown as RpcRow[];
    const map = new Map<string, LeagueSkillCard>();
    rows.forEach((r) => { if (r?.player_id) map.set(r.player_id, mapRow(r)); });
    setCards(map);
    setLoading(false);
  }, [enabled, leagueId]);

  useEffect(() => {
    cancelledRef.current = false;
    void fetchCards();
    return () => { cancelledRef.current = true; };
  }, [fetchCards]);

  return { enabled, loading, denied, cards, refetch: fetchCards };
}
