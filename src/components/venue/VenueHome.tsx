import { ArrowUpRight, CalendarDays, ChevronRight, Clock3, Globe, LayoutGrid, Mail, MapPin, Phone, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSlotTime } from '@/lib/venues/availability';
import { DAY_NAMES, describeDay, type VenueHours } from '@/lib/venues/hours';
import { VenueWelcome } from '@/components/community/VenueWelcome';
import { Skeleton } from '@/components/ui/skeleton';
import { VenueLoadState } from './VenueLoadState';
import { programDateLabel, venueWebsiteLink } from '@/lib/venues/programExperience';
import type { VenueService } from '@/lib/venues/servicePresentation';

/**
 * A venue's front page.
 *
 * Presentational, so it can be rendered in the design harness — the layout
 * problems on a page like this (a contact list stretched across 1400px, a
 * single column of equally-weighted cards) only show up on screen.
 *
 * Two columns on a laptop: what is happening reads down the main column, while
 * the venue's own details sit in a rail. On a phone the rail falls underneath,
 * which is the order of attention there anyway.
 */

export interface VenueHomeSession {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
}

interface VenueHomeProps {
  welcomeHeadline: string | null;
  welcomeMessage: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  websiteUrl: string | null;
  email?: string | null;
  hours: VenueHours;
  nextUp: VenueHomeSession[];
  hasCourts: boolean;
  freeNow: number | null;
  courtCount: number;
  accent?: string | null;
  onBook: () => void;
  onOpenPlay: () => void;
  onBookings?: () => void;
  onPickProgram?: (id: string) => void;
  loadingPrograms?: boolean;
  programsUnavailable?: boolean;
  onRetryPrograms?: () => void;
}

export function VenueHome({
  welcomeHeadline,
  welcomeMessage,
  city,
  state,
  phone,
  websiteUrl,
  email,
  hours,
  nextUp,
  hasCourts,
  freeNow,
  courtCount,
  accent,
  onBook,
  onOpenPlay,
  onBookings,
  onPickProgram,
  loadingPrograms = false,
  programsUnavailable = false,
  onRetryPrograms,
}: VenueHomeProps) {
  const today = new Date().getDay();
  const nextSession = nextUp[0];
  const website = venueWebsiteLink(websiteUrl);
  const phoneNumber = phone?.replace(/[^\d+]/g, '');

  return (
    <div className="min-[1280px]:grid min-[1280px]:grid-cols-[minmax(0,1fr)_280px] min-[1280px]:items-start min-[1280px]:gap-6">
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <VenueWelcome headline={welcomeHeadline} message={welcomeMessage} accent={accent} />

        <section aria-label="Plan your visit" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Plan your visit</h2><span className="text-xs text-muted-foreground">Your next game starts here</span></div>
        <div className={cn('grid gap-3', hasCourts && 'min-[600px]:grid-cols-2')}>
          {hasCourts && (
            <HomeAction
              icon={LayoutGrid}
              eyebrow="Courts"
              title="Book a court"
              detail={freeNow !== null && freeNow > 0 ? `${freeNow} of ${courtCount} open now` : 'Choose a day and time'}
              service="booking"
              onClick={onBook}
            />
          )}
          <HomeAction
            icon={CalendarDays}
            eyebrow="Programs"
            title="Find a session"
            detail={
              loadingPrograms ? 'Loading the next sessions…' : programsUnavailable ? 'Schedule temporarily unavailable' : nextSession
                ? `${programDateLabel(nextSession.start_time)} · ${formatSlotTime(new Date(nextSession.start_time))}`
                : 'Browse open play and clinics'
            }
            service="programs"
            onClick={onOpenPlay}
          />
        </div>
        {onBookings && <button type="button" onClick={onBookings} data-venue-service="booking" className="venue-interactive flex min-h-12 w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-left">
          <Ticket aria-hidden className="venue-service-label h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 text-sm font-medium">My bookings<span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">Reservations &amp; joined sessions</span></span><ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>}
        </section>

        {programsUnavailable && onRetryPrograms ? <VenueLoadState title="Programs couldn’t load" description="We couldn’t confirm the upcoming schedule. Try again to see the latest sessions." onRetry={onRetryPrograms} /> : loadingPrograms ? <div role="status" aria-label="Loading upcoming programs" className="space-y-2"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></div> : nextUp.length > 0 ? (
          <Section title="Coming up" actionLabel="View schedule" onAction={onOpenPlay}>
            <div className="space-y-2">
              {nextUp.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  data-venue-service="programs"
                  onClick={() => onPickProgram ? onPickProgram(session.id) : onOpenPlay()}
                  className="venue-interactive group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 text-left sm:p-4"
                >
                  <span
                    className="venue-service-icon flex min-h-14 w-[76px] shrink-0 flex-col items-center justify-center rounded-xl px-1 text-center"
                  >
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {programDateLabel(session.start_time)}
                    </span>
                    <span className="mt-0.5 text-xs font-semibold tabular-nums">
                      {formatSlotTime(new Date(session.start_time))}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-sm font-semibold leading-5 tracking-tight">{session.title}</p>
                    {session.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {session.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </Section>
        ) : <div className="rounded-2xl border border-dashed border-border/80 p-5"><p className="text-sm font-semibold">No upcoming programs</p><p className="mt-1 text-sm leading-6 text-muted-foreground">No upcoming programs are listed yet. Check the schedule for court times and future sessions.</p><button type="button" className="mt-2 min-h-11 text-sm font-semibold text-primary" onClick={onOpenPlay}>View schedule</button></div>}
      </div>

      <aside className="mt-6 min-w-0 space-y-5 min-[1280px]:mt-0">
        <section className="overflow-hidden rounded-[20px] border border-border/70 bg-card/65 shadow-[0_14px_42px_-34px_hsl(var(--foreground)/0.5)]">
          <div className="border-b border-border/60 bg-muted/25 px-4 py-3.5">
            <h2 className="text-sm font-bold tracking-tight">Venue details</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Location, contact, and opening hours</p>
          </div>
          <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 min-[1280px]:grid-cols-1">
          <div className="min-w-0 space-y-3">
            {city && (
              <ContactRow icon={MapPin}>{[city, state].filter(Boolean).join(', ')}</ContactRow>
            )}
            {phone && <ContactRow icon={Phone}>{phoneNumber ? <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={`tel:${phoneNumber}`}>{phone}</a> : phone}</ContactRow>}
            {email && <ContactRow icon={Mail}><a className="inline-flex min-h-11 items-center underline underline-offset-4" href={`mailto:${encodeURIComponent(email)}`}>{email}</a></ContactRow>}
            {website && (
              <ContactRow icon={Globe}>
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  {new URL(website).hostname}
                </a>
              </ContactRow>
            )}

          </div>
            <div className="min-w-0 border-t border-border/70 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 min-[1280px]:border-l-0 min-[1280px]:border-t min-[1280px]:pl-0 min-[1280px]:pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                Hours
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5 text-xs lg:hidden">
                <span className="font-semibold">Today</span>
                <span className="font-semibold tabular-nums">{describeDay(hours.days[today])}</span>
              </div>
              <details className="group mt-1.5 lg:hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center text-center text-xs font-semibold text-muted-foreground marker:hidden">
                  <span className="group-open:hidden">Show weekly hours</span>
                  <span className="hidden group-open:inline">Hide weekly hours</span>
                </summary>
                <div className="mt-1 border-t border-border/60 pt-2">
                  {Array.from({ length: 6 }, (_, i) => (today + i + 1) % 7).map((d) => (
                    <HoursRow key={d} day={DAY_NAMES[d]} value={describeDay(hours.days[d])} />
                  ))}
                </div>
              </details>
              <div className="hidden lg:block">
              {/* Today first, so the answer most people came for is the first
                  line rather than buried under Sunday. */}
              {Array.from({ length: 7 }, (_, i) => (today + i) % 7).map((d) => {
                const isToday = d === today;
                return (
                  <div key={d} className="flex justify-between gap-3 py-0.5 text-xs">
                    <span className={isToday ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                      {isToday ? 'Today' : DAY_NAMES[d]}
                    </span>
                    <span
                      className={cn(
                        'tabular-nums',
                        isToday ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {describeDay(hours.days[d])}
                    </span>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="min-w-0 text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border/60" />
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="min-h-11 text-xs font-semibold text-muted-foreground hover:text-foreground">
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function HomeAction({
  icon: Icon,
  eyebrow,
  title,
  detail,
  service,
  onClick,
}: {
  icon: typeof LayoutGrid;
  eyebrow: string;
  title: string;
  detail: string;
  service: VenueService;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-venue-service={service}
      className="venue-service-card venue-interactive group relative flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-left min-[600px]:block min-[600px]:p-5"
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <span
          className="venue-service-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        >
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <ArrowUpRight aria-hidden className="hidden h-4 w-4 text-muted-foreground min-[600px]:block" />
      </div>
      <div className="min-w-0 flex-1 min-[600px]:mt-4"><p className="venue-service-label text-[10px] font-semibold uppercase tracking-[0.12em]">{eyebrow}</p>
      <p className="mt-0.5 text-base font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground min-[600px]:hidden" />
    </button>
  );
}

function HoursRow({ day, value }: { day: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-xs text-muted-foreground">
      <span>{day}</span>
      <span className="tabular-nums">{value}</span>
    </div>
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
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/55" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}
