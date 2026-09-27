import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('preserves existing branding and validates optional palette colors in the database', async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE public.venues (id integer PRIMARY KEY, primary_color text, secondary_color text); INSERT INTO public.venues VALUES (1, '#c9962f', '#1f2933');");
    await db.exec(readFileSync('supabase/migrations/20260927100000_venue_color_palette.sql', 'utf8'));
    expect((await db.query('SELECT * FROM public.venues')).rows[0]).toMatchObject({ primary_color: '#c9962f', secondary_color: '#1f2933', logo_background_color: null });
    await db.exec("UPDATE public.venues SET accent_color='#ABC', background_color='#f4f1e9', surface_color='#fff', text_color='#123456', logo_background_color='#fff';");
    for (const column of ['accent_color', 'background_color', 'surface_color', 'text_color', 'logo_background_color']) {
      await expect(db.exec(`UPDATE public.venues SET ${column}='invalid';`)).rejects.toThrow();
      await db.exec(`UPDATE public.venues SET ${column}=NULL;`);
    }
  } finally { await db.close(); }
}, 15000);
