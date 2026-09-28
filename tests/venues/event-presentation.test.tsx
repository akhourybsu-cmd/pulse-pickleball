import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { eventSchedule } from '@/lib/venues/eventPresentation';
import { VenueEventCard } from '@/components/venue/VenueEventCard';

it('shows the venue calendar date and time, including cross-midnight end dates', () => {
  expect(eventSchedule('2026-11-03T00:30:00Z','2026-11-03T02:30:00Z','America/New_York')).toMatchObject({label:'Monday, November 2, 2026',day:'02',weekday:'Mon',time:'7:30 PM – 9:30 PM',zone:'EST'});
  expect(eventSchedule('2026-11-03T04:30:00Z','2026-11-03T06:00:00Z','America/New_York')?.time).toBe('11:30 PM – Tue, Nov 3, 1:00 AM');
});
it('uses labels as well as accents and never manufactures availability counts', () => {
  const html = renderToStaticMarkup(<VenueEventCard event={{id:'e',title:'Evening clinic',start_time:'2099-11-03T00:30:00Z',end_time:'2099-11-03T02:30:00Z',event_format:'clinic',capacity:8}} timeZone="America/New_York" onPick={()=>{}} />);
  expect(html).toContain('data-event-format="clinic"'); expect(html).toContain('Clinic');
  expect(html).toContain('7:30 PM – 9:30 PM'); expect(html).toContain('November 2, 2099');
  expect(html).toContain('View availability'); expect(html).not.toContain('spots left'); expect(html).not.toContain('0 / 8');
});
