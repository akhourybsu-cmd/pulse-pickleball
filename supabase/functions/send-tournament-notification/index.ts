import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: string;
  userId?: string;
  userIds?: string[];
  title: string;
  message: string;
  tournamentId?: string;
  divisionId?: string;
  matchId?: string;
  teamId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  action?: string;
  metadata?: Record<string, unknown>;
  sendEmail?: boolean;
}

// Priority mapping for notification types
const typePriorities: Record<string, string> = {
  match_starting_soon: 'urgent',
  checkin_reminder: 'urgent',
  waitlist_promoted: 'urgent',
  tournament_cancelled: 'urgent',
  tournament_rescheduled: 'urgent',
  weather_delay: 'urgent',
  tournament_update: 'urgent',
  match_disputed: 'urgent',
  checkin_missed: 'urgent',
  payment_failed: 'urgent',
  registration_approved: 'high',
  team_assigned: 'high',
  partner_left_team: 'high',
  registration_closing_soon: 'high',
  schedule_released: 'high',
  match_court_assigned: 'high',
  match_dispute_resolved: 'high',
  match_forfeited: 'high',
  next_match_ready: 'high',
  advanced_to_next_round: 'high',
  podium_finish: 'high',
  checkin_open: 'high',
  tournament_announcement: 'high',
  schedule_change: 'high',
  venue_change: 'high',
  payment_reminder: 'high',
};

function buildNotificationLink(
  type: string,
  tournamentId?: string,
  divisionId?: string
): string {
  const base = tournamentId ? `/tournament/${tournamentId}` : '/tournaments';
  
  if (type.includes('match_') && divisionId) {
    return `${base}/division/${divisionId}`;
  }
  
  if (type === 'tournament_cancelled' || type === 'registration_cancelled') {
    return '/tournaments';
  }
  
  if (type.includes('payment_')) {
    return `${base}?tab=payment`;
  }
  
  if (type === 'registration_approved' || type === 'team_assigned') {
    return `${base}?tab=myteam`;
  }
  
  return base;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationRequest = await req.json();
    
    const {
      type,
      userId,
      userIds,
      title,
      message,
      tournamentId,
      divisionId,
      matchId,
      teamId,
      priority,
      action,
      metadata = {},
      sendEmail = false,
    } = body;

    // Collect all user IDs to notify
    const allUserIds: string[] = [];
    if (userId) allUserIds.push(userId);
    if (userIds) allUserIds.push(...userIds);

    if (allUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No users specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending ${type} notification to ${allUserIds.length} user(s)`);

    const link = buildNotificationLink(type, tournamentId, divisionId);
    const finalPriority = priority || typePriorities[type] || 'normal';

    // Create notifications for all users
    const notifications = allUserIds.map(uid => ({
      user_id: uid,
      notification_type: type,
      category: 'tournaments',
      priority: finalPriority,
      title,
      message,
      link,
      metadata: {
        ...metadata,
        tournament_id: tournamentId,
        division_id: divisionId,
        match_id: matchId,
        team_id: teamId,
        action,
      },
    }));

    const { data, error } = await supabase
      .from('user_notifications')
      .insert(notifications)
      .select();

    if (error) {
      console.error('Error creating notifications:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created ${data?.length || 0} notifications`);

    // TODO: Send emails if sendEmail is true
    // This would integrate with the existing email sending infrastructure

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: data?.length || 0,
        notifications: data 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error in send-tournament-notification:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
