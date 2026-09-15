import { ArrowUpRight, CalendarDays, ChevronRight, LayoutGrid, MessageCircle, Users } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { VenueLoadState } from './VenueLoadState';
import type { ClubPlayer } from '@/hooks/useVenueCommunityPreview';
import { clubDate, clubTime, clubHoursStatus, clubSkill } from '@/lib/venues/clubPresentation';
import { programPhase, venueWebsiteLink } from '@/lib/venues/programExperience';
import { DAY_NAMES, describeDay, parseTime } from '@/lib/venues/hours';
import type { VenueHomeSession } from './VenueHome';

export interface ClubSession extends VenueHomeSession { end_time?: string | null; capacity?: number | null; skill_level_min?: number | null; skill_level_max?: number | null; going?: number | null }
export interface VenueClubHomeProps {
  name: string; hasBooking: boolean; sessions: ClubSession[]; timeZone?: string | null;
  loading?: boolean; error?: boolean; onRetry: () => void;
  players: ClubPlayer[]; memberCount: number; onlineCount: number;
  welcomeHeadline?: string | null; welcomeMessage?: string | null;
  onBook: () => void; onPlay: () => void; onSchedule: () => void; onCommunity: () => void; onMembers: () => void; onAbout: () => void; onPick: (id: string) => void;
}

export function VenueClubHome({ name, hasBooking, sessions, timeZone, loading, error, onRetry, players, memberCount, onlineCount, welcomeHeadline, welcomeMessage, onBook, onPlay, onSchedule, onCommunity, onMembers, onAbout, onPick }: VenueClubHomeProps) {
  const relevant = sessions.filter(s => (s.end_time ? programPhase(s) !== 'ended' : Date.parse(s.start_time) >= Date.now())).slice(0, 3);
  const today = relevant.length > 0 && clubDate(relevant[0].start_time, timeZone) === 'Today';
  return <div className="space-y-7 pb-5" data-testid="club-mobile-home">
    <section className="space-y-3" aria-label="Upcoming venue sessions">
      <ClubSectionTitle title={`${today ? 'Today' : 'Coming up'} at ${name}`} onClick={onSchedule} label="View full schedule" />
      {error ? <VenueLoadState title="Schedule unavailable" description="We couldn’t confirm the latest sessions. Your bookings are unchanged." onRetry={onRetry} /> : loading ? <div role="status" aria-label="Loading sessions"><Skeleton className="h-28 rounded-2xl" /></div> : relevant.length ? <div className="space-y-2.5">{relevant.map(session => <ClubSessionCard key={session.id} session={session} timeZone={timeZone} onPick={onPick} />)}</div> : <div className="rounded-2xl border border-dashed border-border p-4"><p className="text-sm font-medium">More play is on the way</p><p className="mt-1 text-xs leading-5 text-muted-foreground">No upcoming sessions are listed. Check the schedule for another day.</p><button type="button" className="club-text-action mt-1 justify-start px-0" onClick={onSchedule}>View schedule<ChevronRight className="h-3.5 w-3.5" /></button></div>}
    </section>
    <section className="space-y-3" aria-label="Ways to play">
      <h2 className="break-words text-[15px] font-semibold tracking-tight">Play at {name}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {hasBooking && <ClubPlayCard icon={LayoutGrid} title="Book a Court" detail="Private court time" action="View availability" onClick={onBook} />}
        <ClubPlayCard icon={Users} title="Open Play" detail="Find your next game" action="Browse sessions" onClick={onPlay} />
        <ClubPlayCard icon={CalendarDays} title="Events & competition" detail="See what’s on the calendar" action="Browse events" onClick={onSchedule} wide={hasBooking} />
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

function ClubSectionTitle({ title, onClick, label }: { title: string; onClick: () => void; label: string }) {
  return <div className="flex min-w-0 items-center justify-between gap-2"><h2 className="min-w-0 break-words text-[15px] font-semibold tracking-tight">{title}</h2><button type="button" onClick={onClick} aria-label={label} className="club-icon-button shrink-0"><ChevronRight className="h-4 w-4" /></button></div>;
}

function ClubPlayCard({ icon: Icon, title, detail, action, onClick, wide }: { icon: typeof Users; title: string; detail: string; action: string; onClick: () => void; wide?: boolean }) {
  return <button type="button" onClick={onClick} className={`club-play-card min-w-0 rounded-2xl border border-border/70 bg-card p-3.5 text-left ${wide ? 'col-span-2 flex items-center gap-3' : ''}`}>
    <Icon aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
    <span className={`block min-w-0 flex-1 ${wide ? '' : 'mt-4'}`}><span className="block text-sm font-semibold leading-5">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span><span className="mt-3 flex items-center gap-1 text-[11px] font-medium">{action}<ArrowUpRight aria-hidden className="h-3 w-3 shrink-0" /></span></span>
  </button>;
}

export function ClubSessionCard({ session, timeZone, onPick }: { session: ClubSession; timeZone?: string | null; onPick: (id: string) => void }) {
  const count = session.going;
  const skill = session.skill_level_min != null && session.skill_level_max != null ? `${clubSkill(session.skill_level_min)}–${clubSkill(session.skill_level_max)}` : session.skill_level_min != null ? `${clubSkill(session.skill_level_min)}+` : session.skill_level_max != null ? `Up to ${clubSkill(session.skill_level_max)}` : 'All levels';
  return <button type="button" onClick={() => onPick(session.id)} className="club-session-card relative block w-full overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-left">
    <span aria-hidden className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-[var(--club-accent)]" />
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-muted-foreground"><span>{clubDate(session.start_time, timeZone)}</span><span>{clubTime(session.start_time, timeZone)}{session.end_time ? ` – ${clubTime(session.end_time, timeZone)}` : ''}</span>{programPhase(session) === 'live' && <span className="text-emerald-700 dark:text-emerald-300">In progress</span>}</span>
    <span className="mt-2 block break-words text-[15px] font-semibold leading-5">{session.title}</span>
    <span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{skill}</span><span>{session.capacity != null && count != null ? count >= session.capacity ? 'Full · View options' : `${count} / ${session.capacity} players` : 'View availability'}<ChevronRight aria-hidden className="ml-1 inline h-3 w-3" /></span></span>
  </button>;
}

export function VenueClubCommunityNav({ section, onPosts, onMembers, onChat }: { section: 'posts' | 'members'; onPosts: () => void; onMembers: () => void; onChat?: () => void }) {
  return <div className="mb-4 flex flex-wrap gap-2" aria-label="Community sections">
    <button type="button" aria-pressed={section === 'posts'} className="club-community-button" onClick={onPosts}>Updates</button>
    <button type="button" aria-pressed={section === 'members'} className="club-community-button" onClick={onMembers}><Users className="h-4 w-4" />Players</button>
    {onChat && <button type="button" className="club-community-button" onClick={onChat}><MessageCircle className="h-4 w-4" />Chat</button>}
  </div>;
}

export function VenueClubAbout({ name, description, city, state, hoursRaw, timeZone, phone, email, websiteUrl }: { name: string; description?: string | null; city?: string | null; state?: string | null; hoursRaw?: unknown; timeZone?: string | null; phone?: string | null; email?: string | null; websiteUrl?: string | null }) {
  const website = venueWebsiteLink(websiteUrl ?? null);
  const days = (hoursRaw as { days?: Record<string, { open?: string; close?: string } | null> } | null)?.days;
  return <section className="space-y-5" aria-label={`About ${name}`}>
    <div><h2 className="break-words text-xl font-semibold">About {name}</h2>{(city || state) && <p className="mt-1 text-sm text-muted-foreground">{[city, state].filter(Boolean).join(', ')}</p>}{description && <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{description}</p>}</div>
    <div className="rounded-2xl border border-border/70 bg-card p-4"><h3 className="text-sm font-semibold">Opening hours</h3><p className="mt-1 break-words text-xs text-muted-foreground">{clubHoursStatus(hoursRaw, timeZone)}{timeZone ? ` · ${timeZone.replace(/_/g, ' ')}` : ''}</p>
      {days && <dl className="mt-3 space-y-2 text-xs">{DAY_NAMES.map((label, index) => { const day = days[index]; const open = parseTime(day?.open), close = parseTime(day?.close); return <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="text-muted-foreground">{day === null ? 'Closed' : open !== null && close !== null && close > open ? describeDay({ openMinutes: open, closeMinutes: close }) : 'Not listed'}</dd></div>; })}</dl>}
    </div>
    {(phone || email || website) && <div className="grid gap-1 text-sm">
      {phone && <a className="club-text-action justify-start break-all" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>}
      {email && <a className="club-text-action justify-start break-all" href={`mailto:${email}`}>{email}</a>}
      {website && <a className="club-text-action justify-start" href={website} target="_blank" rel="noopener noreferrer">Visit venue website<ArrowUpRight className="h-4 w-4" /></a>}
    </div>}
  </section>;
}
