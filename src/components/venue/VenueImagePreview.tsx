import { Monitor, Smartphone } from 'lucide-react';
import { VenueBrandMark, type VenueIdentity } from './VenueBrandMark';
import { VenueCoverImage, type VenueCoverImageProps } from './VenueCoverImage';

/** Representative 390px phone / 1440px desktop compositions, scaled to fit the editor. */
export function VenueImagePreview({ identity, cover }: { identity: VenueIdentity; cover: VenueCoverImageProps }) {
  return <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" aria-label="Venue image device previews">
    {(['phone', 'desktop'] as const).map(device => {
      const Icon = device === 'phone' ? Smartphone : Monitor;
      return <section key={device} className="min-w-0 space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Icon className="h-3.5 w-3.5" />{device === 'phone' ? 'Phone' : 'Desktop'}</p>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative isolate overflow-hidden bg-[#171a1f]" style={{ aspectRatio: device === 'phone' ? '390 / 176' : '1440 / 288' }}>
            <VenueCoverImage {...cover} alt={`${device === 'phone' ? 'Phone' : 'Desktop'} banner preview`} />
          </div>
          <div className="flex min-w-0 items-center gap-2 p-2.5">
            <VenueBrandMark {...identity} className="h-9 w-9 bg-muted text-[36px] text-foreground ring-1 ring-border" />
            <span className="min-w-0 truncate text-xs font-semibold">{identity.name}</span>
          </div>
        </div>
      </section>;
    })}
  </div>;
}
