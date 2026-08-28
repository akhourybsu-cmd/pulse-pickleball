import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { type ManageTab, type TabDef, MANAGE_TABS, GROUPS } from "./leagueManageTabs";

export type { ManageTab };

/**
 * Grouped nav for the league management surface.
 *
 *   Desktop (lg+): vertical rail on the left, ~200px wide. Groups are
 *   uppercase eyebrows; active tab gets a primary-tinted background +
 *   left accent bar. Framer Motion `layoutId` slides the accent
 *   between tabs smoothly.
 *
 *   Mobile: horizontal scrollable strip. Uses shorter labels + icon.
 *   Active tab gets a filled pill. Scroll-snaps for a native feel.
 */
export function LeagueManageNav({
  active, onChange, tabs = MANAGE_TABS,
}: {
  active: ManageTab;
  onChange: (t: ManageTab) => void;
  /** The tabs to show (defaults to all). Callers pass a type-filtered set. */
  tabs?: TabDef[];
}) {
  return (
    <>
      {/* ------------------ Desktop rail ------------------ */}
      <aside className="hidden lg:block w-[220px] shrink-0 sticky top-4 self-start">
        <div className="rounded-xl border border-[color:var(--lg-border)] bg-[color:var(--lg-surface)] p-2 space-y-3 shadow-[inset_0_1px_0_0_rgba(201,168,76,0.08)]">
          {GROUPS.map((group) => {
            const items = tabs.filter((t) => t.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--lg-gold)]/70 px-2 py-1">
                  {group}
                </div>
                {items.map((t) => {
                  const Icon = t.icon;
                  const isActive = active === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => onChange(t.key)}
                      className={cn(
                        "relative w-full text-left rounded-md pl-3 pr-2.5 py-2 flex items-center gap-2.5 transition-colors group",
                        isActive
                          ? "text-[color:var(--lg-text)]"
                          : "text-[color:var(--lg-text-dim)] hover:bg-white/5 hover:text-[color:var(--lg-text)]",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="league-nav-active"
                          className="absolute inset-0 rounded-md bg-[color:var(--lg-emerald)]/25 ring-1 ring-[color:var(--lg-emerald)]/40"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          aria-hidden
                        />
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="league-nav-bar"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[color:var(--lg-gold)]"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          aria-hidden
                        />
                      )}
                      <Icon className={cn(
                        "w-4 h-4 shrink-0 relative",
                        isActive ? "text-[color:var(--lg-gold)]" : "text-[color:var(--lg-text-dim)] group-hover:text-[color:var(--lg-text)]",
                      )} />
                      <div className="min-w-0 relative">
                        <div className="text-[13px] font-semibold leading-tight tracking-normal">
                          {t.label}
                        </div>
                        <div className={cn(
                          "text-[11px] leading-tight line-clamp-2 font-normal",
                          isActive ? "text-[color:var(--lg-text)]/70" : "text-[color:var(--lg-text-dim)]/80",
                        )}>
                          {t.hint}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ------------------ Mobile section picker ------------------ */}
      <MobileSectionPicker active={active} onChange={onChange} tabs={tabs} />
    </>
  );
}

function MobileSectionPicker({
  active, onChange, tabs,
}: {
  active: ManageTab;
  onChange: (t: ManageTab) => void;
  tabs: TabDef[];
}) {
  const [open, setOpen] = useState(false);
  const activeDef = tabs.find((t) => t.key === active) ?? tabs[0];
  const ActiveIcon = activeDef.icon;

  return (
    <div className="lg:hidden">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left active:scale-[0.99] transition-transform"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ActiveIcon className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Section
              </div>
              <div className="text-sm font-bold truncate leading-tight">
                {activeDef.label}
              </div>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="p-0 overflow-hidden">
          {/* Stadium banner — same broadcast header as every league menu */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[color:var(--lg-emerald-deep)] via-[color:var(--lg-emerald)] to-[color:var(--lg-surface)]">
            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-primary" aria-hidden />
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent 0, transparent 10px, currentColor 10px, currentColor 11px)",
                color: "var(--lg-hero-gold)",
              }}
            />
            <div aria-hidden className="absolute -top-14 -right-10 h-40 w-40 rounded-full blur-3xl pointer-events-none bg-primary/20" />
            <DrawerHeader className="relative text-left p-5 pb-4 space-y-0">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 mb-0.5">
                League console
              </div>
              <DrawerTitle className="text-lg font-black tracking-tight text-white">
                Jump to section
              </DrawerTitle>
            </DrawerHeader>
          </div>

          <div className="px-4 pb-8 pt-4 space-y-4 max-h-[62vh] overflow-y-auto">
            {GROUPS.map((group) => {
              const items = tabs.filter((t) => t.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-1 rounded-full bg-primary shrink-0" aria-hidden />
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/75">
                      {group}
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    {items.map((t) => {
                      const Icon = t.icon;
                      const isActive = active === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => { onChange(t.key); setOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors backdrop-blur-sm border",
                            isActive
                              ? "bg-primary/10 border-primary/35 shadow-[0_1px_2px_hsl(0_0%_0%/0.05)]"
                              : "bg-card/70 border-border/60 hover:bg-muted/60 active:bg-muted",
                          )}
                        >
                          <span className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ring-1",
                            isActive
                              ? "bg-primary/15 text-primary ring-primary/30"
                              : "bg-muted/70 text-muted-foreground ring-border/60",
                          )}>
                            <Icon className="w-[18px] h-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={cn(
                              "text-sm leading-tight",
                              isActive ? "font-black text-primary" : "font-bold",
                            )}>
                              {t.label}
                            </div>
                            <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                              {t.hint}
                            </div>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </DrawerContent>
      </Drawer>
    </div>
  );
}
