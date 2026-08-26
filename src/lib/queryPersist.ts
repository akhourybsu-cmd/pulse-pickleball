import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { removeOldestQuery, type PersistQueryClientOptions } from '@tanstack/react-query-persist-client';


/**
 * React Query cache persistence.
 *
 * Without this the cache is memory-only, so every cold start — very common on
 * mobile, where the OS evicts backgrounded apps — begins with a full round of
 * spinners even for data we already had. Persisting to localStorage lets the
 * hot screens (dashboard, community, profiles, groups) paint from the last
 * known-good data immediately and revalidate in the background.
 *
 * Restored data is never treated as fresh: queries keep their normal
 * staleTime, so anything stale refetches on mount. Persistence only removes
 * the *blank* first paint.
 */

const STORAGE_KEY = 'pulse.rq-cache';

/** Bump when cached query SHAPES change incompatibly — invalidates every
 *  persisted entry so no screen can restore data it can't render. */
const PERSIST_VERSION = 'v1';

/** Don't restore anything older than a day — beyond that a fetch is fine. */
const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Query keys that must NOT be persisted.
 *
 * `group-messages` is realtime-driven with staleTime: Infinity — a restored
 * entry would never refetch on mount, so the chat could show a stale backlog
 * until a realtime event happened to arrive. It's cheap to refetch and must be
 * correct, so it always comes from the network.
 */
const NEVER_PERSIST = ['group-messages'];

/** localStorage can be unavailable (private mode, embedded webviews). */
function safeStorage(): Storage | undefined {
  try {
    const s = window.localStorage;
    const probe = '__pulse_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return undefined;
  }
}

const storage = safeStorage();

export const queryPersister = storage
  ? createSyncStoragePersister({
      storage,
      key: STORAGE_KEY,
      // Serializing the whole cache is not free — batch writes rather than
      // running on every cache mutation.
      throttleTime: 2000,
      // localStorage has a hard quota; on overflow drop the oldest queries
      // instead of throwing and silently disabling persistence.
      retry: removeOldestQuery,
    })
  : undefined;

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> | undefined =
  queryPersister
    ? {
        persister: queryPersister,
        maxAge: MAX_AGE,
        buster: PERSIST_VERSION,
        dehydrateOptions: {
          // Loosely typed: duplicate @tanstack/query-core copies in the tree
          // make the nominal `Query` types incompatible across packages.
          shouldDehydrateQuery: (query: any) => {
            // Only persist settled, successful data — never errors or
            // in-flight/partial state.
            if (query.state.status !== 'success') return false;
            const head = query.queryKey?.[0];
            if (typeof head === 'string' && NEVER_PERSIST.includes(head)) return false;
            return true;
          },
        },
      }
    : undefined;

/**
 * Drop the persisted cache. Called on sign-out so a shared browser/device
 * never restores the previous account's data into the next session.
 */
export function clearPersistedQueryCache(): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing we can do — the cache is a cache */
  }
}
