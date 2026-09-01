import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Who works at this venue.
 *
 * Staff identity has to reach deep into shared components — an individual post
 * card, a single chat bubble — that know nothing about venues and are used by
 * every ordinary community too. Threading a prop down through the feed, the
 * post list, the card and the header would touch a lot of generic code for one
 * venue feature.
 *
 * So it is context. Outside a provider `useStaffBadge` returns null, which
 * means non-venue communities render exactly as they always did with no
 * conditional at the call site.
 *
 * Roles come from `venue_staff`, not from group moderator status. A front desk
 * person should be able to speak for the venue without being handed moderation
 * powers over the community, and the venue owner should not have to remember to
 * keep two lists in sync.
 */

export type VenueRole = 'owner' | 'manager' | 'organizer' | 'staff';

export interface StaffBadge {
  role: VenueRole;
  /** What the badge says. */
  label: string;
}

interface VenueStaffValue {
  byUser: Map<string, VenueRole>;
  venueName: string | null;
  accent: string | null;
}

const VenueStaffContext = createContext<VenueStaffValue | null>(null);

/**
 * Deliberately generic wording. "Owner" and "Manager" are worth distinguishing
 * because they signal authority; an organizer or front-desk staffer just needs
 * to read as "this is the venue talking", so both say Staff.
 */
const ROLE_LABEL: Record<VenueRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  organizer: 'Staff',
  staff: 'Staff',
};

const ROLE_RANK: Record<VenueRole, number> = {
  owner: 4,
  manager: 3,
  organizer: 2,
  staff: 1,
};

export function VenueStaffProvider({
  venueId,
  venueName,
  accent,
  children,
}: {
  venueId: string | null | undefined;
  venueName?: string | null;
  accent?: string | null;
  children: ReactNode;
}) {
  const { data } = useQuery({
    queryKey: ['venue-staff', venueId],
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // The view exposes identity and role only; who invited whom stays
      // between managers.
      const { data: rows, error } = await supabase
        .from('venue_staff_public')
        .select('user_id, role')
        .eq('venue_id', venueId!);

      if (error) throw error;
      return rows ?? [];
    },
  });

  const value = useMemo<VenueStaffValue>(() => {
    const byUser = new Map<string, VenueRole>();

    for (const row of data ?? []) {
      const userId = (row as { user_id: string | null }).user_id;
      const role = (row as { role: string | null }).role as VenueRole | null;
      if (!userId || !role || !(role in ROLE_RANK)) continue;

      // Someone can hold more than one staff row; show the strongest.
      const existing = byUser.get(userId);
      if (!existing || ROLE_RANK[role] > ROLE_RANK[existing]) {
        byUser.set(userId, role);
      }
    }

    return { byUser, venueName: venueName ?? null, accent: accent ?? null };
  }, [data, venueName, accent]);

  return <VenueStaffContext.Provider value={value}>{children}</VenueStaffContext.Provider>;
}

/** The badge for a user, or null when they aren't staff — or aren't in a venue. */
export function useStaffBadge(userId: string | null | undefined): StaffBadge | null {
  const context = useContext(VenueStaffContext);
  if (!context || !userId) return null;

  const role = context.byUser.get(userId);
  if (!role) return null;

  return { role, label: ROLE_LABEL[role] };
}

/** The venue accent, for tinting badges. Null outside a venue. */
export function useVenueStaffAccent(): string | null {
  return useContext(VenueStaffContext)?.accent ?? null;
}

/**
 * The signed-in user's own role at a venue, independent of any provider.
 *
 * This is what gates the operations dashboard. It reads `venue_staff` rather
 * than group moderator status on purpose: running the courts and moderating the
 * conversation are different jobs, and a venue should be able to give the front
 * desk the first without handing over the second.
 */
export function useMyVenueRole(venueId: string | null | undefined): {
  role: VenueRole | null;
  loading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['my-venue-role', venueId],
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: rows, error } = await supabase
        .from('venue_staff_public')
        .select('role')
        .eq('venue_id', venueId!)
        .eq('user_id', user.id);

      if (error) throw error;

      // Strongest role wins if somehow there are several.
      return (rows ?? []).reduce<VenueRole | null>((best, row) => {
        const role = (row as { role: string | null }).role as VenueRole | null;
        if (!role || !(role in ROLE_RANK)) return best;
        return !best || ROLE_RANK[role] > ROLE_RANK[best] ? role : best;
      }, null);
    },
  });

  return { role: data ?? null, loading: isLoading };
}

/** Roles allowed to run the venue's day. Organizers schedule; staff work it. */
export function canOperateVenue(role: VenueRole | null): boolean {
  return role === 'owner' || role === 'manager' || role === 'staff' || role === 'organizer';
}

/** Roles allowed to change the venue's identity and courts. */
export function canManageVenue(role: VenueRole | null): boolean {
  return role === 'owner' || role === 'manager';
}
