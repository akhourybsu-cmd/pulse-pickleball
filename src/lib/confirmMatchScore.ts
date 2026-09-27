import { supabase } from "@/integrations/supabase/client";

export async function confirmMatchScore(
  matchId: string,
  viewerId: string,
  pending: boolean
) {
  if (pending) {
    const { data, error } = await supabase
      .from("match_approvals")
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq("match_id", matchId)
      .eq("player_id", viewerId)
      .select("match_id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new Error(
        "Your confirmation was not saved. Refresh your matches and try again."
      );
  } else {
    const { error } = await supabase.rpc("verify_match", {
      p_match_id: matchId,
    });
    if (error) throw error;
  }
}
