import { RESPONSE_KEYS, type ResponseKey } from './model';
import { assessmentBank } from './banks';
import type { Responses } from './scoring';

// New clients must not put V3 drafts where an older open V2 client can delete them.
export const GUEST_ASSESSMENT_KEY = 'pulse.guest-skill.v3';
export const LEGACY_GUEST_ASSESSMENT_KEY = 'pulse.guest-skill.v2';
export const GUEST_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const ASSESSMENT_PATH = '/skill-assessment';
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface GuestAssessment {
  version: 2 | 3;
  id: string;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
  saveRequested: boolean;
  responses: Responses;
}
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createGuestAssessment(now = Date.now()): GuestAssessment {
  return { version: 3, id: crypto.randomUUID(), createdAt: now, expiresAt: now + GUEST_RETENTION_MS,
    completedAt: null, saveRequested: false, responses: {} };
}

/** Raw answers only. Stored or URL-supplied scores are never used. */
export function parseGuestAssessment(raw: string | null, now = Date.now()): GuestAssessment | null {
  try {
    if (!raw || raw.length > 24000) return null;
    const d = JSON.parse(raw);
    if (![2, 3].includes(d?.version) || typeof d.id !== 'string' || !UUID_PATTERN.test(d.id) ||
      !Number.isFinite(d.createdAt) || !Number.isFinite(d.expiresAt) || d.createdAt > now ||
      d.expiresAt <= now || d.expiresAt !== d.createdAt + GUEST_RETENTION_MS ||
      typeof d.saveRequested !== 'boolean' ||
      (d.completedAt !== null && (!Number.isFinite(d.completedAt) || d.completedAt < d.createdAt || d.completedAt > now)) ||
      !d.responses || typeof d.responses !== 'object' || Array.isArray(d.responses)) return null;
    const keys = new Set(assessmentBank(d.version).filter(i => i.active).map(i => i.itemKey));
    const entries = Object.entries(d.responses);
    if (entries.length > keys.size || entries.some(([key, value]) => !keys.has(key) || !RESPONSE_KEYS.includes(value as ResponseKey))) return null;
    return { version: d.version, id: d.id, createdAt: d.createdAt, expiresAt: d.expiresAt,
      completedAt: d.completedAt, saveRequested: d.saveRequested, responses: Object.fromEntries(entries) as Responses };
  } catch { return null; }
}

export function readGuestAssessment(storage: DraftStorage | null, now = Date.now()) {
  try {
    for (const key of [GUEST_ASSESSMENT_KEY, LEGACY_GUEST_ASSESSMENT_KEY]) {
      const raw = storage?.getItem(key) ?? null;
      const draft = parseGuestAssessment(raw, now);
      if (draft) return draft;
      if (raw) {
        // Leave drafts from a future app version untouched.
        try { if (JSON.parse(raw)?.version > 3) return null; } catch { /* Invalid JSON is removable. */ }
        storage?.removeItem(key);
      }
    }
    return null;
  } catch { return null; }
}

export function writeGuestAssessment(storage: DraftStorage | null, draft: GuestAssessment): boolean {
  try {
    if (!storage) return false;
    const raw = JSON.stringify(draft);
    storage.setItem(GUEST_ASSESSMENT_KEY, raw);
    const retained = storage.getItem(GUEST_ASSESSMENT_KEY) === raw;
    if (retained) storage.removeItem(LEGACY_GUEST_ASSESSMENT_KEY);
    return retained;
  } catch { return false; }
}

export function browserGuestStorage(): DraftStorage | null {
  try { return window.localStorage; } catch { return null; }
}

export function clearGuestAssessment(storage: DraftStorage | null, id: string) {
  try {
    // A late response from an older tab must not remove a newer assessment.
    for (const key of [GUEST_ASSESSMENT_KEY, LEGACY_GUEST_ASSESSMENT_KEY]) {
      if (parseGuestAssessment(storage?.getItem(key) ?? null)?.id === id) storage?.removeItem(key);
    }
  } catch { /* Local browser retention remains bounded by expiresAt. */ }
}

export function guestSaveReturnPath(id: string) {
  return `${ASSESSMENT_PATH}?save=${encodeURIComponent(id)}`;
}

export function canAutoSaveGuest(draft: GuestAssessment | null, saveId: string | null) {
  return !!draft?.completedAt && draft.saveRequested && draft.id === saveId && draft.expiresAt > Date.now();
}
