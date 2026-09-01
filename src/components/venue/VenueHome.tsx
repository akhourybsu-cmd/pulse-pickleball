import { ChevronRight, Globe, LayoutGrid, MapPin, Phone } from 'lucide-react';
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

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
      <div className="min-w-0 space-y-7">
        <VenueWelcome headline={welcomeHeadline} message={welcomeMessage} accent={accent} />

        {hasCourts && (
          <button
            type="button"
            onClick={onBook}
            className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-primary/40"
            style={accent ? { borderColor: `${accent}55`, backgroundColor: `${accent}0d` } : undefined}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              style={accent ? { backgroundColor: `${accent}1a`, color: accent } : undefined}
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight">Book a court</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {freeNow > 0 ? `${freeNow} of ${courtCount} free right now` : 'See what is open today'}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {nextUp.length > 0 && (
          <Section title="Coming up">
            <div className="divide-y divide-border/70 border-y border-border/70">
              {nextUp.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={onOpenPlay}
                  className="group flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-muted/30"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    style={accent ? { backgroundColor: accent } : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight">{session.title}</p>
                    {session.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {session.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground/75">
                    {formatSlotTime(new Date(session.start_time))}
                  </span>
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>

      <aside className="mt-8 space-y-5 lg:mt-0 lg:border-l lg:border-border/70 lg:pl-8">
        <Section title="About">
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
              <p className="mb-2 text-[11px] font-semibold text-foreground/80">
                Hours
              </p>
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
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border/60" />
      </div>
      {children}
    </section>
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
