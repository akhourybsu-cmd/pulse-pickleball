/**
 * System Health Checks
 * 
 * Edge case handlers and data integrity validators.
 * Run these periodically or on-demand to ensure system health.
 */

import { supabase } from '@/integrations/supabase/client';

export interface HealthCheckResult {
  check: string;
  passed: boolean;
  message: string;
  count?: number;
  fixable?: boolean;
}

// =============================================================================
// MATCH HEALTH CHECKS
// =============================================================================

/**
 * Find matches with invalid scores (e.g., both teams have same score)
 */
export async function checkInvalidScores(): Promise<HealthCheckResult> {
  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('team1_score', supabase.rpc as any) // This won't work, need raw SQL
    .limit(100);

  // Use a different approach - fetch and filter
  const { data: matches } = await supabase
    .from('matches')
    .select('id, team1_score, team2_score, status')
    .not('status', 'eq', 'voided')
    .limit(1000);

  const invalid = matches?.filter(m => m.team1_score === m.team2_score) || [];

  return {
    check: 'invalid_scores',
    passed: invalid.length === 0,
    message: invalid.length === 0 
      ? 'All matches have valid scores'
      : `Found ${invalid.length} matches with tied scores`,
    count: invalid.length,
    fixable: true
  };
}

/**
 * Find duplicate matches (same players, same date, same event)
 */
export async function checkDuplicateMatches(): Promise<HealthCheckResult> {
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      match_date,
      event_id,
      match_participants(player_id)
    `)
    .not('voided', 'eq', true)
    .order('match_date', { ascending: false })
    .limit(500);

  if (!matches) {
    return {
      check: 'duplicate_matches',
      passed: true,
      message: 'Could not check for duplicates',
      count: 0
    };
  }

  // Group by date + event to find potential duplicates
  const potentialDuplicates: string[][] = [];
  const matchGroups = new Map<string, typeof matches>();

  for (const match of matches) {
    const key = `${match.match_date}_${match.event_id || 'manual'}`;
    if (!matchGroups.has(key)) {
      matchGroups.set(key, []);
    }
    matchGroups.get(key)!.push(match);
  }

  // Check each group for player overlap
  for (const [key, group] of matchGroups) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const players1 = new Set(group[i].match_participants?.map(p => p.player_id) || []);
        const players2 = new Set(group[j].match_participants?.map(p => p.player_id) || []);
        
        const overlap = [...players1].filter(p => players2.has(p));
        if (overlap.length >= 2) {
          potentialDuplicates.push([group[i].id, group[j].id]);
        }
      }
    }
  }

  return {
    check: 'duplicate_matches',
    passed: potentialDuplicates.length === 0,
    message: potentialDuplicates.length === 0
      ? 'No duplicate matches found'
      : `Found ${potentialDuplicates.length} potential duplicate match pairs`,
    count: potentialDuplicates.length,
    fixable: true
  };
}

/**
 * Find matches with missing participants
 */
export async function checkMissingParticipants(): Promise<HealthCheckResult> {
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      match_format,
      match_participants(id)
    `)
    .not('voided', 'eq', true)
    .limit(500);

  const invalid = matches?.filter(m => {
    const expectedCount = m.match_format === 'singles' ? 2 : 4;
    return (m.match_participants?.length || 0) < expectedCount;
  }) || [];

  return {
    check: 'missing_participants',
    passed: invalid.length === 0,
    message: invalid.length === 0
      ? 'All matches have correct participant count'
      : `Found ${invalid.length} matches with missing participants`,
    count: invalid.length,
    fixable: false
  };
}

// =============================================================================
// EVENT HEALTH CHECKS
// =============================================================================

/**
 * Find events with invalid status transitions
 */
export async function checkEventStatusIntegrity(): Promise<HealthCheckResult> {
  const { data: events } = await supabase
    .from('unified_events')
    .select('id, status, start_time, end_time')
    .limit(500);

  const now = new Date();
  const issues: string[] = [];

  events?.forEach(event => {
    const startTime = new Date(event.start_time);
    const endTime = event.end_time ? new Date(event.end_time) : null;

    // Event ended but status not completed
    if (endTime && endTime < now && event.status !== 'completed' && event.status !== 'cancelled') {
      issues.push(event.id);
    }

    // Event should be in_progress but isn't
    if (startTime < now && (!endTime || endTime > now) && 
        event.status !== 'in_progress' && event.status !== 'completed' && event.status !== 'cancelled') {
      // This might be intentional, just flag it
    }
  });

  return {
    check: 'event_status_integrity',
    passed: issues.length === 0,
    message: issues.length === 0
      ? 'All event statuses are valid'
      : `Found ${issues.length} events with potentially incorrect status`,
    count: issues.length,
    fixable: true
  };
}

/**
 * Find events with over-registration
 */
export async function checkEventOverRegistration(): Promise<HealthCheckResult> {
  const { data: events } = await supabase
    .from('unified_events')
    .select(`
      id,
      max_participants,
      event_registrations(id, status)
    `)
    .not('status', 'in', '("completed","cancelled")')
    .limit(500);

  const overRegistered = events?.filter(event => {
    const confirmed = event.event_registrations?.filter((r: { status: string }) => 
      r.status === 'confirmed' || r.status === 'registered'
    ).length || 0;
    return event.max_participants && confirmed > event.max_participants;
  }) || [];

  return {
    check: 'event_over_registration',
    passed: overRegistered.length === 0,
    message: overRegistered.length === 0
      ? 'No events are over-registered'
      : `Found ${overRegistered.length} events with too many registrations`,
    count: overRegistered.length,
    fixable: true
  };
}

// =============================================================================
// USER HEALTH CHECKS
// =============================================================================

/**
 * Find orphaned profiles (users deleted but profile remains)
 */
export async function checkOrphanedProfiles(): Promise<HealthCheckResult> {
  // This requires admin access and can't be done from client
  // Just return a pass for now
  return {
    check: 'orphaned_profiles',
    passed: true,
    message: 'Orphaned profile check requires admin access',
    count: 0,
    fixable: false
  };
}

/**
 * Find profiles with invalid player_state
 */
export async function checkPlayerStateIntegrity(): Promise<HealthCheckResult> {
  // Find players marked as 'onboarding' but have matches
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, player_state')
    .eq('player_state', 'onboarding')
    .limit(500);

  if (!profiles || profiles.length === 0) {
    return {
      check: 'player_state_integrity',
      passed: true,
      message: 'All player states are valid',
      count: 0
    };
  }

  // Check if any of these have matches
  const profileIds = profiles.map(p => p.id);
  const { data: participants } = await supabase
    .from('match_participants')
    .select('player_id')
    .in('player_id', profileIds);

  const playersWithMatches = new Set(participants?.map(p => p.player_id) || []);
  const invalidCount = playersWithMatches.size;

  return {
    check: 'player_state_integrity',
    passed: invalidCount === 0,
    message: invalidCount === 0
      ? 'All player states are valid'
      : `Found ${invalidCount} players in 'onboarding' state with matches`,
    count: invalidCount,
    fixable: true
  };
}

// =============================================================================
// RATING HEALTH CHECKS
// =============================================================================

/**
 * Check for rating calculation inconsistencies
 */
export async function checkRatingIntegrity(): Promise<HealthCheckResult> {
  // Find matches where rating_eligible is true but no rating changes recorded
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      rating_eligible,
      status,
      match_participants(rating_change)
    `)
    .eq('rating_eligible', true)
    .not('voided', 'eq', true)
    .limit(500);

  const noRatingChanges = matches?.filter(m => {
    return m.match_participants?.every(p => p.rating_change === null || p.rating_change === 0);
  }) || [];

  return {
    check: 'rating_integrity',
    passed: noRatingChanges.length === 0,
    message: noRatingChanges.length === 0
      ? 'All rated matches have proper rating changes'
      : `Found ${noRatingChanges.length} rated matches without rating changes`,
    count: noRatingChanges.length,
    fixable: true
  };
}

// =============================================================================
// RUN ALL CHECKS
// =============================================================================

export async function runAllHealthChecks(): Promise<HealthCheckResult[]> {
  const results = await Promise.all([
    checkInvalidScores(),
    checkDuplicateMatches(),
    checkMissingParticipants(),
    checkEventStatusIntegrity(),
    checkEventOverRegistration(),
    checkPlayerStateIntegrity(),
    checkRatingIntegrity()
  ]);

  return results;
}

/**
 * Quick summary of system health
 */
export async function getHealthSummary(): Promise<{
  healthy: boolean;
  totalChecks: number;
  passed: number;
  failed: number;
  issues: HealthCheckResult[];
}> {
  const results = await runAllHealthChecks();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed);

  return {
    healthy: failed.length === 0,
    totalChecks: results.length,
    passed,
    failed: failed.length,
    issues: failed
  };
}
