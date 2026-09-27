import { createContext, useContext, type CSSProperties } from 'react';

interface ScopedThemeValue { className: string; style: CSSProperties; portalStyle?: CSSProperties }
export const ScopedThemeContext = createContext<ScopedThemeValue | null>(null);

/** React context crosses portals; CSS inheritance does not. Restore it locally. */
export function useScopedTheme() {
  const theme = useContext(ScopedThemeContext);
  return theme ? { className: theme.className, style: { ...theme.style, ...theme.portalStyle } } : null;
}
