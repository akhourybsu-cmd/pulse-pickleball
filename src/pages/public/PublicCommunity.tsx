import { useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, MapPin, MessageCircle, Users } from 'lucide-react';
import { useAuthState } from '@/hooks/useAuthState';
import { usePublicCommunity } from '@/hooks/usePublicCommunity';
import { GuestAccountPrompt } from '@/components/community/GuestAccountPrompt';
import { CommunityHero } from '@/components/community/CommunityHero';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { publicWebsiteUrl } from '@/lib/communityAccess';

export default function PublicCommunity() {
  const { groupId, slug } = useParams<{ groupId: string; slug: string }>();
  const { isAuthenticated } = useAuthState();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = usePublicCommunity(groupId, slug);
  const [intent, setIntent] = useState<{ action: string; returnTo: string } | null>(null);
  if (query.isLoading) return <p role="status" className="py-16 text-center">Opening the community…</p>;
  if (query.isError) return <div role="alert" className="space-y-4 py-12 text-center"><h1 className="text-2xl font-semibold">Let’s try that again</h1><p>We couldn’t load this page. Your link is still here.</p><Button onClick={() => void query.refetch()}>Try again</Button></div>;
  const group = query.data;
  if (!group) return <div className="space-y-4 py-12"><h1 className="text-2xl font-semibold">This community isn’t available to browse</h1><p className="text-muted-foreground">It may be private or not published yet. If you’re a member, sign in or use the invite link your host shared.</p><GuestAccountPrompt action="access your communities" /><Link to="/player/community" className="inline-block py-3 underline">Explore communities</Link></div>;
  if (isAuthenticated && slug) return <Navigate to={`/player/community/group/${group.id}${location.search}${location.hash}`} replace />;
  const venue = group.venue;
  const name = venue?.name || group.name;
  const website = publicWebsiteUrl(venue?.website_url);
  const tab = params.get('tab') || 'home';
  const openTab = (value: string) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); };
  const gate = (action: string, destinationTab: string) => {
    const next = new URLSearchParams(params); next.set('tab', destinationTab);
    setIntent({ action, returnTo: `${location.pathname}?${next}${location.hash}` });
  };
  return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
    <Link to="/player/community" className="inline-block text-sm text-muted-foreground hover:underline">← Explore communities</Link>
    <CommunityHero group={group} />
    <GuestAccountPrompt name={name} action={venue?.booking_enabled ? 'join the community, book courts, and connect with players' : 'join the community, post, and connect with players'} />
    <nav aria-label="Community sections" className="flex gap-2 overflow-x-auto border-b pb-3">
      {[['home', 'About'], ...(venue ? [['book', 'Courts'], ['events', 'Events']] : []), ['feed', 'Community']].map(([value, label]) => <Button key={value} variant={tab === value ? 'default' : 'ghost'} aria-current={tab === value ? 'page' : undefined} onClick={() => openTab(value)} className="min-h-11">{label}</Button>)}
    </nav>
    {venue && tab === 'events' ? <section className="space-y-4 rounded-2xl border p-6">
      <CalendarDays className="h-7 w-7 text-primary" aria-hidden="true" />
      <h2 className="text-2xl font-semibold">Events at {name}</h2>
      <p className="max-w-2xl text-sm leading-7 text-muted-foreground">Sign in to browse the schedule, see session times and available spots, and join an event. Your account is free; any event prices and venue requirements are shown before you sign up.</p>
      <Button className="min-h-11" onClick={() => gate('browse the schedule and sign up for events', 'events')}>Explore events</Button>
    </section> : tab === 'home' ? <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border p-6"><h2 className="text-2xl font-semibold">{venue?.welcome_headline || `Welcome to ${name}`}</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">{venue?.welcome_message || group.description || 'A place to connect over pickleball. Take a look around and join us when you’re ready.'}</p><Button className="mt-5 min-h-11" onClick={() => gate(group.join_method === 'invite_only' ? 'use your invitation and join the community' : 'join this community', 'feed')}>{group.join_method === 'request_to_join' ? 'Request to join' : group.join_method === 'invite_only' ? 'Join with an invitation' : 'Join the community'}</Button></section>
      <section className="rounded-2xl border p-6"><h2 className="text-lg font-semibold">{venue ? 'Plan your visit' : 'Meet the community'}</h2>{venue && <p className="mt-4 flex gap-2 text-sm leading-6"><MapPin className="mt-1 h-4 w-4 shrink-0" />{[venue.address, venue.city, venue.state].filter(Boolean).join(', ') || 'Location details coming soon'}</p>}<p className="mt-4 flex items-center gap-2 text-sm"><Users className="h-4 w-4" />{group.member_count || 0} community members</p>{website && <a className="mt-4 inline-block py-2 text-sm underline" href={website} target="_blank" rel="noopener noreferrer">Visit venue website ↗</a>}<p className="mt-3 text-xs leading-5 text-muted-foreground">A free PULSE account connects you with the community. Venue fees and membership requirements may still apply.</p></section>
    </div> : tab === 'book' && venue ? <section className="space-y-4"><div><h2 className="text-2xl font-semibold">Find your court</h2><p className="mt-2 text-sm text-muted-foreground">Explore the courts. Join the community to plan your next game.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.courts.map(court => <article key={court.id} className="rounded-2xl border p-5"><h3 className="font-semibold">{court.name || `Court ${court.court_number}`}</h3><p className="mt-2 text-sm text-muted-foreground">{[court.court_type, court.surface_type].filter(Boolean).join(' · ')}</p></article>)}</div>{!group.courts.length && <p className="text-sm text-muted-foreground">Court details are coming soon.</p>}{venue.booking_enabled && <Button className="min-h-11" onClick={() => gate('check availability and book a court', 'book')}>Check availability</Button>}</section> : <section className="space-y-4"><h2 className="text-2xl font-semibold">There’s more waiting for you</h2><p className="text-sm leading-6 text-muted-foreground">Join PULSE to see community activity and take part. Private conversations and member details are shared according to the community’s access settings.</p><div className="grid gap-3 sm:grid-cols-3">{[{ label: 'Events & play', action: 'explore events and join a game', tab: venue ? 'play' : 'schedule', icon: CalendarDays }, { label: 'Posts & updates', action: 'read updates and share a post', tab: 'feed', icon: Users }, { label: 'Community chat', action: 'connect with the community in chat', tab: 'chat', icon: MessageCircle }].map(item => <Button key={item.tab} variant="outline" className="min-h-16 justify-start gap-3 whitespace-normal" onClick={() => gate(item.action, item.tab)}><item.icon className="h-5 w-5 shrink-0" />{item.label}</Button>)}</div></section>}
    <Dialog open={!!intent} onOpenChange={open => { if (!open) setIntent(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Join in with a free account</DialogTitle><DialogDescription>Create a free PULSE account to {intent?.action}. Any community approval or venue requirements still apply.</DialogDescription></DialogHeader><GuestAccountPrompt name={name} action={intent?.action} returnTo={intent?.returnTo} /><Button variant="ghost" className="min-h-11" onClick={() => setIntent(null)}>Keep looking around</Button></DialogContent></Dialog>
  </div>;
}
