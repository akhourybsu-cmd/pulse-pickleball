import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
export const VenueAdminPageContext = createContext<{
  target: HTMLElement | null;
} | null>(null);

/** The persistent console owns the page title; individual tools supply actions. */
export function VenueAdminPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const consolePage = useContext(VenueAdminPageContext);
  if (consolePage)
    return children && consolePage.target
      ? createPortal(
          <div className="flex flex-wrap items-center gap-2">{children}</div>,
          consolePage.target,
        )
      : null;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

/** Also used by shared community tools that already render their own title. */
export function VenueAdminPageActions({ children }: { children: ReactNode }) {
  const consolePage = useContext(VenueAdminPageContext);
  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {children}
    </div>
  );
  return consolePage ? (
    consolePage.target ? (
      createPortal(actions, consolePage.target)
    ) : null
  ) : (
    <div className="mb-4">{actions}</div>
  );
}
