import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const owner='30000000-0000-4000-8000-000000000001', outsider='30000000-0000-4000-8000-000000000002';
let db:PGlite, venue:string, group:string;
async function asUser(user:string|null, query:string,args:unknown[]=[]) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user??'']);
  await db.exec(user?'SET ROLE authenticated':'SET ROLE anon');
  try { return await db.query(query,args); } finally { await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)"); }
}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
    CREATE TYPE app_role AS ENUM('admin'); CREATE TYPE venue_role AS ENUM('owner','manager','staff','organizer');
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE venues(id uuid PRIMARY KEY,name text,slug text,owner_id uuid,venue_type text,activation_state text,is_active bool,is_published bool,is_searchable bool,allow_follow bool,
      description text,tagline text,welcome_headline text,welcome_message text,primary_color text,secondary_color text,timezone text,hours_of_operation jsonb,amenities text[],verification_approved_at timestamptz,verification_approved_by uuid);
    CREATE TABLE groups(id uuid PRIMARY KEY,name text,description text,type text,visibility text,join_method text,venue_id uuid REFERENCES venues(id),created_by uuid,settings jsonb,invite_code text DEFAULT 'INVITE',invite_code_expires_at timestamptz,is_venue_verified bool);
    CREATE TABLE group_members(group_id uuid,user_id uuid,role text,status text DEFAULT 'active');
    CREATE TABLE venue_staff(venue_id uuid,user_id uuid,role venue_role,accepted_at timestamptz,is_active bool,status text);
    CREATE TABLE venue_module_access(venue_id uuid,module_key text,source text,enabled bool);
    CREATE TABLE venue_courts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid,court_number integer,name text,is_active bool,is_premium bool,court_type text,surface_type text,hourly_rate numeric,notes text);
    CREATE TABLE group_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid,venue_id uuid,venue_court_id uuid,parent_event_id uuid,created_by uuid,title text,description text,event_format text,location_type text,start_time timestamptz,end_time timestamptz,capacity integer,waitlist_enabled bool,rotation_style text);
    CREATE TABLE group_posts(id uuid DEFAULT gen_random_uuid(),group_id uuid,user_id uuid,type text,title text,content text,pinned bool);
    CREATE TABLE group_messages(id uuid DEFAULT gen_random_uuid(),group_id uuid,user_id uuid,content text,is_pinned bool,pinned_at timestamptz,pinned_by uuid);
    CREATE TABLE group_invites(id uuid DEFAULT gen_random_uuid(),group_id uuid);
    CREATE TABLE venue_payment_accounts(venue_id uuid); CREATE TABLE venue_payment_settings(venue_id uuid,accepting_payments bool);
    CREATE TABLE payment_orders(venue_id uuid,group_id uuid); CREATE TABLE payment_subscriptions(venue_id uuid); CREATE TABLE venue_subscriptions(venue_id uuid);
    CREATE TABLE unified_events(venue_id uuid,host_venue_id uuid,host_group_id uuid);
    CREATE TABLE round_robin_events(id uuid,venue_id uuid,group_id uuid,status text);
    CREATE TABLE round_robin_schedule(event_id uuid,a1_player_id uuid,a2_player_id uuid,b1_player_id uuid,b2_player_id uuid,a1_guest_id uuid,a2_guest_id uuid,b1_guest_id uuid,b2_guest_id uuid);
    CREATE TABLE profiles(id uuid,full_name text,display_name text);
    CREATE TABLE guest_players(id uuid,group_id uuid,display_name text);
    CREATE SCHEMA storage;
    CREATE TABLE storage.objects(bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon,authenticated;
    GRANT ALL ON storage.objects TO anon,authenticated;
    CREATE POLICY permissive ON storage.objects FOR ALL USING(true) WITH CHECK(true);
    CREATE FUNCTION add_group_creator_as_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO group_members(group_id,user_id,role) VALUES(NEW.id,NEW.created_by,'owner'); RETURN NEW; END $$;
    CREATE TRIGGER add_owner AFTER INSERT ON groups FOR EACH ROW EXECUTE FUNCTION add_group_creator_as_owner();
  `);
  const foundation=readFileSync('supabase/migrations/20260917100000_verified_free_venues.sql','utf8');
  await db.exec(foundation.match(/CREATE OR REPLACE FUNCTION public.validate_venue_group\(\)[\s\S]*?END \$\$;/)![0]);
  await db.exec('CREATE TRIGGER check_venue_group_permission BEFORE INSERT OR UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION validate_venue_group()');
  // Deliberately broader than production. Restrictive gates must still block outsiders.
  const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows as {tablename:string}[];
  for(const {tablename:t} of tables) await db.exec(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY; GRANT ALL ON ${t} TO authenticated,anon; CREATE POLICY everyone ON ${t} FOR ALL USING(true) WITH CHECK(true)`);
  await db.query('INSERT INTO auth.users VALUES($1,now()),($2,now())',[owner,outsider]);
  await db.exec(readFileSync('supabase/migrations/20260920100000_private_venue_sandboxes.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20260920110000_private_venue_public_surfaces.sql','utf8'));
  const result=await db.query("SELECT provision_private_venue_sandbox($1,'Sample Palace') AS result",[owner]);
  ({venue_id:venue,group_id:group}=result.rows[0].result as {venue_id:string,group_id:string});
},30_000);
afterAll(async()=>{await db?.close();});

describe('private sample venue',()=>{
  it('prevents public media uploads without affecting ordinary venue uploads',async()=>{
    for (const [bucket,id] of [['venue-logos',venue],['groups',group],['group-post-images',group],['group-message-images',group],['group-files',group]]) {
      expect((await asUser(owner,'SELECT can_upload_public_venue_media($1,$2) AS allowed',[bucket,`${id}/photo.jpg`])).rows[0].allowed).toBe(false);
      await expect(asUser(owner,'INSERT INTO storage.objects VALUES($1,$2)',[bucket,`${id}/photo.jpg`])).rejects.toThrow(/row-level security/);
    }
    await asUser(owner,"INSERT INTO storage.objects VALUES('venue-logos','normal-venue/photo.jpg')");
    await expect(asUser(owner,'UPDATE storage.objects SET name=$1',[`${venue}/photo.jpg`])).rejects.toThrow(/row-level security/);
  });
  it('keeps the public kiosk name RPC private for sample events',async()=>{
    const event='30000000-0000-4000-8000-000000000050';
    await db.query("INSERT INTO round_robin_events VALUES($1,$2,$3,'live')",[event,venue,group]);
    await db.query("INSERT INTO profiles VALUES($1,'Sample owner',NULL)",[owner]);
    await db.query('INSERT INTO round_robin_schedule(event_id,a1_player_id) VALUES($1,$2)',[event,owner]);
    expect((await asUser(owner,'SELECT * FROM rr_kiosk_participant_names($1)',[event])).rows).toHaveLength(1);
    for (const user of [null,outsider]) expect((await asUser(user,'SELECT * FROM rr_kiosk_participant_names($1)',[event])).rows).toHaveLength(0);
  });
  it('provisions six courts, both included modules, a week of programs, posts and chat',async()=>{
    expect((await asUser(owner,'SELECT * FROM venue_courts WHERE venue_id=$1',[venue])).rows).toHaveLength(6);
    expect((await asUser(owner,'SELECT * FROM venue_module_access WHERE venue_id=$1 AND enabled AND source=$2',[venue,'staff_grant'])).rows).toHaveLength(2);
    expect((await asUser(owner,'SELECT * FROM group_events WHERE group_id=$1',[group])).rows).toHaveLength(29);
    expect((await asUser(owner,'SELECT * FROM group_posts WHERE group_id=$1',[group])).rows).toHaveLength(3);
    expect((await asUser(owner,'SELECT * FROM group_messages WHERE group_id=$1',[group])).rows).toHaveLength(2);
  });
  it('sets a single owner in all layers without pretending to verify a real business',async()=>{
    expect((await asUser(owner,'SELECT * FROM venues WHERE id=$1',[venue])).rows[0]).toMatchObject({owner_id:owner,is_published:false,is_searchable:false,verification_approved_at:null});
    expect((await asUser(owner,'SELECT * FROM groups WHERE id=$1',[group])).rows[0]).toMatchObject({created_by:owner,visibility:'private',join_method:'invite_only',invite_code:null,is_venue_verified:false,settings:expect.objectContaining({private_sample:true})});
    expect((await asUser(owner,'SELECT * FROM group_members WHERE group_id=$1',[group])).rows).toEqual([expect.objectContaining({user_id:owner,role:'owner'})]);
    expect((await asUser(owner,'SELECT * FROM venue_staff WHERE venue_id=$1',[venue])).rows).toEqual([expect.objectContaining({user_id:owner,role:'owner'})]);
  });
  it('blocks anonymous and different users from direct table reads and legacy discovery RPC',async()=>{
    for(const user of [outsider,null]) {
      for(const table of ['venues','venue_courts','venue_module_access','venue_staff','groups','group_members','group_events','group_posts','group_messages']) {
        expect((await asUser(user,`SELECT * FROM ${table}`)).rows,table).toHaveLength(0);
      }
      expect((await asUser(user,'SELECT * FROM get_user_venues($1)',[owner])).rows).toHaveLength(0);
    }
  });
  it('does not change visibility of unrelated venues',async()=>{
    const otherVenue='30000000-0000-4000-8000-000000000090';
    await db.query("INSERT INTO venues(id,name,owner_id,is_active) VALUES($1,'Normal venue',$2,true)",[otherVenue,outsider]);
    try { expect((await asUser(null,'SELECT * FROM venues WHERE id=$1',[otherVenue])).rows).toHaveLength(1); }
    finally { await db.query('DELETE FROM venues WHERE id=$1',[otherVenue]); }
  });
  it('forbids public visibility, invites, verification and ownership transfer even for the owner',async()=>{
    for(const q of ["UPDATE venues SET is_published=true WHERE id=$1","UPDATE venues SET is_searchable=true WHERE id=$1","UPDATE venues SET verification_approved_at=now() WHERE id=$1",`UPDATE venues SET owner_id='${outsider}' WHERE id=$1`]) {
      await expect(asUser(owner,q,[venue])).rejects.toThrow(/Private sample/);
    }
    await expect(asUser(owner,"UPDATE groups SET visibility='public' WHERE id=$1",[group])).rejects.toThrow(/owner-only/);
    await expect(asUser(owner,"UPDATE groups SET invite_code='NEWCODE' WHERE id=$1",[group])).rejects.toThrow(/Invitations/);
    await expect(asUser(owner,'INSERT INTO group_invites(group_id) VALUES($1)',[group])).rejects.toThrow(/Invitations/);
  });
  it('blocks member and staff additions and prevents billing even for a privileged write',async()=>{
    await expect(asUser(owner,"INSERT INTO group_members(group_id,user_id,role) VALUES($1,$2,'member')",[group,outsider])).rejects.toThrow(/Only the owner/);
    await expect(asUser(owner,"INSERT INTO venue_staff(venue_id,user_id,role) VALUES($1,$2,'manager')",[venue,outsider])).rejects.toThrow(/Only the owner/);
    for(const t of ['venue_payment_accounts','payment_orders','payment_subscriptions','venue_subscriptions']) await expect(db.query(`INSERT INTO ${t}(venue_id) VALUES($1)`,[venue])).rejects.toThrow(/Billing is disabled/);
    await expect(db.query('INSERT INTO venue_payment_settings VALUES($1,true)',[venue])).rejects.toThrow(/Billing is disabled/);
  });
  it('keeps owner edits usable, preserves the sample marker, and does not overwrite edits on retry',async()=>{
    await asUser(owner,"UPDATE venues SET tagline='My own playground' WHERE id=$1",[venue]);
    await asUser(owner,"UPDATE groups SET settings='{}' WHERE id=$1",[group]);
    const retry=(await db.query("SELECT provision_private_venue_sandbox($1,'Different name') AS result",[owner])).rows[0].result;
    expect(retry).toEqual({venue_id:venue,group_id:group,already_exists:true});
    expect((await asUser(owner,'SELECT tagline FROM venues WHERE id=$1',[venue])).rows[0].tagline).toBe('My own playground');
    expect((await asUser(owner,'SELECT settings FROM groups WHERE id=$1',[group])).rows[0].settings).toEqual({private_sample:true});
  });
  it('prevents ordinary accounts from provisioning or changing the private registry',async()=>{
    await expect(asUser(owner,"SELECT provision_private_venue_sandbox($1,'Unauthorized')",[outsider])).rejects.toThrow(/permission denied/);
    await expect(asUser(owner,'DELETE FROM private_venue_sandboxes WHERE venue_id=$1',[venue])).rejects.toThrow(/permission denied/);
    await expect(asUser(owner,'DELETE FROM groups WHERE id=$1',[group])).rejects.toThrow(/foreign key/);
  });
});
