// Sends team-assignment branded emails to both partners for each team.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://pulsepb.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { teamIds } = await req.json();
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      return new Response(JSON.stringify({ error: "teamIds must be a non-empty array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: teams, error: teamsError } = await supabase
      .from("tournaments_teams")
      .select(`
        *,
        division:tournaments_divisions(
          name,
          event:tournaments_events(name, start_date, location, id)
        ),
        player1:profiles!tournaments_teams_player1_id_fkey(email, display_name, full_name),
        player2:profiles!tournaments_teams_player2_id_fkey(email, display_name, full_name)
      `)
      .in("id", teamIds);

    if (teamsError) throw teamsError;

    let sent = 0;

    for (const team of teams || []) {
      const event = team.division?.event;
      if (!event) continue;

      const eventUrl = `${SITE_URL}/tournament/${event.id}`;
      const p1Name = team.player1?.display_name || team.player1?.full_name;
      const p2Name = team.player2?.display_name || team.player2?.full_name;

      const dispatch = async (
        email: string,
        role: "p1" | "p2",
        playerName?: string,
        partnerName?: string
      ) => {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "team-assignment",
            recipientEmail: email,
            idempotencyKey: `team-assigned-${team.id}-${role}`,
            templateData: {
              playerName: playerName?.split(" ")[0] || "Player",
              partnerName: partnerName || "your partner",
              eventName: event.name,
              divisionName: team.division?.name,
              teamName: team.team_name,
              eventUrl,
            },
          },
        });
        sent++;
      };

      if (team.player1?.email) await dispatch(team.player1.email, "p1", p1Name, p2Name);
      if (team.player2?.email) await dispatch(team.player2.email, "p2", p2Name, p1Name);
    }

    return new Response(
      JSON.stringify({ success: true, sent, teams: teamIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending team assignment emails:", error);
    return new Response(JSON.stringify({ error: "Failed to send team assignment notification" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
