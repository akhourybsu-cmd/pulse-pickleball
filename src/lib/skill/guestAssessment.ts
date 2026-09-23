import { RESPONSE_KEYS, type ResponseKey } from './model';
import { QUESTION_BANK_V2 } from './questionBankV2';
import type { Responses } from './scoring';

export const GUEST_ASSESSMENT_KEY = 'pulse.guest-skill.v2';
export const GUEST_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const ASSESSMENT_PATH = '/skill-assessment';
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface GuestAssessment {
  version: 2;
  id: string;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
  saveRequested: boolean;
  responses: Responses;
}
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createGuestAssessment(now = Date.now()): GuestAssessment {
  return { version: 2, id: crypto.randomUUID(), createdAt: now, expiresAt: now + GUEST_RETENTION_MS,
    completedAt: null, saveRequested: false, responses: {} };
}

/** Raw answers only. Stored or URL-supplied scores are never used. */
export function parseGuestAssessment(raw: string | null, now = Date.now()): GuestAssessment | null {
  try {
    if (!raw || raw.length > 24000) return null;
    const d = JSON.parse(raw);
    if (d?.version !== 2 || typeof d.id !== 'string' || !UUID_PATTERN.test(d.id) ||
      !Number.isFinite(d.createdAt) || !Number.isFinite(d.expiresAt) || d.createdAt > now ||
      d.expiresAt <= now || d.expiresAt !== d.createdAt + GUEST_RETENTION_MS ||
      typeof d.saveRequested !== 'boolean' ||
      (d.completedAt !== null && (!Number.isFinite(d.completedAt) || d.completedAt < d.createdAt || d.completedAt > now)) ||
      !d.responses || typeof d.responses !== 'object' || Array.isArray(d.responses)) return null;
    const keys = new Set(QUESTION_BANK_V2.filter(i => i.active).map(i => i.itemKey));
    const entries = Object.entries(d.responses);
    if (entries.length > keys.size || entries.some(([key, value]) => !keys.has(key) || !RESPONSE_KEYS.includes(value as ResponseKey))) return null;
    return { version: 2, id: d.id, createdAt: d.createdAt, expiresAt: d.expiresAt,
      completedAt: d.completedAt, saveRequested: d.saveRequested, responses: Object.fromEntries(entries) as Responses };
  } catch { return null; }
}

export function readGuestAssessment(storage: DraftStorage | null, now = Date.now()) {
  try {
    const raw = storage?.getItem(GUEST_ASSESSMENT_KEY) ?? null;
    const draft = parseGuestAssessment(raw, now);
    if (raw && !draft) storage?.removeItem(GUEST_ASSESSMENT_KEY);
    return draft;
  } catch { return null; }
}

export function writeGuestAssessment(storage: DraftStorage | null, draft: GuestAssessment): boolean {
  try {
    if (!storage) return false;
    const raw = JSON.stringify(draft);
    storage.setItem(GUEST_ASSESSMENT_KEY, raw);
    return storage.getItem(GUEST_ASSESSMENT_KEY) === raw;
  } catch { return false; }
}

export function browserGuestStorage(): DraftStorage | null {
  try { return window.localStorage; } catch { return null; }
}

export function clearGuestAssessment(storage: DraftStorage | null, id: string) {
  try {
    // A late response from an older tab must not remove a newer assessment.
    if (readGuestAssessment(storage)?.id === id) storage?.removeItem(GUEST_ASSESSMENT_KEY);
  } catch { /* Local browser retention remains bounded by expiresAt. */ }
}

export function guestSaveReturnPath(id: string) {
  return `${ASSESSMENT_PATH}?save=${encodeURIComponent(id)}`;
}

export function canAutoSaveGuest(draft: GuestAssessment | null, saveId: string | null) {
  return !!draft?.completedAt && draft.saveRequested && draft.id === saveId && draft.expiresAt > Date.now();
}
