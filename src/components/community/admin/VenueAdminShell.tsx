import { VenueAdminPageContext } from "@/components/venue/VenueAdminPageHeader";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  Gauge,
  Menu,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { VenueBrandMark } from "@/components/venue/VenueBrandMark";
import {
  filterVenueAdminItems,
  venueAdminSection,
  VENUE_ADMIN_SECTIONS,
} from "@/lib/venues/adminSections";
import type { VenueBrand } from "@/lib/venues/branding";
import { cn } from "@/lib/utils";
import { useVisualViewportPane } from "@/hooks/useVisualViewportPane";

export interface VenueAdminNavItem {
  value: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  section?: "venue" | "community" | "advanced";
}

export function VenueAdminShell({
  venueName,
  brand,
  verified,
  roleLabel,
  accent,
  activeTab,
  items,
  onTabChange,
  onBack,
  onViewVenue,
  onOperations,
  showOperations = true,
  children,
  kiosk = false,
}: {
  venueName: string;
  brand?:
    | (VenueBrand & {
        logo_url?: string | null;
        logo_shape?: "circle" | "square" | null;
        logo_image_fit?: "contain" | "cover" | null;
      })
    | null;
  verified: boolean;
  roleLabel: string;
  accent?: string | null;
  activeTab: string;
  items: VenueAdminNavItem[];
  onTabChange: (value: string) => void;
  onBack: () => void;
  onViewVenue: () => void;
  onOperations: () => void;
  showOperations?: boolean;
  children: ReactNode;
  kiosk?: boolean;
}) {
  const viewport = useVisualViewportPane();
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = items.find((item) => item.value === activeTab) ?? items[0];
  const activeSection =
    activeItem &&
    VENUE_ADMIN_SECTIONS.find(
      (section) => section.value === venueAdminSection(activeItem),
    );
  const filtered = filterVenueAdminItems(items, search);
  const body = useRef<HTMLElement>(null);
  const desktopNav = useRef<HTMLElement>(null);
  const menuTitle = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    body.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab]);
  useEffect(() => {
    setMobileOpen(false);
    setSearch("");
    desktopNav.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeTab]);
  function select(value: string) {
    setSearch("");
    setMobileOpen(false);
    onTabChange(value);
  }

  const toolSearch = (
    <div className="venue-admin-tool-search">
      <Search className="h-4 w-4" aria-hidden />
      <Input
        aria-label="Find a venue tool"
        placeholder="Find a tool…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        type="search"
        autoComplete="off"
      />
      {search && (
        <button
          type="button"
          aria-label="Clear tool search"
          onClick={() => setSearch("")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
  const navigation = (
    <>
      {VENUE_ADMIN_SECTIONS.map((section) => {
        const sectionItems = filtered.filter(
          (item) => venueAdminSection(item) === section.value,
        );
        if (!sectionItems.length) return null;
        return (
          <section
            key={section.value}
            className="venue-admin-nav-group"
            aria-label={section.label}
          >
            <h2>{section.label}</h2>
            <div>
              {sectionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-current={item.value === activeTab ? "page" : undefined}
                    onClick={() => select(item.value)}
                    className={cn(
                      "venue-admin-nav-item",
                      item.value === "danger" && "venue-admin-nav-danger",
                    )}
                    title={item.description}
                  >
                    <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.shortLabel ?? item.label}</span>
                    {item.value === activeTab && (
                      <ChevronRight
                        aria-hidden
                        className="ml-auto h-3.5 w-3.5 shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {filtered.length === 0 && (
        <div
          role="status"
          className="px-3 py-6 text-sm leading-6 text-muted-foreground"
        >
          <p>No tools match “{search}”.</p>
          <button
            type="button"
            className="mt-2 min-h-11 font-medium underline underline-offset-4"
            onClick={() => setSearch("")}
          >
            Show all tools
          </button>
        </div>
      )}
    </>
  );

  return (
    <VenueAdminPageContext.Provider value={{ target: actionsTarget }}>
      <div
        data-venue-service="operations"
        className="venue-management-frame venue-admin-frame font-sans"
        style={
          {
            "--venue-admin-accent": accent ?? "hsl(var(--primary))",
            "--venue-pane-height": viewport.height,
            "--venue-pane-top": viewport.top ?? 0,
          } as CSSProperties
        }
      >
        {!kiosk && (
          <a
            href="#venue-admin-content"
            className="sr-only z-50 rounded-lg bg-card px-4 py-3 text-sm font-semibold focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
          >
            Skip to venue workspace
          </a>
        )}
        {!kiosk && (
          <header className="venue-admin-topbar">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Sheet
                open={mobileOpen}
                onOpenChange={(open) => {
                  setMobileOpen(open);
                  if (!open) setSearch("");
                }}
              >
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 lg:hidden"
                    aria-label="Venue management sections"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="venue-admin-drawer flex w-[min(90vw,340px)] flex-col gap-0 p-0"
                  onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    menuTitle.current?.focus();
                  }}
                >
                  <SheetHeader className="border-b p-5 pr-12 text-left">
                    <SheetTitle
                      ref={menuTitle}
                      tabIndex={-1}
                      className="text-base outline-none"
                    >
                      {venueName}
                    </SheetTitle>
                    <SheetDescription>
                      Venue management ·{" "}
                      <span className="capitalize">{roleLabel}</span>
                    </SheetDescription>
                  </SheetHeader>
                  <div className="px-4 pb-2 pt-4">{toolSearch}</div>
                  <nav
                    aria-label="Venue management tools"
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5"
                  >
                    {navigation}
                  </nav>
                  <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={onBack}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to venue
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <VenueBrandMark
                name={venueName}
                logoUrl={brand?.logo_url}
                logoShape={brand?.logo_shape}
                logoCrop={brand?.logo_crop} logoImageFit={brand?.logo_image_fit}
                secondaryColor={brand?.secondary_color}
                logoBackgroundColor={brand?.logo_background_color}
                className="h-10 w-10 text-[40px] ring-1 ring-border/60"
              />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-sm font-semibold sm:text-base">
                    {venueName}
                  </p>
                  {verified && (
                    <BadgeCheck
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-label="Verified venue"
                    />
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  Venue workspace{" "}
                  <span className="hidden sm:inline">
                    · <span className="capitalize">{roleLabel}</span>
                  </span>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onViewVenue}
                aria-label="View venue"
                className="h-10 min-w-10 gap-2 px-2.5 sm:px-3"
              >
                <span className="hidden sm:inline">View venue</span>
                <ArrowUpRight className="h-4 w-4" />
              </Button>
              {showOperations && (
                <Button
                  size="sm"
                  onClick={onOperations}
                  aria-label="Open venue operations"
                  className="h-10 min-w-10 gap-2 px-2.5 sm:px-3"
                >
                  <Gauge className="h-4 w-4" />
                  <span className="hidden sm:inline">Operations</span>
                </Button>
              )}
            </div>
          </header>
        )}
        <div
          className={cn(
            "venue-management-body venue-admin-body w-full lg:grid",
            !kiosk &&
              "lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)]",
          )}
        >
          {!kiosk && (
            <aside
              aria-label="Venue administration"
              className="venue-admin-sidebar hidden min-h-0 flex-col border-r lg:flex"
            >
              <div className="shrink-0 px-4 pb-2 pt-5">{toolSearch}</div>
              <nav
                ref={desktopNav}
                aria-label="Venue management sections"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6"
              >
                {navigation}
              </nav>
              <div className="shrink-0 border-t px-3 py-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs text-muted-foreground"
                  onClick={onBack}
                >
                  <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                  Back to venue
                </Button>
              </div>
            </aside>
          )}
          <main
            ref={body}
            id="venue-admin-content"
            tabIndex={-1}
            className={cn(
              "venue-management-content min-w-0",
              !kiosk &&
                "venue-admin-content p-4 sm:p-6 lg:px-8 lg:py-7 xl:px-10",
            )}
          >
            {!kiosk && (
              <header className="venue-admin-page-heading flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{activeSection?.label || "Venue management"}</span>
                    <ChevronRight aria-hidden className="h-3 w-3" />
                    <span className="font-medium text-foreground">
                      {activeItem?.shortLabel ?? activeItem?.label}
                    </span>
                  </p>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]">
                    {activeItem?.label}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {activeItem?.description}
                  </p>
                </div>
                <div ref={setActionsTarget} className="shrink-0 empty:hidden" />
              </header>
            )}
            {children}
          </main>
        </div>
      </div>
    </VenueAdminPageContext.Provider>
  );
}
