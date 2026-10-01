import { copyCommunityText, shareCommunity } from "@/lib/communityShare";

export function roundRobinPath(eventId: string, inviteCode?: string | null) {
  const path = `/round-robin/${encodeURIComponent(eventId)}`;
  return inviteCode?.trim() ? `${path}?${new URLSearchParams({ invite: inviteCode.trim().toUpperCase() })}` : path;
}

// Native apps may run on localhost. Invitations always point to the public app.
export const roundRobinUrl = (eventId: string, inviteCode?: string | null) =>
  `https://pulsepb.com${roundRobinPath(eventId, inviteCode)}`;

export const copyRoundRobinLink = (eventId: string, inviteCode?: string | null) =>
  copyCommunityText(roundRobinUrl(eventId, inviteCode));

export const shareRoundRobin = (eventId: string, name: string, inviteCode?: string | null) =>
  shareCommunity({ title: name, text: `Join ${name} on PULSE. View the event and register or join the waitlist.`, url: roundRobinUrl(eventId, inviteCode) });

export interface RoundRobinEntryData {
  event_id: string;
  name: string;
  date: string;
  start_time: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  format: string;
  num_courts: number;
  num_rounds: number;
  registration_mode: string;
  registration_deadline: string | null;
  max_players: number | null;
  confirmed_count: number;
  waitlisted_count: number;
  registration_status: string | null;
  waitlist_position: number | null;
  can_open: boolean;
  closed_reason: string | null;
  organizer_name: string;
  venue_registration_path: string | null;
  price_cents: number | null;
  currency: string | null;
}

export function roundRobinJoinAction(event: RoundRobinEntryData) {
  if (event.can_open) return { label: "Open Event", disabled: false };
  if (event.registration_status === "waitlisted") return { label: "You're on the Waitlist", disabled: true };
  if (event.registration_status === "confirmed") return { label: "View Registration", disabled: !event.venue_registration_path };
  if (event.closed_reason) return { label: "Registration Closed", disabled: true };
  if (event.max_players !== null && event.confirmed_count >= event.max_players) return { label: "Join the Waitlist", disabled: false };
  return { label: !event.venue_registration_path && event.registration_mode !== "open_registration" ? "Join the Event" : "Register", disabled: false };
}
