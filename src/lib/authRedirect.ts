export const DEFAULT_AUTH_DESTINATION = "/player/dashboard";

const AUTH_RETURN_STORAGE_KEY = "pulse_oauth_return";

const safeStorageGet = (storage: () => Storage, key: string) => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (storage: () => Storage, key: string, value: string) => {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }
};

const safeStorageRemove = (storage: () => Storage, key: string) => {
  try {
    storage().removeItem(key);
  } catch {
    // Ignore storage cleanup failures; redirects still fall back safely.
  }
};

export const isAuthEntryPath = (path: string) => path === "/" || path === "/auth";

export const isAssessmentSaveRedirect = (path: string | null | undefined) =>
  !!path && /^\/skill-assessment\?save=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(path);

export const sanitizeRedirectPath = (path: string | null | undefined) => {
  // Reject URL-parser normalization of backslashes, whitespace and controls.
  // eslint-disable-next-line no-control-regex
  if (!path || !path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(path)) {
    return DEFAULT_AUTH_DESTINATION;
  }

  const normalizedPath = path === "/dashboard" ? DEFAULT_AUTH_DESTINATION : path;

  if (
    normalizedPath === "/" ||
    normalizedPath.split(/[?#]/, 1)[0] === "/auth" ||
    normalizedPath.startsWith("/~oauth")
  ) {
    return DEFAULT_AUTH_DESTINATION;
  }

  return normalizedPath;
};

export const stashPostAuthRedirect = (path: string) => {
  const safePath = sanitizeRedirectPath(path);
  safeStorageSet(() => sessionStorage, AUTH_RETURN_STORAGE_KEY, safePath);
  safeStorageSet(() => localStorage, AUTH_RETURN_STORAGE_KEY, safePath);
  return peekPostAuthRedirect() === safePath;
};

export const peekPostAuthRedirect = () => {
  const stored =
    safeStorageGet(() => sessionStorage, AUTH_RETURN_STORAGE_KEY) ||
    safeStorageGet(() => localStorage, AUTH_RETURN_STORAGE_KEY);

  return stored ? sanitizeRedirectPath(stored) : null;
};

export const consumePostAuthRedirect = () => {
  const redirect = peekPostAuthRedirect();
  // App's callback listener, Index and Auth can all resolve the same login.
  // Keep an assessment handoff until its destination acknowledges arrival;
  // otherwise a second resolver can replace it with the default dashboard.
  if (!isAssessmentSaveRedirect(redirect)) clearPostAuthRedirect();
  return redirect || DEFAULT_AUTH_DESTINATION;
};

export const clearPostAuthRedirect = (expectedPath?: string) => {
  for (const storage of [() => sessionStorage, () => localStorage]) {
    if (!expectedPath || safeStorageGet(storage, AUTH_RETURN_STORAGE_KEY) === expectedPath) {
      safeStorageRemove(storage, AUTH_RETURN_STORAGE_KEY);
    }
  }
};
