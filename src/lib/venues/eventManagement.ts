import { supabase } from "@/integrations/supabase/client";
import type { GroupEvent } from "@/hooks/useGroupEvents";
import type { VenueEventCourt } from "@/components/community/event-wizard/types";
export interface EventDocument {
  edit_scope?: "occurrence" | "following" | "all";
  series_preview?: {
    id: string;
    updated_at: string;
    start_time: string;
    title: string;
  }[];
  skip_dates?: string[];
  title: string;
  description: string;
  event_format: GroupEvent["event_format"];
  capacity: number;
  price_cents: number;
  court_ids: string[];
  occurrences: { start_time: string; end_time: string }[];
  close_minutes: number;
  registration_paused: boolean;
  cancellation_policy: string | null;
  waitlist_enabled: boolean;
  waitlist_limit: number | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
  frequency?: import("@/components/community/event-wizard/types").RecurringFrequency;
  rotation_style?: string | null;
  rr_games_per_player?: number | null;
}
export interface EventDraft {
  id: string;
  document: EventDocument;
  updated_at: string;
}
export interface ManagedEvent extends GroupEvent {
  court_ids: string[];
  going: number;
  waitlisted: number;
  pending: number;
  collected_cents: number;
}
export interface EventWorkspace {
  venue: { id: string; name: string; timezone: string | null };
  is_owner: boolean;
  facility_enabled: boolean;
  accepting_event_payments: boolean;
  courts: VenueEventCourt[];
  drafts: EventDraft[];
  events: ManagedEvent[];
}
export interface EventAttendee {
  id: string | null;
  name: string;
  status: string;
  checked_in_at: string | null;
  no_show_at: string | null;
  attendance_version: number;
  order_id: string | null;
  payment_status: string | null;
  amount_cents: number | null;
  refunded_cents: number | null;
  refund_state: string | null;
  livemode: boolean | null;
}
export async function eventManagementRpc<T>(
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw new Error(error.message || "The event could not be saved.");
  return data as T;
}
export function validateEventDocument(d: EventDocument) {
  if (!d.title.trim() || d.title.trim().length > 150)
    throw new Error("Enter a title of 1–150 characters.");
  if (
    !Number.isInteger(d.price_cents) ||
    (d.price_cents !== 0 && (d.price_cents < 100 || d.price_cents > 99999999))
  )
    throw new Error(
      "Set a free event or a price of at least $1.00 per player."
    );
  if (!Number.isInteger(d.capacity) || d.capacity < 1 || d.capacity > 5000)
    throw new Error("Choose a capacity from 1 to 5,000 players.");
  if (
    d.event_format === "round_robin" &&
    d.rr_games_per_player != null &&
    (!Number.isInteger(d.rr_games_per_player) ||
      d.rr_games_per_player < 1 ||
      d.rr_games_per_player > 20)
  )
    throw new Error("Choose 1 to 20 games per player.");
  if (!d.occurrences.length || !d.court_ids.length)
    throw new Error(
      "Choose valid dates, a duration and at least one available court."
    );
  if (
    d.occurrences.some(
      (o) =>
        new Date(o.start_time).getTime() <= Date.now() ||
        new Date(o.end_time) <= new Date(o.start_time)
    )
  )
    throw new Error("Choose future event dates with a positive duration.");
  if (d.cancellation_policy && d.cancellation_policy.trim().length < 20)
    throw new Error(
      "Write a cancellation policy of at least 20 characters or use the venue policy."
    );
  if (
    d.skill_level_min != null &&
    d.skill_level_max != null &&
    d.skill_level_min > d.skill_level_max
  )
    throw new Error("Minimum skill cannot exceed maximum skill.");
}
