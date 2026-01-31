import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    
    let notificationsSent = 0;
    const errors: string[] = [];

    console.log('Running tournament reminders check at:', now.toISOString());

    // 1. Find matches starting in ~15 minutes (check window: 10-20 min)
    const matchWindow = {
      start: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      end: new Date(now.getTime() + 20 * 60 * 1000).toISOString(),
    };

    const { data: upcomingMatches, error: matchError } = await supabase
      .from('tournaments_matches')
      .select(`
        id,
        scheduled_time,
        division_id,
        team1_id,
        team2_id,
        court_id
      `)
      .eq('status', 'scheduled')
      .gte('scheduled_time', matchWindow.start)
      .lte('scheduled_time', matchWindow.end);

    if (matchError) {
      console.error('Error fetching upcoming matches:', matchError);
      errors.push(`Match query error: ${matchError.message}`);
    } else if (upcomingMatches && upcomingMatches.length > 0) {
      console.log(`Found ${upcomingMatches.length} matches starting soon`);

      for (const match of upcomingMatches) {
        // Get team details
        const { data: team1Data } = await supabase
          .from('tournaments_teams')
          .select('team_name, player1_id, player2_id')
          .eq('id', match.team1_id)
          .single();

        const { data: team2Data } = await supabase
          .from('tournaments_teams')
          .select('team_name, player1_id, player2_id')
          .eq('id', match.team2_id)
          .single();

        // Get division and event info
        const { data: divisionData } = await supabase
          .from('tournaments_divisions')
          .select('event_id, name')
          .eq('id', match.division_id)
          .single();

        // Get court info if assigned
        let courtInfo = '';
        if (match.court_id) {
          const { data: courtData } = await supabase
            .from('tournaments_courts')
            .select('court_number, court_name')
            .eq('id', match.court_id)
            .single();
          
          if (courtData) {
            courtInfo = `on Court ${courtData.court_number}${courtData.court_name ? ` (${courtData.court_name})` : ''}`;
          }
        }

        // Collect player IDs
        const playerIds: string[] = [];
        if (team1Data?.player1_id) playerIds.push(team1Data.player1_id);
        if (team1Data?.player2_id) playerIds.push(team1Data.player2_id);
        if (team2Data?.player1_id) playerIds.push(team2Data.player1_id);
        if (team2Data?.player2_id) playerIds.push(team2Data.player2_id);

        if (playerIds.length === 0) continue;

        // Check if we already sent this reminder
        const { data: existing } = await supabase
          .from('event_reminders_sent')
          .select('id')
          .eq('event_id', match.id)
          .eq('event_type', 'match_starting_soon')
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`Skipping match ${match.id} - reminder already sent`);
          continue;
        }

        // Create notifications for all players
        const notifications = playerIds.map(userId => ({
          user_id: userId,
          notification_type: 'match_starting_soon',
          category: 'tournaments',
          priority: 'urgent',
          title: 'Match Starting Soon! ⏰',
          message: `Your match ${team1Data?.team_name || 'Team 1'} vs ${team2Data?.team_name || 'Team 2'} starts in 15 minutes ${courtInfo}`.trim(),
          link: `/tournament/${divisionData?.event_id}/division/${match.division_id}`,
          metadata: {
            tournament_id: divisionData?.event_id,
            division_id: match.division_id,
            match_id: match.id,
            action: 'view_match',
          },
        }));

        const { error: insertError } = await supabase
          .from('user_notifications')
          .insert(notifications);

        if (insertError) {
          console.error(`Error sending match reminder for ${match.id}:`, insertError);
          errors.push(`Match ${match.id}: ${insertError.message}`);
        } else {
          // Mark as sent
          await supabase.from('event_reminders_sent').insert(
            playerIds.map(userId => ({
              event_id: match.id,
              event_type: 'match_starting_soon',
              user_id: userId,
            }))
          );
          notificationsSent += notifications.length;
          console.log(`Sent ${notifications.length} match starting reminders for match ${match.id}`);
        }
      }
    }

    // 2. Find tournaments with registration closing in ~24 hours
    const regCloseWindow = {
      start: new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString(),
      end: new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString(),
    };

    const { data: closingTournaments, error: closingError } = await supabase
      .from('event_tournament')
      .select('event_id, registration_close_date')
      .eq('registration_enabled', true)
      .gte('registration_close_date', regCloseWindow.start)
      .lte('registration_close_date', regCloseWindow.end);

    if (closingError) {
      console.error('Error fetching closing tournaments:', closingError);
      errors.push(`Closing query error: ${closingError.message}`);
    } else if (closingTournaments && closingTournaments.length > 0) {
      console.log(`Found ${closingTournaments.length} tournaments with registration closing soon`);

      for (const tournament of closingTournaments) {
        // Get event details
        const { data: eventData } = await supabase
          .from('unified_events')
          .select('name, status')
          .eq('id', tournament.event_id)
          .single();

        if (eventData?.status !== 'published') continue;

        // Get registered players who haven't been notified
        const { data: registrations } = await supabase
          .from('tournament_registrations')
          .select('captain_user_id, partner_user_id')
          .eq('event_id', tournament.event_id)
          .in('status', ['pending', 'waitlisted']);

        const playerIds = new Set<string>();
        registrations?.forEach(reg => {
          if (reg.captain_user_id) playerIds.add(reg.captain_user_id);
          if (reg.partner_user_id) playerIds.add(reg.partner_user_id);
        });

        if (playerIds.size === 0) continue;

        // Check if we already sent this reminder
        const { data: existing } = await supabase
          .from('event_reminders_sent')
          .select('id')
          .eq('event_id', tournament.event_id)
          .eq('event_type', 'registration_closing_soon')
          .limit(1);

        if (existing && existing.length > 0) continue;

        const notifications = Array.from(playerIds).map(userId => ({
          user_id: userId,
          notification_type: 'registration_closing_soon',
          category: 'tournaments',
          priority: 'high',
          title: 'Registration Closing Soon! ⏰',
          message: `Registration for ${eventData?.name || 'tournament'} closes in 24 hours`,
          link: `/tournament/${tournament.event_id}`,
          metadata: {
            tournament_id: tournament.event_id,
          },
        }));

        const { error: insertError } = await supabase
          .from('user_notifications')
          .insert(notifications);

        if (!insertError) {
          await supabase.from('event_reminders_sent').insert(
            Array.from(playerIds).map(userId => ({
              event_id: tournament.event_id,
              event_type: 'registration_closing_soon',
              user_id: userId,
            }))
          );
          notificationsSent += notifications.length;
        }
      }
    }

    console.log(`Tournament reminders complete. Sent ${notificationsSent} notifications.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error in send-tournament-reminders:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
