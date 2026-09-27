import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VenueBrandMark } from '@/components/venue/VenueBrandMark';
import { hexToHsl } from '@/lib/venues/palette';
import { VenueTheme } from '@/components/venue/VenueTheme';
import { useScopedTheme } from '@/components/ui/scoped-theme';

function ScopedSurface({ children }: { children: React.ReactNode }) {
  const theme = useScopedTheme();
  return theme ? <div className={theme.className} style={theme.style}>{children}</div> : <>{children}</>;
}

describe('venue branding surfaces', () => {
  it('paints the logo tile before its image loads and when the logo is missing', () => {
    for (const logoUrl of [undefined, '/transparent-logo.svg']) {
      const html = renderToStaticMarkup(<VenueBrandMark name="Test Club" logoUrl={logoUrl} secondaryColor="#123" logoBackgroundColor="#fff" />);
      expect(html).toContain('background-color:#ffffff');
      expect(html).toContain('color:#000000');
      expect(html).toContain('TC');
    }
  });

  it('carries local theme tokens into portal content without changing unrelated UI', () => {
    expect(renderToStaticMarkup(<ScopedSurface><p>Platform menu</p></ScopedSurface>)).toBe('<p>Platform menu</p>');
    const html = renderToStaticMarkup(<VenueTheme brand={{ primary_color: '#123', logo_background_color: '#fff' }}><ScopedSurface><p>Venue booking</p></ScopedSurface></VenueTheme>);
    expect(html.match(/--club-accent:#112233/g)).toHaveLength(2);
    expect(html).toContain('--venue-logo-background:#ffffff');
  });

  it('uses the card color for dialog backgrounds even when the page has a different color', () => {
    const html = renderToStaticMarkup(<VenueTheme brand={{ background_color: '#000', surface_color: '#fff' }}><ScopedSurface><p>Review booking</p></ScopedSurface></VenueTheme>);
    expect(html).toContain('--background:' + hexToHsl('#f7f5ef'));
    expect(html).toContain('--background:0.00 0.00% 100.00%');
  });
});
