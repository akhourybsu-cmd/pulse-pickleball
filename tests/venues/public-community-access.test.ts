import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RESERVED_VENUE_HOSTS } from '@/lib/venues/address';

let db: PGlite;
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function guest(sql: string, params: unknown[] = []) {
  await db.exec('SET ROLE anon');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('RESET ROLE'); }
}
const preview = async (n: number) => (await guest('SELECT get_public_community($1,NULL) AS page', [id(n)]))[0].page as any;

async function manager(n: number, sql: string, params: unknown[] = [], role = 'authenticated') {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(n)]);
  await db.exec(`SET ROLE ${role}`);
  try { return (await db.query(sql, params)).rows as any[]; }
  finally { await db.exec('RESET ROLE'); await db.exec("SELECT set_config('request.jwt.claim.sub','',false)"); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('is_anonymous',coalesce(current_setting('test.anonymous',true),'false')::boolean) $$;
    CREATE FUNCTION pulse_has_required_mfa() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.mfa',true),'true')<>'false' $$;
    CREATE TYPE app_role AS ENUM ('admin');
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${id(99)}' $$;
    CREATE FUNCTION is_platform_superadmin() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(auth.uid()='${id(99)}',false) $$;
    CREATE TABLE platform_admin_identity(user_id uuid);
    INSERT INTO platform_admin_identity VALUES('${id(99)}');
    CREATE TABLE platform_admin_audit(actor_id uuid,venue_id uuid,action text,note text,before_state jsonb,after_state jsonb);
    CREATE TABLE venue_staff(venue_id uuid,user_id uuid,role text,is_active bool,status text);
    CREATE TABLE venues(id uuid PRIMARY KEY, slug text UNIQUE, name text, address text, city text, state text, phone text, email text, website_url text,
      logo_url text, cover_image_url text, logo_image_fit text, cover_image_fit text, logo_shape text, cover_focal_point text,
      accent_color text, logo_background_color text, background_color text, surface_color text, text_color text, primary_color text, secondary_color text, tagline text, welcome_headline text, welcome_message text, timezone text, hours_of_operation jsonb,
      is_active bool DEFAULT true, is_published bool DEFAULT true, is_searchable bool DEFAULT true, owner_id uuid, stripe_account_id text,
      verification_approved_at timestamptz DEFAULT now(),verification_approved_by uuid DEFAULT '${id(99)}');
    CREATE TABLE groups(id uuid PRIMARY KEY, venue_id uuid REFERENCES venues, type text DEFAULT 'club', name text, description text,
      visibility text DEFAULT 'public', join_method text DEFAULT 'open', icon_url text, cover_url text, member_count integer DEFAULT 12,
      is_venue_verified bool DEFAULT false, invite_code text DEFAULT 'SECRET', settings jsonb DEFAULT '{"secret":true}', created_by uuid);
    CREATE TABLE venue_courts(id uuid PRIMARY KEY, venue_id uuid, name text, court_number integer, court_type text, surface_type text, is_active bool DEFAULT true, notes text);
    CREATE TABLE private_venue_sandboxes(venue_id uuid, group_id uuid);
    CREATE TABLE venue_module_access(venue_id uuid,module_key text,enabled boolean,expires_at timestamptz);
    CREATE TABLE group_messages(body text); INSERT INTO group_messages VALUES('Private conversation');
    ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
    ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
    ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON groups, venues, group_messages TO anon;
  `);
  for (let n = 1; n <= 7; n++) {
    await db.query('INSERT INTO auth.users VALUES($1)', [id(n)]);
    await db.query('INSERT INTO venues(id,slug,name,owner_id,stripe_account_id) VALUES($1,$2,$3,$1,$4)', [id(n), `venue-${n}`, `Venue ${n}`, 'SECRET_STRIPE']);
    await db.query("INSERT INTO groups(id,venue_id,type,name) VALUES($1,$1,'venue_official',$2)", [id(n), `Community ${n}`]);
  }
  await db.query("UPDATE groups SET visibility='unlisted' WHERE id=$1", [id(2)]);
  await db.query("UPDATE groups SET visibility='private' WHERE id=$1", [id(3)]);
  await db.query('UPDATE venues SET is_published=false WHERE id=$1', [id(4)]);
  await db.query('UPDATE venues SET is_active=false WHERE id=$1', [id(5)]);
  await db.query('INSERT INTO private_venue_sandboxes VALUES($1,$1)', [id(6)]);
  await db.query('UPDATE groups SET venue_id=NULL WHERE id=$1', [id(7)]);
  await db.query("INSERT INTO venue_courts VALUES($1,$2,'Center court',1,'indoor','hard',true,'PRIVATE_NOTE'),($3,$2,'Retired court',2,'outdoor','hard',false,NULL)", [id(10), id(1), id(11)]);
  await db.exec(readFileSync('supabase/migrations/20260928100000_public_community_pages.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260928110000_venue_address_integrations.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260928120000_venue_address_mfa_policy.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260928230000_venue_address_automation.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260930120000_venue_image_framing.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260930121000_public_venue_branding.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260930130000_community_discovery.sql', 'utf8'));
}, 30_000);
afterAll(async () => { await db?.close(); });

describe('anonymous community projection', () => {
  it('allows direct public links and ordinary communities', async () => {
    expect(await preview(1)).toMatchObject({ id: id(1), name: 'Community 1', venue: { slug: 'venue-1' } });
    expect(await preview(7)).toMatchObject({ venue: null, courts: [] });
  });
  it.each([2, 3, 4, 5, 6, 99])('hides unlisted, private, unpublished, inactive, sample and missing page %s', async n => {
    expect(await preview(n)).toBeNull();
  });
  it('resolves the official venue by its stable name and rejects ambiguous input', async () => {
    expect((await guest("SELECT get_public_community(NULL,'venue-1') AS page"))[0].page).toMatchObject({ id: id(1) });
    expect((await guest("SELECT get_public_community($1,'venue-2') AS page", [id(1)]))[0].page).toBeNull();
    expect((await guest("SELECT get_public_community(NULL,'venue-3') AS page"))[0].page).toBeNull();
  });
  it('exposes only approved fields and active courts', async () => {
    const page = await preview(1);
    expect(page.courts).toHaveLength(1);
    expect(page.courts[0].name).toBe('Center court');
    const text = JSON.stringify(page);
    for (const forbidden of ['SECRET', 'PRIVATE_NOTE', 'invite_code', 'settings', 'owner_id', 'stripe_account_id', 'created_by']) expect(text).not.toContain(forbidden);
  });
  it('excludes unlisted, private, unpublished and sample pages from search', async () => {
    const rows = await guest('SELECT list_public_communities() AS page');
    expect(rows.map((row: any) => row.page.id)).toEqual([id(1), id(7)]);
    expect(await guest("SELECT list_public_communities('Community 2') AS page")).toEqual([]);
    expect((await guest("SELECT list_public_communities('COMMUNITY 1') AS page"))).toHaveLength(1);
    expect(await guest("SELECT list_public_communities('%') AS page")).toEqual([]);
  });
  it('does not add raw-table or write permissions to the existing policies', async () => {
    for (const table of ['groups', 'venues', 'group_messages']) expect(await guest(`SELECT * FROM ${table}`)).toEqual([]);
    await expect(guest("UPDATE groups SET name='Changed' WHERE id=$1", [id(1)])).rejects.toThrow(/permission denied/);
    await expect(guest("INSERT INTO group_messages VALUES('Guest post')")).rejects.toThrow(/permission denied/);
    expect((await preview(1)).name).toBe('Community 1');
  });
});

describe('venue integration permissions and lifecycle', () => {
  it('retains the required restrictive MFA policy and closed client grants', async () => {
    const { rows } = await db.query(`
      SELECT c.relrowsecurity, p.polpermissive, p.polcmd,
        p.polroles = ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'authenticated')] AS authenticated_only,
        pg_get_expr(p.polqual, p.polrelid) AS using_expression,
        pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
      FROM pg_class c JOIN pg_policy p ON p.polrelid = c.oid
      WHERE c.oid = 'public.venue_address_connections'::regclass
        AND p.polname = 'pulse_required_mfa'
    `);
    expect(rows).toEqual([expect.objectContaining({
      relrowsecurity: true, polpermissive: false, polcmd: '*', authenticated_only: true,
      using_expression: expect.stringContaining('pulse_has_required_mfa()'),
      check_expression: expect.stringContaining('pulse_has_required_mfa()'),
    })]);
    await expect(guest('SELECT * FROM venue_address_connections')).rejects.toThrow(/permission denied/);
    await expect(manager(1, 'SELECT * FROM venue_address_connections')).rejects.toThrow(/permission denied/);
  });
  it('rejects guests, another venue owner, unverified MFA and anonymous accounts', async () => {
    await expect(guest('SELECT get_venue_address_setup($1)', [id(1)])).rejects.toThrow(/permission denied/);
    await expect(manager(2,'SELECT get_venue_address_setup($1)',[id(1)])).rejects.toThrow(/manager access/);
    await db.exec("SET test.mfa='false'");
    await expect(manager(1,'SELECT request_venue_address($1,$2)',[id(1),'palace'])).rejects.toThrow(/manager access/);
    await db.exec("SET test.mfa='true'; SET test.anonymous='true'");
    await expect(manager(1,'SELECT get_venue_address_setup($1)',[id(1)])).rejects.toThrow(/manager access/);
    await db.exec("SET test.anonymous='false'");
  });
  it('allows active managers but rejects ordinary, invited and inactive staff', async () => {
    await db.query("INSERT INTO venue_staff VALUES($1,$2,'manager',true,'active')",[id(1),id(2)]);
    expect((await manager(2,'SELECT get_venue_address_setup($1) AS setup',[id(1)]))[0].setup.verified).toBe(true);
    for (const [role,status,active] of [['staff','active',true],['manager','invited',true],['manager','active',false]]) {
      await db.query('UPDATE venue_staff SET role=$1,status=$2,is_active=$3',[role,status,active]);
      await expect(manager(2,'SELECT get_venue_address_setup($1)',[id(1)])).rejects.toThrow(/manager access/);
    }
    await db.exec('DELETE FROM venue_staff');
  });
  it('validates DNS names, reserves platform names and detects existing venue names', async () => {
    for (const slug of [...RESERVED_VENUE_HOSTS,'ab','-palace','palace-','club.example','club/name','a'.repeat(64),'two words']) {
      const result=(await manager(1,'SELECT check_venue_address($1,$2) AS check',[id(1),slug]))[0].check;
      expect(result.available,slug).toBe(false);
    }
    expect((await manager(1,'SELECT check_venue_address($1,$2) AS check',[id(1),'VENUE-2']))[0].check.available).toBe(false);
  });
  it('requires real, active and verified venues without changing privacy', async () => {
    await expect(manager(6,'SELECT request_venue_address($1,$2)',[id(6),'sample-address'])).rejects.toThrow(/sample venues/);
    await expect(manager(5,'SELECT request_venue_address($1,$2)',[id(5),'inactive-address'])).rejects.toThrow(/Activate/);
    await db.query('UPDATE venues SET verification_approved_at=NULL WHERE id=$1',[id(4)]);
    await expect(manager(4,'SELECT request_venue_address($1,$2)',[id(4),'not-verified'])).rejects.toThrow(/Verify/);
    const setup=(await manager(3,'SELECT request_venue_address($1,$2) AS setup',[id(3),'private-palace']))[0].setup;
    expect(setup.public_ready).toBe(false);
    expect((await guest("SELECT get_public_community(NULL,'private-palace') AS page"))[0].page).toBeNull();
  });
  it('reserves atomically, makes retries idempotent and keeps the original public link', async () => {
    const claim=()=>manager(1,'SELECT request_venue_address($1,$2) AS setup',[id(1),'  Palace  ']);
    const result=(await claim())[0].setup;
    expect(result.connection).toMatchObject({slug:'palace',status:'requested'});
    expect((await claim())[0].setup.connection.id).toBe(result.connection.id);
    await expect(manager(2,'SELECT request_venue_address($1,$2)',[id(2),'palace'])).rejects.toThrow(/already taken/);
    await expect(manager(1,'SELECT request_venue_address($1,$2)',[id(1),'different-name'])).rejects.toThrow(/already has/);
    await expect(db.query('UPDATE venues SET slug=$1 WHERE id=$2',['palace',id(2)])).rejects.toThrow(/already reserved/);
    expect((await guest("SELECT get_public_community(NULL,'palace') AS page"))[0].page.id).toBe(id(1));
    expect((await guest("SELECT get_public_community(NULL,'venue-1') AS page"))[0].page.id).toBe(id(1));
    await db.query("UPDATE groups SET visibility='private' WHERE id=$1",[id(1)]);
    expect((await guest("SELECT get_public_community(NULL,'palace') AS page"))[0].page).toBeNull();
    await db.query("UPDATE groups SET visibility='public' WHERE id=$1",[id(1)]);
  });
  it('blocks client writes and admin-provider RPCs, even from owners', async () => {
    await expect(manager(1,"UPDATE venue_address_connections SET status='connected'",[])).rejects.toThrow(/permission denied/);
    await expect(manager(1,'SELECT begin_venue_address_check($1,$2)',[id(1),id(99)])).rejects.toThrow(/permission denied/);
    await expect(manager(1,'SELECT list_venue_address_requests()')).rejects.toThrow(/administrator access/);
    expect((await manager(99,'SELECT list_venue_address_requests() AS request')).length).toBe(2);
  });
  it('leases checks, rejects stale completion, audits atomically and hides provider details from managers', async () => {
    await expect(manager(1,'SELECT begin_venue_address_check($1,$2)',[id(1),id(1)],'service_role')).rejects.toThrow(/administrator access/);
    const claim=(await manager(99,'SELECT begin_venue_address_check($1,$2) AS lease',[id(1),id(99)],'service_role'))[0].lease;
    expect(claim.slug).toBe('palace');
    expect((await manager(99,'SELECT begin_venue_address_check($1,$2) AS lease',[id(1),id(99)],'service_role'))[0].lease).toBeNull();
    await expect(manager(99,"SELECT finish_venue_address_check($1,$2,$3,'connected','{}')",[id(1),id(99),id(8)],'service_role')).rejects.toThrow(/newer one/);
    await manager(99,"SELECT finish_venue_address_check($1,$2,$3,'connected',$4)",[id(1),id(99),claim.token,JSON.stringify({dns:[],issues:[],host:'HOST_ACTIVE'})],'service_role');
    const owner=(await manager(1,'SELECT get_venue_address_setup($1) AS setup',[id(1)]))[0].setup;
    expect(owner.connection.status).toBe('connected');
    expect(owner.connection.provider_details).toBeUndefined();
    expect(owner.connection.check_token).toBeUndefined();
    expect((await manager(99,'SELECT get_venue_address_setup($1) AS setup',[id(1)]))[0].setup.connection.provider_details.host).toBe('HOST_ACTIVE');
    expect((await db.query('SELECT * FROM platform_admin_audit')).rows).toHaveLength(1);
    await expect(manager(99,"SELECT finish_venue_address_check($1,$2,$3,'connected','{}')",[id(1),id(99),claim.token],'service_role')).rejects.toThrow(/newer one/);
  });
  it('retains tombstones so deleted venue addresses cannot be reassigned', async () => {
    await db.query("INSERT INTO venues(id,slug,name,owner_id) VALUES($1,'temporary-venue','Temporary',$2)",[id(20),id(1)]);
    await manager(1,"SELECT request_venue_address($1,'permanent-address')",[id(20)]);
    await db.query('DELETE FROM venues WHERE id=$1',[id(20)]);
    expect((await manager(2,"SELECT check_venue_address($1,'permanent-address') AS check",[id(2)]))[0].check.available).toBe(false);
    await expect(db.query("INSERT INTO venues(id,slug) VALUES($1,'permanent-address')",[id(21)])).rejects.toThrow(/already reserved/);
  });
});

describe('automatic venue address queue', () => {
  const claim = async () => (await manager(99,'SELECT claim_venue_address_jobs(10) AS job',[],'service_role')).map(row=>row.job);
  const finish = (job:any,status:string,details:unknown) => manager(99,'SELECT finish_venue_address_job($1,$2,$3,$4)',[job.venue_id,job.token,status,JSON.stringify(details)],'service_role');
  const ready = {host:'HOST_ACTIVE',ownership:'OWNERSHIP_ACTIVE',certificate:'CERT_ACTIVE',dns:[],issues:[]};
  beforeEach(async () => {
    await db.exec('DELETE FROM venue_address_connections');
    await db.query('UPDATE venues SET verification_approved_at=NULL WHERE id=$1',[id(4)]);
    for (const n of [1,3,4,5,6]) await db.query('INSERT INTO venue_address_connections(venue_id,slug) VALUES($1,$2)',[id(n),`queue-${n}`]);
  });
  it('denies queue execution and completion to clients, and restricts retry to an MFA-verified admin', async () => {
    await expect(guest('SELECT claim_venue_address_jobs()')).rejects.toThrow(/permission denied/);
    await expect(manager(99,'SELECT claim_venue_address_jobs()')).rejects.toThrow(/permission denied/);
    await expect(manager(1,"SELECT finish_venue_address_job($1,$2,'connected','{}')",[id(1),id(2)])).rejects.toThrow(/permission denied/);
    await expect(manager(1,'SELECT queue_venue_address_check($1)',[id(1)])).rejects.toThrow(/administrator access/);
    await db.exec("SET test.mfa='false'");
    await expect(manager(99,'SELECT queue_venue_address_check($1)',[id(1)])).rejects.toThrow(/administrator access/);
    await db.exec("SET test.mfa='true'");
  });
  it('claims eligible due addresses once, excludes inactive/unverified/sample venues, and preserves privacy', async () => {
    const jobs=await claim(); expect(jobs.map(job=>job.venue_id).sort()).toEqual([id(1),id(3)]);
    expect(await claim()).toEqual([]);
    await expect(manager(99,'SELECT queue_venue_address_check($1)',[id(1)])).rejects.toThrow(/already running/);
    expect((await guest("SELECT get_public_community(NULL,'queue-3') AS page"))[0].page).toBeNull();
  });
  it('fences expired and replaced leases and rejects false connected results', async () => {
    const old=(await claim()).find(job=>job.venue_id===id(1));
    await expect(finish(old,'connected',{})).rejects.toThrow(/HTTPS/);
    await db.query("UPDATE venue_address_connections SET check_after=now()-interval '1 second' WHERE venue_id=$1",[id(1)]);
    await expect(finish(old,'connected',ready)).rejects.toThrow(/lease expired/);
    const current=(await claim())[0]; expect(current.token).not.toBe(old.token);
    await expect(finish(old,'connected',ready)).rejects.toThrow(/lease expired/);
    await finish(current,'connected',ready);
    await expect(finish(current,'connected',ready)).rejects.toThrow(/lease expired/);
    const row=(await db.query('SELECT *,check_after>now()+interval \'23 hours\' AS daily FROM venue_address_connections WHERE venue_id=$1',[id(1)])).rows[0] as any;
    expect(row.daily).toBe(true); expect(row.check_token).toBeNull();
    const audits=(await db.query("SELECT * FROM platform_admin_audit WHERE action='venue.address.automated'")).rows as any[];
    expect(audits.at(-1).actor_id).toBeNull();
  });
  it('backs off failures, permits an admin retry, and does not mark DNS propagation as connected', async () => {
    const job=(await claim()).find(job=>job.venue_id===id(1));
    await finish(job,'error',{issues:['Provider unavailable']});
    let row=(await db.query("SELECT failure_count,check_after>now()+interval '9 minutes' AS delayed FROM venue_address_connections WHERE venue_id=$1",[id(1)])).rows[0] as any;
    expect(row).toMatchObject({failure_count:1,delayed:true});
    await manager(99,'SELECT queue_venue_address_check($1)',[id(1)]);
    const next=(await claim())[0]; await finish(next,'provisioning',{...ready,dns:[{type:'A'}]});
    row=(await db.query('SELECT status,failure_count FROM venue_address_connections WHERE venue_id=$1',[id(1)])).rows[0] as any;
    expect(row).toEqual({status:'provisioning',failure_count:0});
  });
  it('rechecks venue eligibility before accepting an in-flight result', async () => {
    const job=(await claim()).find(job=>job.venue_id===id(1));
    await db.query('UPDATE venues SET is_active=false WHERE id=$1',[id(1)]);
    try { await expect(finish(job,'connected',ready)).rejects.toThrow(/Active, verified/); }
    finally { await db.query('UPDATE venues SET is_active=true WHERE id=$1',[id(1)]); }
  });
});

it('projects saved venue framing and logo colors without exposing payment or owner information',async()=>{
 await db.query("UPDATE venues SET logo_crop=$1,cover_crop=$2,logo_background_color='#123456',accent_color='#654321' WHERE id=$3",[JSON.stringify({x:15,y:70,zoom:1.5}),JSON.stringify({x:80,y:25,zoom:2}),id(1)]);
 const page=await preview(1);
 expect(page.venue).toMatchObject({logo_crop:{x:15,y:70,zoom:1.5},cover_crop:{x:80,y:25,zoom:2},logo_background_color:'#123456',accent_color:'#654321'});
 expect(JSON.stringify(page)).not.toMatch(/SECRET_STRIPE|owner_id/);
 await expect(guest('SELECT venue_brand_identity($1)',[id(1)])).rejects.toThrow(/permission denied/);
 await expect(db.query('UPDATE venues SET logo_crop=$1 WHERE id=$2',[JSON.stringify({x:101,y:0,zoom:4}),id(1)])).rejects.toThrow();
});


describe('community discovery',()=>{
 it('ranks town then state before popularity, searches beyond twenty rows, and paginates without duplicates',async()=>{
  await db.exec('BEGIN');
  try {
   for(let n=100;n<132;n++) await db.query("INSERT INTO groups(id,name,city,state,member_count) VALUES($1,$2,$3,$4,$5)",[id(n),'Directory crew '+n,n===130?'Attleboro':n===129?'Boston':'Austin',n>=129?'MA':'TX',1000-n]);
   const discover=async(q='',offset=0)=>(await guest('SELECT discover_communities($1,$2,$3,$4) result',[q,'Attleboro','Massachusetts',offset]))[0].result as any;
   const first=await discover('Directory');const second=await discover('Directory',24);
   expect(first.items[0]).toMatchObject({id:id(130),city:'Attleboro',state:'MA'});
   expect(first.items[1].state).toBe('MA');expect(first.has_more).toBe(true);expect(second.has_more).toBe(false);
   expect(new Set([...first.items,...second.items].map(x=>x.id)).size).toBe(32);
   expect((await discover('crew 131')).items.map((x:any)=>x.id)).toEqual([id(131)]);
   expect((await discover('%')).items).toEqual([]);
   expect((await discover('Attleboro MA')).items.map((x:any)=>x.id)).toEqual([id(130)]);
   expect(JSON.stringify(first)).not.toMatch(/invite_code|SECRET|owner_id|settings/);
  } finally {await db.exec('ROLLBACK');}
 });
 it('respects discoverability while preserving direct public venue links',async()=>{
  await db.exec('BEGIN');try{
   await db.query('UPDATE venues SET is_searchable=false WHERE id=$1',[id(1)]);
   const result=(await guest('SELECT discover_communities() result'))[0].result as any;
   expect(result.items.map((x:any)=>x.id)).toEqual([id(7)]);
   expect(await preview(1)).not.toBeNull();
  }finally{await db.exec('ROLLBACK');}
 });
});
