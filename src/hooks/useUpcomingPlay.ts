import { useEffect, useState } from 'react';
import { isFuture } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useMyEventRegistrations } from '@/hooks/useEventRegistrations';

/**
 * Aggregates everything a player has coming up for pickleball play into one
 * list, so the "Play" hub can showcase it above discovery. Two proven sources:
 *
 *   1. Unified-event registrations (open play, clinics, leagues, socials, and
 *      round robins registered through the unified events system) — via the
 *      same useMyEventRegistrations hook the My Events page uses.
 *   2. Round robins the player hosts or actively plays in (round_robin_events
 *      + round_robin_players), which live outside the unified-event
 *      registration table — same query shape as the My Round Robins page.
 *
 * Items are merged and sorted soonest-first. The hook is read-only and degrades
 * to just the event registrations if the round-robin query fails.
 */

export interface UpcomingPlayItem {
  key: string;
  kind: 'event' | 'round_robin';
  title: string;
  subtitle: string;
  date: Date;
  href: string;
  role?: 'host' | 'playing';
}

interface RegistrationRow {
  id: string;
  status: string;
  event?: {
    id: string;
    title: string;
    event_type: string;
    start_time: string;
  } | null;
}

interface RRRow {
  id: string;
  name: string;
  date: string | null;
  status: string;
  voided: boolean | null;
  current_round: number | null;
  num_rounds: number | null;
  organizer_id?: string;
}

const isActiveRR = (status: string) => status === 'draft' || status === 'live';

export function useUpcomingPlay() {
  const { registrations, isLoading: regLoading } = useMyEventRegistrations();
  const [rrItems, setRrItems] = useState<UpcomingPlayItem[]>([]);
  const [rrLoading, setRrLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [hostRes, playRes] = await Promise.all([
          supabase
            .from('round_robin_events')
            .select('id, name, date, status, voided, current_round, num_rounds')
            .eq('organizer_id', user.id)
            .in('status', ['draft', 'live']),
          supabase
            .from('round_robin_players')
            .select(
              `round_robin_events!inner (
                 id, name, date, status, voided, current_round, num_rounds, organizer_id
               )`,
            )
            .eq('player_id', user.id)
            .eq('active', true),
        ]);
        if (cancelled) return;

        const byId = new Map<string, UpcomingPlayItem>();
        const push = (e: RRRow | null | undefined, role: 'host' | 'playing') => {
          if (!e || e.voided || !isActiveRR(e.status) || byId.has(e.id)) return;
          byId.set(e.id, {
            key: `rr-${e.id}`,
            kind: 'round_robin',
            title: e.name,
            subtitle:
              e.status === 'live' && e.current_round
                ? `Round robin · Round ${e.current_round}${e.num_rounds ? ` of ${e.num_rounds}` : ''}`
                : 'Round robin',
            date: e.date ? new Date(e.date) : new Date(),
            href: `/round-robin/${e.id}`,
            role,
          });
        };

        ((hostRes.data as RRRow[] | null) ?? []).forEach((e) => push(e, 'host'));
        ((playRes.data as unknown as Array<{ round_robin_events: RRRow }> | null) ?? []).forEach(
          (p) => push(p.round_robin_events, 'playing'),
        );

        setRrItems(Array.from(byId.values()));
      } catch {
        // Non-fatal: fall back to just event registrations.
        if (!cancelled) setRrItems([]);
      } finally {
        if (!cancelled) setRrLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const eventItems: UpcomingPlayItem[] = ((registrations as RegistrationRow[] | undefined) ?? [])
    .filter((r) => r.event && r.status !== 'cancelled' && isFuture(new Date(r.event.start_time)))
    .map((r) => ({
      key: `ev-${r.id}`,
      kind: 'event' as const,
      title: r.event!.title,
      subtitle: r.event!.event_type.replace(/_/g, ' '),
      date: new Date(r.event!.start_time),
      href: `/events/${r.event!.id}`,
    }));

  const items = [...eventItems, ...rrItems].sort((a, b) => a.date.getTime() - b.date.getTime());

  return { items, loading: regLoading || rrLoading };
}
