/**
 * Centralized Permissions Matrix
 * 
 * This module provides a single source of truth for all permission checks
 * across the application. Use these functions instead of scattered isAdmin checks.
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export type EntityType = 'event' | 'match' | 'venue' | 'group' | 'post';
export type ActionType = 'view' | 'create' | 'edit' | 'delete' | 'manage';

export interface PermissionContext {
  userId: string | null;
  entityType: EntityType;
  entityId?: string;
  venueId?: string;
  groupId?: string;
  eventId?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

// =============================================================================
// VENUE PERMISSIONS
// =============================================================================

export type VenueRole = 'owner' | 'manager' | 'staff' | null;

export async function getVenueRole(userId: string, venueId: string): Promise<VenueRole> {
  // Check if owner
  const { data: venue } = await supabase
    .from('venues')
    .select('owner_id')
    .eq('id', venueId)
    .single();

  if (venue?.owner_id === userId) return 'owner';

  // Check staff table
  const { data: staff } = await supabase
    .from('venue_staff')
    .select('role')
    .eq('venue_id', venueId)
    .eq('user_id', userId)
    .single();

  if (staff?.role) return staff.role as VenueRole;

  return null;
}

export function canManageVenue(role: VenueRole): boolean {
  return role === 'owner' || role === 'manager';
}

export function canEditVenueSettings(role: VenueRole): boolean {
  return role === 'owner' || role === 'manager';
}

export function canManageVenueStaff(role: VenueRole): boolean {
  return role === 'owner';
}

export function canCreateVenueEvents(role: VenueRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'staff';
}

export function canDeleteVenue(role: VenueRole): boolean {
  return role === 'owner';
}

// =============================================================================
// EVENT PERMISSIONS
// =============================================================================

export interface EventContext {
  hostVenueId?: string | null;
  hostGroupId?: string | null;
  hostUserId?: string | null;
  status?: string;
}

export async function canManageEvent(
  userId: string | null,
  eventContext: EventContext
): Promise<boolean> {
  if (!userId) return false;

  // Event creator always has manage rights
  if (eventContext.hostUserId === userId) return true;

  // Check venue admin rights
  if (eventContext.hostVenueId) {
    const role = await getVenueRole(userId, eventContext.hostVenueId);
    if (canManageVenue(role)) return true;
  }

  // Check group admin rights
  if (eventContext.hostGroupId) {
    const { data: member } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', eventContext.hostGroupId)
      .eq('user_id', userId)
      .single();

    if (member?.role === 'owner' || member?.role === 'moderator') return true;
  }

  return false;
}

export async function canEditEventScores(
  userId: string | null,
  eventContext: EventContext
): Promise<boolean> {
  // Same as manage for now, but could be more granular
  return canManageEvent(userId, eventContext);
}

export async function canJoinEvent(
  userId: string | null,
  eventStatus: string,
  maxPlayers: number,
  currentPlayers: number
): Promise<PermissionResult> {
  if (!userId) {
    return { allowed: false, reason: 'Must be logged in to join events' };
  }

  if (eventStatus === 'completed' || eventStatus === 'cancelled') {
    return { allowed: false, reason: 'Event is no longer accepting registrations' };
  }

  if (eventStatus === 'in_progress') {
    return { allowed: false, reason: 'Event has already started' };
  }

  if (currentPlayers >= maxPlayers) {
    return { allowed: false, reason: 'Event is full' };
  }

  return { allowed: true };
}

// =============================================================================
// MATCH PERMISSIONS
// =============================================================================

export interface MatchContext {
  createdBy: string;
  eventId?: string | null;
  participantIds: string[];
  status?: string;
  verificationStatus?: string;
}

export function canEditMatch(
  userId: string | null,
  matchContext: MatchContext
): boolean {
  if (!userId) return false;

  // Creator can edit their own matches
  if (matchContext.createdBy === userId) return true;

  // Participants can edit (for verification flow)
  if (matchContext.participantIds.includes(userId)) return true;

  return false;
}

export function canDeleteMatch(
  userId: string | null,
  matchContext: MatchContext
): boolean {
  if (!userId) return false;

  // Only creator can delete
  return matchContext.createdBy === userId;
}

export function canVerifyMatch(
  userId: string | null,
  matchContext: MatchContext
): boolean {
  if (!userId) return false;

  // Only participants can verify
  return matchContext.participantIds.includes(userId);
}

export function canDisputeMatch(
  userId: string | null,
  matchContext: MatchContext
): boolean {
  if (!userId) return false;

  // Only participants can dispute
  return matchContext.participantIds.includes(userId);
}

// =============================================================================
// GROUP PERMISSIONS
// =============================================================================

export type GroupRole = 'owner' | 'moderator' | 'member' | null;

export async function getGroupRole(userId: string, groupId: string): Promise<GroupRole> {
  const { data: member } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return member?.role as GroupRole || null;
}

export function canManageGroup(role: GroupRole): boolean {
  return role === 'owner' || role === 'moderator';
}

export function canPostInGroup(role: GroupRole): boolean {
  return role !== null; // Any member can post
}

export function canApproveMembers(role: GroupRole): boolean {
  return role === 'owner' || role === 'moderator';
}

export function canKickMembers(role: GroupRole): boolean {
  return role === 'owner' || role === 'moderator';
}

export function canChangeGroupSettings(role: GroupRole): boolean {
  return role === 'owner';
}

export function canDeleteGroup(role: GroupRole): boolean {
  return role === 'owner';
}

// =============================================================================
// POST PERMISSIONS
// =============================================================================

export interface PostContext {
  authorId: string;
  groupId?: string;
  courtId?: string;
}

export function canEditPost(userId: string | null, postContext: PostContext): boolean {
  if (!userId) return false;
  return postContext.authorId === userId;
}

export function canDeletePost(
  userId: string | null,
  postContext: PostContext,
  userGroupRole?: GroupRole
): boolean {
  if (!userId) return false;

  // Author can delete their own posts
  if (postContext.authorId === userId) return true;

  // Group moderators can delete posts
  if (postContext.groupId && canManageGroup(userGroupRole || null)) return true;

  return false;
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Quick permission check for common scenarios
 */
export async function checkPermission(context: PermissionContext): Promise<PermissionResult> {
  const { userId, entityType, entityId, venueId, groupId } = context;

  if (!userId) {
    return { allowed: false, reason: 'Authentication required' };
  }

  switch (entityType) {
    case 'venue':
      if (!venueId) return { allowed: false, reason: 'Venue ID required' };
      const venueRole = await getVenueRole(userId, venueId);
      return { 
        allowed: canManageVenue(venueRole),
        reason: venueRole ? undefined : 'No venue access'
      };

    case 'group':
      if (!groupId) return { allowed: false, reason: 'Group ID required' };
      const groupRole = await getGroupRole(userId, groupId);
      return {
        allowed: canManageGroup(groupRole),
        reason: groupRole ? undefined : 'No group access'
      };

    case 'event':
      if (!entityId) return { allowed: false, reason: 'Event ID required' };
      // Fetch event context
      const { data: event } = await supabase
        .from('unified_events')
        .select('host_venue_id, host_group_id, host_user_id')
        .eq('id', entityId)
        .single();
      
      if (!event) return { allowed: false, reason: 'Event not found' };
      
      const canManage = await canManageEvent(userId, {
        hostVenueId: event.host_venue_id,
        hostGroupId: event.host_group_id,
        hostUserId: event.host_user_id
      });
      
      return { allowed: canManage, reason: canManage ? undefined : 'No event access' };

    default:
      return { allowed: false, reason: 'Unknown entity type' };
  }
}
