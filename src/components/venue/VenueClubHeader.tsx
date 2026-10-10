import { ArrowLeft, ArrowUpRight, BadgeCheck, CalendarDays, Settings, Gauge } from 'lucide-react';
import { VenueBrandMark, type VenueIdentity } from './VenueBrandMark';
import { VenueCoverImage, type VenueCoverImageProps } from './VenueCoverImage';
import { clubHoursStatus } from '@/lib/venues/clubPresentation';
import { cn } from '@/lib/utils';

export interface VenueClubHeaderProps {
  identity: VenueIdentity;
  cover: VenueCoverImageProps;
  city?: string | null;
  state?: string | null;
  verified?: boolean;
  hoursRaw?: unknown;
  timeZone?: string | null;
  courtCount: number;
  freeNow: number | null;
  hasBooking: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  booking?: boolean;
  showActions?: boolean;
  /** The persistent app shell owns back/settings controls and safe-area padding. */
  embedded?: boolean;
  onBack: () => void;
  backLabel?: string;
  onSettings: () => void;
  onOperations: () => void;
  onBook: () => void;
  onPlay: () => void;
  onSchedule: () => void;
}

export function VenueClubHeader({ identity, cover, city, state, verified, hoursRaw, timeZone, courtCount, freeNow, hasBooking, isAdmin, isOperator, booking, showActions = true, embedded = false, onBack, backLabel, onSettings, onOperations, onBook, onPlay, onSchedule }: VenueClubHeaderProps) {
  const location = [city, state].filter(Boolean).join(', ');
  const Heading = embedded ? 'h2' : 'h1';
  if (booking) return <header className="flex items-center gap-3 border-b border-border bg-background px-4 pb-3 pt-[calc(0.5rem+env(safe-area-inset-top))]">
    <button type="button" aria-label={backLabel ?? 'Back to venue overview'} onClick={onBack} className="club-icon-button"><ArrowLeft className="h-5 w-5" /></button>
    <div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{identity.name}</p><h1 id="club-booking-title" tabIndex={-1} className="text-lg font-semibold outline-none">Book a court</h1></div>
  </header>;
  return <>
    <header className="bg-background" data-testid="club-mobile-header">
      <div className={cn('relative isolate overflow-hidden bg-[var(--venue-cover-background,#111b29)]', embedded ? 'h-[6.25rem]' : 'h-[calc(6.25rem+env(safe-area-inset-top))]')}>
        <VenueCoverImage {...cover} alt={`${identity.name} banner`} />
        <div aria-hidden className={cn('pointer-events-none absolute inset-0', cover.fit !== 'contain' && 'bg-gradient-to-b from-[#081322]/45 via-transparent to-[#081322]/20')} />
        {!embedded && <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[calc(0.375rem+env(safe-area-inset-top))]">
          <button type="button" aria-label={backLabel ?? 'Back to Community'} onClick={onBack} className="club-icon-button border border-white/20 bg-[#081322]/65 text-white backdrop-blur-md"><ArrowLeft className="h-[18px] w-[18px]" /></button>
          <div className="flex gap-1.5">
            {isOperator && <button type="button" aria-label="Venue operations" onClick={onOperations} className="club-icon-button border border-white/20 bg-[#081322]/65 text-white backdrop-blur-md"><Gauge className="h-[18px] w-[18px]" /></button>}
            {isAdmin && <button type="button" aria-label="Manage venue" onClick={onSettings} className="club-icon-button border border-white/20 bg-[#081322]/65 text-white backdrop-blur-md"><Settings className="h-[18px] w-[18px]" /></button>}
          </div>
        </div>}
      </div>
      <div className="relative mx-5 -mt-5 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <VenueBrandMark {...identity} className="h-10 w-10 bg-muted text-[40px] text-foreground ring-1 ring-border/60" />
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><Heading className="truncate text-xl font-semibold tracking-tight">{identity.name}</Heading>{verified && <BadgeCheck aria-label="Verified venue" className="h-4 w-4 shrink-0 text-muted-foreground" />}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{[location, clubHoursStatus(hoursRaw, timeZone)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground" aria-label="Venue status">
          {courtCount > 0 && <span>{courtCount} {courtCount === 1 ? 'court' : 'courts'}</span>}
          {hasBooking && freeNow !== null && <span>{freeNow} {freeNow === 1 ? 'court free' : 'courts free'}</span>}

        </div>
      </div>
    </header>
    {showActions && <VenueClubActions hasBooking={hasBooking} onBook={onBook} onPlay={onPlay} onSchedule={onSchedule} />}
  </>;
}

export function VenueClubActions({ onPlay, onSchedule }: Pick<VenueClubHeaderProps, 'hasBooking' | 'onBook' | 'onPlay' | 'onSchedule'>) {
  return <section aria-label="Play at this venue" className="grid grid-cols-[1.1fr_1fr] gap-3 bg-background px-5 pt-4">
    <button type="button" onClick={onPlay} className="club-primary flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold">
      Join Open Play<ArrowUpRight aria-hidden className="h-4 w-4 shrink-0" />
    </button>
    <button type="button" onClick={onSchedule} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-card px-3 py-3 text-sm font-semibold"><CalendarDays aria-hidden className="h-4 w-4 shrink-0" />View schedule</button>
  </section>;
}
