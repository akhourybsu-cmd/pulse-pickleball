import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublicCommunities } from '@/hooks/usePublicCommunity';
import { GuestAccountPrompt } from '@/components/community/GuestAccountPrompt';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { venuePublicPath } from '@/lib/communityAccess';

export default function PublicCommunities() {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(0);
  const query = usePublicCommunities(search, page);
  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Find your people</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Welcome to the community</h1><p className="mt-3 max-w-2xl text-muted-foreground">Explore venues and local pickleball communities. Find a place you love, then join PULSE to be part of it.</p></div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setSearch(draft.trim()); setPage(0); }}>
      <Input aria-label="Search venues and communities" placeholder="Find a venue or community" value={draft} maxLength={100} onChange={event => setDraft(event.target.value)} className="min-h-11" />
      <Button type="submit" className="min-h-11">Search</Button>
    </form>
    {query.isLoading ? <p role="status">Finding communities…</p> : query.isError ? <div role="alert" className="space-y-3"><p>We couldn’t load the communities. Please try again.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div> : <>
      {query.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{query.data.map(group => <Link key={group.id} to={group.venue?.slug ? venuePublicPath(group.venue.slug) : `/player/community/group/${group.id}`} className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary focus-visible:outline focus-visible:outline-primary">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.venue ? 'Venue' : 'Community'}</p>
        <h2 className="mt-2 text-xl font-semibold">{group.venue?.name || group.name}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{group.venue?.tagline || group.description || 'Meet your next pickleball community.'}</p>
        {group.venue && <p className="mt-3 text-sm">{[group.venue.city, group.venue.state].filter(Boolean).join(', ')}</p>}
        <span className="mt-4 inline-block text-sm font-medium text-primary">Take a look →</span>
      </Link>)}</div> : <p>No communities found. Try another name.</p>}
      <div className="flex gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={(query.data?.length || 0) < 24} onClick={() => setPage(page + 1)}>Next</Button></div>
    </>}
    <GuestAccountPrompt action="join communities, connect with players, and plan your next game" />
  </div>;
}
