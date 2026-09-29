import { readFileSync } from "node:fs";
import { venueEventDatabase } from "./venueEventDatabase";
export async function venueSuiteDatabase() {
  const db = await venueEventDatabase();
  await db.exec(
    "CREATE TABLE IF NOT EXISTS notification_preferences(user_id uuid,category text,in_app_enabled boolean)"
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
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  return db;
}
