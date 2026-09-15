import { supabase } from '@/integrations/supabase/client';
import { prepareImageForUpload, storagePathFromPublicUrl } from '@/lib/images/prepareImageUpload';
import { assertPublicVenueMediaUploadAllowed } from './privateMedia';

export type VenueImageKind = 'logo' | 'cover';
export const VENUE_IMAGE_OPTIONS = {
  logo: { maxInputMB: 12, maxOutputMB: 8, maxDimension: 1024, minWidth: 320, minHeight: 320, quality: 0.92 },
  cover: { maxInputMB: 12, maxOutputMB: 8, maxDimension: 2880, minWidth: 1200, minHeight: 400, quality: 0.92 },
} as const;

function ownedImagePath(url: string | null, venueId: string) {
  const path = storagePathFromPublicUrl(url, 'venue-logos');
  return path?.startsWith(`${venueId}/`) ? path : null;
}

async function cleanUp(path: string | null) {
  if (!path) return;
  // Cleanup failure must never turn a confirmed profile update into a reported failure.
  try { await supabase.storage.from('venue-logos').remove([path]); } catch { /* Safe to retry later. */ }
}

export async function uploadVenueImage(venueId: string, kind: VenueImageKind, file: File, previousUrl: string | null) {
  await assertPublicVenueMediaUploadAllowed('venue-logos', `${venueId}/upload`);
  // Preserve the original aspect ratio. Fit/crop is reversible and applied at display time.
  const prepared = await prepareImageForUpload(file, VENUE_IMAGE_OPTIONS[kind]);
  const path = `${venueId}/venue-${kind}-${crypto.randomUUID()}.${prepared.extension}`;
  const storage = supabase.storage.from('venue-logos');
  const { error: uploadError } = await storage.upload(path, prepared.blob, { upsert: false, contentType: prepared.blob.type, cacheControl: '31536000' });
  if (uploadError) throw uploadError;
  const { data: { publicUrl } } = storage.getPublicUrl(path);
  const { error } = await supabase.from('venues').update({ [kind === 'logo' ? 'logo_url' : 'cover_image_url']: publicUrl }).eq('id', venueId).select('id').single();
  if (error) {
    // Only an explicit database rejection proves the new file is unreferenced.
    // A lost network response may follow a committed update: keep both files safe.
    if (error.code === 'PGRST116' || /^[0-9A-Z]{5}$/.test(error.code ?? '')) await cleanUp(path);
    throw error;
  }
  await cleanUp(ownedImagePath(previousUrl, venueId));
  return { ...prepared, publicUrl };
}

export async function removeVenueImage(venueId: string, kind: VenueImageKind, previousUrl: string | null) {
  const { error } = await supabase.from('venues').update({ [kind === 'logo' ? 'logo_url' : 'cover_image_url']: null }).eq('id', venueId).select('id').single();
  if (error) throw error;
  await cleanUp(ownedImagePath(previousUrl, venueId));
}
