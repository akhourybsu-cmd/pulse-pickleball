/**
 * Scope persisted Supabase sessions to the backend that issued them.
 *
 * A backend-independent key makes a cutover unsafe: the browser can send a
 * JWT signed by the previous project to the new project, which correctly
 * rejects it as `bad_jwt` and can leave route guards in a redirect loop.
 */
export function getSupabaseAuthStorageKey(projectId: string | undefined, projectUrl: string): string {
  const configuredId = projectId?.trim();
  if (configuredId) return `pulse-auth:${configuredId}`;

  try {
    const hostname = new URL(projectUrl).hostname;
    const inferredId = hostname.split('.')[0]?.trim();
    if (inferredId) return `pulse-auth:${inferredId}`;
  } catch {
    // Vite configuration validation will surface an invalid project URL.
  }

  return 'pulse-auth:default';
}

type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** Blocked storage must not crash a public guest page at module import. The
 * fallback lasts only for this page; redirects still require durable storage.
 */
export function createSafeAuthStorage(
  stores = { local: () => localStorage, session: () => sessionStorage },
): AuthStorage {
  const memory = new Map<string, string>();
  let memoryOnly = false;
  const preferred = () => stores.local().getItem('pulse_persist_session') === 'false' ? stores.session() : stores.local();
  const removeEverywhere = (key: string) => {
    memory.delete(key);
    for (const getStore of [stores.local, stores.session]) {
      try { getStore().removeItem(key); } catch { /* Storage can be unavailable. */ }
    }
  };
  return {
    getItem(key) {
      if (!memoryOnly) {
        try { return preferred().getItem(key); } catch { memoryOnly = true; }
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      if (!memoryOnly) {
        try {
          const chosen = preferred();
          chosen.setItem(key, value);
          // A changed stay-signed-in preference must not leave an older token
          // in the other store to reappear after the current session ends.
          for (const getStore of [stores.local, stores.session]) {
            try { const store = getStore(); if (store !== chosen) store.removeItem(key); } catch { /* Best effort. */ }
          }
          return;
        } catch { memoryOnly = true; }
      }
      removeEverywhere(key);
      memory.set(key, value);
    },
    removeItem: removeEverywhere,
  };
}
