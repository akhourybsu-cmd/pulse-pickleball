import { describe, expect, it } from 'vitest';
import { contrastInk, contrastRatio, readableColor, resolveVenuePalette, venueThemeStyle } from './palette';

describe('venue palette', () => {
  it('keeps legacy colors and gives logos an independent matte', () => {
    const legacy = { primary_color: '#f80', secondary_color: '#123' };
    expect(resolveVenuePalette(legacy)).toMatchObject({ primary: '#ff8800', secondary: '#112233', accent: '#ff8800', logoBackground: '#112233' });
    expect(resolveVenuePalette({ ...legacy, logo_background_color: '#fff', accent_color: '#0a0' })).toMatchObject({ primary: '#ff8800', secondary: '#112233', accent: '#00aa00', logoBackground: '#ffffff' });
  });

  it('rejects malformed saved colors and adapts automatic surfaces to dark mode', () => {
    const bad = 'red; background: url(unsafe)';
    const theme = venueThemeStyle({ primary_color: bad, background_color: bad, surface_color: bad, text_color: bad, accent_color: bad, logo_background_color: bad });
    expect(JSON.stringify(theme)).not.toContain('unsafe');
    expect(resolveVenuePalette({}, true).background).not.toBe(resolveVenuePalette().background);
    expect(resolveVenuePalette({ background_color: '#def' }, true).background).toBe('#15171a');
  });

  it('keeps text and button labels readable across pale, saturated and dark colors', () => {
    const colors = ['#ffffff', '#000000', '#ffff00', '#00ff00', '#0000ff', '#c9962f', '#777777', '#faf8f3', '#1e2024'];
    for (const background of colors) {
      expect(contrastRatio(contrastInk(background), background)).toBeGreaterThanOrEqual(4.5);
      for (const color of colors) expect(contrastRatio(readableColor(color, background), background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps PULSE surfaces and reading colors consistent across venue brands', () => {
    const p = resolveVenuePalette({ background_color: '#000', surface_color: '#fff', text_color: '#aaa' });
    expect(contrastRatio(p.pageText, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.surfaceText, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(p).toMatchObject({ background: '#f7f5ef', surface: '#ffffff', text: '#24272c' });
    expect(venueThemeStyle({ secondary_color: '#ff0000' })['--venue-header']).toBe('#151b24');
  });
});
