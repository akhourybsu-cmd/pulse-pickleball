import { useState } from 'react';
import { VenueMobileShell, VenuePanel } from '../../../src/components/venue/VenueMobileShell';
import { VenueClubCommunityNav } from '../../../src/components/venue/VenueClubHome';
import { Tabs } from '../../../src/components/ui/tabs';
import type { VenuePageTab } from '../../../src/components/venue/VenuePageChrome';

/** Local remount check: opening a profile removes the entire shell from the tree. */
export function VenueMemoryPreview() {
  const [profile, setProfile] = useState<number | null>(null);
  const [leftAt, setLeftAt] = useState(0);
  const [active, setActive] = useState<VenuePageTab>('feed');
  const [section, setSection] = useState<'posts' | 'members'>('members');
  if (profile !== null) return <main className="p-5"><h1>Local player {profile}</h1><p>List position on leaving: {leftAt}</p><button type="button" className="mt-5 min-h-11 rounded-xl border p-3" onClick={() => setProfile(null)}>Back to players</button></main>;
  return <Tabs value={active} onValueChange={value => setActive(value as VenuePageTab)}>
    <VenueMobileShell mobile activeTab={active} visited={new Set(['feed', 'home'])} identity={{ name: 'Local memory check' }} hasBooking={false}
      memoryKey="local-memory-check:viewer" onCommunity={() => setActive('feed')} onExit={() => {}} onBookings={() => {}} onTools={() => {}}>
      <VenuePanel value="feed" section={section}>
        <div><h2 className="mb-5 text-xl font-semibold">Community</h2>
          <VenueClubCommunityNav section={section} onPosts={() => setSection('posts')} onMembers={() => setSection('members')} />
          {section === 'members' ? <div className="space-y-3">{Array.from({ length: 40 }, (_, i) => <button key={i} type="button" onClick={event => { setLeftAt(event.currentTarget.closest<HTMLElement>('[role=tabpanel]')?.scrollTop ?? 0); setProfile(i + 1); }} className="block min-h-16 w-full rounded-2xl border bg-card p-4 text-left">View player {i + 1}</button>)}</div> : <p>Local feed</p>}
        </div>
      </VenuePanel>
      <VenuePanel value="home"><h2>Overview</h2></VenuePanel>
    </VenueMobileShell>
  </Tabs>;
}
