import { ArrowUpRight, CalendarDays, ChevronRight, LayoutGrid, Users } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { VenueLoadState } from './VenueLoadState';
import type { ClubPlayer } from '@/hooks/useVenueCommunityPreview';
import { clubHoursStatus } from '@/lib/venues/clubPresentation';
import { programPhase, venueWebsiteLink } from '@/lib/venues/programExperience';
import { groupedVenueHours } from '@/lib/venues/hours';
import type { VenueHomeSession } from './VenueHome';
import { VenueEventCard } from './VenueEventCard';

export interface ClubSession extends VenueHomeSession { end_time?: string | null; capacity?: number | null; skill_level_min?: number | null; skill_level_max?: number | null; going?: number | null }
export interface VenueClubHomeProps {
  name: string; hasBooking: boolean; sessions: ClubSession[]; timeZone?: string | null;
  loading?: boolean; error?: boolean; onRetry: () => void;
  players: ClubPlayer[]; memberCount: number; onlineCount: number;
  welcomeHeadline?: string | null; welcomeMessage?: string | null;
  onBook: () => void; onPlay: () => void; onSchedule: () => void; onEvents?: () => void; onCommunity: () => void; onMembers: () => void; onAbout: () => void; onPick: (id: string) => void;
}

export function VenueClubHome({ name, hasBooking, sessions, timeZone, loading, error, onRetry, players, memberCount, onlineCount, welcomeHeadline, welcomeMessage, onBook, onPlay, onSchedule, onEvents, onCommunity, onMembers, onAbout, onPick }: VenueClubHomeProps) {
  const relevant = sessions.filter(s => (s.end_time ? programPhase(s) !== 'ended' : Date.parse(s.start_time) >= Date.now())).slice(0, 3);
  return <div className="space-y-7 pb-5" data-testid="club-mobile-home">
    <section className="space-y-3" aria-label="Upcoming venue sessions">
      <ClubSectionTitle title="Coming up" onClick={onSchedule} label="View full schedule" showLabel />
      {error ? <VenueLoadState title="Schedule unavailable" description="We couldn’t confirm the latest sessions. Your bookings are unchanged." onRetry={onRetry} /> : loading ? <div role="status" aria-label="Loading sessions"><Skeleton className="h-28 rounded-2xl" /></div> : relevant.length ? <div className="space-y-2.5">{relevant.map(session => <ClubSessionCard key={session.id} session={session} timeZone={timeZone} onPick={onPick} />)}</div> : <div className="flex min-h-[128px] flex-col justify-center rounded-2xl bg-card p-4"><p className="text-sm font-medium">Nothing scheduled yet</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Check another day or see the full schedule.</p><button type="button" className="club-text-action mt-1 justify-start px-0" onClick={onSchedule}>View schedule<ChevronRight className="h-3.5 w-3.5" /></button></div>}
    </section>
    <section className="space-y-3" aria-label="Ways to play">
      <h2 className="break-words text-[15px] font-semibold tracking-tight">Play at {name}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {hasBooking && <ClubPlayCard icon={LayoutGrid} title="Book a Court" detail="Private court time" action="View availability" onClick={onBook} />}
        <ClubPlayCard icon={Users} title="Open Play" detail="Find your next game" action="Browse sessions" onClick={onPlay} />
        <ClubPlayCard icon={CalendarDays} title="Events & competition" detail="See what’s on the calendar" action="Browse events" onClick={onEvents ?? onSchedule} wide={hasBooking} />
      </div>
    </section>
    <section className="space-y-3" aria-label="Venue community">
      <ClubSectionTitle title="Community" onClick={onMembers} label="Meet venue players" />
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <button type="button" onClick={onMembers} className="flex min-h-11 w-full min-w-0 items-center gap-3 text-left">
          <div className="flex shrink-0 -space-x-2" aria-hidden>{players.length ? players.slice(0, 4).map(player => <Avatar key={player.id} className="h-8 w-8 border-2 border-card"><AvatarImage src={player.avatar_url || undefined} alt="" /><AvatarFallback className="bg-muted text-[10px]">{(player.display_name || player.full_name || 'P').slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>) : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><Users className="h-4 w-4" /></span>}</div>
          <span className="min-w-0 text-sm font-semibold">{memberCount > 0 ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : 'Meet your community'}{onlineCount > 0 && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{onlineCount} online now</span>}</span>
        </button>
        {players.length > 0 && <p className="mt-2 truncate text-xs text-muted-foreground">{players.slice(0, 3).map(p => p.display_name || p.full_name || 'Player').join(' · ')}</p>}
        <button type="button" onClick={onCommunity} className="club-text-action mt-3 w-full justify-between border-t border-border/60 px-0 pt-3"><span className="min-w-0 truncate">See what’s happening at {name}</span><ArrowUpRight className="h-4 w-4 shrink-0" /></button>
      </div>
    </section>
    <section className="space-y-2" aria-label={`About ${name}`}>
      <ClubSectionTitle title={`About ${name}`} onClick={onAbout} label="View venue details" />
      {(welcomeMessage || welcomeHeadline) && <p className="line-clamp-3 break-words text-sm leading-6 text-muted-foreground">{welcomeMessage || welcomeHeadline}</p>}
      <button type="button" onClick={onAbout} className="club-text-action justify-start px-0">Hours, location & contact<ChevronRight className="h-3.5 w-3.5" /></button>
    </section>
  </div>;
}

function ClubSectionTitle({ title, onClick, label, showLabel }: { title: string; onClick: () => void; label: string; showLabel?: boolean }) {
  return <div className="flex min-w-0 items-center justify-between gap-2"><h2 className="min-w-0 break-words text-[15px] font-semibold tracking-tight">{title}</h2><button type="button" onClick={onClick} aria-label={label} className="club-text-action shrink-0">{showLabel && label}<ChevronRight className="h-4 w-4" /></button></div>;
}

function ClubPlayCard({ icon: Icon, title, detail, action, onClick, wide }: { icon: typeof Users; title: string; detail: string; action: string; onClick: () => void; wide?: boolean }) {
  return <button type="button" onClick={onClick} className={`club-play-card min-w-0 rounded-2xl border border-border/70 bg-card p-3.5 text-left ${wide ? 'col-span-2 flex items-center gap-3' : ''}`}>
    <Icon aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
    <span className={`block min-w-0 flex-1 ${wide ? '' : 'mt-4'}`}><span className="block text-sm font-semibold leading-5">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span><span className="mt-3 flex items-center gap-1 text-[11px] font-medium">{action}<ArrowUpRight aria-hidden className="h-3 w-3 shrink-0" /></span></span>
  </button>;
}

export function ClubSessionCard({ session, timeZone, onPick }: { session: ClubSession; timeZone?: string | null; onPick: (id: string) => void }) {
  return <VenueEventCard event={session} going={session.going} timeZone={timeZone} onPick={onPick} />;
}

export function VenueClubCommunityNav({ section, onPosts, onMembers, onChat }: { section: 'posts' | 'members' | 'chat'; onPosts: () => void; onMembers: () => void; onChat?: () => void }) {
  return <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Community sections">
    <button type="button" aria-pressed={section === 'posts'} className="club-community-button" onClick={onPosts}>Feed</button>
    <button type="button" aria-pressed={section === 'members'} className="club-community-button" onClick={onMembers}>Players</button>
    {onChat && <button type="button" aria-pressed={section === 'chat'} className="club-community-button" onClick={onChat}>Chat</button>}
  </div>;
}

export function VenueClubAbout({ name, description, city, state, hoursRaw, timeZone, phone, email, websiteUrl, amenities = [] }: { name: string; description?: string | null; city?: string | null; state?: string | null; hoursRaw?: unknown; timeZone?: string | null; phone?: string | null; email?: string | null; websiteUrl?: string | null; amenities?: string[] | null }) {
  const website = venueWebsiteLink(websiteUrl ?? null);
  const hours = groupedVenueHours(hoursRaw);
  return <section className="space-y-7" aria-label={'About ' + name}>
    <div><h2 className="text-xl font-semibold">Venue info</h2><p className="mt-4 break-words text-lg font-semibold">{name}</p>{(city || state) && <p className="mt-1 text-sm text-muted-foreground">{[city, state].filter(Boolean).join(', ')}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 text-sm">
        {website && <a className="club-text-action justify-start" href={website} target="_blank" rel="noopener noreferrer">Website<ArrowUpRight className="h-4 w-4" /></a>}
        {phone && <a className="club-text-action justify-start break-all" href={'tel:' + phone.replace(/[^\d+]/g, '')}>Call {phone}</a>}
        {email && <a className="club-text-action justify-start break-all" href={'mailto:' + email}>Email venue</a>}
      </div>
    </div>
    {description && <div><h3 className="text-sm font-semibold">About</h3><p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{description}</p></div>}
    <div className="border-b border-border pb-6"><h3 className="text-sm font-semibold">Hours</h3><p className="mt-1 text-xs text-muted-foreground">{clubHoursStatus(hoursRaw, timeZone)}</p>
      {hours.length > 0 && <dl className="mt-4 space-y-3 text-sm">{hours.map(row => <div key={row.days} className="flex flex-wrap justify-between gap-2"><dt>{row.days}</dt><dd className="text-muted-foreground">{row.hours}</dd></div>)}</dl>}
      {timeZone && <p className="mt-3 text-xs text-muted-foreground">Times in {timeZone.replace(/_/g, ' ')}</p>}
    </div>
    {!!amenities?.length && <div className="border-b border-border pb-6"><h3 className="text-sm font-semibold">Venue amenities</h3><ul className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted-foreground">{amenities.filter(Boolean).map(amenity => <li key={amenity}>{amenity.replace(/_/g, ' ')}</li>)}</ul></div>}
  </section>;
}
