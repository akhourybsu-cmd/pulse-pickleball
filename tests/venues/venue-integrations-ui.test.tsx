import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VenueAddressCard } from '@/components/venue/VenueIntegrationsPanel';
import { resolveVenueAdminTab } from '@/lib/venues/navigation';
import type { VenueAddressSetup } from '@/lib/venues/integrations';

vi.mock('@/lib/venues/integrations', () => ({ VENUE_INTEGRATIONS: [{name:'PULSE address',description:'A memorable link to your venue.'}] }));
const setup: VenueAddressSetup = {venue_slug:'palace',verified:true,active:true,private_sample:false,public_ready:true,connection:null};
const props = (patch:Partial<VenueAddressSetup>={}) => ({setup:{...setup,...patch},onCheck:vi.fn().mockResolvedValue({slug:'palace',available:true,reason:null}),onRequest:vi.fn().mockResolvedValue(undefined),onRefresh:vi.fn(),onOpenTab:vi.fn(),canManageCommunity:true});
const connected={id:'id',venue_id:'venue',slug:'palace',status:'connected' as const,requested_at:'2026-09-27T12:00:00Z',checked_at:'2026-09-27T12:01:00Z'};

describe('venue integration setup', () => {
  it('offers integration navigation to facility managers, including free venues', () => {
    expect(resolveVenueAdminTab('integrations',true,false,false)).toBe('integrations');
    expect(resolveVenueAdminTab('integrations',false,true,true)).toBe('general');
  });
  it('shows the current shareable link and understandable setup steps', () => {
    const html=renderToStaticMarkup(<VenueAddressCard {...props()} />);
    expect(html).toContain('Check availability'); expect(html).toContain('PULSE handles the connection for you.'); expect(html).toContain('https://pulsepb.com/venues/palace'); expect(html).toContain('free PULSE account');
  });
  it('does not present a pending or private address as shareable', () => {
    for(const status of ['requested','provisioning','action_required','error'] as const) {
      const html=renderToStaticMarkup(<VenueAddressCard {...props({connection:{...connected,status}})} />);
      expect(html).toContain('not ready to share yet'); expect(html).not.toContain('href="https://palace.pulsepb.com"');
    }
    const html=renderToStaticMarkup(<VenueAddressCard {...props({connection:connected,public_ready:false})} />);
    expect(html).toContain('Address ready · page private'); expect(html).not.toContain('Website live'); expect(html).toContain('Review access &amp; privacy'); expect(html).not.toContain('href="https://palace.pulsepb.com"'); expect(html).not.toContain('Copy venue link');
  });
  it('offers verified connected links, and a clear verification/sample path', () => {
    const live=renderToStaticMarkup(<VenueAddressCard {...props({connection:connected})} />);
    expect(live).toContain('Website live'); expect(live).toContain('live and ready to share'); expect(live).toContain('href="https://palace.pulsepb.com"');
    expect(renderToStaticMarkup(<VenueAddressCard {...props({verified:false})} />)).toContain('Review ownership verification');
    const sample=renderToStaticMarkup(<VenueAddressCard {...props({private_sample:true})} />);
    expect(sample).toContain('This sample stays private'); expect(sample).not.toContain('<input'); expect(sample).not.toContain('Copy venue link');
  });
  it('checks availability before requesting, invalidates a check when edited, and surfaces a save failure', async () => {
    const p=props(); p.onRequest.mockRejectedValueOnce(new Error('That address is already taken.'));
    let renderer:ReactTestRenderer;
    await act(async()=>{renderer=create(<VenueAddressCard {...p} />);});
    const submit=()=>act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});
    await submit(); expect(p.onCheck).toHaveBeenCalledWith('palace'); expect(p.onRequest).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer!.toJSON())).toContain('Request this address');
    await act(async()=>renderer.root.findByType('input').props.onChange({target:{value:'PALACE-BOSTON'}}));
    expect(JSON.stringify(renderer!.toJSON())).toContain('Check availability');
    expect(renderer!.root.findByType('input').props.value).toBe('palace-boston');
    p.onCheck.mockResolvedValue({slug:'palace-boston',available:true,reason:null});
    await submit(); await submit();
    expect(p.onRequest).toHaveBeenCalledWith('palace-boston');
    expect(JSON.stringify(renderer!.toJSON())).toContain('That address is already taken.');
    await act(async()=>renderer!.unmount());
  });
  it('prevents unavailable names from advancing and directs prerequisites to existing settings', async () => {
    const p=props(); p.onCheck.mockResolvedValue({slug:'palace',available:false,reason:'Try adding your city.'});
    let renderer:ReactTestRenderer;
    await act(async()=>{renderer=create(<VenueAddressCard {...p} />);});
    await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
    expect(JSON.stringify(renderer!.toJSON())).toContain('Try adding your city.'); expect(p.onRequest).not.toHaveBeenCalled();
    await act(async()=>renderer!.update(<VenueAddressCard {...p} setup={{...setup,verified:false}} />));
    const button=renderer!.root.findAllByType('button').find(item=>item.children.includes('Review ownership verification'))!;
    await act(async()=>button.props.onClick()); expect(p.onOpenTab).toHaveBeenCalledWith('modules');
    await act(async()=>renderer!.unmount());
  });
});
