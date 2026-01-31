import { supabase } from "@/integrations/supabase/client";

export type TournamentNotificationType =
  // Registration
  | 'registration_submitted'
  | 'registration_approved'
  | 'registration_waitlisted'
  | 'registration_rejected'
  | 'waitlist_promoted'
  | 'team_assigned'
  | 'partner_joined_team'
  | 'partner_left_team'
  | 'registration_cancelled'
  // Lifecycle
  | 'tournament_published'
  | 'tournament_registration_open'
  | 'registration_closing_soon'
  | 'tournament_registration_closed'
  | 'tournament_cancelled'
  | 'tournament_rescheduled'
  | 'schedule_released'
  | 'tournament_completed'
  // Matches
  | 'match_scheduled'
  | 'match_starting_soon'
  | 'match_court_assigned'
  | 'match_started'
  | 'match_completed'
  | 'match_won'
  | 'match_lost'
  | 'match_disputed'
  | 'match_dispute_resolved'
  | 'match_forfeited'
  | 'next_match_ready'
  // Standings
  | 'advanced_to_next_round'
  | 'eliminated_from_tournament'
  | 'podium_finish'
  | 'tournament_champion'
  | 'standings_released'
  // Check-in
  | 'checkin_open'
  | 'checkin_reminder'
  | 'checked_in_confirmed'
  | 'checkin_missed'
  | 'weather_delay'
  // Announcements
  | 'tournament_announcement'
  | 'tournament_update'
  | 'schedule_change'
  | 'venue_change'
  // Payment
  | 'payment_confirmed'
  | 'payment_failed'
  | 'refund_processed'
  | 'payment_reminder';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

interface CreateNotificationParams {
  userId: string;
  type: TournamentNotificationType;
  title: string;
  message: string;
  tournamentId?: string;
  divisionId?: string;
  matchId?: string;
  teamId?: string;
  priority?: Priority;
  action?: string;
  metadata?: Record<string, unknown>;
}

// Priority mapping for notification types
const typePriorities: Record<TournamentNotificationType, Priority> = {
  // Urgent
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
  
  // High
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
  
  // Normal
  registration_submitted: 'normal',
  registration_waitlisted: 'normal',
  registration_rejected: 'normal',
  partner_joined_team: 'normal',
  tournament_published: 'normal',
  tournament_registration_open: 'normal',
  tournament_registration_closed: 'normal',
  tournament_completed: 'normal',
  match_scheduled: 'normal',
  match_started: 'normal',
  match_completed: 'normal',
  match_won: 'normal',
  eliminated_from_tournament: 'normal',
  tournament_champion: 'normal',
  standings_released: 'normal',
  checked_in_confirmed: 'normal',
  payment_confirmed: 'normal',
  refund_processed: 'normal',
  registration_cancelled: 'normal',
  
  // Low
  match_lost: 'low',
};

// Build the link based on notification type and IDs
function buildNotificationLink(
  type: TournamentNotificationType,
  tournamentId?: string,
  divisionId?: string,
  matchId?: string
): string {
  const base = tournamentId ? `/tournament/${tournamentId}` : '/tournaments';
  
  switch (type) {
    case 'registration_approved':
    case 'team_assigned':
    case 'partner_joined_team':
    case 'partner_left_team':
      return `${base}?tab=myteam`;
      
    case 'match_scheduled':
    case 'match_starting_soon':
    case 'match_court_assigned':
    case 'match_started':
    case 'match_completed':
    case 'match_won':
    case 'match_lost':
    case 'match_disputed':
    case 'match_dispute_resolved':
    case 'match_forfeited':
    case 'next_match_ready':
      return divisionId ? `${base}/division/${divisionId}` : base;
      
    case 'schedule_released':
    case 'advanced_to_next_round':
    case 'standings_released':
      return base;
      
    case 'checkin_open':
    case 'checkin_reminder':
    case 'checked_in_confirmed':
    case 'checkin_missed':
      return base;
      
    case 'payment_failed':
    case 'payment_reminder':
      return `${base}?tab=payment`;
      
    case 'tournament_cancelled':
    case 'registration_cancelled':
      return '/tournaments';
      
    default:
      return base;
  }
}

/**
 * Create an in-app notification for a tournament event
 */
export async function createTournamentNotification({
  userId,
  type,
  title,
  message,
  tournamentId,
  divisionId,
  matchId,
  teamId,
  priority,
  action,
  metadata = {},
}: CreateNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const link = buildNotificationLink(type, tournamentId, divisionId, matchId);
    const finalPriority = priority || typePriorities[type] || 'normal';
    
    const { error } = await supabase
      .from("user_notifications")
      .insert({
        user_id: userId,
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
      });

    if (error) {
      console.error("Error creating tournament notification:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Error creating tournament notification:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Send notification to multiple users
 */
export async function sendTournamentNotificationToMany(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<{ success: boolean; sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const result = await createTournamentNotification({ ...params, userId });
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { success: failed === 0, sent, failed };
}

/**
 * Get all player user IDs from a tournament
 */
export async function getTournamentPlayerIds(tournamentId: string): Promise<string[]> {
  const { data: registrations } = await supabase
    .from("tournament_registrations")
    .select("captain_user_id, partner_user_id")
    .eq("event_id", tournamentId)
    .in("status", ["confirmed", "waitlisted"]);

  const userIds = new Set<string>();
  registrations?.forEach(reg => {
    if (reg.captain_user_id) userIds.add(reg.captain_user_id);
    if (reg.partner_user_id) userIds.add(reg.partner_user_id);
  });

  return Array.from(userIds);
}

/**
 * Get player user IDs from a match
 */
export async function getMatchPlayerIds(matchId: string): Promise<string[]> {
  const { data: match } = await supabase
    .from("tournaments_matches")
    .select(`
      team1:tournaments_teams!tournaments_matches_team1_id_fkey(player1_id, player2_id),
      team2:tournaments_teams!tournaments_matches_team2_id_fkey(player1_id, player2_id)
    `)
    .eq("id", matchId)
    .single();

  const userIds = new Set<string>();
  if (match?.team1) {
    if (match.team1.player1_id) userIds.add(match.team1.player1_id);
    if (match.team1.player2_id) userIds.add(match.team1.player2_id);
  }
  if (match?.team2) {
    if (match.team2.player1_id) userIds.add(match.team2.player1_id);
    if (match.team2.player2_id) userIds.add(match.team2.player2_id);
  }

  return Array.from(userIds);
}

/**
 * Hook to use tournament notifications in components
 */
export function useTournamentNotifications() {
  const sendNotification = createTournamentNotification;
  const sendToMany = sendTournamentNotificationToMany;
  const getPlayerIds = getTournamentPlayerIds;
  const getMatchPlayers = getMatchPlayerIds;

  return {
    sendNotification,
    sendToMany,
    getPlayerIds,
    getMatchPlayers,
  };
}
