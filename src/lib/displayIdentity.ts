import type { VenueRole, VenueAccess } from '@/contexts/ModeContext';

/**
 * Display Identity Types
 * 
 * Provides a unified way to represent the current user's identity
 * based on the active mode (player or venue).
 */

export interface PlayerIdentity {
  type: 'player';
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface VenueIdentity {
  type: 'venue';
  id: string;
  name: string;
  logoUrl: string | null;
  role: VenueRole;
}

export type DisplayIdentity = PlayerIdentity | VenueIdentity;

/**
 * Create a player identity object
 */
export function createPlayerIdentity(
  userId: string,
  profile: { full_name?: string | null; display_name?: string | null; avatar_url?: string | null } | null
): PlayerIdentity {
  return {
    type: 'player',
    id: userId,
    name: profile?.full_name || profile?.display_name || 'Player',
    avatarUrl: profile?.avatar_url || null,
  };
}

/**
 * Create a venue identity object
 */
export function createVenueIdentity(venue: VenueAccess): VenueIdentity {
  return {
    type: 'venue',
    id: venue.venue_id,
    name: venue.venue_name,
    logoUrl: venue.logo_url,
    role: venue.role,
  };
}

/**
 * Get display name from identity
 */
export function getIdentityDisplayName(identity: DisplayIdentity): string {
  return identity.name;
}

/**
 * Get avatar/logo URL from identity
 */
export function getIdentityAvatarUrl(identity: DisplayIdentity): string | null {
  if (identity.type === 'player') {
    return identity.avatarUrl;
  }
  return identity.logoUrl;
}

/**
 * Get initials from identity name
 */
export function getIdentityInitials(identity: DisplayIdentity): string {
  return identity.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Check if identity is a venue
 */
export function isVenueIdentity(identity: DisplayIdentity): identity is VenueIdentity {
  return identity.type === 'venue';
}

/**
 * Check if identity is a player
 */
export function isPlayerIdentity(identity: DisplayIdentity): identity is PlayerIdentity {
  return identity.type === 'player';
}
