export { eventManagementRpc as venueRpc } from "./eventManagement";
export interface VenueCustomer {
  id: string;
  venue_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  updated_at: string;
  created_at: string;
}
export interface VenueDocument {
  id: string;
  title: string;
  body: string;
  version: number;
  required: boolean;
  published_at: string;
  retired_at: string | null;
  accepted_at?: string | null;
  signer_name?: string | null;
}
export interface VenueCustomerProfile {
  visits?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    status: string;
    method: string;
    checked_in_at: string | null;
    no_show_at: string | null;
    canceled_reason: string | null;
  }[];
  entitlements?: import("./deskSales").VenueEntitlement[];
  player: VenueCustomer;
  notes: { id: string; body: string; created_at: string }[];
  documents: VenueDocument[];
  registrations: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    status: string;
    checked_in_at: string | null;
    no_show_at: string | null;
  }[];
  bookings: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    court: string | null;
  }[];
  purchases: {
    id: string;
    description: string;
    amount_cents: number;
    refunded_cents: number;
    status: string;
    created_at: string;
  }[];
}
export interface VisitDocumentView {
  timezone?: string;
  server_now?: string;
  brand?: import("./branding").VenueBrand;
  visits?: {
    id: string;
    kind: "registration" | "desk";
    title: string;
    start_time: string;
    end_time: string;
    checked_in_at: string | null;
    visit_status: string | null;
  }[];
  venue_name: string;
  player_name: string;
  expires_at: string;
  documents: VenueDocument[];
}
export function venueDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
