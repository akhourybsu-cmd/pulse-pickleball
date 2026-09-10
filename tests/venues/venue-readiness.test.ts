import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { venueNextSteps } from '@/lib/venues/adminOverview';
import { nextVenueAccessChange, venueModulePresentation } from '@/lib/venues/moduleExperience';
import type { VenueModuleAccess } from '@/lib/venues/venueApplications';

const counts = { courts: 6, staff: 2, upcoming: 3, posts: 4, pendingMembers: 0 };
const ready = { counts, verified: true, isOwner: true, canManageCommunity: true, facilityEnabled: true, contactReady: true, privateSample: false };
describe('venue manager next steps', () => {
  it('puts pending player requests first', () => {
    const steps = venueNextSteps({ ...ready, verified: false, contactReady: false, counts: { ...counts, courts: 0, upcoming: 0, pendingMembers: 2 } });
    expect(steps.map(step => step.action)).toEqual(['members', 'verify', 'profile', 'facility', 'play']);
    expect(steps[0].title).toBe('2 join requests to review');
  });
  it('does not treat unpaid optional features as incomplete setup', () => {
    expect(venueNextSteps({ ...ready, facilityEnabled: false, counts: { ...counts, courts: 0 } })).toEqual([]);
  });
  it('does not infer empty courts, empty programs or pending members from failed reads', () => {
    expect(venueNextSteps({ ...ready, counts: undefined })).toEqual([]);
  });
  it('does not send a manager into owner-only verification or community moderation', () => {
    expect(venueNextSteps({ ...ready, verified: false, isOwner: false, canManageCommunity: false, counts: { ...counts, pendingMembers: 4, upcoming: 0 } })).toEqual([]);
  });
  it('keeps private sample venues out of ownership/contact setup prompts', () => {
    expect(venueNextSteps({ ...ready, privateSample: true, verified: false, contactReady: false })).toEqual([]);
  });
});

describe('venue feature access presentation', () => {
  const now = Date.parse('2026-09-10T12:00:00Z');
  const grant: VenueModuleAccess = { module_key: 'court_booking', enabled: true, source: 'subscription', expires_at: new Date(now + 1000).toISOString() };
  it('distinguishes paid access from included access without claiming a renewal date', () => {
    expect(venueModulePresentation([grant], 'court_booking', now)).toMatchObject({ active: true, subscribed: true, label: 'Paid access' });
    expect(venueModulePresentation([{ ...grant, source: 'existing_venue', expires_at: null }], 'court_booking', now)).toMatchObject({ active: true, subscribed: false, label: 'Included', accessThrough: null });
  });
  it('does not let a disabled or expired row mask a valid grant', () => {
    expect(venueModulePresentation([{ ...grant, enabled: false }, { ...grant, source: 'admin_grant' }], 'court_booking', now)).toMatchObject({ active: true, subscribed: false, label: 'Included' });
  });
  it('shows the expiry boundary as ended instead of an active subscription', () => {
    expect(venueModulePresentation([grant], 'court_booking', now + 1000)).toMatchObject({ active: false, subscribed: false, label: 'Access ended', accessThrough: null });
  });
  it('schedules the nearest enabled expiry and stays within browser timer limits', () => {
    expect(nextVenueAccessChange([grant], now)).toBe(1001);
    expect(nextVenueAccessChange([{ ...grant, enabled: false }], now)).toBeNull();
    expect(nextVenueAccessChange([{ ...grant, expires_at: 'invalid' }], now)).toBeNull();
    expect(nextVenueAccessChange([{ ...grant, expires_at: '2099-01-01T00:00:00Z' }], now)).toBe(2_147_483_647);
    expect(nextVenueAccessChange([grant], now + 1000)).toBeNull();
  });
});
