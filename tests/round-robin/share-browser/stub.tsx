// Local browser fixtures only. No credentials, live signups or backend writes.
import React, { useSyncExternalStore } from "react";
const params = new URLSearchParams(window.location.search);
let signedIn = params.has("signedin");
const listeners = new Set<() => void>();
export function signInPreview() { signedIn=true; listeners.forEach(listener => listener()); }
export function useAuthState() { const authenticated=useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => signedIn); return { user: authenticated ? { id: "preview-player" } : null, isAuthenticated: authenticated, loading: false }; }
const entry = { event_id: "10000000-0000-4000-8000-000000000001", name: "Friday Lights · Rally House", date: "2026-11-06", start_time: "18:30:00", location: "Rally House · Main courts",
  notes: "A social evening of rotating partners and friendly competition. Arrive ten minutes before play with your paddle and water.", status: "draft", format: "open", num_courts: 4, num_rounds: 5,
  registration_mode: "invite_only", registration_deadline: null, max_players: 18, confirmed_count: params.has("full") ? 18 : 12,
  waitlisted_count: 0, registration_status: null as string | null, waitlist_position: null as number | null, can_open: false,
  closed_reason: params.has("closed") ? "Registration has closed for this event." : null, organizer_name: "Alex", venue_registration_path: null, price_cents: null, currency: null };
export const supabase = { rpc(name: string) {
  if (name === "join_round_robin_event") { entry.registration_status=params.has("full") ? "waitlisted" : "confirmed"; entry.can_open=entry.registration_status === "confirmed"; entry.waitlist_position=entry.can_open ? null : 1; entry.waitlisted_count=entry.can_open ? 0 : 1; }
  const response=Promise.resolve({ data: name === "get_round_robin_entry" ? params.has("invalid") ? null : { ...entry } : { registration_status: entry.registration_status, message: "Your place is saved" }, error: null });
  return Object.assign(response, { abortSignal: () => response });
} };
export default function PlayerViewPreview() { return <main className="mx-auto max-w-xl space-y-4 p-12"><h1 className="text-2xl font-bold">You're registered · Player event opened</h1><p>This local fixture confirms that the real entry page opened the player experience after registration.</p></main>; }
