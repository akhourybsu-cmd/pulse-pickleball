import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Tracks what the user is *actively* looking at (a DM conversation, a group
 * chat, an event page, or simply the current route) so incoming notifications
 * for that same context can be auto-cleared instead of popping a toast for
 * something already on screen.
 *
 * Keys are opaque strings, e.g. `conversation:<id>`, `group:<id>`,
 * `event:<id>`, plus the current pathname (registered automatically).
 */

type Matchable = {
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  event_id?: string | null;
};

interface ActiveViewValue {
  registerContext: (keys: string[]) => () => void;
  /** True when the notification targets something currently on screen. */
  isContextActive: (n: Matchable) => boolean;
}

const ActiveViewContext = createContext<ActiveViewValue | null>(null);

const normalizePath = (link: string) => {
  try {
    const path = link.startsWith('http') ? new URL(link).pathname : link.split('?')[0].split('#')[0];
    return path.replace(/\/+$/, '') || '/';
  } catch {
    return link;
  }
};

export function ActiveViewProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const keysRef = useRef<Map<string, number>>(new Map());
  const pathRef = useRef(normalizePath(location.pathname));

  useEffect(() => {
    pathRef.current = normalizePath(location.pathname);
  }, [location.pathname]);

  const registerContext = useCallback((keys: string[]) => {
    const map = keysRef.current;
    keys.forEach((k) => map.set(k, (map.get(k) || 0) + 1));
    return () => {
      keys.forEach((k) => {
        const next = (map.get(k) || 0) - 1;
        if (next <= 0) map.delete(k);
        else map.set(k, next);
      });
    };
  }, []);

  const isContextActive = useCallback((n: Matchable) => {
    // Backgrounded tab / another app: the user is not actively engaging.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;

    const meta = (n.metadata || {}) as Record<string, unknown>;
    const candidates: string[] = [];
    const push = (prefix: string, value: unknown) => {
      if (typeof value === 'string' && value) candidates.push(`${prefix}:${value}`);
    };
    push('conversation', meta.conversation_id);
    push('group', meta.group_id ?? meta.group);
    push('event', n.event_id ?? meta.event_id);
    push('league', meta.league_id);
    push('tournament', meta.tournament_id);

    if (candidates.some((k) => keysRef.current.has(k))) return true;

    // Fall back to route matching: the notification deep-links to the page
    // (or a sub-path of the page) the user is already on.
    if (n.link) {
      const target = normalizePath(n.link);
      const current = pathRef.current;
      if (target !== '/' && (current === target || current.startsWith(`${target}/`))) return true;
    }

    return false;
  }, []);

  const value = useMemo(() => ({ registerContext, isContextActive }), [registerContext, isContextActive]);

  return <ActiveViewContext.Provider value={value}>{children}</ActiveViewContext.Provider>;
}

export function useActiveView(): ActiveViewValue {
  return (
    useContext(ActiveViewContext) ?? {
      registerContext: () => () => {},
      isContextActive: () => false,
    }
  );
}

/** Declare that this screen is actively showing the given context(s). */
export function useRegisterActiveContext(keys: (string | null | undefined)[]) {
  const { registerContext } = useActiveView();
  const stable = keys.filter((k): k is string => Boolean(k));
  const signature = stable.join('|');

  useEffect(() => {
    if (!signature) return;
    return registerContext(signature.split('|'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, registerContext]);
}
