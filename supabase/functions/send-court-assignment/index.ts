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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { matchId, courtNumber, scheduledTime }: CourtAssignmentPayload = await req.json();

    // Fetch match details with team and player info
    const { data: matchData, error: matchError } = await supabase
      .from("tournaments_matches")
      .select(`
        id,
        division_id,
        team1_id,
        team2_id
      `)
      .eq("id", matchId)
      .single();

    if (matchError || !matchData) {
      throw new Error("Match not found");
    }

    // Fetch teams separately - use player1_id and player2_id (correct column names)
    const { data: teamsData } = await supabase
      .from("tournaments_teams")
      .select("id, team_name, player1_id, player2_id")
      .in("id", [matchData.team1_id, matchData.team2_id]);

    const team1 = teamsData?.find(t => t.id === matchData.team1_id);
    const team2 = teamsData?.find(t => t.id === matchData.team2_id);

    // Fetch division info
    const { data: divisionData } = await supabase
      .from("tournaments_divisions")
      .select("name, event_id")
      .eq("id", matchData.division_id)
      .single();

    // Fetch event info
    const { data: eventData } = await supabase
      .from("tournaments_events")
      .select("name, location")
      .eq("id", divisionData?.event_id)
      .single();

    const eventName = eventData?.name || "Tournament";

    // Collect all player IDs to notify - use player1_id and player2_id
    const playerIds: string[] = [];
    if (team1?.player1_id) playerIds.push(team1.player1_id);
    if (team1?.player2_id) playerIds.push(team1.player2_id);
    if (team2?.player1_id) playerIds.push(team2.player1_id);
    if (team2?.player2_id) playerIds.push(team2.player2_id);

    // Fetch player emails
    const { data: players, error: playersError } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", playerIds);

    if (playersError) {
      throw new Error("Failed to fetch player info");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const formattedTime = new Date(scheduledTime).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    // Send emails to all players
    const emailPromises = players?.map(async (player) => {
      const isTeam1 = team1?.player1_id === player.id || 
                      team1?.player2_id === player.id;
      const opponentTeam = isTeam1 ? team2?.team_name : team1?.team_name;
      const playerTeam = isTeam1 ? team1?.team_name : team2?.team_name;

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏓 Your Match is Ready!</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hi ${player.display_name || 'Player'},
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #10B981;">
              <h2 style="margin: 0 0 15px 0; color: #111827;">Match Details</h2>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Court</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #111827;">Court ${courtNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Time</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #111827;">${formattedTime}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Your Team</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #111827;">${playerTeam}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Opponent</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #111827;">${opponentTeam}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Division</td>
                  <td style="padding: 8px 0; color: #111827;">${divisionData?.name}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                ⚠️ <strong>Important:</strong> Please report to the court promptly. Matches not started within 10 minutes may be forfeited.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
              Good luck!
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              — The ${eventName} Team
            </p>
          </div>
        </div>
      `;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "PULSE <support@pulsepb.com>",
          to: [player.email],
          subject: `🏓 Court Assignment: ${eventName} - Court ${courtNumber} at ${formattedTime}`,
          html: emailHtml,
        }),
      });

      if (!response.ok) {
        console.error(`Failed to send email to ${player.email}`);
      }

      return response;
    }) || [];

    await Promise.all(emailPromises);

    // Update match with court assignment
    await supabase
      .from("tournaments_matches")
      .update({
        court_number: courtNumber,
        scheduled_time: scheduledTime,
        status: "scheduled"
      })
      .eq("id", matchId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: players?.length || 0 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-court-assignment:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send court assignment" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
