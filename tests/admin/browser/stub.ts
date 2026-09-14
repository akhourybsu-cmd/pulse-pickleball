// Local fake data only. Every RPC mutation is blocked unless explicitly simulated below.
export const useAuthState=()=>({user:{id:'sample-admin',email:'admin@example.com'},isAuthenticated:true,loading:false});
const params=new URLSearchParams(location.search);
const long=params.has('long');
const venue={id:'venue-sample',name:long?'PickleballPalaceWithAnUnusuallyLongUnbrokenVenueNameForLayoutChecks':'Pickleball Palace (local preview)',city:'Boston',state:'MA',owner_id:'sample-owner',owner_name:'Venue Owner',owner_email:long?'an.unusually.long.business.contact.email@example.com':'owner@example.com',group_id:'group-sample',is_active:true,is_published:true,verification_approved_at:'2026-09-01T00:00:00Z',verification_approved_by:'sample-admin',private_sample:false,modules:[],booking:false,facility:false};
let actions:any[]=[];
export const supabase={
  auth:{getUser:async()=>({data:{user:{id:'sample-admin'}}})},
  from:(table:string)=>{
    let value:any[]=table==='user_roles'?[{role:'admin'}]:table==='platform_admin_audit'?actions:table==='venue_applications'?[{id:'request-sample',applicant_id:'sample-owner',venue_id:null,group_id:null,status:'pending',created_at:'2026-09-01T00:00:00Z',details:{name:'Example Venue',address:'123 Court Lane',city:'Boston',state:'MA',contact_name:'Example Owner',contact_email:'owner@example.com',contact_phone:'555-555-5555',website:'https://example.com',evidence:'Fictional business evidence for UI preview only.'}}]:[];
    const result={data:value,error:null};
    const chain:any={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,range:()=>chain,maybeSingle:()=>Promise.resolve({data:value[0],error:null}),then:(resolve:any)=>Promise.resolve(result).then(resolve)};return chain;
  },
  rpc:async(name:string,args:any)=>{
    if(params.has('error'))return {error:new Error('Local preview connection error'),data:null};
    if(name==='platform_admin_overview')return {data:{account_email:'admin@example.com',pending_requests:3,needs_info:2,venues:12,unverified_venues:4,recent_actions:actions},error:null};
    if(name==='platform_admin_venues')return {data:{total:1,rows:[venue]},error:null};
    if(name==='platform_set_venue_access') {
      venue.booking=args.p_modules.includes('court_booking');venue.facility=args.p_modules.includes('facility_tools');
      (venue as any).modules=args.p_modules.map((key:string)=>({module_key:key,source:'staff_grant',enabled:true,expires_at:args.p_expires,updated_at:new Date().toISOString()}));
      actions.unshift({id:'action-'+Date.now(),venue_id:venue.id,action:'venue_access_changed',note:args.p_note,created_at:new Date().toISOString()});
      return {data:venue.modules,error:null};
    }
    return {error:new Error('Backend mutations are blocked in this local preview.'),data:null};
  }
};
