import { supabase } from '@/integrations/supabase/client';

const publicVenueBuckets = new Set(['venue-logos', 'groups', 'group-post-images', 'group-message-images', 'group-files']);

/** Do not send private sample files into a bucket with permanently public URLs. */
export async function assertPublicVenueMediaUploadAllowed(bucket: string, path: string) {
  if (!publicVenueBuckets.has(bucket)) return;
  const { data, error } = await (supabase as any).rpc('can_upload_public_venue_media', { p_bucket: bucket, p_path: path });
  if (error) throw error;
  if (data !== true) throw new Error('Uploads are disabled in private sample venues because normal venue files have public links. Text posts, chat, booking and operations are available.');
}
