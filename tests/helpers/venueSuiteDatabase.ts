import { readFileSync } from "node:fs";
import { venueEventDatabase } from "./venueEventDatabase";
import type { PGlite } from "@electric-sql/pglite";
export async function venueSuiteDatabase(
  beforeMigrations?: (db: PGlite) => Promise<void>,
) {
  const db = await venueEventDatabase();
  await db.exec(
    "ALTER TABLE groups ADD COLUMN type text DEFAULT 'venue_official'",
  );
  const privacy = readFileSync(
    "supabase/migrations/20260920100000_private_venue_sandboxes.sql",
    "utf8",
  );
  await db.exec(
    privacy.slice(
      privacy.indexOf("CREATE FUNCTION public.can_access_private_venue"),
      privacy.indexOf("CREATE FUNCTION public.can_access_private_group"),
    ),
  );
  await beforeMigrations?.(db);
  await db.exec(
    "CREATE TABLE IF NOT EXISTS notification_preferences(user_id uuid,category text,in_app_enabled boolean)",
  );
  for (const file of [
    "20260928200000_venue_program_roster.sql",
    "20260929010000_venue_attendance.sql",
    "20260929011000_venue_attendance_mfa.sql",
    "20260929100000_venue_customer_records.sql",
    "20260929110000_venue_desk_sales.sql",
    "20260929120000_venue_booking_policies.sql",
    "20260929130000_venue_walkins.sql",
    "20260929131000_venue_visit_integration.sql",
    "20260929140000_venue_player_checkin.sql",
    "20260929150000_venue_waitlist_offers.sql",
    "20260929160000_venue_communications.sql",
    "20260929170000_venue_series_management.sql",
    "20260929180000_venue_reports.sql",
    "20260929190000_venue_lessons_private_bookings.sql",
    "20260929200000_venue_online_booking_attendance.sql",
    "20260929210000_venue_desk_completion.sql",
    "20260929220000_venue_player_visit_portal.sql",
    "20260929233000_venue_appointment_reports.sql",
    "20260930100000_venue_arrivals_and_waivers.sql",
    "20260930101000_private_rental_parties.sql",
    "20260930102000_venue_coach_scheduling.sql",
    "20260930103000_venue_waiver_reminders_mfa.sql",
    "20260930110000_venue_payment_providers.sql",
    "20260930111000_route_venue_desk_payments.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  return db;
}
