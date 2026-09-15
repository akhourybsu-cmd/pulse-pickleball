import { ArrowLeft, ArrowUpRight, BadgeCheck, CalendarDays, ChevronRight, Settings, Gauge } from 'lucide-react';
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
  onBack: () => void;
  onSettings: () => void;
  onOperations: () => void;
  onBook: () => void;
  onPlay: () => void;
  onSchedule: () => void;
}

export function VenueClubHeader({ identity, cover, city, state, verified, hoursRaw, timeZone, courtCount, freeNow, hasBooking, isAdmin, isOperator, booking, showActions = true, onBack, onSettings, onOperations, onBook, onPlay, onSchedule }: VenueClubHeaderProps) {
  const location = [city, state].filter(Boolean).join(', ');
  if (booking) return <header className="flex items-center gap-3 border-b border-border bg-background px-4 pb-3 pt-[calc(0.5rem+env(safe-area-inset-top))]">
    <button type="button" aria-label="Back to venue overview" onClick={onBack} className="club-icon-button"><ArrowLeft className="h-5 w-5" /></button>
    <div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{identity.name}</p><h1 id="club-booking-title" tabIndex={-1} className="text-lg font-semibold outline-none">Book a court</h1></div>
  </header>;
  return <>
    <header className="bg-card" data-testid="club-mobile-header">
      <div className="relative isolate h-[calc(6.25rem+env(safe-area-inset-top))] overflow-hidden bg-[#111b29]">
        <VenueCoverImage {...cover} alt={`${identity.name} banner`} />
        <div aria-hidden className={cn('pointer-events-none absolute inset-0', cover.fit !== 'contain' && 'bg-gradient-to-b from-[#081322]/45 via-transparent to-[#081322]/20')} />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[calc(0.375rem+env(safe-area-inset-top))]">
          <button type="button" aria-label="Back to Community" onClick={onBack} className="club-icon-button border border-white/20 bg-[#081322]/65 text-white backdrop-blur-md"><ArrowLeft className="h-[18px] w-[18px]" /></button>
          <div className="flex gap-1.5">
            {isOperator && <button type="button" aria-label="Venue operations" onClick={onOperations} className="club-icon-button border border-white/20 bg-[#081322]/65 text-white backdrop-blur-md"><Gauge className="h-[18px] w-[18px]" /></button>}
            {isAdmin && <button type="button" aria-label="Manage venue" onClick={onSettings} className="club-icon-button border border-white/20 bg-[#081322]/65 text-white backdrop-blur-md"><Settings className="h-[18px] w-[18px]" /></button>}
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <VenueBrandMark {...identity} className="h-10 w-10 bg-muted text-[40px] text-foreground ring-1 ring-border/60" />
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h1 className="truncate text-xl font-semibold tracking-tight">{identity.name}</h1>{verified && <BadgeCheck aria-label="Verified venue" className="h-4 w-4 shrink-0 text-muted-foreground" />}</div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{location || 'Your venue community'}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground" aria-label="Venue status">
          {courtCount > 0 && <span>{courtCount} {courtCount === 1 ? 'court' : 'courts'}</span>}
          {hasBooking && freeNow !== null && <span>{freeNow} {freeNow === 1 ? 'court free' : 'courts free'}</span>}
          <span>{clubHoursStatus(hoursRaw, timeZone)}</span>
        </div>
      </div>
    </header>
    {showActions && <VenueClubActions hasBooking={hasBooking} onBook={onBook} onPlay={onPlay} onSchedule={onSchedule} />}
  </>;
}

export function VenueClubActions({ hasBooking, onBook, onPlay, onSchedule }: Pick<VenueClubHeaderProps, 'hasBooking' | 'onBook' | 'onPlay' | 'onSchedule'>) {
  return <section aria-label="Play at this venue" className="space-y-1.5 bg-background px-4 pb-2 pt-3">
    <button type="button" onClick={hasBooking ? onBook : onPlay} className="club-primary flex min-h-[68px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left">
      <span className="min-w-0"><span className="block text-[15px] font-semibold">{hasBooking ? 'Book a Court' : 'Join Open Play'}</span><span className="mt-0.5 block text-xs opacity-80">{hasBooking ? 'Find an available court' : 'Find your next game'}</span></span>
      <ArrowUpRight aria-hidden className="h-5 w-5 shrink-0" />
    </button>
    <div className="grid grid-cols-2 gap-2">
      {hasBooking ? <button type="button" onClick={onPlay} className="club-text-action">Join Open Play<ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" /></button> : <span />}
      <button type="button" onClick={onSchedule} className="club-text-action"><CalendarDays aria-hidden className="h-3.5 w-3.5 shrink-0" />View Schedule</button>
    </div>
  </section>;
}
