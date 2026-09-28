import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { allocateAvailableCourts, endAfterDuration, programWindows } from '@/lib/venues/programScheduling';
import { EventDateTimeStep } from '@/components/community/event-wizard/steps/EventDateTimeStep';
import { EventDetailsStep } from '@/components/community/event-wizard/steps/EventDetailsStep';
const courts=[1,2,3,4].map(n=>({id:String(n),name:`Court ${n}`,court_number:n}));
const noop=()=>{};
it('assigns the requested count using free courts and preserves manual preferences',()=>{
  expect(allocateAvailableCourts(courts,new Set(['2']),2,['3'])).toEqual(['3','1']);
  expect(allocateAvailableCourts(courts,new Set(['2','3','4']),2)).toEqual(['1']);
  expect(allocateAvailableCourts([{...courts[0],is_active:false},...courts.slice(1)],new Set(),2)).toEqual(['2','3']);
});
it('keeps recurring venue clock times stable across daylight saving and validates duration',()=>{
  const windows=programWindows('2026-10-26','09:30','11:00','weekly',2,'America/New_York');
  expect(windows.map(w=>w.start.toISOString())).toEqual(['2026-10-26T13:30:00.000Z','2026-11-02T14:30:00.000Z']);
  expect(windows.map(w=>w.end.getTime()-w.start.getTime())).toEqual([5400000,5400000]);
  expect(programWindows('2026-11-02','11:00','09:30','none',1)).toEqual([]);
  expect(endAfterDuration('09:30',90)).toBe('11:00');
  expect(endAfterDuration('23:00',120)).toBe('');
});
it('asks for a required duration and court count, and explains insufficient inventory',()=>{
  const when=renderToStaticMarkup(<EventDateTimeStep venueMode date="2026-11-02" startTime="09:30" endTime="11:00" timeZone="America/New_York" recurringFrequency="none" recurringCount={1}
    onDateChange={noop} onStartTimeChange={noop} onEndTimeChange={noop} onRecurringFrequencyChange={noop} onRecurringCountChange={noop}/>);
  expect(when).toContain('How long is the event?'); expect(when).toContain('value="90"'); expect(when).toContain('America/New York');
  const detail=renderToStaticMarkup(<EventDetailsStep venueMode eventType="clinic" location="" capacity={8} waitlistEnabled waitlistLimit={4} rrCourts={null} rrGamesPerPlayer={null}
    courts={courts} courtCount={3} busyCourtIds={new Set(['1','2'])} selectedCourtIds={['3','4']}
    onCourtCountChange={noop} onLocationChange={noop} onCapacityChange={noop} onWaitlistEnabledChange={noop} onWaitlistLimitChange={noop} onRrCourtsChange={noop} onRrGamesChange={noop}/>);
  expect(detail).toContain('How many courts are needed?'); expect(detail).toContain('Only 2 courts are available'); expect(detail).toContain('Unassigned courts remain available for rentals.');
});
