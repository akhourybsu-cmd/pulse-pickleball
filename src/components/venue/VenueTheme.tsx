import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { ScopedThemeContext } from '@/components/ui/scoped-theme';
import { venueThemeStyle } from '@/lib/venues/palette';
import type { VenueBrand } from '@/lib/venues/branding';
import { cn } from '@/lib/utils';

export function VenueTheme({ brand, children, className, dark }: { brand?: VenueBrand | null; children: ReactNode; className?: string; dark?: boolean }) {
  const { resolvedTheme } = useTheme();
  const isDark = dark ?? resolvedTheme === 'dark';
  const value = useMemo(() => {
    const style = venueThemeStyle(brand ?? {}, isDark);
    // Dialog primitives use bg-background; on a portal that means a surface.
    const portalStyle = { ...style, '--background': style['--card'], '--foreground': style['--card-foreground'],
      '--venue-page-ink': style['--venue-card-ink'], '--venue-page-muted': style['--venue-card-muted'],
      '--venue-page-link': style['--venue-card-link'], '--venue-page-highlight': style['--venue-card-highlight'] };
    return { className: 'venue-theme', style: style as CSSProperties, portalStyle: portalStyle as CSSProperties };
  }, [brand, isDark]);
  return <ScopedThemeContext.Provider value={value}><div className={cn('venue-theme bg-background text-foreground', className)} style={value.style}>{children}</div></ScopedThemeContext.Provider>;
}
