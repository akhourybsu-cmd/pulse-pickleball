import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, BadgeCheck, ExternalLink, Gauge, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface VenueAdminNavItem {
  value: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  section?: 'venue' | 'community' | 'advanced';
}

export function VenueAdminShell({
  venueName,
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
}: {
  venueName: string;
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
}) {
  const activeItem = items.find((item) => item.value === activeTab) ?? items[0];
  const sections: Array<{ value: VenueAdminNavItem['section']; label: string }> = [
    { value: 'venue', label: 'Venue' },
    { value: 'community', label: 'Community' },
    { value: 'advanced', label: 'Advanced' },
  ];

  return (
    <div
      className="min-h-[100dvh] bg-muted/[0.16] pb-[env(safe-area-inset-bottom)]"
      style={{ '--venue-admin-accent': accent ?? 'hsl(var(--primary))' } as CSSProperties}
    >
      <header className="border-b border-white/10 bg-[#15171b] text-white">
        <div className="mx-auto max-w-[1480px] px-3 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 sm:pb-5 sm:pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-10 w-10 shrink-0 rounded-full border border-white/10 text-white/75 hover:bg-white/10 hover:text-white"
              aria-label="Back to venue"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] sm:flex"
              >
                <Settings2 className="h-5 w-5" style={accent ? { color: accent } : undefined} />
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{venueName}</h1>
                  {verified && <BadgeCheck className="h-4 w-4 shrink-0 text-amber-400" aria-label="Verified venue" />}
                </div>
                <p className="truncate text-[11px] text-white/55 sm:text-xs">Venue admin · {roleLabel}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewVenue}
                className="h-10 rounded-full border border-white/10 px-3 text-white/75 hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">View venue</span>
              </Button>
              {showOperations && (
                <Button
                  size="sm"
                  onClick={onOperations}
                  className="h-10 rounded-full px-3 text-[#15171b] shadow-none"
                  style={accent ? { backgroundColor: accent } : undefined}
                >
                  <Gauge className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Operations</span>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5 lg:hidden">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{activeItem?.description}</p>
          </div>
        </div>

        <div className="border-t border-white/[0.08] lg:hidden">
          <div className="overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max items-center">
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.value === activeTab;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onTabChange(item.value)}
                    className={cn(
                      'relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-xs font-semibold text-white/55 transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-[var(--venue-admin-accent)] after:transition-transform',
                      active && 'text-white after:scale-x-100',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.shortLabel ?? item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-5">
            {sections.map((section) => {
              const sectionItems = items.filter((item) => (item.section ?? 'venue') === section.value);
              if (!sectionItems.length) return null;
              return (
                <div key={section.value}>
                  <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {sectionItems.map((item) => {
                      const Icon = item.icon;
                      const active = item.value === activeTab;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => onTabChange(item.value)}
                          className={cn(
                            'relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:scale-y-0 before:rounded-full before:bg-[var(--venue-admin-accent)] before:transition-transform hover:bg-card/70',
                            active && 'bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.05)] before:scale-y-100',
                          )}
                        >
                          <Icon className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground', active && 'text-foreground')} />
                          <span className="min-w-0">
                            <span className={cn('block text-sm font-semibold text-foreground/75', active && 'text-foreground')}>
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{item.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-6 hidden items-end justify-between gap-4 border-b border-border/70 pb-4 lg:flex">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Venue admin</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{activeItem?.label}</h2>
            </div>
            <p className="max-w-sm text-right text-sm text-muted-foreground">{activeItem?.description}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
