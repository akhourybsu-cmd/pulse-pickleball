import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { accessChangeError, tierLabel, type PlatformVenue } from '@/lib/admin/platformAdmin';
import { ADMIN_NAVIGATION } from '@/components/admin/adminNavigation';
import { AdminGuard } from '@/components/guards/AdminGuard';
import AdminDashboard from '@/pages/AdminDashboard';
import { VenueAccessEditor } from '@/pages/AdminVenues';

const state=vi.hoisted(()=>({access:true,isError:false,user:'admin',overview:{account_email:'admin@example.com',pending_requests:3,needs_info:2,venues:12,unverified_venues:4,recent_actions:[]}}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/hooks/useAuthState',()=>({useAuthState:()=>({user:state.user?{id:state.user}:null,loading:false,isAuthenticated:!!state.user})}));
vi.mock('@tanstack/react-query',()=>({useQuery:({queryKey}:any)=>({data:queryKey[0]==='platform-admin-access'?state.access:state.overview,isPending:false,isError:state.isError,refetch:vi.fn()}),useQueryClient:()=>({invalidateQueries:vi.fn()})}));
vi.mock('react-router-dom',()=>({Link:({to,children,...props}:any)=><a href={to} {...props}>{children}</a>,Navigate:({to}:any)=><span>Redirect:{to}</span>,useLocation:()=>({pathname:'/admin'}),useSearchParams:()=>[new URLSearchParams(),vi.fn()]}));
vi.mock('@/components/ThemeToggle',()=>({ThemeToggle:()=>null}));
vi.mock('@/components/Logo',()=>({Logo:()=> <span>PULSE</span>}));
vi.mock('@/components/ui/sheet',()=>({Sheet:()=>null,SheetContent:()=>null,SheetDescription:()=>null,SheetHeader:()=>null,SheetTitle:()=>null,SheetTrigger:()=>null}));
vi.mock('@/components/ui/dialog',()=>({Dialog:({children}:any)=><div>{children}</div>,DialogContent:({children,...props}:any)=><div {...props}>{children}</div>,DialogHeader:({children,...props}:any)=><div {...props}>{children}</div>,DialogTitle:({children,...props}:any)=><h2 {...props}>{children}</h2>,DialogDescription:({children}:any)=><p>{children}</p>}));
const venue:PlatformVenue={id:'venue',name:'Venue with a long name',city:'Boston',state:'MA',owner_id:'owner',owner_name:'Venue Owner',owner_email:'owner@example.com',group_id:'group',is_active:true,is_published:true,verification_approved_at:'2026-01-01',verification_approved_by:'admin',private_sample:false,modules:[],booking:false,facility:false};
const note='Complimentary onboarding access has been approved.';
beforeEach(()=>{state.access=true;state.isError=false;state.user='admin';});
describe('platform portal presentation',()=>{
 it('keeps primary navigation focused and archived tools out of the main menu',()=>{
   expect(ADMIN_NAVIGATION.map(n=>n.href)).toContain('/admin/venues');
   expect(ADMIN_NAVIGATION.map(n=>n.href)).toContain('/admin/venue-requests');
   expect(ADMIN_NAVIGATION.map(n=>n.href)).not.toContain('/admin/pairing');
   expect(ADMIN_NAVIGATION.map(n=>n.href)).not.toContain('/admin/biometrics');
   expect(ADMIN_NAVIGATION.map(n=>n.href)).not.toContain('/admin/manage');
 });
 it('shows approval and venue queues with a single accessible page heading',()=>{
   const html=renderToStaticMarkup(<AdminDashboard/>);
   expect(html.match(/<h1/g)).toHaveLength(1);
   expect(html).toContain('Needs your attention');expect(html).toContain('Waiting on applicant');
   expect(html).toContain('not a paid subscription');expect(html).toContain('minmax(0,1fr)');
 });
 it('shows a bounded explicit access review and cannot save without confirmation',()=>{
   const html=renderToStaticMarkup(<VenueAccessEditor venue={venue} onClose={vi.fn()} onSaved={async()=>{}}/>);
   expect(html).toContain('max-h-[90dvh]');expect(html).toContain('w-[calc(100%-1rem)]');
   expect(html).toContain('included access—not a billing change');expect(html).toMatch(/disabled=""[^>]*>Confirm access change/);
 });
 it('does not mount admin children on denied access, failures or sign-out',()=>{
   state.access=false;expect(renderToStaticMarkup(<AdminGuard><span>SECRET</span></AdminGuard>)).not.toContain('SECRET');
   state.isError=true;expect(renderToStaticMarkup(<AdminGuard><span>SECRET</span></AdminGuard>)).toContain('Retry access check');
   state.user='';expect(renderToStaticMarkup(<AdminGuard><span>SECRET</span></AdminGuard>)).toContain('/auth');
   const source=readFileSync('src/components/guards/AdminGuard.tsx','utf8');
   expect(source).toContain("['platform-admin-access', user?.id]");
 });
 it('keeps all new routes behind AdminGuard',()=>{
   const routes=readFileSync('src/App.tsx','utf8');
   for(const route of ['venues','activity','legacy-tools'])expect(routes).toContain('path="/admin/'+route+'" element={<AdminGuard>');
 });
});
describe('feature access validation',()=>{
 it('maps only the established venue features to readable access levels',()=>{
   expect(tierLabel(false,false)).toBe('Free community');expect(tierLabel(true,false)).toBe('Court booking');expect(tierLabel(false,true)).toBe('Facility tools');expect(tierLabel(true,true)).toBe('Both features');
 });
 it('requires a meaningful reason and future finite expiry',()=>{
   expect(accessChangeError(venue,['court_booking'],'no','')).toContain('reason');
   expect(accessChangeError(venue,['court_booking'],note,'invalid')).toContain('future');
   expect(accessChangeError(venue,['court_booking'],note,'2020-01-01')).toContain('future');
   expect(accessChangeError(venue,['court_booking'],note,'2099-01-01')).toBeNull();
 });
 it('locks samples and unverified upgrades, but permits removing unverified grants',()=>{
   expect(accessChangeError({...venue,private_sample:true},[],note,'')).toContain('sample');
   expect(accessChangeError({...venue,verification_approved_at:null},['court_booking'],note,'')).toContain('ownership');
   expect(accessChangeError({...venue,verification_approved_at:null},[],note,'')).toBeNull();
 });
 it('cannot use tier controls to cancel or reactivate a Stripe subscription',()=>{
   const paid={...venue,modules:[{module_key:'court_booking' as const,source:'subscription',enabled:true,expires_at:'2099-01-01',updated_at:'2026-01-01'}]};
   expect(accessChangeError(paid,[],note,'')).toContain('Stripe');
   expect(accessChangeError(paid,['court_booking'],note,'')).toBeNull();
   expect(accessChangeError({...paid,modules:[{...paid.modules[0],enabled:false}]},['court_booking'],note,'')).toContain('Stripe');
 });
});

