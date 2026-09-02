import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Gauge,
  LayoutGrid,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatSlotTime } from '@/lib/venues/availability';
import { describeDay, type VenueHours } from '@/lib/venues/hours';
import type { VenueHomeSession } from '@/components/venue/VenueHome';

export type VenuePageTab = 'home' | 'book' | 'play' | 'feed' | 'chat' | 'more';

const NAV_ITEMS: Array<{
  value: VenuePageTab;
  label: string;
  mobileLabel: string;
  icon: typeof MapPin;
  needsCourts?: boolean;
  needsChat?: boolean;
}> = [
  { value: 'home', label: 'Overview', mobileLabel: 'Home', icon: MapPin },
  { value: 'book', label: 'Book a court', mobileLabel: 'Book', icon: LayoutGrid, needsCourts: true },
  { value: 'play', label: 'Play & programs', mobileLabel: 'Play', icon: CalendarDays },
  { value: 'feed', label: 'Venue feed', mobileLabel: 'Feed', icon: MessageSquare },
  { value: 'chat', label: 'Venue chat', mobileLabel: 'Chat', icon: MessageCircle, needsChat: true },
  { value: 'more', label: 'Members & more', mobileLabel: 'More', icon: MoreHorizontal },
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
  freeNow: number;
  courtCount: number;
  memberCount: number;
  nextStart?: string | null;
  isOperator: boolean;
  isAdmin: boolean;
  onBack: () => void;
  onOperations: () => void;
  onSettings: () => void;
}

/** Responsive venue identity. Desktop is deliberately bounded like a product surface. */
export function VenueMasthead({
  venueName,
  tagline,
  logoUrl,
  coverImageUrl,
  logoImageFit = 'cover',
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
  return (
    <header className="relative shrink-0 lg:bg-muted/[0.16] lg:px-6 lg:pt-6">
      <div className="lg:mx-auto lg:max-w-[1480px] lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-border/70 lg:bg-card lg:shadow-[0_18px_55px_-38px_hsl(var(--foreground)/0.45)]">
        <div
          className="relative h-44 sm:h-56 lg:h-[260px]"
          style={{
            backgroundImage: coverImageUrl
              ? `url(${coverImageUrl})`
              : fallbackBackground ??
                'linear-gradient(158deg, hsl(var(--ink-700)) 0%, hsl(var(--ink-900)) 100%)',
            backgroundSize: coverImageUrl ? (coverImageFit ?? 'cover') : 'cover',
            backgroundPosition: coverFocalPoint === 'top' ? 'center top' : 'center',
            backgroundRepeat: 'no-repeat',
            // A deliberate dark matte keeps `contain` covers looking finished
            // instead of exposing the page background around the image.
            backgroundColor: '#171a1f',
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.14) 100%)',
            }}
          />
          {bloom && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 78% 18%, ${bloom} 0%, transparent 34%)` }}
            />
          )}

          <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[calc(0.6rem+env(safe-area-inset-top))] lg:px-7 lg:pt-6">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-full border border-white/20 bg-black/25 px-2.5 text-white backdrop-blur-md hover:bg-black/40 hover:text-white lg:px-3.5"
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
                  className="h-9 rounded-full border border-white/20 bg-black/25 px-2.5 text-white backdrop-blur-md hover:bg-black/40 hover:text-white lg:px-3.5"
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
                  className="h-9 rounded-full border border-white/20 bg-black/25 px-2.5 text-white backdrop-blur-md hover:bg-black/40 hover:text-white lg:px-3.5"
                  onClick={onSettings}
                  aria-label="Venue settings"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden text-xs font-semibold lg:inline">Settings</span>
                </Button>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4 sm:px-6 lg:gap-5 lg:px-8 lg:pb-7">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${venueName} logo`}
                className={cn(
                  'h-14 w-14 shrink-0 bg-white/10 shadow-xl ring-1 ring-white/30 sm:h-16 sm:w-16 lg:h-20 lg:w-20',
                  logoShape === 'circle' ? 'rounded-full' : 'rounded-xl lg:rounded-2xl',
                )}
                style={{ objectFit: logoImageFit ?? 'cover' }}
              />
            ) : (
              <div
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-xl font-bold text-white shadow-xl backdrop-blur-md sm:h-16 sm:w-16 sm:text-2xl lg:h-20 lg:w-20 lg:rounded-2xl lg:text-3xl"
              >
                {venueName.trim().slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-bold leading-none tracking-[-0.025em] text-white sm:text-3xl lg:text-[40px]">
                  {venueName}
                </h1>
                {verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-amber-400 lg:h-5 lg:w-5" aria-label="Verified venue" />
                )}
              </div>
              {tagline && (
                <p className="mt-1.5 max-w-2xl truncate text-sm text-white/[0.78] lg:mt-2 lg:text-base">
                  {tagline}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-border/70 bg-card lg:border-b-0">
          <div className="flex items-center overflow-x-auto px-4 py-3 sm:px-6 lg:px-8 lg:py-3.5">
            <MastheadStat
              icon={LayoutGrid}
              label={hasCourts ? `${freeNow} of ${courtCount} courts free` : 'No courts yet'}
              accent={accent}
            />
            <MastheadStat icon={Users} label={`${memberCount} members`} />
            {nextStart && (
              <MastheadStat
                icon={CalendarClock}
                label={`Next program at ${formatSlotTime(new Date(nextStart))}`}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Phone/tablet navigation remains a compact horizontal strip. */
export function VenueMobileTabs({ hasCourts, chatEnabled = true }: { hasCourts: boolean; chatEnabled?: boolean }) {
  return (
    <div className="border-b border-border/70 bg-card lg:hidden">
      <div className="mx-auto max-w-[1480px] overflow-x-auto px-2 sm:px-4">
        <TabsList className="h-auto w-max justify-start gap-0 rounded-none border-0 bg-transparent p-0">
          {NAV_ITEMS.filter(
            (item) => (!item.needsCourts || hasCourts) && (!item.needsChat || chatEnabled),
          ).map((item) => (
            <MobileTab key={item.value} {...item} />
          ))}
        </TabsList>
      </div>
    </div>
  );
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
    <aside className="hidden lg:block">
      <div className="sticky top-6 space-y-5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Venue
          </p>
          <TabsList className="flex h-auto w-full flex-col items-stretch gap-1 rounded-none bg-transparent p-0">
            {NAV_ITEMS.filter(
              (item) => (!item.needsCourts || hasCourts) && (!item.needsChat || chatEnabled),
            ).map((item) => (
              <DesktopTab key={item.value} {...item} />
            ))}
          </TabsList>
        </div>

        {isOperator && (
          <div className="border-t border-border/70 pt-4">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Staff
            </p>
            <button
              type="button"
              onClick={onOperations}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <Gauge className="h-4 w-4" />
              Operations
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={onSettings}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
                Venue settings
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
  freeNow: number;
  courtCount: number;
  memberCount: number;
  onlineCount: number;
  chatEnabled?: boolean;
  nextUp: VenueHomeSession[];
  hours: VenueHours;
  accent?: string | null;
  onOpenTab: (tab: VenuePageTab) => void;
  onBookings: () => void;
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
}: VenueDesktopRailProps) {
  const today = new Date().getDay();
  const next = nextUp[0];

  return (
    <aside className="hidden min-[1180px]:block">
      <div className="sticky top-6 space-y-4">
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_12px_36px_-28px_hsl(var(--foreground)/0.35)]">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Today at {venueName}
              </p>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>

            {hasCourts ? (
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
                      width: `${courtCount ? Math.max(5, (freeNow / courtCount) * 100) : 0}%`,
                      ...(accent ? { backgroundColor: accent } : {}),
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold">Court availability is not published yet.</p>
            )}

            <div className="mt-4 space-y-2 border-t border-border/70 pt-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Hours today</span>
                <span className="font-semibold tabular-nums">{describeDay(hours.days[today])}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Community</span>
                <span className="font-semibold tabular-nums">
                  {onlineCount > 0 ? `${onlineCount} online · ` : ''}{memberCount} members
                </span>
              </div>
            </div>
          </div>

          {next && (
            <button
              type="button"
              onClick={() => onOpenTab('play')}
              className="flex w-full items-center gap-3 border-t border-border/70 bg-muted/25 px-5 py-3.5 text-left transition-colors hover:bg-muted/45"
            >
              <CalendarClock className="h-4 w-4 shrink-0 text-primary" style={accent ? { color: accent } : undefined} />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Next up</span>
                <span className="mt-0.5 block truncate text-sm font-semibold">{next.title}</span>
              </span>
              <span className="text-xs font-semibold tabular-nums">{formatSlotTime(new Date(next.start_time))}</span>
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

function MobileTab({ value, mobileLabel, icon: Icon }: (typeof NAV_ITEMS)[number]) {
  return (
    <TabsTrigger
      value={value}
      className="relative gap-1.5 rounded-none border-0 bg-transparent px-3 py-3 text-xs font-semibold text-muted-foreground shadow-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-[var(--venue-accent)] after:transition-transform data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:scale-x-100"
    >
      <Icon className="h-3.5 w-3.5" />
      {mobileLabel}
    </TabsTrigger>
  );
}

function DesktopTab({ value, label, icon: Icon }: (typeof NAV_ITEMS)[number]) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'relative w-full justify-start gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground shadow-none',
        'before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:scale-y-0 before:rounded-full before:bg-[var(--venue-accent)] before:transition-transform',
        'hover:bg-card/70 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_hsl(var(--foreground)/0.05)] data-[state=active]:before:scale-y-100',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </TabsTrigger>
  );
}

function MastheadStat({
  icon: Icon,
  label,
  accent,
}: {
  icon: typeof MapPin;
  label: string;
  accent?: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3 first:pl-0 [&+&]:border-l [&+&]:border-border/70 lg:px-5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" style={accent ? { color: accent } : undefined} />
      <span className="text-xs font-semibold text-foreground/80">{label}</span>
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
