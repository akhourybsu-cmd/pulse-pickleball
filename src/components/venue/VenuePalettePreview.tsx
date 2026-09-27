import { CalendarDays, LayoutGrid } from 'lucide-react';
import { VenueTheme } from './VenueTheme';
import { VenueBrandMark, type VenueIdentity } from './VenueBrandMark';
import type { VenueBrand } from '@/lib/venues/branding';

/** Same tokens and logo renderer as the venue; editing never writes preview data. */
export function VenuePalettePreview({ brand, identity, dark }: { brand: VenueBrand; identity: VenueIdentity; dark?: boolean }) {
  return <div className="space-y-2">
    <p className="text-sm font-medium">Live palette preview</p>
    <VenueTheme brand={brand} dark={dark} className="overflow-hidden rounded-xl border">
      <div className="venue-palette-preview-header flex items-center gap-3 p-4">
        <VenueBrandMark {...identity} secondaryColor={brand.secondary_color} logoBackgroundColor={brand.logo_background_color} className="h-12 w-12 text-[48px] ring-1 ring-current/20" />
        <div className="min-w-0"><p className="truncate font-semibold">{identity.name}</p><p className="text-xs opacity-80">Your venue, ready to play</p></div>
      </div>
      <div className="flex gap-5 border-b px-4 text-sm" aria-hidden>
        <span className="border-b-2 border-[hsl(var(--venue-highlight))] py-3 font-semibold">Overview</span><span className="py-3 text-muted-foreground">Play</span><span className="py-3 text-muted-foreground">Events</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 font-semibold"><CalendarDays className="venue-service-label h-4 w-4" />Plan your next visit</p>
          <p className="text-sm text-muted-foreground">Reserve a court or find an upcoming session.</p>
          <div className="flex flex-wrap gap-2" aria-hidden>
            <span className="club-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"><LayoutGrid className="h-4 w-4" />Play</span>
            <span className="rounded-lg border px-3 py-2 text-sm font-medium text-primary">View schedule</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Preview only · Your existing venue layout stays the same.</p>
      </div>
    </VenueTheme>
    <p className="text-xs leading-5 text-muted-foreground" role="status">PULSE surfaces stay consistent. Button labels adapt automatically for readability.</p>
  </div>;
}
