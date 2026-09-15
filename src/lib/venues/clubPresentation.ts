import { normalizeHex } from './branding';
import { parseTime } from './hours';
import { venueCalendarNow } from './timezone';

/** Pick readable ink for arbitrary saved venue accents, not just ELEVENO gold. */
export function clubAccent(value?: string | null) {
  const accent = normalizeHex(value) ?? '#c9962f';
  const rgb = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  return { '--club-accent': accent, '--club-on-accent': luminance > .179 ? '#000000' : '#ffffff' };
}

export function clubTime(value: string, timeZone?: string | null) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined }) : 'Time TBC';
}

export function clubDate(value: string, timeZone?: string | null, now = new Date()) {
  const date = venueCalendarNow(timeZone, new Date(value));
  if (!Number.isFinite(date.getTime())) return 'Date TBC';
  const today = venueCalendarNow(timeZone, now);
  if (date.toDateString() === today.toDateString()) return 'Today';
  today.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Never advertise guessed/default booking hours as a venue's confirmed opening status. */
export function clubHoursStatus(raw: unknown, timeZone?: string | null, now = new Date()): string {
  const local = venueCalendarNow(timeZone, now);
  const days = (raw as { days?: Record<string, unknown> } | null)?.days;
  if (!days || !Object.prototype.hasOwnProperty.call(days, local.getDay())) return 'Hours not listed';
  const day = days[local.getDay()];
  if (day === null) return 'Closed today';
  const entry = day as { open?: unknown; close?: unknown };
  const open = parseTime(entry?.open), close = parseTime(entry?.close);
  if (open === null || close === null || close <= open) return 'Hours not listed';
  const minute = local.getHours() * 60 + local.getMinutes();
  const label = (minutes: number) => {
    const hour = Math.floor(minutes / 60) % 24;
    return `${hour % 12 || 12}${minutes % 60 ? ':' + String(minutes % 60).padStart(2, '0') : ''} ${hour >= 12 ? 'PM' : 'AM'}`;
  };
  if (minute < open) return `Opens ${label(open)}`;
  if (minute >= close) return 'Closed now';
  return `Open until ${label(close)}`;
}

export const CLUB_PLAY_FORMATS = ['open_play', 'clinic', 'practice'];

/** Preserve quarter-point skill bands (3.75), with one decimal for whole levels. */
export function clubSkill(value: number) {
  return value.toFixed(2).replace(/(\.\d)0$/, '$1');
}
