// Sends court-assignment branded emails to every player on the match.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CourtAssignmentPayload {
  matchId: string;
  courtNumber: number;
  scheduledTime: string;
}

const SITE_URL = "https://pulsepb.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { matchId, courtNumber, scheduledTime }: CourtAssignmentPayload = await req.json();
    if (!matchId || courtNumber === undefined || !scheduledTime) {
      return new Response(JSON.stringify({ error: "matchId, courtNumber, scheduledTime required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: matchData, error: matchError } = await supabase
      .from("tournaments_matches")
      .select("id, division_id, team1_id, team2_id")
      .eq("id", matchId)
      .single();

    if (matchError || !matchData) throw new Error("Match not found");

    const { data: teamsData } = await supabase
      .from("tournaments_teams")
      .select("id, team_name, player1_id, player2_id")
      .in("id", [matchData.team1_id, matchData.team2_id]);

    const team1 = teamsData?.find((t) => t.id === matchData.team1_id);
    const team2 = teamsData?.find((t) => t.id === matchData.team2_id);

    const { data: divisionData } = await supabase
      .from("tournaments_divisions")
      .select("name, event_id")
      .eq("id", matchData.division_id)
      .single();

    const { data: eventData } = await supabase
      .from("tournaments_events")
      .select("id, name, location")
      .eq("id", divisionData?.event_id)
      .single();

    const eventName = eventData?.name || "Tournament";
    const eventUrl = eventData?.id ? `${SITE_URL}/tournament/${eventData.id}` : SITE_URL;

    const playerIds: string[] = [];
    if (team1?.player1_id) playerIds.push(team1.player1_id);
    if (team1?.player2_id) playerIds.push(team1.player2_id);
    if (team2?.player1_id) playerIds.push(team2.player1_id);
    if (team2?.player2_id) playerIds.push(team2.player2_id);

    const { data: players } = await supabase
      .from("profiles")
      .select("id, email, display_name, full_name")
      .in("id", playerIds);

    const formattedTime = new Date(scheduledTime).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    for (const player of players || []) {
      if (!player.email) continue;
      const isTeam1 =
        team1?.player1_id === player.id || team1?.player2_id === player.id;
      const opponentTeam = isTeam1 ? team2?.team_name : team1?.team_name;

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "court-assignment",
          recipientEmail: player.email,
          idempotencyKey: `court-assigned-${matchId}-${player.id}`,
          templateData: {
            playerName:
              player.display_name || player.full_name?.split(" ")[0] || "Player",
            courtNumber: String(courtNumber),
            matchTime: formattedTime,
            opponentTeam,
            divisionName: divisionData?.name,
            eventName,
            matchUrl: eventUrl,
          },
        },
      });
    }

    await supabase
      .from("tournaments_matches")
      .update({
        court_number: courtNumber,
        scheduled_time: scheduledTime,
        status: "scheduled",
      })
      .eq("id", matchId);

    return new Response(
      JSON.stringify({ success: true, notified: players?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-court-assignment:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send court assignment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
