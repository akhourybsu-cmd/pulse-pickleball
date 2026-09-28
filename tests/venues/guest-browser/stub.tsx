import { useSyncExternalStore } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
const listeners = new Set<() => void>();
let signedIn = false;
let emailCallback = '';
export const previewSignOut = () => { signedIn = false; listeners.forEach(fn => fn()); };
export const confirmPreview = () => { signedIn = true; listeners.forEach(fn => fn()); return emailCallback; };
export function useAuthState() {
  const current = useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => signedIn);
  return { loading: false, isAuthenticated: current, user: current ? { id: 'preview-user' } : null, profile: { full_name: 'Guest Preview' } };
}
export const community = {
  id: '10000000-0000-4000-8000-000000000001', name: 'Pickleball Palace', description: 'Great games, good company, and a court for every kind of player.',
  visibility: 'public', join_method: 'open', member_count: 184, is_venue_verified: true, icon_url: null, cover_url: null,
  venue: { id: 'venue', slug: 'pickleball-palace', name: 'Pickleball Palace', address: '42 Court Street', city: 'Boston', state: 'MA', tagline: 'Your court. Your community.',
    welcome_headline: 'Come for a game. Stay for the people.', welcome_message: 'Six indoor courts, open play for every level, and a community that makes you feel at home.\n\nWhether you’re picking up a paddle for the first time or finding your next doubles partner, there’s a place for you here.',
    primary_color: '#c9962f', secondary_color: '#263b37', website_url: 'https://example.com', booking_enabled: true },
  courts: Array.from({ length: 6 }, (_, i) => ({ id: `court-${i}`, name: `Court ${i + 1}`, court_number: i + 1, court_type: 'Indoor', surface_type: 'Cushioned' })),
};
export const supabase = {
  rpc: (name: string, args?: Record<string, unknown>) => {
    if (name === 'find_group_by_invite_code' || name === 'join_group_by_code') {
      const data = name === 'find_group_by_invite_code' ? [{ ...community, name: 'Rally House Sports', is_expired: args?.p_code === 'EXPIRED' }] : { status: args?.p_code === 'PENDING' ? 'pending' : 'joined', group_id: community.id };
      const result = { data: args?.p_code === 'REVOKED' ? [] : data, error: null };
      return Object.assign(Promise.resolve(result), { abortSignal: () => Promise.resolve(result) });
    }
    if (['get_venue_address_setup','check_venue_address','request_venue_address','list_venue_address_requests','queue_venue_address_check'].includes(name)) {
      const setup=JSON.parse(sessionStorage.getItem('venue-address-preview') || '{"venue_slug":"pickleball-palace","verified":true,"active":true,"public_ready":true,"private_sample":false,"connection":null}');
      let data=setup;
      if(name==='queue_venue_address_check') return Promise.resolve({data:null,error:null});
      if(name==='check_venue_address') data={slug:args?.p_slug,available:args?.p_slug!=='taken',reason:args?.p_slug==='taken'?'That address is already taken. Try adding your city.':null};
      if(name==='request_venue_address') { setup.connection={id:'preview',venue_id:args?.p_venue_id,slug:args?.p_slug,status:'requested',requested_at:new Date().toISOString(),checked_at:null}; sessionStorage.setItem('venue-address-preview',JSON.stringify(setup)); }
      if(name==='list_venue_address_requests') data=setup.connection?[{...setup.connection,venue_name:'Pickleball Palace'}]:[];
      return Promise.resolve({data,error:null});
    }
    const result = { data: name === 'get_public_community' ? args?.p_venue_slug === 'private' ? null : community : name === 'list_public_communities' ? [community] : { verified: true, method: 'none', userId: 'preview-user', sessionId: 'preview-session' }, error: null, status: 200 };
    return Object.assign(Promise.resolve(result), { abortSignal: () => Promise.resolve(result) });
  },
  auth: {
    getUser: async () => ({ data: { user: signedIn ? { id: 'preview-user' } : null }, error: null }),
    getSession: async () => ({ data: { session: signedIn ? { user: { id: 'preview-user' } } : null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => { signedIn = true; listeners.forEach(fn => fn()); return { data: { user: { id: 'preview-user' } }, error: null }; },
    signUp: async (args: { options: { emailRedirectTo: string } }) => { emailCallback = args.options.emailRedirectTo; return { data: { user: { id: 'preview-user' }, session: null }, error: null }; },
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }), listFactors: async () => ({ data: { all: [], totp: [] }, error: null }) },
  },
  functions: { invoke: async (name?:string) => {
    if(name==='venue-integrations') {
      const setup=JSON.parse(sessionStorage.getItem('venue-address-preview')!);
      const connected=setup.connection.status==='action_required';
      setup.connection.status=connected?'connected':'action_required'; setup.connection.checked_at=new Date().toISOString();
      setup.connection.provider_details={host:connected?'HOST_ACTIVE':'HOST_UNHOSTED',ownership:connected?'OWNERSHIP_ACTIVE':'OWNERSHIP_MISSING',certificate:connected?'CERT_ACTIVE':'CERT_PREPARING',dns:connected?[]:[{domainName:`${setup.connection.slug}.pulsepb.com`,type:'TXT',rdata:'hosting-site=preview-only',requiredAction:'ADD'}],issues:[]};
      sessionStorage.setItem('venue-address-preview',JSON.stringify(setup)); return {data:{status:setup.connection.status},error:null};
    }
    return { data: { biometric_enabled: false }, error: null };
  } },
  from: () => { const query = { select: () => query, eq: () => query, abortSignal: () => query, maybeSingle: async () => ({ data: { mfa_method: 'none' }, error: null }) }; return query; },
};
export default function SignedInSurface() {
  const location = useLocation();
  return <><div className="rounded-xl border p-5"><h1 className="text-xl font-semibold">Signed-in destination</h1><p className="break-all">{location.pathname}{location.search}{location.hash}</p></div><Outlet /></>;
}
