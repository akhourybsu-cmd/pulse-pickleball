import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { teamIds } = await req.json();

    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      throw new Error("teamIds must be a non-empty array");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    // Fetch team details with event and division info
    const { data: teams, error: teamsError } = await supabase
      .from("tournaments_teams")
      .select(`
        *,
        division:tournaments_divisions(
          name,
          event:tournaments_events(
            name,
            start_date,
            location,
            id
          )
        ),
        player1:profiles!tournaments_teams_player1_id_fkey(email, display_name, full_name),
        player2:profiles!tournaments_teams_player2_id_fkey(email, display_name, full_name)
      `)
      .in("id", teamIds);

    if (teamsError) throw teamsError;

    const notifications = [];

    for (const team of teams || []) {
      if (!team.division?.event) continue;

      const event = team.division.event;
      const eventDate = new Date(event.start_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const publicUrl = `${Deno.env.get("SUPABASE_URL")?.replace("https://", "https://")}/tournament/${event.id}/live`;

      const emailHtml = `
        <h1>Team Assignment Confirmed! 🎾</h1>
        <p>Your team has been officially registered for <strong>${event.name}</strong>.</p>
        
        <h2>Team Details</h2>
        <p><strong>Team Name:</strong> ${team.team_name}</p>
        <p><strong>Division:</strong> ${team.division.name}</p>
        <p><strong>Seed:</strong> ${team.seed_number ? `#${team.seed_number}` : 'TBD (will be assigned before tournament)'}</p>
        
        <h3>Your Partner</h3>
        <p>${team.player1 ? (team.player1.display_name || team.player1.full_name) : 'Player 1'} & ${team.player2 ? (team.player2.display_name || team.player2.full_name) : 'Player 2'}</p>
        
        <h3>Event Information</h3>
        <p><strong>Date:</strong> ${eventDate}</p>
        <p><strong>Location:</strong> ${event.location || 'TBD'}</p>
        
        <h3>What's Next</h3>
        <ul>
          <li>Brackets and match schedules will be posted soon</li>
          <li>You'll receive updates as matches are scheduled</li>
          <li>Arrive 15 minutes early for check-in</li>
        </ul>
        
        <p><strong>Live Bracket:</strong> <a href="${publicUrl}">View Tournament Bracket</a></p>
        
        <p>If you have any questions or need to make changes, reply to this email.</p>
        
        <p>Good luck!</p>
        <p>The Tournament Team</p>
      `;

      // Send to player 1
      if (team.player1?.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "PULSE <support@pulsepb.com>",
            to: [team.player1.email],
            subject: `Team Assignment: ${event.name}`,
            html: emailHtml,
          }),
        });

        notifications.push({
          team_id: team.id,
          to_email: team.player1.email,
        });
      }

      // Send to player 2 if exists
      if (team.player2?.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "PULSE <support@pulsepb.com>",
            to: [team.player2.email],
            subject: `Team Assignment: ${event.name}`,
            html: emailHtml,
          }),
        });

        notifications.push({
          team_id: team.id,
          to_email: team.player2.email,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: notifications.length,
        teams: teamIds.length 
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending team assignment emails:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
