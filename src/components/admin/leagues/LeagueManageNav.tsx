import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { type ManageTab, type TabDef, MANAGE_TABS, GROUPS } from "./leagueManageTabs";
import { LeagueBrandMark } from "@/components/leagues/LeagueIdentity";
import type { League } from "@/lib/leagues/types";
import { Logo } from '@/components/Logo';

export type { ManageTab };

/** One ordered, type-filtered navigation model for the desktop rail and mobile drawer. */
export function LeagueManageNav({
  active, onChange, tabs = MANAGE_TABS, actionCount, league,
}: {
  active: ManageTab;
  onChange: (tab: ManageTab) => void;
  tabs?: TabDef[];
  actionCount?: number;
  league?: Pick<League, "name" | "branding">;
}) {
  if (!tabs.length) return null;
  return (
    <>
      <aside className="hidden lg:block w-[248px] shrink-0 sticky top-24 self-start">
        <nav aria-label="League management" className="lg-scroll-area max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2.5 space-y-3">
          <div className="rounded-xl bg-[var(--league-header,#1c2621)] px-4 py-4 text-[#faf7ef]"><Logo compact className="w-16" />{league && <div className="mt-3 flex items-center gap-2"><LeagueBrandMark name={league.name} branding={league.branding} className="h-9 w-9 text-[36px]" /><span className="min-w-0 break-words text-xs font-semibold">{league.name}</span></div>}<p className="mt-2 text-xs text-[color:var(--league-brand-accent,#e3ca92)]">Organizer workspace</p></div>
          {GROUPS.map(group => {
            const items = tabs.filter(tab => tab.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="space-y-1">
                <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{group}</p>
                {items.map(tab => <SectionButton key={tab.key} tab={tab} active={active === tab.key} compact count={tab.key === 'actions' ? actionCount : undefined} onSelect={() => onChange(tab.key)} />)}
              </div>
            );
          })}
        </nav>
      </aside>
      <MobileSectionPicker league={league} active={active} onChange={onChange} tabs={tabs} actionCount={actionCount} />
    </>
  );
}

function SectionButton({ tab, active, onSelect, compact = false, count }: { tab: TabDef; active: boolean; onSelect: () => void; compact?: boolean; count?: number }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      title={tab.hint}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active ? "border-primary/40 bg-primary/10 text-foreground shadow-[inset_3px_0_0_hsl(var(--primary))]" : "border-transparent text-foreground hover:border-border hover:bg-muted/60 active:bg-muted",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[color:var(--lg-accent-gold)]" : "text-muted-foreground")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{tab.label}</span>
        <span className={cn(compact && !active ? 'sr-only' : 'mt-1 block text-xs font-normal leading-relaxed text-muted-foreground')}>{tab.hint}</span>
      </span>
      {count != null && count > 0 ? <span aria-label={`${count} pending items`} className="lg-count shrink-0">{count > 99 ? '99+' : count}</span> : active && <Check className="h-4 w-4 shrink-0 text-[color:var(--lg-accent-gold)]" aria-hidden />}
    </button>
  );
}

function MobileSectionPicker({ active, onChange, tabs, actionCount, league }: {
  active: ManageTab;
  onChange: (tab: ManageTab) => void;
  tabs: TabDef[];
  actionCount?: number;
  league?: Pick<League, "name" | "branding">;
}) {
  const [open, setOpen] = useState(false);
  const activeDef = tabs.find(tab => tab.key === active) ?? tabs[0];
  if (!activeDef) return null;
  const ActiveIcon = activeDef.icon;
  return (
    <div className="lg:hidden">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            aria-label={`League sections: ${activeDef.label}`}
            className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[color:var(--lg-accent-gold)]">
              <ActiveIcon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">League sections</span>
              <span className="mt-0.5 block text-base font-semibold leading-snug">{activeDef.label}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </DrawerTrigger>
        <DrawerContent className="league-menu mx-auto w-full max-w-xl rounded-t-3xl p-0 overflow-hidden">
          <DrawerHeader className="shrink-0 border-b border-border p-5 pr-16 text-left">
            <Logo compact className="mb-3 w-16 text-foreground" />
            {league && <div className="mb-3 flex items-center gap-3"><LeagueBrandMark name={league.name} branding={league.branding} className="h-11 w-11 text-[44px]" /><span className="min-w-0 break-words text-sm font-semibold">{league.name}</span></div>}
            <DrawerTitle className="text-xl font-semibold leading-snug">League sections</DrawerTitle>
            <DrawerDescription className="text-sm leading-relaxed">Set up your league, manage play, and review results.</DrawerDescription>
          </DrawerHeader>
          <DrawerClose className="absolute right-3 top-7 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Close league sections">
            <X className="h-5 w-5" />
          </DrawerClose>
          <nav aria-label="League management sections" className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-5">
            {GROUPS.map(group => {
              const items = tabs.filter(tab => tab.group === group);
              if (!items.length) return null;
              return (
                <div key={group} className="space-y-1">
                  <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{group}</p>
                  {items.map(tab => (
                    <SectionButton key={tab.key} tab={tab} active={active === tab.key} count={tab.key === 'actions' ? actionCount : undefined} onSelect={() => { onChange(tab.key); setOpen(false); }} />
                  ))}
                </div>
              );
            })}
          </nav>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
