import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookCourtDialog } from '../../../src/components/venue/BookCourtDialog';
import { VenueBookingGrid } from '../../../src/components/venue/VenueBookingGrid';
import { VenuePaymentsPanel } from '../../../src/components/venue/VenuePaymentsPanel';
import { buildDayGrid } from '../../../src/lib/venues/availability';
import '../../../src/index.css';
import { EntrancePreview } from './entrance-preview';
import { VenueDesktopPagePreview } from '../../../src/pages/dev/VenuePreview';
import { VenueModulesPanel } from '../../../src/components/venue/VenueModulesPanel';
import { VenueAdminShell } from '../../../src/components/community/admin/VenueAdminShell';
import { LayoutGrid, Settings } from 'lucide-react';
import { ImagesPreview } from './images-preview';

const params = new URLSearchParams(window.location.search);
if (params.has('dark')) document.documentElement.classList.add('dark');
if (params.has('large-text')) document.documentElement.style.fontSize = '20px';
const start = new Date('2099-09-15T14:00:00Z');
const courts = [
  { id: 'c1', name: 'Court 1', court_number: 1 },
  { id: 'c2', name: 'ChampionshipCourtWithAVeryLongUnbrokenName', court_number: 2 },
  { id: 'c3', name: 'Court 3', court_number: 3 },
];
const query = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
function Preview() {
  const [day, setDay] = useState(start);
  const [booking, setBooking] = useState<{ court: typeof courts[number]; start: Date; minutes: number } | null>(params.has('dialog') ? { court: courts[1], start, minutes: params.has('invalid') ? 45 : 60 } : null);
  const grid = buildDayGrid(courts, [], day, { openHour: 10, closeHour: 16, slotMinutes: 60, timeZone: 'America/New_York' });
  return <main className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-3 sm:p-6" data-testid="venue-qa">
    <div><p className="text-xs font-medium text-primary">LOCAL FIXTURE · NO EXTERNAL WRITES</p><h1 className="mt-1 text-2xl font-semibold">Pickleball Palace</h1></div>
    {params.has('owner') ? <VenuePaymentsPanel venueId="local-sample" /> : <VenueBookingGrid grid={grid} day={day} timeZone="America/New_York" loading={false} canBook onDayChange={setDay} onPickSlot={(id, selected, minutes) => setBooking({ court: courts.find(c => c.id === id)!, start: selected, minutes })} />}
    <BookCourtDialog open={!!booking} onOpenChange={open => { if (!open) setBooking(null); }} groupId="local-group" venueId="local-sample" court={booking?.court ?? null} start={booking?.start ?? null} slotMinutes={60} presetMinutes={booking?.minutes} dayEnd={booking ? new Date(booking.start.getTime() + 6 * 3600_000) : null} timeZone="America/New_York" onBooked={() => {}} />
  </main>;
}
function ModulesPreview() {
  const [activeTab, setActiveTab] = useState('modules');
  return <VenueAdminShell venueName={params.has('long') ? 'TheVeryLongVenueNameForResponsiveTestingPickleballPalace' : 'Pickleball Palace'} verified roleLabel="Owner" accent="#C5AD11" activeTab={activeTab} items={[{value:'overview',label:'Overview',description:'Venue activity and next steps. Review upcoming programs, community activity, court readiness and the tasks that need your attention.',icon:LayoutGrid},{value:'modules',label:'Plan & upgrades',description:'Your included and purchased venue features.',icon:Settings}]} onTabChange={setActiveTab} onBack={()=>{}} onViewVenue={()=>{}} onOperations={()=>{}}>
    {activeTab === 'modules' ? <VenueModulesPanel venueId="local-sample" venueName="Pickleball Palace" verified canVerify /> : <div className="space-y-4">{Array.from({length:12},(_,index)=><p key={index} className="rounded-xl border p-4">Local management preview · Task {index+1}</p>)}</div>}
  </VenueAdminShell>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><QueryClientProvider client={query}>{params.has('images') ? <ImagesPreview /> : params.has('modules') ? <ModulesPreview /> : params.has('surface') ? <VenueDesktopPagePreview /> : params.has('entrance') ? <EntrancePreview /> : <Preview />}</QueryClientProvider></MemoryRouter>);
