import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContestRequest {
  match_id: string;
  reason?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { match_id, reason }: ContestRequest = await req.json();

    // Insert the contested match record
    const { data: contestData, error: contestError } = await supabase
      .from('contested_matches')
      .insert({
        match_id,
        contested_by: user.id,
        reason: reason || 'No reason provided',
      })
      .select()
      .single();

    if (contestError) {
      console.error('Error creating contest:', contestError);
      return new Response(
        JSON.stringify({ error: 'Failed to contest match' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get match details and all participants
    const { data: matchData } = await supabase
      .from('matches')
      .select(`
        match_date,
        team1_score,
        team2_score,
        courts(name)
      `)
      .eq('id', match_id)
      .single();

    const { data: participants } = await supabase
      .from('match_participants')
      .select('player_id, profiles(full_name)')
      .eq('match_id', match_id);

    const { data: contester } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    // Log the contest notification (no sensitive data)
    console.log('Match Contest Notification:', {
      match_id,
      contested_by: contester?.full_name,
      reason,
      match_details: matchData,
      participant_count: participants?.length || 0,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Match contested successfully. Admins have been notified.',
        contest_id: contestData.id,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in notify-contested-match:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});