import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useVenueDay } from '@/hooks/useVenueDay';
import { venueChrome } from '@/lib/venues/branding';
import { parseVenueHours } from '@/lib/venues/hours';
import { useMyVenueRole, canOperateVenue, canManageVenue } from '@/components/venue/VenueStaffContext';
import { courtStatuses, daySummary, upcomingGaps } from '@/lib/venues/ops';
import { OpsDashboard } from '@/components/venue/ops/OpsDashboard';
import { CloseCourtDialog } from '@/components/venue/ops/CloseCourtDialog';
import { SessionSheet } from '@/components/venue/ops/SessionSheet';
import { BookCourtDialog } from '@/components/venue/BookCourtDialog';

/**
 * Venue operations.
 *
 * Reads the same `useVenueDay` as the player-facing venue page, so the two can
 * never disagree about what is happening at the venue. What differs is
 * authority, not information: staff see closed courts, can act on occupied
 * slots, and can take a court out of play.
 *
 * The order of the page is the order of a manager's attention — the floor right
 * now, then the day's shape, then the whole timeline. Built to be usable on a
 * phone while walking the courts, because that is where this job is actually
 * done.
 */
export default function VenueOps() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const { group, membership, loading } = useGroupDetail(groupId);
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // The board is a clock: without this it would silently go stale and show a
  // court as in play twenty minutes after it emptied.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeCourtId, setCloseCourtId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bookCourtId, setBookCourtId] = useState<string | null>(null);
  const [bookStart, setBookStart] = useState<Date | null>(null);
  const [bookMinutes, setBookMinutes] = useState<number | null>(null);

  const venue = group?.venue ?? null;
  const chrome = useMemo(() => venueChrome(venue), [venue]);
  const hours = useMemo(() => parseVenueHours(venue?.hours_of_operation), [venue]);

  const { role: venueRole, loading: roleLoading } = useMyVenueRole(group?.venue_id);

  const { courts, sessions, grid, closed, slotMinutes, loading: dayLoading, refresh } =
    useVenueDay(group?.venue_id, groupId, day, hours);

  // Access is a venue role, not community moderation: a front-desk person can
  // run the day without being handed moderator powers over the conversation.
  // The group owner keeps access as a floor so a venue can never lock itself
  // out of its own operations.
  const isStaff = canOperateVenue(venueRole) || membership?.role === 'owner';

  const statuses = useMemo(() => courtStatuses(courts, sessions, now), [courts, sessions, now]);
  const summary = useMemo(() => daySummary(grid, statuses, now), [grid, statuses, now]);
  const gaps = useMemo(() => upcomingGaps(grid, now, 60).slice(0, 4), [grid, now]);

  const isToday = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return day.getTime() === t.getTime();
  }, [day]);

  // Non-staff must never see the operations view, even by URL.
  useEffect(() => {
    // Wait for the role to resolve, or a staff member is bounced on first paint.
    if (!loading && !roleLoading && group && !isStaff) {
      navigate(`/player/community/group/${groupId}`, { replace: true });
    }
  }, [loading, roleLoading, group, isStaff, groupId, navigate]);

  if (loading || roleLoading || !group || !isStaff) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const selectedSession = sessions.find((s) => s.id === sessionId) ?? null;
  const selectedSessionCourt =
    courts.find((c) => c.id === selectedSession?.venue_court_id) ?? null;
  const bookCourt = courts.find((c) => c.id === bookCourtId) ?? null;
  const dayStart = grid[0]?.slots[0]?.start ?? null;
  const dayEnd = grid[0]?.slots[grid[0].slots.length - 1]?.end ?? null;

  return (
    <>
      <OpsDashboard
        venueName={venue?.name ?? group.name}
        day={day}
        now={now}
        isToday={isToday}
        loading={dayLoading}
        closed={closed}
        statuses={statuses}
        summary={summary}
        gaps={gaps}
        grid={grid}
        accent={chrome?.accentHex}
        canManage={canManageVenue(venueRole) || membership?.role === 'owner'}
        onBack={() => navigate(`/player/community/group/${groupId}`)}
        onSettings={() => navigate(`/player/community/group/${groupId}/manage`)}
        onCloseCourt={() => {
          setCloseCourtId(null);
          setCloseOpen(true);
        }}
        onPickCourt={(courtId) => {
          const status = statuses.find((s) => s.court.id === courtId);
          // Tapping a live court goes to what's on it; tapping a free one is a
          // request to put something there.
          if (status?.current) {
            setSessionId(status.current.id);
          } else {
            const nextSlot = grid.find((c) => c.court.id === courtId)?.slots.find((s) => s.bookable);
            if (nextSlot) {
              setBookCourtId(courtId);
              setBookStart(nextSlot.start);
            }
          }
        }}
        onDayChange={setDay}
        onPickSlot={(courtId, start, minutes) => {
          setBookCourtId(courtId);
          setBookStart(start);
          setBookMinutes(minutes || null);
        }}
        onPickSession={setSessionId}
        onFillGap={(gap) => {
          setBookCourtId(gap.court.id);
          setBookStart(gap.start);
        }}
      />

      {group.venue_id && (
        <>
          <CloseCourtDialog
            open={closeOpen}
            onOpenChange={setCloseOpen}
            groupId={groupId!}
            venueId={group.venue_id}
            court={courts.find((c) => c.id === closeCourtId) ?? null}
            courts={courts}
            dayStart={dayStart}
            dayEnd={dayEnd}
            onClosed={refresh}
          />

          <BookCourtDialog
            open={!!bookCourtId && !!bookStart}
            onOpenChange={(o) => {
              if (!o) {
                setBookCourtId(null);
                setBookStart(null);
                setBookMinutes(null);
              }
            }}
            groupId={groupId!}
            venueId={group.venue_id}
            court={bookCourt}
            start={bookStart}
            slotMinutes={slotMinutes}
            presetMinutes={bookMinutes}
            dayEnd={dayEnd}
            onBooked={refresh}
          />
        </>
      )}

      <SessionSheet
        session={selectedSession}
        court={selectedSessionCourt}
        open={!!selectedSession}
        onOpenChange={(o) => {
          if (!o) setSessionId(null);
        }}
        onChanged={refresh}
      />
    </>
  );
}
