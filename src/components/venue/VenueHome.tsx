import { CalendarDays, ChevronRight, Clock3, Globe, LayoutGrid, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSlotTime } from '@/lib/venues/availability';
import { DAY_NAMES, describeDay, type VenueHours } from '@/lib/venues/hours';
import { VenueWelcome } from '@/components/community/VenueWelcome';

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
  hours: VenueHours;
  nextUp: VenueHomeSession[];
  hasCourts: boolean;
  freeNow: number;
  courtCount: number;
  accent?: string | null;
  onBook: () => void;
  onOpenPlay: () => void;
}

export function VenueHome({
  welcomeHeadline,
  welcomeMessage,
  city,
  state,
  phone,
  websiteUrl,
  hours,
  nextUp,
  hasCourts,
  freeNow,
  courtCount,
  accent,
  onBook,
  onOpenPlay,
}: VenueHomeProps) {
  const today = new Date().getDay();
  const nextSession = nextUp[0];

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 xl:gap-10">
      <div className="min-w-0 space-y-6 lg:space-y-8">
        <VenueWelcome headline={welcomeHeadline} message={welcomeMessage} accent={accent} />

        <div className={cn('grid gap-2.5 sm:gap-3', hasCourts && 'grid-cols-2')}>
          {hasCourts && (
            <HomeAction
              icon={LayoutGrid}
              eyebrow="Courts"
              title="Book a court"
              detail={freeNow > 0 ? `${freeNow} of ${courtCount} open now` : 'View today’s availability'}
              accent={accent}
              onClick={onBook}
            />
          )}
          <HomeAction
            icon={CalendarDays}
            eyebrow="Programs"
            title="Find a session"
            detail={
              nextSession
                ? `Next at ${formatSlotTime(new Date(nextSession.start_time))}`
                : 'Browse open play and clinics'
            }
            accent={accent}
            onClick={onOpenPlay}
          />
        </div>

        {nextUp.length > 0 && (
          <Section title="Coming up" actionLabel="View schedule" onAction={onOpenPlay}>
            <div className="space-y-2">
              {nextUp.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={onOpenPlay}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/75 p-3 text-left shadow-[0_10px_28px_-26px_hsl(var(--foreground)/0.55)] transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-primary/35 hover:bg-card sm:p-3.5"
                >
                  <span
                    className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted/60 text-center"
                    style={accent ? { backgroundColor: `${accent}12` } : undefined}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {new Date(session.start_time).toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span className="mt-0.5 text-xs font-extrabold tabular-nums" style={accent ? { color: accent } : undefined}>
                      {formatSlotTime(new Date(session.start_time))}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight">{session.title}</p>
                    {session.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {session.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>

      <aside className="mt-8 space-y-5 lg:mt-0">
        <section className="overflow-hidden rounded-[20px] border border-border/70 bg-card/65 shadow-[0_14px_42px_-34px_hsl(var(--foreground)/0.5)]">
          <div className="border-b border-border/60 bg-muted/25 px-4 py-3.5">
            <h2 className="text-sm font-bold tracking-tight">Venue details</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Location, contact, and opening hours</p>
          </div>
          <div className="space-y-3 p-4">
          <div className="space-y-3">
            {city && (
              <ContactRow icon={MapPin}>{[city, state].filter(Boolean).join(', ')}</ContactRow>
            )}
            {phone && <ContactRow icon={Phone}>{phone}</ContactRow>}
            {websiteUrl && (
              <ContactRow icon={Globe}>
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2"
                >
                  {websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              </ContactRow>
            )}

            <div className="border-t border-border/70 pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                Hours
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5 text-xs lg:hidden">
                <span className="font-semibold">Today</span>
                <span className="font-semibold tabular-nums">{describeDay(hours.days[today])}</span>
              </div>
              <details className="group mt-1.5 lg:hidden">
                <summary className="cursor-pointer list-none py-1 text-center text-[11px] font-semibold text-muted-foreground marker:hidden">
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
        <h2 className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border/60" />
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="text-[11px] font-bold text-muted-foreground hover:text-foreground">
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
  accent,
  onClick,
}: {
  icon: typeof LayoutGrid;
  eyebrow: string;
  title: string;
  detail: string;
  accent?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-[18px] border border-border/75 bg-card p-3 text-left shadow-[0_12px_34px_-28px_hsl(var(--foreground)/0.6)] transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/40 sm:p-4"
      style={accent ? { borderColor: `${accent}42`, background: `linear-gradient(145deg, ${accent}10, hsl(var(--card)) 62%)` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          style={accent ? { backgroundColor: `${accent}18`, color: accent } : undefined}
        >
          <Icon className="h-4 w-4" />
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.17em] text-muted-foreground">{eyebrow}</p>
      <p className="mt-0.5 truncate text-sm font-bold tracking-tight">{title}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">{detail}</p>
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
      <span className="truncate">{children}</span>
    </div>
  );
}
