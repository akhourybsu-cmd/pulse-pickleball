import { useState } from 'react';
import type { ImageFit } from '@/lib/images/prepareImageUpload';

export interface VenueCoverImageProps {
  src?: string | null;
  fit?: ImageFit | null;
  focalPoint?: 'top' | 'center' | null;
  alt?: string;
}

/** The containing frame owns its dimensions; the photo never stretches the layout. */
export function VenueCoverImage({ src, fit, focalPoint, alt = '' }: VenueCoverImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!src || failedUrl === src) return null;
  return <img src={src} alt={alt} width={2560} height={640} decoding="async"
    onError={() => setFailedUrl(src)} className="pointer-events-none absolute inset-0 h-full w-full max-w-full"
    style={{ objectFit: fit ?? 'cover', objectPosition: focalPoint === 'top' ? 'center top' : 'center' }} />;
}
