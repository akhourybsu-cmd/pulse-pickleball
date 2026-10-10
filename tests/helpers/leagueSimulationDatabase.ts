import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/** Real league migrations and RLS; external identity, notification delivery,
 * and the independent global rating engine are isolated from this database. */
export async function leagueSimulationDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated,anon,service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
    CREATE SCHEMA auth; CREATE TYPE public.app_role AS ENUM ('admin','player');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY,display_name text,full_name text,first_name text,last_name text,avatar_url text,current_rating numeric DEFAULT 3.5,updated_at timestamptz DEFAULT now());
    CREATE VIEW profiles_public AS SELECT * FROM profiles;
    CREATE VIEW profiles_search AS SELECT * FROM profiles;
    CREATE TABLE groups(id uuid PRIMARY KEY);
    CREATE TABLE matches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),match_date date,team1_score int,team2_score int,created_by uuid,source text,court_no int,match_type text,status text,verified_by uuid[],count_for_rating bool,voided bool DEFAULT false,void_reason text);
    CREATE TABLE match_participants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),match_id uuid REFERENCES matches ON DELETE CASCADE,player_id uuid,team int);
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    -- Session verification is isolated here; auth/mfa-database.test.ts exercises
    -- league feed policies against the real MFA functions and session proofs.
    CREATE FUNCTION pulse_has_required_mfa() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
    CREATE FUNCTION update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE FUNCTION skill_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient uuid,kind text,title text,body text,link text);
    CREATE FUNCTION create_notification(uuid,text,text,text,text,text,text,jsonb,uuid,text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ INSERT INTO notifications(recipient,kind,title,body,link) VALUES($1,$2,$4,$5,$6) $$;
    CREATE FUNCTION recalculate_all_ratings() RETURNS void LANGUAGE sql AS $$ SELECT $$;
  `);
  const extra = new Set([
    "20260706231517_cf9d71f6-dd20-48c2-82d5-805b6c98fe44.sql",
    "20260721124511_60ef9065-76c5-4e5c-92f3-10cbbc04a8fa.sql",
    "20260723160559_eeec3125-8f99-430a-9b2e-125c6350fe9d.sql",
    "20260723185719_c0554f06-a325-4ff6-a1c5-83f52bfc9fae.sql",
    "20260723213301_e283c058-7935-41c1-b063-8368aa337701.sql",
    "20260723221804_4c30e520-9e15-46f9-a3c1-421b0b925c6f.sql",
    "20260724232129_7ba8e282-4df1-46ad-9506-93b14e1575b0.sql",
    "20260725005751_aaf2f7b6-e456-4c60-b40c-73f1149d6fb2.sql",
    "20260725005820_17ea133f-d27a-482a-bea3-2fd04b9d0e76.sql",
    "20260725010738_eca40b7b-b86f-464b-b609-e5a46c3bc5df.sql",
    "20260727150236_fb295038-af5b-4bc7-85be-394442a3a7fb.sql",
    "20260727172451_b2b79dfb-a792-47d6-b4f9-b32e5d15719d.sql",
    "20260728004926_3b24b2a5-051e-44f2-bb75-35a3aab4b03a.sql",
    "20260728191648_3fa3dfe0-ed52-4990-a2b1-81bc0b2275d8.sql",
    "20260730201705_de9942ef-b42d-415f-ad28-4ee0e0845639.sql",
    "20260807012301_07de1935-cef3-4a17-bee1-c385923cb5e0.sql",
    "20260828000619_eb0f1a52-6d2f-4a4c-b1f0-171718efa842.sql",
  ]);
  const migrations = readdirSync("supabase/migrations")
    .filter(
      (file) =>
        extra.has(file) ||
        /^2026\d+_(?:league_|leagues_|ladder_|create_league_|remove_league_)/.test(
          file
        )
    )
    .sort();
  for (const file of migrations) {
    try {
      await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    } catch (error) {
      await db.close();
      throw new Error(`League migration ${file}: ${(error as Error).message}`);
    }
  }
  await db.exec(
    "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;"
  );
  return db;
}

export function leagueActor(db: PGlite, user: string | null, service = false) {
  return async <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ) =>
    db.transaction(async (tx) => {
      await tx.query(
        "SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",
        [user ?? "", service ? "service_role" : user ? "authenticated" : "anon"]
      );
      await tx.exec(
        `SET LOCAL ROLE ${service ? "service_role" : user ? "authenticated" : "anon"}`
      );
      return tx.query<T>(sql, params);
    });
}
