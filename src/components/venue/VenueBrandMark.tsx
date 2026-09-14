import { useState } from 'react';
import { cn } from '@/lib/utils';
import { normalizeHex } from '@/lib/venues/branding';

export interface VenueIdentity {
  name: string;
  logoUrl?: string | null;
  logoShape?: 'circle' | 'square' | null;
  logoImageFit?: 'contain' | 'cover' | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export function venueInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase() || 'V';
}

/** Broken or missing images keep a deliberate identity instead of a broken-image icon. */
export function VenueBrandMark({ name, logoUrl, logoShape, logoImageFit, secondaryColor, className }: VenueIdentity & { className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const showImage = !!logoUrl && failedUrl !== logoUrl;
  return <div className={cn('relative flex shrink-0 items-center justify-center overflow-hidden bg-white/10 text-white', logoShape === 'circle' ? 'rounded-full' : 'rounded-2xl', className)} style={{ backgroundColor: showImage && loadedUrl === logoUrl ? normalizeHex(secondaryColor) ?? undefined : undefined }}>
    {(!showImage || loadedUrl !== logoUrl) && <span aria-hidden className="font-sans text-[0.3em] font-semibold tracking-tight">{venueInitials(name)}</span>}
    {showImage && <img src={logoUrl!} alt={`${name} logo`} width={128} height={128} decoding="async" onLoad={() => setLoadedUrl(logoUrl!)} onError={() => setFailedUrl(logoUrl!)} className="absolute inset-0 h-full w-full transition-opacity duration-150 motion-reduce:transition-none" style={{ objectFit: logoImageFit ?? 'contain', opacity: loadedUrl === logoUrl ? 1 : 0 }} />}
  </div>;
}
