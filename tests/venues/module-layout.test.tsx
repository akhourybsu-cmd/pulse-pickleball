import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { VenueModulesPanel } from '@/components/venue/VenueModulesPanel';

const state=vi.hoisted(()=>({active:true}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/hooks/useVenueModules',()=>({useVenueModules:()=>({loading:false,isError:false,booking:state.active,facility:state.active,data:state.active ? [
  {module_key:'court_booking',enabled:true,source:'subscription',expires_at:null},
  {module_key:'facility_tools',enabled:true,source:'staff_grant',expires_at:null},
] : []})}));
vi.mock('@/hooks/usePrivateVenueSandbox',()=>({usePrivateVenuePaymentTesting:()=>false}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:{mode:'test'},isError:false})}));
vi.mock('@/lib/payments',()=>({paymentApi:vi.fn()}));
vi.mock('@/components/venue/VenueAddonCheckout',()=>({VenueAddonCheckout:()=> <div>Checkout placeholder</div>}));
const render=()=>renderToStaticMarkup(<MemoryRouter><VenueModulesPanel venueId="local-sample" venueName="Test venue" verified canVerify /></MemoryRouter>);
beforeEach(()=>{state.active=true;});
it('puts existing feature management ahead of a collapsed upgrade guide',()=>{
  const html=render();
  expect(html).toContain('Manage your venue features'); expect(html).toContain('Upgrade guide &amp; ownership');
  expect(html).not.toMatch(/<details[^>]*\bopen=/); expect(html).not.toContain('See paid features in action');
  expect(html).toContain('View booking demo'); expect(html).toContain('View operations demo');
});
it('keeps included grants, paid access, and payment availability distinct',()=>{
  const html=render();
  expect(html).toContain('Paid access'); expect(html).toContain('Included access · no payment required');
  expect(html).toContain('$10 USD / month · paid feature access'); expect(html).toContain('Test checkout only');
  expect(html).toContain('Manage subscription'); expect(html).not.toContain('Checkout placeholder');
});
it('retains the expanded onboarding guide and demo for a free venue',()=>{
  state.active=false;
  const html=render(); expect(html).toMatch(/<details[^>]*\bopen=/);
  expect(html).toContain('See paid features in action'); expect(html).toContain('Choose your paid features');
  expect(html).toContain('Checkout placeholder');
});
