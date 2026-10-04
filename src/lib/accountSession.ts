import { useCallback, useState } from "react";

const PREFIX = "pulse.account-session.v1:";
const memory = new Map<string, unknown>();
let generation = 0;

// Same-tab recovery only. Never store passwords, MFA challenges or payment data.
export function readAccountState<T>(
  userId: string,
  name: string,
  fallback: T
): T {
  const key = `${PREFIX}${userId}:${name}`;
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw !== null) {
      const value = JSON.parse(raw) as T;
      if (
        typeof value !== typeof fallback ||
        value === null ||
        Array.isArray(value) !== Array.isArray(fallback)
      )
        return fallback;
      memory.set(key, value);
      return value;
    }
  } catch {
    /* Keep working when storage is unavailable. */
  }
  return fallback;
}

export function writeAccountState<T>(userId: string, name: string, value: T) {
  const key = `${PREFIX}${userId}:${name}`;
  memory.set(key, value);
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Memory fallback. */
  }
}

export function clearAccountSession() {
  generation += 1;
  memory.clear();
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    /* Storage is optional. */
  }
}

/** State is keyed by account even when auth changes without a route remount. */
export function useAccountSessionState<T>(
  userId: string,
  name: string,
  fallback: T
) {
  const key = `${userId}:${name}`;
  const version = generation;
  const [snapshot, setSnapshot] = useState(() => ({
    key,
    value: readAccountState(userId, name, fallback),
  }));
  const value =
    snapshot.key === key
      ? snapshot.value
      : readAccountState(userId, name, fallback);
  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      // An in-flight save from a signed-out account must not recreate its draft.
      if (version !== generation) return;
      // Write synchronously: a navigation immediately after a change must retain it.
      const current = readAccountState(userId, name, fallback);
      const updated =
        typeof next === "function" ? (next as (value: T) => T)(current) : next;
      writeAccountState(userId, name, updated);
      setSnapshot({ key, value: updated });
    },
    [userId, name, key, fallback, version]
  );
  return [value, setValue] as const;
}

export const ACCOUNT_PATHS = new Set([
  "/player/profile",
  "/player/profile/edit",
  "/player/profile/notifications",
  "/player/profile/security",
  "/player/profile/blocked",
  "/player/profile/data-export",
  "/player/payments",
]);

export function accountTabDestination(
  userId: string,
  currentPath: string
): string {
  if (ACCOUNT_PATHS.has(currentPath)) return "/player/profile";
  const saved = readAccountState(userId, "last-page", "/player/profile");
  return typeof saved === "string" && ACCOUNT_PATHS.has(saved.split("?")[0])
    ? saved
    : "/player/profile";
}
