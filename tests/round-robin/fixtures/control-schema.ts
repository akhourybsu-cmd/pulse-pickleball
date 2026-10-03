import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
const sql = (file: string) => readFileSync(`supabase/migrations/${file}`, 'utf8');

/** Latest production controls and guest triggers, with the existing match engine. */
export async function installControlSchema(db: PGlite) {
  await db.exec(`
    GRANT USAGE ON SCHEMA auth TO authenticated;
    ALTER TABLE round_robin_events ADD name text DEFAULT 'Control test', ADD start_time time DEFAULT '09:00', ADD notes text,
      ADD max_players integer DEFAULT 8, ADD registration_deadline timestamptz, ADD voided_by uuid, ADD voided_at timestamptz, ADD void_reason text;
    ALTER TABLE matches ADD voided_at timestamptz, ADD voided_by uuid, ADD void_reason text;
    ALTER TABLE guest_players ADD archived_at timestamptz;
    ALTER TABLE round_robin_schedule ADD FOREIGN KEY(match_id) REFERENCES matches ON DELETE SET NULL;
    CREATE UNIQUE INDEX courts_once ON round_robin_schedule(event_id,round_no,court_no) WHERE NOT is_bye AND voided_at IS NULL AND superseded_by_schedule_id IS NULL;
  `);
  const original = sql('20260912100000_round_robin_atomic_schedule_rebuild.sql');
  await db.exec(original.slice(original.indexOf('CREATE OR REPLACE FUNCTION public.rr_edit_schedule('), original.indexOf('CREATE OR REPLACE FUNCTION public.rr_substitute_round('))
    .replace('v_event.organizer_id <> v_actor', 'NOT public.can_manage_round_robin(p_event_id,v_actor)'));
  const guests = sql('20261003180000_guest_lifecycle.sql');
  await db.exec(guests.slice(guests.indexOf('CREATE OR REPLACE FUNCTION public.guard_guest_roster_identity()'), guests.indexOf('CREATE OR REPLACE FUNCTION public.my_round_robin_registrations')));
  await db.exec(guests.slice(guests.indexOf('CREATE OR REPLACE FUNCTION public.link_claimed_guest_match_participant()'), guests.indexOf('-- Repair unambiguous history')));
  await db.exec(sql('20261003200000_round_robin_control_safety.sql'));
}
