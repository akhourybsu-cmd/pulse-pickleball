import { supabase } from '@/integrations/supabase/client';
import type { AddressStatus } from './address';

// Add future integrations as separate cards/adapters. Provider credentials stay server-side.
export const VENUE_INTEGRATIONS = [{ id: 'pulse-address', name: 'PULSE address', description: 'A memorable link that welcomes players to your venue.' }] as const;
export interface AddressConnection {
  id: string; venue_id: string; slug: string; status: AddressStatus; requested_at: string; checked_at: string | null;
  provider_details?: {
    host?: string; ownership?: string; certificate?: string; dns_automation?: string;
    dns?: { domainName: string; type: string; rdata: string; requiredAction: string }[];
    issues?: string[];
  };
}
export interface VenueAddressSetup {
  venue_slug: string; active: boolean; verified: boolean; private_sample: boolean; public_ready: boolean;
  connection: AddressConnection | null;
}
export interface AddressAvailability { slug: string; available: boolean; reason: string | null }
export interface VenueAddressRequest { venue_id: string; venue_name: string; slug: string; status: AddressStatus; requested_at: string }
export async function getVenueAddressSetup(venueId: string): Promise<VenueAddressSetup> {
  const { data, error } = await supabase.rpc('get_venue_address_setup', { p_venue_id: venueId });
  if (error) throw error;
  return data as unknown as VenueAddressSetup;
}
export async function checkVenueAddress(venueId: string, slug: string): Promise<AddressAvailability> {
  const { data, error } = await supabase.rpc('check_venue_address', { p_venue_id: venueId, p_slug: slug });
  if (error) throw error;
  return data as unknown as AddressAvailability;
}
export async function requestVenueAddress(venueId: string, slug: string): Promise<VenueAddressSetup> {
  const { data, error } = await supabase.rpc('request_venue_address', { p_venue_id: venueId, p_slug: slug });
  if (error) throw error;
  return data as unknown as VenueAddressSetup;
}
export async function listVenueAddressRequests(): Promise<VenueAddressRequest[]> {
  const { data, error } = await supabase.rpc('list_venue_address_requests');
  if (error) throw error;
  return data as unknown as VenueAddressRequest[];
}
export async function queueVenueAddressCheck(venueId: string) {
  const { error } = await supabase.rpc('queue_venue_address_check', { p_venue_id: venueId });
  if (error) throw error;
}
