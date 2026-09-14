import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const uid = (n: number) => `a0000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const admin=uid(1), owner=uid(2), former=uid(3), venue=uid(10), otherVenue=uid(11), group=uid(20);
let db: PGlite;
async function asUser(user: string | null, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user ?? '']); await db.exec('SET ROLE authenticated');
  try { return await db.query(sql,args); } finally { await db.exec('RESET ROLE'); }
}
const snapshot = async () => (await db.query('SELECT platform_venue_access_snapshot($1) AS value',[venue])).rows[0].value;
const grant = async (modules: string[] = ['court_booking'], user = admin, expires: string | null = null, expected?: unknown, note = 'Complimentary feature approved for onboarding support.') =>
  asUser(user,'SELECT platform_set_venue_access($1,$2,$3,$4,$5) AS value',[venue,modules,expires,note,expected ?? await snapshot()]);
const details={name:'Another Venue',address:'100 Court Street',city:'Boston',state:'MA',description:'Test',website:'https://venue.example.com',contact_name:'Owner',contact_email:'owner@example.com',contact_phone:'555-555-5555',evidence:'Business records demonstrate my authority to represent this venue.',authorized:true,visibility:'public',join_method:'open'};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
    CREATE TYPE app_role AS ENUM('admin','user'); CREATE TYPE venue_type AS ENUM('other');
    CREATE TYPE group_visibility AS ENUM('public','unlisted','private'); CREATE TYPE group_join_method AS ENUM('open','request_to_join','invite_only');
    CREATE TABLE user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),role app_role,UNIQUE(user_id,role));
    ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
    GRANT SELECT,INSERT,UPDATE,DELETE ON user_roles TO authenticated;
    CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT USING(user_id=auth.uid());
    CREATE POLICY "Admins can manage all roles" ON user_roles FOR ALL USING(has_role(auth.uid(),'admin'));
    CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,display_name text);
    CREATE TABLE venues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,slug text UNIQUE,address text,city text,state text,description text,owner_id uuid,venue_type venue_type,
      activation_state text,is_active bool,is_published bool,verification_requested_at timestamptz,verification_approved_at timestamptz,verification_approved_by uuid);
    CREATE TABLE groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,description text,type text,visibility group_visibility,join_method group_join_method,venue_id uuid,created_by uuid,is_venue_verified bool);
    CREATE UNIQUE INDEX one_official_venue ON groups(venue_id) WHERE type='venue_official';
    CREATE TABLE group_members(group_id uuid,user_id uuid,role text,status text);
    CREATE FUNCTION add_group_creator_as_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO group_members VALUES(NEW.id,NEW.created_by,'owner','active'); RETURN NEW; END $$;
    CREATE TRIGGER add_group_creator AFTER INSERT ON groups FOR EACH ROW EXECUTE FUNCTION add_group_creator_as_owner();
    CREATE TABLE venue_staff(venue_id uuid,user_id uuid,role text,accepted_at timestamptz,is_active bool,status text,UNIQUE(venue_id,user_id));
    CREATE TABLE venue_courts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid,name text,is_active bool);
    CREATE TABLE group_events(id uuid DEFAULT gen_random_uuid(),group_id uuid,venue_id uuid,venue_court_id uuid,event_format text,start_time timestamptz,end_time timestamptz,title text,status text);
    CREATE TABLE notifications(recipient uuid,kind text,title text,body text,link text);
    CREATE FUNCTION create_notification(uuid,text,text,text,text,text,text,jsonb,uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO notifications VALUES($1,$2,$4,$5,$6) $$;
    GRANT SELECT,INSERT,UPDATE,DELETE ON venues,groups,group_members,venue_staff,venue_courts,group_events TO authenticated;
    CREATE TABLE private_venue_sandboxes(venue_id uuid PRIMARY KEY,group_id uuid,owner_id uuid);
    CREATE TABLE payment_orders(id uuid DEFAULT gen_random_uuid(),venue_id uuid,module_key text,kind text,livemode bool,status text);
    CREATE TABLE payment_subscriptions(venue_id uuid,module_key text,livemode bool,status text,paid_through timestamptz);
    CREATE TABLE venue_payment_settings(venue_id uuid,accepting_payments bool);
    CREATE TABLE venue_payment_accounts(venue_id uuid,account_id text);
  `);
  await db.query("INSERT INTO auth.users VALUES($1,'akhourybsu@gmail.com',now()),($2,'owner@example.com',now()),($3,'former@example.com',now())",[admin,owner,former]);
  await db.query("INSERT INTO profiles VALUES($1,'Alex Khoury',NULL),($2,'Venue Owner','Venue Owner')",[admin,owner]);
  await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin'),($2,'admin'),($2,'user')",[admin,former]);
  await db.exec(readFileSync('supabase/migrations/20260618030100_user_roles_last_admin_guard.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20260917100000_verified_free_venues.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20260922100000_platform_admin_venue_control.sql','utf8'));
},30_000);
beforeEach(async () => {
  await db.exec("SELECT set_config('request.jwt.claim.sub','',false); TRUNCATE platform_admin_audit,venue_application_history,venue_applications,venue_module_access,private_venue_sandboxes,payment_orders,payment_subscriptions,groups,group_members,venue_staff,venue_courts,group_events,notifications,venues CASCADE;");
  await db.query("INSERT INTO venues(id,name,owner_id,city,is_active,is_published,verification_approved_at,verification_approved_by) VALUES($1,'Verified Palace',$2,'Boston',true,true,now(),$3),($4,'Free Club',$2,'Boston',true,true,NULL,NULL)",[venue,owner,admin,otherVenue]);
  await db.query("INSERT INTO groups(id,name,type,venue_id,created_by) VALUES($1,'Verified Palace','venue_official',$2,$3)",[group,venue,owner]);
  await db.query("INSERT INTO venue_staff VALUES($1,$2,'owner',now(),true,'active')",[venue,owner]);
});
afterAll(async () => { await db?.close(); });

describe('sole platform administrator', () => {
  it('fails closed and rolls back if the confirmed target account is missing',async () => {
    const isolated = new PGlite();
    try {
      await isolated.exec("CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;");
      for (const table of ['venues','venue_module_access','venue_staff','group_members','private_venue_sandboxes','venue_payment_settings','venue_payment_accounts','payment_orders','payment_subscriptions']) await isolated.exec('CREATE TABLE '+table+'(id uuid)');
      await expect(isolated.exec(readFileSync('supabase/migrations/20260922100000_platform_admin_venue_control.sql','utf8'))).rejects.toThrow('exactly one confirmed');
      await isolated.exec('ROLLBACK');
      expect((await isolated.query("SELECT to_regclass('public.platform_admin_identity') AS relation")).rows[0].relation).toBeNull();
    } finally { await isolated.close(); }
  });
  it('binds access to the account UUID, not a mutable email address',async () => {
    await db.query("UPDATE auth.users SET email='changed@example.com' WHERE id=$1",[admin]);
    try { expect((await asUser(admin,'SELECT is_platform_superadmin() AS allowed')).rows[0].allowed).toBe(true); }
    finally { await db.query("UPDATE auth.users SET email='akhourybsu@gmail.com' WHERE id=$1",[admin]); }
  });
  it('keeps the requested account as the only admin and preserves other ordinary roles',async () => {
    expect((await db.query("SELECT user_id FROM user_roles WHERE role='admin'")).rows).toEqual([{user_id:admin}]);
    expect((await db.query("SELECT user_id FROM user_roles WHERE role='user'")).rows).toEqual([{user_id:former}]);
    expect((await asUser(admin,'SELECT is_platform_superadmin() AS allowed')).rows[0].allowed).toBe(true);
    expect((await asUser(former,'SELECT is_platform_superadmin() AS allowed')).rows[0].allowed).toBe(false);
  });
  it('cannot promote another admin, reassign the role or change the configured identity',async () => {
    await expect(db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",[owner])).rejects.toThrow('designated');
    await expect(db.query("UPDATE user_roles SET user_id=$1 WHERE role='admin'",[owner])).rejects.toThrow();
    await expect(db.exec("DELETE FROM user_roles WHERE role='admin'")).rejects.toThrow();
    await expect(asUser(admin,"INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",[owner])).rejects.toThrow('permission denied');
    await expect(asUser(admin,'UPDATE platform_admin_identity SET user_id=$1',[owner])).rejects.toThrow('permission denied');
  });
  it('denies non-admin and signed-out RPC access and hides audit records',async () => {
    for (const user of [owner,former,null]) {
      await expect(asUser(user,'SELECT platform_admin_overview()')).rejects.toThrow('superadmin');
      await expect(asUser(user,'SELECT platform_admin_venues()')).rejects.toThrow('superadmin');
      await expect(grant(['court_booking'],user!)).rejects.toThrow('superadmin');
    }
    await grant(); expect((await asUser(owner,'SELECT * FROM platform_admin_audit')).rows).toHaveLength(0);
    await expect(asUser(admin,"UPDATE platform_admin_audit SET note='changed'")).rejects.toThrow('permission denied');
    for (const sig of ['platform_admin_overview()','platform_admin_venues(text,text,integer)','platform_set_venue_access(uuid,text[],timestamp with time zone,text,jsonb)'])
      expect((await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed",[sig])).rows[0].allowed).toBe(false);
  });
});

describe('venue platform controls', () => {
  it('grants both features atomically, records a reason and notifies the owner without a charge',async () => {
    await grant(['court_booking','facility_tools']);
    expect((await snapshot()) as unknown[]).toHaveLength(2);
    expect((await db.query('SELECT * FROM payment_orders')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM platform_admin_audit')).rows[0]).toMatchObject({actor_id:admin,venue_id:venue,action:'venue_access_changed'});
    expect((await db.query('SELECT * FROM notifications')).rows[0]).toMatchObject({recipient:owner});
    expect((await db.query('SELECT owner_id FROM venues WHERE id=$1',[venue])).rows[0].owner_id).toBe(owner);
  });
  it('reverts to free without deleting venue content or changing another venue',async () => {
    await grant(); await db.query("INSERT INTO group_events(group_id,title) VALUES($1,'Existing event')",[group]); await grant([]);
    expect((await db.query("SELECT venue_has_module($1,'court_booking') AS allowed",[venue])).rows[0].allowed).toBe(false);
    expect((await db.query('SELECT * FROM group_events')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM venue_staff')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM venue_module_access WHERE venue_id=$1',[otherVenue])).rows).toHaveLength(0);
  });
  it('blocks stale decisions, invalid modules, missing notes and past expiries',async () => {
    const old=await snapshot(); await grant();
    await expect(grant([],admin,null,old)).rejects.toThrow('changed');
    await expect(grant(['court_booking','court_booking'])).rejects.toThrow('valid');
    await expect(grant(['unknown'])).rejects.toThrow('valid');
    await expect(grant([],admin,null,undefined,'short')).rejects.toThrow('reason');
    await expect(grant(['court_booking'],admin,'2020-01-01T00:00:00Z')).rejects.toThrow('future');
  });
  it('does not grant commercial tools to unverified venues or touch private samples',async () => {
    await db.query('UPDATE venues SET verification_approved_at=NULL WHERE id=$1',[venue]);
    await expect(grant()).rejects.toThrow('Approve venue ownership');
    await db.query('INSERT INTO private_venue_sandboxes VALUES($1,$2,$3)',[venue,group,owner]);
    await expect(grant()).rejects.toThrow('Private sample');
  });
  it('cannot overwrite Stripe-managed access or a live pending checkout',async () => {
    await db.query("INSERT INTO venue_module_access VALUES($1,'court_booking','subscription',true,now()+interval '1 month',now())",[venue]);
    await expect(grant([])).rejects.toThrow('Subscription-managed');
    await grant(['court_booking','facility_tools']);
    expect((await snapshot() as any[]).find(r=>r.module_key==='court_booking').source).toBe('subscription');
    await grant(['court_booking']);
    await db.query("INSERT INTO payment_orders(venue_id,module_key,kind,livemode,status) VALUES($1,'facility_tools','venue_module',true,'pending')",[venue]);
    await expect(grant(['court_booking','facility_tools'])).rejects.toThrow('checkout');
  });
  it('blocks checkout after a grant and protects active paid-through periods',async () => {
    await grant();
    await expect(db.query("INSERT INTO payment_orders(venue_id,module_key,kind,livemode,status) VALUES($1,'court_booking','venue_module',true,'pending')",[venue])).rejects.toThrow('already has access');
    await db.query("INSERT INTO payment_subscriptions VALUES($1,'facility_tools',true,'canceled',now()+interval '2 days')",[venue]);
    await expect(grant(['court_booking','facility_tools'])).rejects.toThrow('subscription');
    expect((await snapshot() as any[])).toHaveLength(1);
  });
  it('protects pending player checkout from a downgrade and blocks new rentals after access is removed',async () => {
    await grant();
    await db.query("INSERT INTO payment_orders(venue_id,kind,livemode,status) VALUES($1,'court_rental',true,'pending')",[venue]);
    await expect(grant([])).rejects.toThrow('player rental checkout');
    await db.exec("UPDATE payment_orders SET status='expired'");
    await grant([]);
    await expect(db.query("INSERT INTO payment_orders(venue_id,kind,livemode,status) VALUES($1,'court_rental',true,'pending')",[venue])).rejects.toThrow('access changed');
  });
  it('uses recorded expiry, keeps free community features and rejects silent partial changes',async () => {
    await grant(['court_booking'],admin,'2099-01-01T12:00:00Z');
    await db.query("UPDATE venue_module_access SET expires_at=now()-interval '1 second' WHERE venue_id=$1",[venue]);
    expect((await db.query("SELECT venue_has_module($1,'court_booking') AS allowed",[venue])).rows[0].allowed).toBe(false);
    await db.query("INSERT INTO venue_module_access VALUES($1,'facility_tools','subscription',true,NULL,now())",[venue]);
    await expect(grant(['court_booking'])).rejects.toThrow('Subscription-managed');
    expect((await db.query("SELECT venue_has_module($1,'court_booking') AS allowed",[venue])).rows[0].allowed).toBe(false);
  });
  it('provides accurate searchable/filterable directory and excludes samples from production counts',async () => {
    await grant();
    const list=(await asUser(admin,"SELECT platform_admin_venues('owner@example.com','upgraded',0) AS value")).rows[0].value as any;
    expect(list.total).toBe(1); expect(list.rows[0]).toMatchObject({name:'Verified Palace',booking:true,facility:false,owner_email:'owner@example.com'});
    await db.query('INSERT INTO private_venue_sandboxes VALUES($1,$2,$3)',[venue,group,owner]);
    const overview=(await asUser(admin,'SELECT platform_admin_overview() AS value')).rows[0].value as any;
    expect(overview).toMatchObject({venues:1,unverified_venues:1,account_email:'akhourybsu@gmail.com'});
    const hiddenSamples=(await asUser(admin,"SELECT platform_admin_venues('','samples',0) AS value")).rows[0].value as any;
    expect(hiddenSamples.total).toBe(0);
    await db.query('UPDATE private_venue_sandboxes SET owner_id=$1',[admin]);
    const samples=(await asUser(admin,"SELECT platform_admin_venues('','samples',0) AS value")).rows[0].value as any;
    expect(samples.total).toBe(1);
  });
  it('records transparent sole-admin self-review while retaining validation and stale-review guards',async () => {
    const req=(await asUser(admin,'SELECT submit_venue_application($1) AS id',[details])).rows[0].id;
    await expect(asUser(admin,"SELECT review_venue_application($1,'approved',$2,false)",[req,'Business authority documented with registration records.'])).rejects.toThrow('verify');
    await asUser(admin,"SELECT review_venue_application($1,'approved',$2,true)",[req,'Business authority documented with registration records.']);
    const history=(await db.query("SELECT details FROM venue_application_history WHERE action='approved'")).rows[0].details as any;
    expect(history.superadmin_self_review).toBe(true);
    expect((await db.query("SELECT * FROM platform_admin_audit WHERE action='venue_request_approved'")).rows).toHaveLength(1);
    await expect(asUser(admin,"SELECT review_venue_application($1,'approved',$2,true)",[req,'Business authority documented with registration records.'])).rejects.toThrow('no longer');
  });
});
