import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, CalendarClock, CalendarDays, LayoutGrid,
  MapPin, MessageSquare, MoreHorizontal, Settings, Users, Globe, Phone, Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useVenueDay } from '@/hooks/useVenueDay';
import { venueChrome } from '@/lib/venues/branding';
import { DEFAULT_GRID, formatSlotTime } from '@/lib/venues/availability';
import { VenueBookingGrid } from '@/components/venue/VenueBookingGrid';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
import { DayStrip } from '@/components/venue/DayStrip';
import { BookCourtDialog } from '@/components/venue/BookCourtDialog';
import { VenueWelcome } from '@/components/community/VenueWelcome';
import { GroupFeed } from '@/components/community/GroupFeed';
import { GroupMembers } from '@/components/community/GroupMembers';

/**
 * A venue's community.
 *
 * Deliberately NOT the standard community page. A community is a conversation
 * with a schedule attached; a venue is a facility you book, whose conversation
 * is secondary. So this leads with the things a court-reservation app leads
 * with — what's free right now, what's on today, book a court — and keeps the
 * feed and members behind them.
 *
 * Everything underneath is shared: sessions are `group_events`, posts are
 * `group_posts`, members are `group_members`. The venue layer is identity and
 * arrangement, never a second data model. The staff dashboard that will sit
 * alongside this reads the same `useVenueDay` hook, so the two can never
 * disagree about what is happening at the venue.
 */

export default function VenueCommunity() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const { group, membership, loading } = useGroupDetail(groupId);
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [bookingCourtId, setBookingCourtId] = useState<string | null>(null);
  const [bookingStart, setBookingStart] = useState<Date | null>(null);
  const [bookingMinutes, setBookingMinutes] = useState<number | null>(null);

  const venue = group?.venue ?? null;
  const chrome = useMemo(() => venueChrome(venue), [venue]);

  const { courts, programming, going, grid, freeNow, loading: dayLoading, refresh, hasCourts } =
    useVenueDay(group?.venue_id, groupId, day, DEFAULT_GRID);

  const isMember = membership?.status === 'active';
  const isAdmin = membership?.role === 'owner' || membership?.role === 'moderator';
  // Members may book unless the group has turned member-created events off —
  // the same setting that gates every other kind of session, so a venue has one
  // switch to think about rather than two.
  const canBook =
    isMember &&
    (isAdmin ||
      (group?.settings as Record<string, unknown> | null)?.allow_member_events !== false);

  if (loading || !group) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const bookingCourt = courts.find((c) => c.id === bookingCourtId) ?? null;
  const dayEnd = grid[0]?.slots[grid[0].slots.length - 1]?.end ?? null;

  const nextUp = programming
    .filter((p) => new Date(p.start_time) >= new Date())
    .slice(0, 3);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Venue hero — a facility masthead, not the community's ink band. The
          cover carries the identity, the stats carry the answer most people
          arrived for. */}
      <header className="relative shrink-0 overflow-hidden">
        <div
          className="relative h-40 sm:h-52"
          style={{
            backgroundImage: venue?.cover_image_url
              ? `url(${venue.cover_image_url})`
              : chrome?.backgroundImage ??
                'linear-gradient(158deg, hsl(var(--ink-700)) 0%, hsl(var(--ink-900)) 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Scrim so white text survives any cover photo. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.12) 100%)',
            }}
          />

          <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[calc(0.6rem+env(safe-area-inset-top))]">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 hover:text-white"
              onClick={() => navigate('/player/community')}
              aria-label="Back to Community"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="ml-auto flex items-center gap-1.5">
              {isAdmin && (
                <>
                  {/* Operations is the staff surface: same data as this page,
                      more authority over it. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 hover:text-white"
                    onClick={() => navigate(`/player/community/group/${groupId}/ops`)}
                    aria-label="Venue operations"
                  >
                    <Gauge className="h-[18px] w-[18px]" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 hover:text-white"
                    onClick={() => navigate(`/player/community/group/${groupId}/manage`)}
                    aria-label="Venue settings"
                  >
                    <Settings className="h-[18px] w-[18px]" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-3">
            {venue?.logo_url && (
              <img
                src={venue.logo_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover ring-2 ring-white/25"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-xl font-bold leading-tight text-white sm:text-2xl">
                  {venue?.name ?? group.name}
                </h1>
                {group.is_venue_verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-amber-400" aria-label="Verified venue" />
                )}
              </div>
              {venue?.tagline && (
                <p className="truncate text-xs text-white/80">{venue.tagline}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stat strip — the court-reservation answer, above everything else. */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2.5">
          <Stat
            icon={LayoutGrid}
            label={hasCourts ? `${freeNow} of ${courts.length} free` : 'No courts yet'}
            accent={chrome?.accentHex}
          />
          <Stat icon={Users} label={`${group.member_count ?? 0} members`} />
          {nextUp[0] && (
            <Stat
              icon={CalendarClock}
              label={`Next: ${formatSlotTime(new Date(nextUp[0].start_time))}`}
            />
          )}
        </div>
      </header>

      <Tabs defaultValue={hasCourts ? 'book' : 'home'} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-card p-1">
          <VenueTab value="home" icon={MapPin}>Home</VenueTab>
          {hasCourts && <VenueTab value="book" icon={LayoutGrid}>Book</VenueTab>}
          <VenueTab value="play" icon={CalendarDays}>Play</VenueTab>
          <VenueTab value="feed" icon={MessageSquare}>Feed</VenueTab>
          <VenueTab value="more" icon={MoreHorizontal}>More</VenueTab>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="home" className="mt-0 space-y-4">
            <VenueWelcome
              headline={venue?.welcome_headline ?? null}
              message={venue?.welcome_message ?? null}
              accent={chrome?.accentHex ?? null}
            />

            {nextUp.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Coming up
                </h2>
                {nextUp.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{p.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatSlotTime(new Date(p.start_time))}
                      </span>
                    </div>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                ))}
              </section>
            )}

            {(venue?.city || venue?.phone || venue?.website_url) && (
              <section className="space-y-1.5 rounded-xl border border-border bg-card p-3">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  About
                </h2>
                {venue.city && (
                  <ContactRow icon={MapPin}>
                    {[venue.city, venue.state].filter(Boolean).join(', ')}
                  </ContactRow>
                )}
                {venue.phone && <ContactRow icon={Phone}>{venue.phone}</ContactRow>}
                {venue.website_url && (
                  <ContactRow icon={Globe}>
                    <a
                      href={venue.website_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline underline-offset-2"
                    >
                      {venue.website_url.replace(/^https?:\/\//, '')}
                    </a>
                  </ContactRow>
                )}
              </section>
            )}
          </TabsContent>

          {hasCourts && (
            <TabsContent value="book" className="mt-0">
              <VenueBookingGrid
                grid={grid}
                day={day}
                loading={dayLoading}
                canBook={canBook}
                accent={chrome?.accentHex}
                onDayChange={setDay}
                onPickSlot={(courtId, start, minutes) => {
                  setBookingCourtId(courtId);
                  setBookingStart(start);
                  setBookingMinutes(minutes || null);
                }}
              />
            </TabsContent>
          )}

          <TabsContent value="play" className="mt-0 space-y-3">
            {/* Same day model as Book, so moving between the two tabs keeps
                the viewer on the day they were already looking at. */}
            <DayStrip value={day} onChange={setDay} accent={chrome?.accentHex} />
            <VenueProgramming
              sessions={programming}
              going={going}
              loading={dayLoading}
              venueName={venue?.name ?? null}
              accent={chrome?.accentHex}
            />
          </TabsContent>

          <TabsContent value="feed" className="mt-0">
            <GroupFeed
              groupId={groupId!}
              groupName={venue?.name ?? group.name}
              isAdmin={isAdmin}
              currentUserId={membership?.user_id ?? null}
            />
          </TabsContent>

          <TabsContent value="more" className="mt-0 space-y-4">
            <GroupMembers groupId={groupId!} isAdmin={isAdmin} currentUserId={membership?.user_id ?? null} />
          </TabsContent>
        </div>
      </Tabs>

      {group.venue_id && (
        <BookCourtDialog
          open={!!bookingCourtId && !!bookingStart}
          onOpenChange={(o) => {
            if (!o) {
              setBookingCourtId(null);
              setBookingStart(null);
              setBookingMinutes(null);
            }
          }}
          groupId={groupId!}
          venueId={group.venue_id}
          court={bookingCourt}
          start={bookingStart}
          slotMinutes={DEFAULT_GRID.slotMinutes}
          presetMinutes={bookingMinutes}
          dayEnd={dayEnd}
          onBooked={refresh}
        />
      )}
    </div>
  );
}

function VenueTab({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </TabsTrigger>
  );
}

function Stat({
  icon: Icon,
  label,
  accent,
}: {
  icon: typeof MapPin;
  label: string;
  accent?: string | null;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold')}
      style={accent ? { borderColor: `${accent}55`, color: accent } : undefined}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

function ContactRow({
  icon: Icon,
  children,
}: {
  icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}
