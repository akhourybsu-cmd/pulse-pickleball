import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VenueRequests from '@/pages/player/VenueRequests';

const state = vi.hoisted(() => ({
  query: {} as any, params: new URLSearchParams(), setParams: vi.fn(), keys: [] as unknown[][],
  buttons: [] as { label: string; disabled?: boolean; click?: () => any }[], form: null as any,
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => { state.keys.push(options.queryKey); return state.query; }, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [state.params, state.setParams], Link: ({ to, children }: any) => <a href={to}>{children}</a> }));
vi.mock('@/components/venue/VenueApplicationForm', () => ({ VenueApplicationForm: (props: any) => { state.form = props; return <div>Ownership evidence form</div>; } }));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, onClick, disabled, asChild }: any) => {
  const label = (Array.isArray(children) ? children : [children]).filter(child => typeof child === 'string').join('').trim();
  state.buttons.push({ label, disabled, click: onClick });
  return asChild ? children : <button disabled={disabled}>{children}</button>;
} }));
beforeEach(() => {
  vi.clearAllMocks(); state.params = new URLSearchParams('venue=venue-a'); state.keys = []; state.buttons = []; state.form = null;
  state.query = { data: [], isPending: false, isError: false, refetch: vi.fn() };
});
const render = () => renderToStaticMarkup(<VenueRequests />);

describe('existing venue ownership review', () => {
  it('scopes requests to the signed-in owner and selected venue', () => {
    const html = render(); expect(state.keys).toEqual([['venue-applications', 'owner', 'venue-a', 0]]);
    expect(html).toContain('Venue ownership review'); expect(html).toContain('No ownership requests are on file for this venue');
    state.buttons.find(button => button.label === 'Submit ownership evidence')!.click!();
    expect(state.setParams).toHaveBeenCalledWith({ venue: 'venue-a', new: '1' });
  });
  it('preserves venue context when closing an evidence form', () => {
    state.params.set('new', '1'); expect(render()).toContain('Ownership evidence form');
    state.form.onCancel(); expect(state.setParams).toHaveBeenCalledWith({ venue: 'venue-a' });
  });
  it('does not open a duplicate form before a scoped request check succeeds', () => {
    state.params.set('new', '1'); state.query.data = undefined; state.query.isPending = true;
    expect(render()).not.toContain('Ownership evidence form');
    state.query.isPending = false; state.query.isError = true;
    expect(render()).toContain('We couldn’t load venue requests'); expect(state.form).toBeNull();
  });
  it('keeps an existing draft mounted when a background refresh fails', () => {
    state.params.set('new', '1'); state.query.isError = true;
    expect(render()).toContain('Ownership evidence form');
  });
  it('directs an owner to an already open request without suggesting a duplicate', () => {
    state.params.set('new', '1');
    state.query.data = [{ id: 'r1', venue_id: 'venue-a', status: 'pending', details: { name: 'ELEVENO', city: 'Foxboro' }, created_at: '2026-09-09' }];
    const html = render(); expect(html).toContain('already open for this venue');
    expect(html).toContain('Your existing venue remains available during review');
    expect(html).not.toContain('Ownership evidence form'); expect(html).not.toContain('No community is created');
  });
  it('remounts form state when the scoped venue changes', () => {
    const first = VenueRequests(); state.params.set('venue', 'venue-b'); const next = VenueRequests();
    expect(first.key).toBe('owner:venue-a'); expect(next.key).toBe('owner:venue-b');
  });
});
