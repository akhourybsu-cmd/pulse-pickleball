import { pathToFileURL } from "node:url";
import { PRODUCTION_SUPABASE_PROJECT } from "../src/lib/backendPolicy.mjs";

export function venueIntegrityQuery(venueId) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      venueId || ""
    )
  )
    throw new Error("A venue UUID is required.");
  // Only configuration flags and integrity counts leave the database. Never
  // include customers, contacts, document text, tokens, prices or revenue.
  return `WITH target AS (SELECT * FROM public.venues WHERE id='${venueId}'::uuid),
    events AS (SELECT * FROM public.group_events WHERE venue_id='${venueId}'::uuid AND canceled_at IS NULL AND end_time>now()),
    official AS (SELECT * FROM public.groups WHERE venue_id='${venueId}'::uuid AND type='venue_official')
  SELECT jsonb_build_object(
    'venue_exists',EXISTS(SELECT 1 FROM target),
    'venue_active',coalesce((SELECT is_active FROM target),false),
    'venue_published',coalesce((SELECT is_published FROM target),false),
    'official_community_exists',EXISTS(SELECT 1 FROM official),
    'community_public',EXISTS(SELECT 1 FROM official WHERE visibility='public'),
    'sample_venue',EXISTS(SELECT 1 FROM public.private_venue_sandboxes WHERE venue_id='${venueId}'::uuid),
    'required_waiver_published',EXISTS(SELECT 1 FROM public.venue_documents WHERE venue_id='${venueId}'::uuid AND required AND retired_at IS NULL),
    'products_configured',EXISTS(SELECT 1 FROM public.venue_products WHERE venue_id='${venueId}'::uuid AND active),
    'coach_availability_configured',EXISTS(SELECT 1 FROM public.venue_coaches WHERE venue_id='${venueId}'::uuid AND active AND jsonb_array_length(availability)>0),
    'active_courts',(SELECT count(*) FROM public.venue_courts WHERE venue_id='${venueId}'::uuid AND is_active),
    'upcoming_programs',(SELECT count(*) FROM events WHERE parent_event_id IS NULL AND event_format NOT IN ('reservation','program_hold')),
    'programs_without_courts',(SELECT count(*) FROM events e WHERE e.parent_event_id IS NULL AND e.event_format NOT IN ('reservation','program_hold') AND e.venue_court_id IS NULL AND NOT EXISTS(SELECT 1 FROM events b WHERE b.parent_event_id=e.id AND b.event_format='program_hold')),
    'invalid_court_allocations',(SELECT count(*) FROM events b JOIN public.group_events e ON e.id=b.parent_event_id LEFT JOIN public.venue_courts c ON c.id=b.venue_court_id WHERE b.event_format='program_hold' AND ((b.venue_id,b.group_id,b.start_time,b.end_time) IS DISTINCT FROM (e.venue_id,e.group_id,e.start_time,e.end_time) OR c.venue_id IS DISTINCT FROM b.venue_id)),
    'overlapping_court_blocks',(SELECT count(*) FROM events a JOIN events b ON a.id<b.id AND a.venue_court_id=b.venue_court_id AND a.start_time<b.end_time AND b.start_time<a.end_time),
    'cross_venue_visits',(SELECT count(*) FROM public.venue_visits v LEFT JOIN public.group_events e ON e.id=v.event_id LEFT JOIN public.venue_courts c ON c.id=v.court_id WHERE v.venue_id='${venueId}'::uuid AND ((v.event_id IS NOT NULL AND e.venue_id IS DISTINCT FROM v.venue_id) OR (v.court_id IS NOT NULL AND c.venue_id IS DISTINCT FROM v.venue_id))),
    'contradictory_attendance',(SELECT count(*) FROM public.venue_visits WHERE venue_id='${venueId}'::uuid AND checked_in_at IS NOT NULL AND no_show_at IS NOT NULL),
    'cross_venue_payment_links',(SELECT count(*) FROM public.venue_sales s JOIN public.payment_orders p ON p.id=s.payment_order_id WHERE s.venue_id='${venueId}'::uuid AND p.venue_id IS DISTINCT FROM s.venue_id),
    'appointment_block_mismatches',(SELECT count(*) FROM public.venue_appointments a WHERE a.venue_id='${venueId}'::uuid AND a.status IN ('held','confirmed') AND a.end_time>now() AND cardinality(a.court_ids)<>(SELECT count(*) FROM public.group_events e WHERE e.venue_appointment_id=a.id AND e.canceled_at IS NULL AND e.venue_court_id=ANY(a.court_ids) AND (e.start_time,e.end_time)=(a.start_time,a.end_time))),
    'private_table_access_violations',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('venue_customers','venue_customer_notes','venue_document_acceptances','venue_visits','venue_sales','venue_entitlements','venue_appointments','venue_equipment_returns') AND (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')))
  ) AS checks;`;
}

export const integrityCounters = [
  "programs_without_courts",
  "invalid_court_allocations",
  "overlapping_court_blocks",
  "cross_venue_visits",
  "contradictory_attendance",
  "cross_venue_payment_links",
  "appointment_block_mismatches",
  "private_table_access_violations",
];
export function summarizeVenueChecks(checks) {
  if (!checks || !checks.venue_exists)
    throw new Error("The target venue was not found.");
  const failures = integrityCounters.filter(
    (k) => typeof checks[k] !== "number" || checks[k] !== 0
  );
  const setup = [
    "required_waiver_published",
    "products_configured",
    "coach_availability_configured",
  ].filter((k) => checks[k] !== true);
  return {
    integrityPassed: failures.length === 0,
    failures,
    setupNeeded: setup,
    publicAccess:
      checks.venue_active &&
      checks.venue_published &&
      checks.official_community_exists &&
      checks.community_public &&
      !checks.sample_venue
        ? "available"
        : "restricted",
    checks,
  };
}
export async function checkVenueSystem(env = process.env, request = fetch) {
  if (
    env.SUPABASE_PROJECT_REF !== PRODUCTION_SUPABASE_PROJECT ||
    !env.SUPABASE_ACCESS_TOKEN?.startsWith("sbp_")
  )
    throw new Error(
      "Approved production project and deployment credential are required."
    );
  const response = await request(
    `https://api.supabase.com/v1/projects/${PRODUCTION_SUPABASE_PROJECT}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: venueIntegrityQuery(env.VENUE_ID),
        read_only: true,
      }),
      signal: AbortSignal.timeout(45000),
    }
  );
  // Provider errors may contain SQL or private values; never echo response bodies.
  if (!response.ok)
    throw new Error(`Venue integrity query failed (HTTP ${response.status}).`);
  const data = await response.json();
  const rows = Array.isArray(data) ? data : data?.data;
  return summarizeVenueChecks(rows?.[0]?.checks);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  checkVenueSystem()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.integrityPassed) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
