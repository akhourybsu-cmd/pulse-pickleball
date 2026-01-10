/**
 * React hooks for permission checks
 * 
 * Use these hooks in components to check user permissions.
 */

import { useState, useEffect, useMemo } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useAuthState } from './useAuthState';
import {
  VenueRole,
  GroupRole,
  getVenueRole,
  getGroupRole,
  canManageVenue,
  canEditVenueSettings,
  canManageVenueStaff,
  canCreateVenueEvents,
  canDeleteVenue,
  canManageGroup,
  canPostInGroup,
  canApproveMembers,
  canKickMembers,
  canChangeGroupSettings,
  canDeleteGroup,
  canManageEvent,
  EventContext
} from '@/lib/permissions';

// =============================================================================
// VENUE PERMISSIONS HOOK
// =============================================================================

export interface UseVenuePermissionsResult {
  role: VenueRole;
  isLoading: boolean;
  canManage: boolean;
  canEditSettings: boolean;
  canManageStaff: boolean;
  canCreateEvents: boolean;
  canDelete: boolean;
}

export function useVenuePermissions(venueId?: string | null): UseVenuePermissionsResult {
  const { user } = useAuthState();
  const { currentVenue, currentVenueId } = useMode();
  const [role, setRole] = useState<VenueRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  const targetVenueId = venueId || currentVenueId;

  useEffect(() => {
    async function fetchRole() {
      if (!user?.id || !targetVenueId) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      // First check if we have role from context (faster)
      if (currentVenue && currentVenue.venue_id === targetVenueId) {
        setRole(currentVenue.role);
        setIsLoading(false);
        return;
      }

      // Otherwise fetch from database
      const fetchedRole = await getVenueRole(user.id, targetVenueId);
      setRole(fetchedRole);
      setIsLoading(false);
    }

    fetchRole();
  }, [user?.id, targetVenueId, currentVenue]);

  return useMemo(() => ({
    role,
    isLoading,
    canManage: canManageVenue(role),
    canEditSettings: canEditVenueSettings(role),
    canManageStaff: canManageVenueStaff(role),
    canCreateEvents: canCreateVenueEvents(role),
    canDelete: canDeleteVenue(role)
  }), [role, isLoading]);
}

// =============================================================================
// GROUP PERMISSIONS HOOK
// =============================================================================

export interface UseGroupPermissionsResult {
  role: GroupRole;
  isLoading: boolean;
  canManage: boolean;
  canPost: boolean;
  canApprove: boolean;
  canKick: boolean;
  canChangeSettings: boolean;
  canDelete: boolean;
}

export function useGroupPermissions(groupId?: string | null): UseGroupPermissionsResult {
  const { user } = useAuthState();
  const [role, setRole] = useState<GroupRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user?.id || !groupId) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      const fetchedRole = await getGroupRole(user.id, groupId);
      setRole(fetchedRole);
      setIsLoading(false);
    }

    fetchRole();
  }, [user?.id, groupId]);

  return useMemo(() => ({
    role,
    isLoading,
    canManage: canManageGroup(role),
    canPost: canPostInGroup(role),
    canApprove: canApproveMembers(role),
    canKick: canKickMembers(role),
    canChangeSettings: canChangeGroupSettings(role),
    canDelete: canDeleteGroup(role)
  }), [role, isLoading]);
}

// =============================================================================
// EVENT PERMISSIONS HOOK
// =============================================================================

export interface UseEventPermissionsResult {
  isLoading: boolean;
  canManage: boolean;
  canEditScores: boolean;
}

export function useEventPermissions(eventContext?: EventContext | null): UseEventPermissionsResult {
  const { user } = useAuthState();
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkPermissions() {
      if (!user?.id || !eventContext) {
        setCanManage(false);
        setIsLoading(false);
        return;
      }

      const result = await canManageEvent(user.id, eventContext);
      setCanManage(result);
      setIsLoading(false);
    }

    checkPermissions();
  }, [user?.id, eventContext?.hostVenueId, eventContext?.hostGroupId, eventContext?.hostUserId]);

  return useMemo(() => ({
    isLoading,
    canManage,
    canEditScores: canManage
  }), [isLoading, canManage]);
}

// =============================================================================
// MATCH PERMISSIONS HOOK (Synchronous - no async needed)
// =============================================================================

export interface UseMatchPermissionsResult {
  canEdit: boolean;
  canDelete: boolean;
  canVerify: boolean;
  canDispute: boolean;
}

export function useMatchPermissions(
  matchContext: {
    createdBy: string;
    participantIds: string[];
  } | null
): UseMatchPermissionsResult {
  const { user } = useAuthState();

  return useMemo(() => {
    if (!user?.id || !matchContext) {
      return {
        canEdit: false,
        canDelete: false,
        canVerify: false,
        canDispute: false
      };
    }

    const isCreator = matchContext.createdBy === user.id;
    const isParticipant = matchContext.participantIds.includes(user.id);

    return {
      canEdit: isCreator || isParticipant,
      canDelete: isCreator,
      canVerify: isParticipant,
      canDispute: isParticipant
    };
  }, [user?.id, matchContext?.createdBy, matchContext?.participantIds]);
}
