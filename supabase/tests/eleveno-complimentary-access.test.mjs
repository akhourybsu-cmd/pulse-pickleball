import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const target='4ee96566-4074-41c0-aa2b-2d767bdb50e1', community='e3e97754-ac66-4814-94f3-ae3391de4e33';
const actor='a0000000-0000-0000-0000-000000000001', owner='a0000000-0000-0000-0000-000000000002', other='a0000000-0000-0000-0000-000000000010';
const sql=readFileSync(new URL('../migrations/20260922110000_eleveno_complimentary_full_access.sql',import.meta.url),'utf8');
async function fixture() {
  const db=new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
    CREATE TYPE app_role AS ENUM('admin','user');
    CREATE TABLE user_roles(user_id uuid,role app_role);
    CREATE TABLE platform_admin_identity(user_id uuid);
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
    CREATE TABLE venues(id uuid PRIMARY KEY,name text,owner_id uuid,verification_approved_at timestamptz,is_published boolean);
    CREATE TABLE groups(id uuid PRIMARY KEY,venue_id uuid,type text);
    CREATE TABLE private_venue_sandboxes(venue_id uuid);
    CREATE TABLE venue_module_access(venue_id uuid,module_key text CHECK(module_key IN ('court_booking','facility_tools')),source text,enabled boolean,expires_at timestamptz,updated_at timestamptz DEFAULT now(),PRIMARY KEY(venue_id,module_key));
    CREATE TABLE payment_orders(venue_id uuid,kind text,livemode boolean,status text);
    CREATE TABLE payment_subscriptions(venue_id uuid,livemode boolean,status text,paid_through timestamptz);
    CREATE TABLE platform_admin_audit(actor_id uuid,venue_id uuid,action text,note text,before_state jsonb,after_state jsonb);
    CREATE TABLE notifications(recipient uuid,kind text,title text,body text,link text);
    CREATE FUNCTION create_notification(uuid,text,text,text,text,text,text,jsonb,uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO notifications VALUES($1,$2,$4,$5,$6) $$;
    CREATE FUNCTION platform_venue_access_snapshot(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY module_key),'[]') FROM venue_module_access m WHERE venue_id=$1 $$;
    CREATE FUNCTION venue_has_module(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM venue_module_access WHERE venue_id=$1 AND module_key=$2 AND enabled AND (expires_at IS NULL OR expires_at>now())) $$;
  `);
  await db.query("INSERT INTO auth.users VALUES($1,'akhourybsu@gmail.com',now());",[actor]);
  await db.query("INSERT INTO user_roles VALUES($1,'admin')",[actor]);
  await db.query('INSERT INTO platform_admin_identity VALUES($1)',[actor]);
  await db.query("INSERT INTO venues VALUES($1,'ELEVENO',$2,NULL,false),($3,'Other venue',$2,NULL,false)",[target,owner,other]);
  await db.query("INSERT INTO groups VALUES($1,$2,'venue_official')",[community,target]);
  await db.query("INSERT INTO venue_module_access(venue_id,module_key,source,enabled) VALUES($1,'court_booking','existing_venue',false),($1,'facility_tools','existing_venue',false),($2,'court_booking','staff_grant',true)",[target,other]);
  return db;
}

test('grants both features without expiry, preserves venue and other grants, and records the explicit override',async()=>{
  const db=await fixture(); try {
    const venues=(await db.query('SELECT * FROM venues ORDER BY id')).rows;
    const others=(await db.query('SELECT * FROM venue_module_access WHERE venue_id=$1',[other])).rows;
    await db.exec(sql);
    assert.deepEqual((await db.query('SELECT module_key,source,enabled,expires_at FROM venue_module_access WHERE venue_id=$1 ORDER BY module_key',[target])).rows,
      ['court_booking','facility_tools'].map(module_key=>({module_key,source:'staff_grant',enabled:true,expires_at:null})));
    assert.deepEqual((await db.query('SELECT * FROM venues ORDER BY id')).rows,venues);
    assert.deepEqual((await db.query('SELECT * FROM venue_module_access WHERE venue_id=$1',[other])).rows,others);
    const audit=(await db.query('SELECT * FROM platform_admin_audit')).rows;
    assert.equal(audit.length,1); assert.equal(audit[0].actor_id,actor); assert.match(audit[0].note,/verification remains unchanged/);
    assert.equal((await db.query('SELECT * FROM notifications')).rows[0].recipient,owner);
    assert.equal((await db.query('SELECT * FROM payment_orders')).rows.length,0);
    assert.equal((await db.query('SELECT * FROM payment_subscriptions')).rows.length,0);
  } finally { await db.close(); }
});

for (const [name,setup,error] of [
  ['renamed target',"UPDATE venues SET name='Different venue' WHERE id='"+target+"'",/target mismatch/],
  ['wrong community',"UPDATE groups SET type='social'",/target mismatch/],
  ['unconfirmed admin',"UPDATE auth.users SET email_confirmed_at=NULL",/superadmin not confirmed/],
  ['pending live module checkout',"INSERT INTO payment_orders VALUES('"+target+"','venue_module',true,'pending')",/module billing/],
  ['paid-through canceled subscription',"INSERT INTO payment_subscriptions VALUES('"+target+"',true,'canceled',now()+interval '1 day')",/module billing/],
  ['subscription entitlement',"UPDATE venue_module_access SET source='subscription' WHERE venue_id='"+target+"'",/module billing/],
]) test('fails closed for '+name,async()=>{
  const db=await fixture(); try {
    await db.exec(setup);
    const before=(await db.query('SELECT * FROM venue_module_access ORDER BY venue_id,module_key')).rows;
    await assert.rejects(db.exec(sql),error); await db.exec('ROLLBACK');
    assert.deepEqual((await db.query('SELECT * FROM venue_module_access ORDER BY venue_id,module_key')).rows,before);
    assert.equal((await db.query('SELECT * FROM platform_admin_audit')).rows.length,0);
    assert.equal((await db.query('SELECT * FROM notifications')).rows.length,0);
  } finally { await db.close(); }
});
