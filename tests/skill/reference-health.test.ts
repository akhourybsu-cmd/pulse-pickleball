import { describe, expect, it } from 'vitest';
import { referenceUrls, checkReference } from '../../scripts/check-assessment-references.mjs';

describe('public teaching reference availability', () => {
  it('extracts unique HTTPS teaching destinations', () => {
    expect(referenceUrls("a: { url: 'https://example.test/lesson' }, b: { url: 'https://example.test/lesson' }"))
      .toEqual(['https://example.test/lesson']);
  });
  it('flags removed pages, soft errors, and blocked requests', async () => {
    for (const response of [new Response('', { status: 404 }), new Response('<title>Page not found</title>'), new Response('<title>Just a moment...</title>')]) {
      expect((await checkReference('https://example.test', async () => response)).ok).toBe(false);
    }
    expect((await checkReference('https://example.test', async () => { throw new Error('timeout'); })).ok).toBe(false);
    expect((await checkReference('https://example.test', async () => new Response('<title>Forehand lesson</title>'))).ok).toBe(true);
  });
});
