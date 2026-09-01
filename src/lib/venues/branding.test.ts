import { describe, expect, it } from 'vitest';
import { normalizeHex, venueChrome, withAlpha } from './branding';

describe('normalizeHex', () => {
  it('expands shorthand to six digits', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('#F0A')).toBe('#ff00aa');
  });

  it('passes through full-length hex, lowercased and trimmed', () => {
    expect(normalizeHex('  #C9962F ')).toBe('#c9962f');
  });

  it('rejects anything that is not a plain hex colour', () => {
    for (const bad of [
      '',
      'red',
      'C9962F', // no hash
      '#12345',
      '#1234567',
      'rgb(1,2,3)',
      'javascript:alert(1)',
      '#ggg',
      null,
      undefined,
    ]) {
      expect(normalizeHex(bad as string | null)).toBeNull();
    }
  });

  it('rejects hex with an alpha channel, which would compound with ours', () => {
    expect(normalizeHex('#aabbccdd')).toBeNull();
    expect(normalizeHex('#abcd')).toBeNull();
  });
});

describe('withAlpha', () => {
  it('appends an eight-bit alpha', () => {
    expect(withAlpha('#c9962f', 1)).toBe('#c9962fff');
    expect(withAlpha('#c9962f', 0)).toBe('#c9962f00');
  });

  it('pads single-digit alpha bytes', () => {
    expect(withAlpha('#000000', 0.02)).toBe('#00000005');
  });

  it('clamps out-of-range alpha', () => {
    expect(withAlpha('#ffffff', 5)).toBe('#ffffffff');
    expect(withAlpha('#ffffff', -3)).toBe('#ffffff00');
  });
});

describe('venueChrome', () => {
  it('returns null when there is no venue', () => {
    expect(venueChrome(null)).toBeNull();
    expect(venueChrome(undefined)).toBeNull();
  });

  it('returns null when no usable colour is set, so Pulse chrome is kept', () => {
    expect(venueChrome({ primary_color: null, secondary_color: null })).toBeNull();
    expect(venueChrome({ primary_color: 'chartreuse', secondary_color: 'not a colour' })).toBeNull();
  });

  it('builds a band from the secondary and an accent from the primary', () => {
    const chrome = venueChrome({ primary_color: '#c9962f', secondary_color: '#1f2933' })!;
    expect(chrome.accent).toBe('#c9962f');
    expect(chrome.backgroundImage).toContain('#1f2933ff');
    expect(chrome.bloom).toContain('#c9962f');
    expect(chrome.border).toContain('#c9962f');
  });

  it('still brands when only the accent colour is set', () => {
    const chrome = venueChrome({ primary_color: '#ff0055', secondary_color: null })!;
    expect(chrome.accent).toBe('#ff0055');
    // Falls back to the app's own ink for the band rather than bailing out.
    expect(chrome.backgroundImage).toContain('#1f2933');
  });

  it('still brands when only the band colour is set, keeping the Pulse accent', () => {
    const chrome = venueChrome({ primary_color: null, secondary_color: '#004488' })!;
    expect(chrome.backgroundImage).toContain('#004488ff');
    expect(chrome.accent).toBe('hsl(var(--primary))');
  });

  it('normalizes shorthand colours before use', () => {
    const chrome = venueChrome({ primary_color: '#abc', secondary_color: '#123' })!;
    expect(chrome.accent).toBe('#aabbcc');
    expect(chrome.backgroundImage).toContain('#112233ff');
  });

  it('never emits an unvalidated string into CSS', () => {
    const chrome = venueChrome({
      primary_color: 'red; background: url(evil)',
      secondary_color: '#123456',
    })!;
    expect(chrome.accent).toBe('hsl(var(--primary))');
    expect(JSON.stringify(chrome)).not.toContain('evil');
  });

  it('darkens toward the bottom so white text stays legible on a light brand', () => {
    const chrome = venueChrome({ primary_color: null, secondary_color: '#ffffff' })!;
    expect(chrome.backgroundImage).toContain('#0f1216');
  });
});

describe('venueChrome accentHex', () => {
  it('is the hex accent when the venue set one', () => {
    expect(venueChrome({ primary_color: '#abc', secondary_color: null })!.accentHex).toBe('#aabbcc');
  });

  it('is null when the accent fell back to a Pulse token', () => {
    // Compositing alpha onto `hsl(var(--primary))` is not a colour; callers
    // must be able to tell the difference and skip the tint.
    const chrome = venueChrome({ primary_color: null, secondary_color: '#004488' })!;
    expect(chrome.accent).toBe('hsl(var(--primary))');
    expect(chrome.accentHex).toBeNull();
  });

  it('is null when the accent was rejected as unsafe', () => {
    expect(
      venueChrome({ primary_color: 'red; background: url(evil)', secondary_color: '#123456' })!
        .accentHex,
    ).toBeNull();
  });
});
