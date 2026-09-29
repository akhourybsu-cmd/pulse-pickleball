import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { contrastRatio, resolveVenueChatPalette, venueThemeStyle } from '@/lib/venues/palette';

describe('venue chat colors', () => {
  it('stores overrides per venue, validates colors and supports resetting to automatic', async () => {
    const db = new PGlite();
    try {
      await db.exec("CREATE TABLE venues(id integer PRIMARY KEY, primary_color text); INSERT INTO venues VALUES(1,'#123456'),(2,'#abcdef');");
      await db.exec(readFileSync('supabase/migrations/20260929020000_venue_chat_colors.sql', 'utf8'));
      await db.exec("UPDATE venues SET chat_background_color='#123', chat_incoming_color='#ABCDEF', chat_outgoing_color='#fff' WHERE id=1");
      expect((await db.query('SELECT * FROM venues WHERE id=1')).rows[0]).toMatchObject({ primary_color: '#123456', chat_background_color: '#123', chat_incoming_color: '#ABCDEF', chat_outgoing_color: '#fff' });
      expect((await db.query('SELECT chat_background_color,chat_incoming_color,chat_outgoing_color FROM venues WHERE id=2')).rows[0]).toEqual({ chat_background_color: null, chat_incoming_color: null, chat_outgoing_color: null });
      for (const column of ['chat_background_color', 'chat_incoming_color', 'chat_outgoing_color']) {
        for (const bad of ['', '#12345678', 'red; background:url(x)']) {
          await expect(db.query(`UPDATE venues SET ${column}=$1 WHERE id=1`, [bad])).rejects.toThrow();
        }
      }
      await db.exec('UPDATE venues SET chat_background_color=NULL,chat_incoming_color=NULL,chat_outgoing_color=NULL WHERE id=1');
      expect((await db.query('SELECT chat_outgoing_color FROM venues WHERE id=1')).rows[0]).toEqual({ chat_outgoing_color: null });
    } finally { await db.close(); }
  });

  it('keeps text readable on chosen message and canvas colors in both themes', () => {
    for (const dark of [false, true]) for (const color of ['#ffffff', '#000000', '#ffff00', '#777777', '#0a6fdb']) {
      const p = resolveVenueChatPalette({ chat_background_color: color, chat_incoming_color: color, chat_outgoing_color: color }, dark);
      for (const [ink, background] of [[p.text, p.background], [p.mutedText, p.background], [p.incomingText, p.incoming], [p.outgoingText, p.outgoing]]) {
        expect(contrastRatio(ink, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('uses safe theme defaults and keeps chat overrides separate from the venue palette', () => {
    expect(resolveVenueChatPalette({ primary_color: '#123' }).outgoing).toBe('#112233');
    expect(resolveVenueChatPalette({}, true).background).not.toBe(resolveVenueChatPalette().background);
    expect(resolveVenueChatPalette({ chat_background_color: 'url(unsafe)' })).toEqual(resolveVenueChatPalette());
    const original = venueThemeStyle({ primary_color: '#123' });
    const custom = venueThemeStyle({ primary_color: '#123', chat_background_color: '#000', chat_incoming_color: '#fff', chat_outgoing_color: '#ff0000' });
    for (const key of Object.keys(original).filter(key => !key.startsWith('--venue-chat-'))) expect(custom[key]).toBe(original[key]);
    expect(custom['--venue-chat-outgoing']).not.toBe(original['--venue-chat-outgoing']);
  });
});
