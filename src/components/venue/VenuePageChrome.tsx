import { Fragment, useEffect, useRef } from 'react';
import { venueTabService } from '@/lib/venues/servicePresentation';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Gauge,
  LayoutGrid,
  MapPin,
  MessageCircle,
  MessageSquare,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatSlotTime } from '@/lib/venues/availability';
import { programDateLabel } from '@/lib/venues/programExperience';
import { VenueBrandMark } from './VenueBrandMark';
import { VenueCoverImage } from './VenueCoverImage';
import { describeDay, type VenueHours } from '@/lib/venues/hours';
import type { VenueHomeSession } from '@/components/venue/VenueHome';

export type VenuePageTab = 'home' | 'book' | 'play' | 'feed' | 'chat' | 'more' | 'events';

const NAV_ITEMS: Array<{
  value: VenuePageTab;
  label: string;
  mobileLabel: string;
  icon: typeof MapPin;
  needsCourts?: boolean;
  needsChat?: boolean;
}> = [
  { value: 'home', label: 'Venue home', mobileLabel: 'Home', icon: MapPin },
  { value: 'book', label: 'Book a court', mobileLabel: 'Book', icon: LayoutGrid, needsCourts: true },
  { value: 'play', label: 'Programs & play', mobileLabel: 'Play', icon: CalendarDays },
  { value: 'events', label: 'Events & schedule', mobileLabel: 'Events', icon: CalendarClock },
  { value: 'feed', label: 'Venue updates', mobileLabel: 'Feed', icon: MessageSquare },
  { value: 'chat', label: 'Venue chat', mobileLabel: 'Chat', icon: MessageCircle, needsChat: true },
  { value: 'more', label: 'Venue info', mobileLabel: 'Info', icon: Building2 },
];

interface VenueMastheadProps {
  venueName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  logoImageFit?: 'cover' | 'contain' | null;
  coverImageFit?: 'cover' | 'contain' | null;
  logoShape?: 'circle' | 'square' | null;
  coverFocalPoint?: 'top' | 'center' | null;
  fallbackBackground?: string | null;
  bloom?: string | null;
  accent?: string | null;
  verified?: boolean;
  hasCourts: boolean;
  freeNow: number | null;
  courtCount: number;
  memberCount: number;
  nextStart?: string | null;
  isOperator: boolean;
  isAdmin: boolean;
  onBack: () => void;
  onOperations: () => void;
  onSettings: () => void;
}

/** A shallow club cover and separate identity keep desktop activity above the fold. */
export function VenueMasthead({
  venueName,
  tagline,
  logoUrl,
  coverImageUrl,
  logoImageFit = 'contain',
  coverImageFit = 'cover',
  logoShape = 'square',
  coverFocalPoint = 'center',
  fallbackBackground,
  bloom,
  accent,
  verified = false,
  hasCourts,
  freeNow,
  courtCount,
  memberCount,
  nextStart,
  isOperator,
  isAdmin,
  onBack,
  onOperations,
  onSettings,
}: VenueMastheadProps) {
  const fullPhoto = !!coverImageUrl && coverImageFit === 'contain';
  const identity = (
          <div className="relative flex min-w-0 items-center gap-3 bg-card px-4 py-3 sm:px-6" data-testid="venue-desktop-identity">
            <VenueBrandMark name={venueName} logoUrl={logoUrl} logoShape={logoShape} logoImageFit={logoImageFit} className="h-12 w-12 bg-muted text-[48px] text-foreground ring-1 ring-border/70" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 title={venueName} className="truncate font-sans text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground">
                  {venueName}
                </h1>
                {verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Verified venue" />
                )}
              </div>
              {tagline && (
                <p className="mt-1 max-w-2xl truncate text-sm text-muted-foreground">
                  {tagline}
                </p>
              )}
            </div>
          </div>
  );
  return (
    <header className="relative shrink-0 lg:bg-muted/[0.16] lg:px-6 lg:pt-4" data-testid="venue-desktop-header">
      <div className="lg:mx-auto lg:max-w-[1480px] lg:overflow-hidden lg:rounded-[20px] lg:border lg:border-border/70 lg:bg-card lg:shadow-[0_12px_36px_-30px_hsl(var(--foreground)/0.35)]">
        <div
          className="relative isolate h-24 overflow-hidden xl:h-28"
          data-testid="venue-desktop-cover"
          style={{
            backgroundImage: coverImageUrl ? undefined : fallbackBackground ??
                'linear-gradient(158deg, hsl(var(--ink-700)) 0%, hsl(var(--ink-900)) 100%)',
            // A deliberate dark matte keeps `contain` covers looking finished
            // instead of exposing the page background around the image.
            backgroundColor: '#171a1f',
          }}
        >
          <VenueCoverImage src={coverImageUrl} fit={coverImageFit} focalPoint={coverFocalPoint} alt={`${venueName} banner`} />
          {!fullPhoto && <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(8,19,34,0.32), rgba(8,19,34,0.08))',
            }}
          />}
          {!fullPhoto && bloom && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 78% 18%, ${bloom} 0%, transparent 34%)` }}
            />
          )}

          <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[calc(0.6rem+env(safe-area-inset-top))] lg:px-6 lg:pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 min-w-11 rounded-full border border-white/20 bg-[#081322]/70 px-2.5 text-white backdrop-blur-md hover:bg-[#081322]/90 hover:text-white focus-visible:ring-white lg:px-3.5"
              onClick={onBack}
              aria-label="Back to Community"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden text-xs font-semibold lg:inline">Community</span>
            </Button>

            <div className="ml-auto flex items-center gap-2">
              {isOperator && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 min-w-11 rounded-full border border-white/20 bg-[#081322]/70 px-2.5 text-white backdrop-blur-md hover:bg-[#081322]/90 hover:text-white focus-visible:ring-white lg:px-3.5"
                  onClick={onOperations}
                  aria-label="Venue operations"
                >
                  <Gauge className="h-4 w-4" />
                  <span className="hidden text-xs font-semibold lg:inline">Operations</span>
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 min-w-11 rounded-full border border-white/20 bg-[#081322]/70 px-2.5 text-white backdrop-blur-md hover:bg-[#081322]/90 hover:text-white focus-visible:ring-white lg:px-3.5"
                  onClick={onSettings}
                  aria-label="Manage venue"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden text-xs font-semibold lg:inline">Manage venue</span>
                </Button>
              )}
            </div>
          </div>

        </div>

        {identity}

        <div className="border-b border-border/70 bg-card lg:border-b-0">
          <div
            className="grid w-full px-3 py-2.5 sm:px-6 lg:flex lg:flex-wrap lg:items-center lg:gap-y-2"
            style={{ gridTemplateColumns: `repeat(${nextStart ? 3 : 2}, minmax(0, 1fr))` }}
          >
            <MastheadStat
              icon={LayoutGrid}
              label={hasCourts ? freeNow === null ? 'View court availability' : `${freeNow} of ${courtCount} courts free` : 'Venue community'}
              mobileLabel={hasCourts ? freeNow === null ? 'Court times' : `${freeNow} / ${courtCount} courts` : 'Community'}
              accent={accent}
            />
            <MastheadStat icon={Users} label={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`} mobileLabel={String(memberCount)} />
            {nextStart && (
              <MastheadStat
                icon={CalendarClock}
                label={`Next program: ${programDateLabel(nextStart)} · ${formatSlotTime(new Date(nextStart))}`}
                mobileLabel={formatSlotTime(new Date(nextStart))}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Stable venue sections; chat keeps Community selected and booking retains a return path. */
export function VenueMobileTabs({ activeTab, hasCourts = false, onOpenCommunity }: { hasCourts?: boolean; chatEnabled?: boolean; activeTab?: VenuePageTab; onOpenCommunity?: () => void }) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = scroll.current;
    const active = strip?.querySelector<HTMLElement>('[data-state="active"]');
    if (!strip || !active) return;
    const item = active.getBoundingClientRect(), frame = strip.getBoundingClientRect();
    if (item.right > frame.right) strip.scrollLeft += item.right - frame.right + 16;
    else if (item.left < frame.left) strip.scrollLeft -= frame.left - item.left + 16;
  }, [activeTab]);
  const sections = [
    ['home', 'Overview'], ...(hasCourts ? [['book', 'Book']] : []), ['play', 'Play'],
    [activeTab === 'chat' ? 'chat' : 'feed', 'Community'], ['events', 'Events'], ['more', 'About'],
  ];
  return <div className="shrink-0 border-b border-border/70 bg-background lg:hidden" data-testid="venue-mobile-nav">
    <div ref={scroll} className="club-mobile-tabs px-4">
      <TabsList aria-label="Venue sections" className="flex h-auto w-max min-w-full justify-between gap-4 rounded-none bg-transparent p-0">
        {sections.map(([value,label]) => <TabsTrigger key={label} value={value} className="club-tab" onClick={value === 'chat' ? onOpenCommunity : undefined}>{label}</TabsTrigger>)}
      </TabsList>
    </div>
  </div>;
}

/** Desktop navigation uses the left edge for orientation instead of another top bar. */
export function VenueDesktopNavigation({
  hasCourts,
  chatEnabled = true,
  isOperator,
  isAdmin,
  onOperations,
  onSettings,
}: {
  hasCourts: boolean;
  chatEnabled?: boolean;
  isOperator: boolean;
  isAdmin: boolean;
  onOperations: () => void;
  onSettings: () => void;
}) {
  return (
    <aside className="hidden self-stretch lg:block" data-testid="venue-desktop-nav">
      <div className="sticky top-6 max-h-[calc(100dvh-3rem)] space-y-4 overflow-y-auto p-1">
        <div className="rounded-[20px] border border-border/65 bg-card/60 p-2 shadow-[0_14px_40px_-34px_hsl(var(--foreground)/0.55)] backdrop-blur-sm">
          <p className="mb-1 px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Plan your visit
          </p>
          <TabsList aria-label="Venue sections" className="flex h-auto w-full flex-col items-stretch gap-1 rounded-none bg-transparent p-0">
            {NAV_ITEMS.filter(
              (item) => (!item.needsCourts || hasCourts) && (!item.needsChat || chatEnabled),
            ).map((item) => (
              <Fragment key={item.value}>{item.value === 'feed' && <span className="mb-1 mt-3 border-t border-border/60 px-2.5 pt-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Community</span>}<DesktopTab {...item} /></Fragment>
            ))}
          </TabsList>
        </div>

        {(isOperator || isAdmin) && (
          <div data-venue-service="operations" className="venue-service-card rounded-[20px] border p-2">
            <p className="mb-1 px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Staff
            </p>
            {isOperator && <button
              type="button"
              onClick={onOperations}
              className="venue-interactive flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-background/80"
            >
              <Gauge className="venue-service-label h-4 w-4 shrink-0" />
              Operations
            </button>}
            {isAdmin && (
              <button
                type="button"
                onClick={onSettings}
                className="venue-interactive flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-background/80"
              >
                <Settings className="venue-service-label h-4 w-4 shrink-0" />
                Manage venue
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

interface VenueDesktopRailProps {
  venueName: string;
  activeTab: VenuePageTab;
  hasCourts: boolean;
  freeNow: number | null;
  courtCount: number;
  memberCount: number;
  onlineCount: number;
  chatEnabled?: boolean;
  nextUp: VenueHomeSession[];
  hours: VenueHours;
  accent?: string | null;
  onOpenTab: (tab: VenuePageTab) => void;
  onBookings: () => void;
  onPickProgram?: (id: string) => void;
}

/** Context, not filler: this rail answers what is happening while the center stays readable. */
export function VenueDesktopRail({
  venueName,
  activeTab,
  hasCourts,
  freeNow,
  courtCount,
  memberCount,
  onlineCount,
  chatEnabled = true,
  nextUp,
  hours,
  accent,
  onOpenTab,
  onBookings,
  onPickProgram,
}: VenueDesktopRailProps) {
  const today = new Date().getDay();
  const next = nextUp[0];

  return (
    <aside className="hidden self-stretch min-[1280px]:block">
      <div className="sticky top-6 space-y-4">
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_12px_36px_-28px_hsl(var(--foreground)/0.35)]">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Today at {venueName}
              </p>
              {freeNow !== null && <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>}
            </div>

            {hasCourts && freeNow !== null ? (
              <div className="mt-4">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-[-0.06em] text-foreground">{freeNow}</span>
                  <span className="pb-1 text-sm font-medium text-muted-foreground">
                    of {courtCount} courts free
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${courtCount ? (freeNow / courtCount) * 100 : 0}%`,
                      ...(accent ? { backgroundColor: accent } : {}),
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm font-medium">{hasCourts ? 'Open court booking to check a date and time.' : 'Your venue community, all in one place.'}</p>
            )}

            <div className="mt-4 space-y-2 border-t border-border/70 pt-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Hours today</span>
                <span className="font-semibold tabular-nums">{describeDay(hours.days[today])}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Community</span>
                <span className="font-semibold tabular-nums">
                  {onlineCount > 0 ? `${onlineCount} online · ` : ''}{memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </div>

          {next && (
            <button
              type="button"
              onClick={() => onPickProgram ? onPickProgram(next.id) : onOpenTab('play')}
              className="flex w-full items-center gap-3 border-t border-border/70 bg-muted/25 px-5 py-3.5 text-left transition-colors hover:bg-muted/45"
            >
              <CalendarClock className="h-4 w-4 shrink-0 text-primary" style={accent ? { color: accent } : undefined} />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Next up</span>
                <span className="mt-0.5 block line-clamp-2 break-words text-sm font-semibold">{next.title}</span>
              </span>
              <span className="shrink-0 text-right text-xs font-semibold tabular-nums"><span className="mb-1 block text-[10px] text-muted-foreground">{programDateLabel(next.start_time)}</span>{formatSlotTime(new Date(next.start_time))}</span>
            </button>
          )}
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-3">
          <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Quick links
          </p>
          {hasCourts && activeTab !== 'book' && (
            <RailAction icon={LayoutGrid} label="Book a court" onClick={() => onOpenTab('book')} />
          )}
          {activeTab !== 'play' && (
            <RailAction icon={CalendarDays} label="Browse programs" onClick={() => onOpenTab('play')} />
          )}
          {chatEnabled && activeTab !== 'chat' && (
            <RailAction icon={MessageCircle} label="Open venue chat" onClick={() => onOpenTab('chat')} />
          )}
          <RailAction icon={Ticket} label="My bookings" onClick={onBookings} />
        </section>
      </div>
    </aside>
  );
}

function DesktopTab({ value, label, icon: Icon }: (typeof NAV_ITEMS)[number]) {
  return (
    <TabsTrigger
      value={value}
      data-venue-service={venueTabService(value)}
      className={cn(
        'venue-nav-tab relative min-h-11 w-full justify-start gap-2.5 whitespace-normal rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground shadow-none',
        'before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:scale-y-0 before:rounded-full before:bg-[var(--venue-accent)] before:transition-transform',
        'hover:bg-background/75 hover:text-foreground data-[state=active]:shadow-none data-[state=active]:before:scale-y-100',
      )}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      {label}
    </TabsTrigger>
  );
}

function MastheadStat({
  icon: Icon,
  label,
  mobileLabel,
  accent,
}: {
  icon: typeof MapPin;
  label: string;
  mobileLabel?: string;
  accent?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1.5 border-l border-border/70 px-2 first:border-l-0 lg:shrink-0 lg:justify-start lg:gap-2 lg:px-5 lg:first:pl-0">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" style={accent ? { color: accent } : undefined} />
      <span className="min-w-0 truncate text-[10px] font-semibold text-foreground/80 sm:text-xs lg:hidden" title={label}>
        {mobileLabel ?? label}
      </span>
      <span className="hidden text-xs font-semibold text-foreground/80 lg:inline">{label}</span>
    </div>
  );
}

function RailAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof LayoutGrid;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
