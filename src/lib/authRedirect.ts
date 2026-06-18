export const DEFAULT_AUTH_DESTINATION = "/player/dashboard";

const AUTH_RETURN_STORAGE_KEY = "pulse_oauth_return";

const safeStorageGet = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (storage: Storage, key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }
};

const safeStorageRemove = (storage: Storage, key: string) => {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures; redirects still fall back safely.
  }
};

export const isAuthEntryPath = (path: string) => path === "/" || path === "/auth";

export const sanitizeRedirectPath = (path: string | null | undefined) => {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_AUTH_DESTINATION;
  }

  const normalizedPath = path === "/dashboard" ? DEFAULT_AUTH_DESTINATION : path;

  if (
    normalizedPath === "/" ||
    normalizedPath === "/auth" ||
    normalizedPath.startsWith("/auth?") ||
    normalizedPath.startsWith("/~oauth")
  ) {
    return DEFAULT_AUTH_DESTINATION;
  }

  return normalizedPath;
};

export const stashPostAuthRedirect = (path: string) => {
  const safePath = sanitizeRedirectPath(path);
  safeStorageSet(sessionStorage, AUTH_RETURN_STORAGE_KEY, safePath);
  safeStorageSet(localStorage, AUTH_RETURN_STORAGE_KEY, safePath);
};

export const peekPostAuthRedirect = () => {
  const stored =
    safeStorageGet(sessionStorage, AUTH_RETURN_STORAGE_KEY) ||
    safeStorageGet(localStorage, AUTH_RETURN_STORAGE_KEY);

  return stored ? sanitizeRedirectPath(stored) : null;
};

export const consumePostAuthRedirect = () => {
  const redirect = peekPostAuthRedirect();
  clearPostAuthRedirect();
  return redirect || DEFAULT_AUTH_DESTINATION;
};

export const clearPostAuthRedirect = () => {
  safeStorageRemove(sessionStorage, AUTH_RETURN_STORAGE_KEY);
  safeStorageRemove(localStorage, AUTH_RETURN_STORAGE_KEY);
};