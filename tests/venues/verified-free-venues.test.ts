import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { applicationError, EMPTY_VENUE_APPLICATION, hasVenueModule } from '@/lib/venues/venueApplications';

const id = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const applicant=id(1), other=id(2), admin=id(3), unconfirmed=id(4), legacy=id(20);
const sql=readFileSync('supabase/migrations/20260917100000_verified_free_venues.sql','utf8');
const details={ ...EMPTY_VENUE_APPLICATION, name:'Test Venue',address:'100 Court Street',city:'Boston',state:'MA',website:'https://venue.example.com',contact_name:'Owner Name',
  contact_email:'owner@example.com',contact_phone:'555-555-5555',evidence:'The public business registration lists me as the owner. Please call the independently listed business number.',authorized:true };
let db:PGlite;
async function asUser(user:string|null, query:string,args:unknown[]=[]) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user??'']); await db.exec('SET ROLE authenticated');
  try { return await db.query(query,args); } finally { await db.exec('RESET ROLE'); }
}
const submit=async (user=applicant, data=details, request:string|null=null, venue:string|null=null) => {
  const result=await asUser(user,'SELECT submit_venue_application($1,$2,$3) AS id',[data,request,venue]); return result.rows[0].id as string;
};
const review=(request:string, decision='approved', user=admin, checked=true) => asUser(user,'SELECT review_venue_application($1,$2,$3,$4) AS result',[request,decision,'Business authority independently confirmed using the public business registry.',checked]);
const application=async (request:string) => (await db.query('SELECT * FROM venue_applications WHERE id=$1',[request])).rows[0];
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
    CREATE TYPE app_role AS ENUM('admin','user'); CREATE TYPE venue_type AS ENUM('other');
    CREATE TYPE group_visibility AS ENUM('public','unlisted','private'); CREATE TYPE group_join_method AS ENUM('open','request_to_join','invite_only');
    CREATE TABLE user_roles(user_id uuid,role app_role);
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
    CREATE TABLE venues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,slug text UNIQUE,address text,city text,state text,description text,owner_id uuid,venue_type venue_type,
      activation_state text,is_active bool,is_published bool,verification_requested_at timestamptz,verification_approved_at timestamptz,verification_approved_by uuid);
    CREATE TABLE groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,description text,type text,visibility group_visibility,join_method group_join_method,venue_id uuid,created_by uuid,is_venue_verified bool);
    CREATE UNIQUE INDEX one_official_venue ON groups(venue_id) WHERE type='venue_official';
    CREATE TABLE group_members(group_id uuid,user_id uuid,role text,status text);
    CREATE FUNCTION add_group_creator_as_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO group_members VALUES(NEW.id,NEW.created_by,'owner','active'); RETURN NEW; END $$;
    CREATE TRIGGER trigger_add_group_creator_as_owner AFTER INSERT ON groups FOR EACH ROW EXECUTE FUNCTION add_group_creator_as_owner();
    CREATE TABLE venue_staff(venue_id uuid,user_id uuid,role text,accepted_at timestamptz,is_active bool,status text,UNIQUE(venue_id,user_id));
    CREATE TABLE venue_courts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid,name text,is_active bool);
    CREATE TABLE group_events(id uuid DEFAULT gen_random_uuid(),group_id uuid,venue_id uuid,venue_court_id uuid,event_format text,start_time timestamptz,end_time timestamptz,title text,status text);
    CREATE TABLE notifications(recipient uuid,kind text,title text,body text,link text);
    CREATE FUNCTION create_notification(uuid,text,text,text,text,text,text,jsonb,uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO notifications VALUES($1,$2,$4,$5,$6) $$;
    GRANT SELECT,INSERT,UPDATE,DELETE ON venues,groups,group_members,venue_staff,venue_courts,group_events TO authenticated;
  `);
  for(const u of [applicant,other,admin,unconfirmed]) await db.query('INSERT INTO auth.users VALUES($1,$2)',[u,u===unconfirmed?null:new Date().toISOString()]);
  await db.query("INSERT INTO user_roles VALUES($1,'admin')",[admin]);
  await db.query("INSERT INTO venues(id,name,owner_id) VALUES($1,'Existing venue',$2)",[legacy,applicant]);
  await db.exec(sql); await db.exec(sql);
},30_000);
beforeEach(async()=>{
  await db.exec("SELECT set_config('request.jwt.claim.sub','',false); TRUNCATE venue_application_history,venue_applications,group_members,groups,venue_staff,venue_courts,group_events,notifications;");
  await db.query('DELETE FROM venue_module_access WHERE venue_id <> $1',[legacy]);
  await db.query('DELETE FROM venues WHERE id <> $1',[legacy]);
});
afterAll(async()=>{await db?.close();});

describe('venue ownership review',()=>{
  it('records a private request but creates no public venue until approval',async()=>{
    const req=await submit(); expect((await application(req)).status).toBe('pending');
    expect((await db.query('SELECT * FROM venues')).rows).toHaveLength(1);
    expect((await asUser(other,'SELECT * FROM venue_applications')).rows).toHaveLength(0);
    expect((await asUser(other,'SELECT * FROM venue_application_history')).rows).toHaveLength(0);
    expect((await asUser(applicant,'SELECT * FROM venue_application_history')).rows).toHaveLength(1);
    expect((await asUser(admin,'SELECT * FROM venue_applications')).rows).toHaveLength(1);
  });
  it('atomically creates verified venue, staff owner and community owner without paid grants',async()=>{
    const req=await submit(); await review(req); const app=await application(req);
    expect(app.status).toBe('approved');
    expect((await db.query('SELECT * FROM groups WHERE id=$1',[app.group_id])).rows[0]).toMatchObject({created_by:applicant,is_venue_verified:true,type:'venue_official'});
    expect((await db.query('SELECT * FROM group_members WHERE group_id=$1',[app.group_id])).rows[0]).toMatchObject({user_id:applicant,role:'owner',status:'active'});
    expect((await db.query('SELECT * FROM venue_staff WHERE venue_id=$1',[app.venue_id])).rows[0]).toMatchObject({user_id:applicant,role:'owner'});
    expect((await db.query('SELECT * FROM venue_module_access WHERE venue_id=$1',[app.venue_id])).rows).toHaveLength(0);
    await expect(review(req)).rejects.toThrow('no longer');
  });
  it('blocks unauthenticated, unconfirmed-email, incomplete and duplicate submissions',async()=>{
    await expect(asUser(null,'SELECT submit_venue_application($1)',[details])).rejects.toThrow('Sign in');
    await expect(submit(unconfirmed)).rejects.toThrow('Confirm');
    await expect(submit(applicant,{...details,authorized:false})).rejects.toThrow('authority');
    await expect(submit(applicant,{...details,evidence:'a'})).rejects.toThrow('evidence');
    await submit(); await expect(submit()).rejects.toThrow('already have');
  });
  it('requires an independent reviewer, recorded note and explicit ownership check',async()=>{
    const req=await submit(); await expect(review(req,'approved',applicant)).rejects.toThrow('admin');
    await expect(review(req,'approved',admin,false)).rejects.toThrow('Independently');
    await expect(asUser(admin,'SELECT review_venue_application($1,$2,$3,true)',[req,'approved','ok'])).rejects.toThrow('review note');
    const own=await submit(admin); await expect(review(own)).rejects.toThrow('Another');
  });
  it('returns actionable notes, supports resubmission and retains the review history',async()=>{
    const req=await submit(); await review(req,'needs_info');
    await expect(submit(other,details,req)).rejects.toThrow('not found');
    expect(await submit(applicant,{...details,evidence:details.evidence+' Additional public proof.'},req)).toBe(req);
    expect((await application(req)).review_note).toBeNull();
    expect((await db.query('SELECT * FROM venue_application_history WHERE application_id=$1',[req])).rows).toHaveLength(3);
    await review(req);
  });
  it('withdrawal is restricted and stale approval cannot create a venue',async()=>{
    const req=await submit(); await expect(asUser(other,'SELECT withdraw_venue_application($1)',[req])).rejects.toThrow('not found');
    await asUser(applicant,'SELECT withdraw_venue_application($1)',[req]); await expect(review(req)).rejects.toThrow('no longer');
  });
  it('prevents competing approvals for the same facility',async()=>{
    const first=await submit(), second=await submit(other); await review(first);
    await expect(review(second)).rejects.toThrow('already exists');
    expect((await application(second)).status).toBe('pending');
  });
  it('does not let a claimant attach to another owner’s venue',async()=>{
    await expect(submit(other,details,null,legacy)).rejects.toThrow('current venue owner');
  });
  it('invalidates verification on transfer, and re-verifies without creating a second community',async()=>{
    const req=await submit(); await review(req); const app=await application(req);
    await asUser(applicant,'UPDATE venues SET owner_id=$1 WHERE id=$2',[other,app.venue_id]);
    expect((await db.query('SELECT is_venue_verified FROM groups WHERE id=$1',[app.group_id])).rows[0].is_venue_verified).toBe(false);
    const next=await submit(other,details,null,app.venue_id as string); await review(next);
    expect((await application(next)).group_id).toBe(app.group_id);
    expect((await db.query('SELECT * FROM groups')).rows).toHaveLength(1);
  });
});
describe('venue capability and identity protections',()=>{
  it('preserves existing access; migration reruns never grant add-ons to new free venues',async()=>{
    expect((await db.query('SELECT * FROM venue_module_access WHERE venue_id=$1',[legacy])).rows).toHaveLength(2);
    const req=await submit(); await review(req); const app=await application(req);
    await db.exec(sql);
    expect((await db.query('SELECT * FROM venue_module_access WHERE venue_id=$1',[app.venue_id])).rows).toHaveLength(0);
  });
  it('blocks direct table approvals, entitlement writes, venue inserts and the old creation RPC',async()=>{
    const req=await submit();
    await expect(asUser(applicant,"UPDATE venue_applications SET status='approved' WHERE id=$1",[req])).rejects.toThrow('permission denied');
    await expect(asUser(applicant,"INSERT INTO venue_module_access VALUES($1,'court_booking','subscription',true,NULL,now())",[legacy])).rejects.toThrow('permission denied');
    await expect(asUser(applicant,"INSERT INTO venues(name) VALUES('Unreviewed')")).rejects.toThrow('permission denied');
    await expect(asUser(applicant,"SELECT create_venue_community('Unreviewed')")).rejects.toThrow('Ownership approval');
    await expect(asUser(applicant,'UPDATE venues SET verification_approved_at=now(),verification_approved_by=$1 WHERE id=$2',[applicant,legacy])).rejects.toThrow('Only PULSE');
  });
  it('does not award badges for ordinary groups or unapproved links',async()=>{
    await asUser(applicant,"INSERT INTO groups(name,type,created_by,is_venue_verified) VALUES('Crew','crew',$1,true)",[applicant]);
    expect((await db.query('SELECT is_venue_verified FROM groups')).rows[0].is_venue_verified).toBe(false);
    await expect(asUser(applicant,"INSERT INTO groups(name,type,created_by,venue_id) VALUES('Fake','venue_official',$1,$2)",[applicant,legacy])).rejects.toThrow('approved');
  });
  it('leaves community events free while enforcing court/booking entitlements in SQL',async()=>{
    const req=await submit(); await review(req); const app=await application(req);
    await asUser(applicant,"INSERT INTO group_events(group_id,venue_id,event_format,title) VALUES($1,$2,'open_play','Free community play')",[app.group_id,app.venue_id]);
    await expect(asUser(applicant,"INSERT INTO venue_courts(venue_id,name) VALUES($1,'Court 1')",[app.venue_id])).rejects.toThrow('add-on');
    await expect(asUser(applicant,"INSERT INTO group_events(group_id,venue_id,event_format) VALUES($1,$2,'reservation')",[app.group_id,app.venue_id])).rejects.toThrow('court_booking');
    await db.query("INSERT INTO venue_module_access VALUES($1,'court_booking','staff_grant',true,NULL,now())",[app.venue_id]);
    await asUser(applicant,"INSERT INTO venue_courts(venue_id,name) VALUES($1,'Court 1')",[app.venue_id]);
    await asUser(applicant,"INSERT INTO group_events(group_id,venue_id,event_format) VALUES($1,$2,'reservation')",[app.group_id,app.venue_id]);
    await expect(asUser(applicant,"INSERT INTO group_events(group_id,venue_id,event_format) VALUES($1,$2,'program_hold')",[app.group_id,app.venue_id])).rejects.toThrow('facility_tools');
    await db.query("UPDATE venue_module_access SET expires_at=now()-interval '1 minute' WHERE venue_id=$1",[app.venue_id]);
    await expect(asUser(applicant,"INSERT INTO group_events(group_id,venue_id,event_format) VALUES($1,$2,'reservation')",[app.group_id,app.venue_id])).rejects.toThrow('court_booking');
    await asUser(applicant,"UPDATE group_events SET status='canceled' WHERE group_id=$1",[app.group_id]);
  });
  it('revokes anonymous mutation privileges',async()=>{
    for(const sig of ['submit_venue_application(jsonb,uuid,uuid)','withdraw_venue_application(uuid)','review_venue_application(uuid,text,text,boolean)']) {
      expect((await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed",[sig])).rows[0].allowed).toBe(false);
    }
  });
  it('lets ordinary communities reference a venue as a location without reserving a court',async()=>{
    const group=id(99);
    await asUser(applicant,"INSERT INTO groups(id,name,type,created_by) VALUES($1,'Crew','crew',$2)",[group,applicant]);
    await asUser(applicant,"INSERT INTO group_events(group_id,venue_id,event_format) VALUES($1,$2,'open_play')",[group,legacy]);
    await expect(asUser(applicant,"INSERT INTO group_events(group_id,venue_id,event_format) VALUES($1,$2,'reservation')",[group,legacy])).rejects.toThrow('venue community');
  });
  it('notifies reviewers and applicants without leaking private evidence into notifications',async()=>{
    const req=await submit(); await review(req,'needs_info');
    const notices=(await db.query('SELECT * FROM notifications')).rows;
    expect(notices).toHaveLength(2); expect(notices[0]).toMatchObject({recipient:admin,link:'/admin/venue-requests'});
    expect(notices[1]).toMatchObject({recipient:applicant,link:'/player/venue-requests'});
    expect(JSON.stringify(notices)).not.toContain(details.contact_email);
    expect(JSON.stringify(notices)).not.toContain(details.evidence);
  });
  it('limits submission spam, including repeated resubmissions',async()=>{
    for(let i=0;i<5;i++) await submit(applicant,{...details,name:`Venue ${i}`});
    await expect(submit(applicant,{...details,name:'Venue six'})).rejects.toThrow('daily venue request limit');
  });
});
describe('venue presentation helpers',()=>{
  it('requires meaningful evidence and an HTTPS business reference',()=>{
    expect(applicationError(details)).toBeNull(); expect(applicationError({...details,website:'javascript:alert(1)'})).toContain('HTTPS');
    expect(applicationError({...details,authorized:false})).toContain('Confirm');
  });
  it('does not treat disabled or expired modules as paid access',()=>{
    expect(hasVenueModule([{module_key:'court_booking',source:'existing_venue',enabled:true,expires_at:null}],'court_booking')).toBe(true);
    expect(hasVenueModule([{module_key:'court_booking',source:'subscription',enabled:false,expires_at:null}],'court_booking')).toBe(false);
    expect(hasVenueModule([{module_key:'court_booking',source:'subscription',enabled:true,expires_at:'2020-01-01'}],'court_booking')).toBe(false);
  });
});
