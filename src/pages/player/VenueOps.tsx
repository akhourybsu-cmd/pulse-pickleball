import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Wrench, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useVenueDay } from '@/hooks/useVenueDay';
import { venueChrome } from '@/lib/venues/branding';
import { DEFAULT_GRID, formatSlotTime } from '@/lib/venues/availability';
import { courtStatuses, daySummary, formatDuration, upcomingGaps } from '@/lib/venues/ops';
import { CourtStatusBoard } from '@/components/venue/ops/CourtStatusBoard';
import { OpsStatRail } from '@/components/venue/ops/OpsStatRail';
import { CloseCourtDialog } from '@/components/venue/ops/CloseCourtDialog';
import { SessionSheet } from '@/components/venue/ops/SessionSheet';
import { VenueBookingGrid } from '@/components/venue/VenueBookingGrid';
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

  const { courts, sessions, grid, loading: dayLoading, refresh } = useVenueDay(
    group?.venue_id,
    groupId,
    day,
    DEFAULT_GRID,
  );

  const isStaff = membership?.role === 'owner' || membership?.role === 'moderator';

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
    if (!loading && group && !isStaff) {
      navigate(`/player/community/group/${groupId}`, { replace: true });
    }
  }, [loading, group, isStaff, groupId, navigate]);

  if (loading || !group || !isStaff) {
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
    <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 pb-3 pt-[calc(0.6rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1 h-9 w-9 shrink-0 rounded-full"
            onClick={() => navigate(`/player/community/group/${groupId}`)}
            aria-label="Back to venue"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Operations
            </p>
            <h1 className="truncate text-lg font-bold leading-tight">
              {venue?.name ?? group.name}
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => {
              setCloseCourtId(null);
              setCloseOpen(true);
            }}
          >
            <Wrench className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Close court</span>
          </Button>
        </div>
      </header>

      <div className="space-y-6 p-4">
        <section className="space-y-2.5">
          <SectionHeading
            title={isToday ? 'On the floor' : 'Courts'}
            hint={
              isToday
                ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                : day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
            }
          />
          {dayLoading ? (
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[104px] rounded-xl" />
              ))}
            </div>
          ) : (
            <CourtStatusBoard
              statuses={statuses}
              accent={chrome?.accentHex}
              onPickCourt={(courtId) => {
                const status = statuses.find((s) => s.court.id === courtId);
                // Tapping a live court goes to what's on it; tapping a free one
                // is a request to put something there.
                if (status?.current) {
                  setSessionId(status.current.id);
                } else {
                  const nextSlot = grid
                    .find((c) => c.court.id === courtId)
                    ?.slots.find((s) => s.bookable);
                  if (nextSlot) {
                    setBookCourtId(courtId);
                    setBookStart(nextSlot.start);
                  }
                }
              }}
            />
          )}
        </section>

        <section className="space-y-2.5">
          <SectionHeading title="The day" />
          <OpsStatRail summary={summary} accent={chrome?.accentHex} />
        </section>

        {gaps.length > 0 && (
          <section className="space-y-2.5">
            <SectionHeading
              title="Sellable gaps"
              hint={`${formatDuration(summary.openMinutes)} open`}
            />
            <p className="text-xs text-muted-foreground">
              The longest unbooked stretches left today. Tap one to put something in it.
            </p>
            <div className="space-y-1.5">
              {gaps.map((gap) => (
                <button
                  key={`${gap.court.id}-${gap.start.toISOString()}`}
                  type="button"
                  onClick={() => {
                    setBookCourtId(gap.court.id);
                    setBookStart(gap.start);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40"
                >
                  <Sparkles
                    className="h-4 w-4 shrink-0 text-primary"
                    style={chrome?.accentHex ? { color: chrome.accentHex } : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {gap.court.name ?? `Court ${gap.court.court_number}`}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatSlotTime(gap.start)}–{formatSlotTime(gap.end)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {formatDuration(gap.minutes)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2.5">
          <SectionHeading title="Schedule" />
          <VenueBookingGrid
            grid={grid}
            day={day}
            loading={dayLoading}
            canBook
            accent={chrome?.accentHex}
            onDayChange={setDay}
            onPickSlot={(courtId, start, minutes) => {
              setBookCourtId(courtId);
              setBookStart(start);
              setBookMinutes(minutes || null);
            }}
            onPickSession={setSessionId}
          />
        </section>
      </div>

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
            slotMinutes={DEFAULT_GRID.slotMinutes}
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
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      {hint && <span className="text-xs tabular-nums text-muted-foreground">{hint}</span>}
    </div>
  );
}
