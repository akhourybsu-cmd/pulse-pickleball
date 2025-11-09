import { forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BottomSheet } from "./BottomSheet";

interface DashboardTileProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  menuActions?: Array<{
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  }>;
  className?: string;
  notification?: boolean;
}

export const DashboardTile = forwardRef<HTMLButtonElement, DashboardTileProps>(
  (
    {
      icon: Icon,
      title,
      subtitle,
      badge,
      onClick,
      loading = false,
      disabled = false,
      ariaLabel,
      menuActions,
      className,
      notification,
    },
    ref
  ) => {
    const [sheetOpen, setSheetOpen] = useState(false);

    return (
      <>
        <button
          ref={ref}
          onClick={onClick}
          disabled={disabled || loading}
          aria-label={ariaLabel}
          className={cn(
            "relative group @container w-full text-left",
            "border rounded-2xl overflow-hidden tile-hover",
            "bg-tile-bg border-tile-border",
            "transition-all duration-200",
            // Mobile: compact variant
            "min-h-[92px] p-3",
            // Tablet & up: standard variant
            "md:min-h-[160px] md:p-4",
            disabled && "opacity-60 cursor-not-allowed",
            className
          )}
          style={{
            boxShadow: "var(--tile-shadow)",
          }}
        >
          {/* Top Accent Bar - 2–4px gradient */}
          <div
            className={cn(
              "absolute top-0 left-0 right-0 pointer-events-none",
              "h-[2px] md:h-1",
              loading && "animate-pulse"
            )}
            style={{
              background: "var(--tile-gradient-lime)",
            }}
          />

          {/* Pickleball Dot Pattern - subtle texture */}
          <div
            className={cn(
              "absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 pointer-events-none",
              "opacity-[0.02] dark:opacity-[0.01]",
              "md:opacity-[0.04] md:dark:opacity-[0.02]"
            )}
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--tile-pattern-color)) 1px, transparent 1px)`,
              backgroundSize: "8px 8px",
            }}
          />

          {/* Card Content - single row layout */}
          <div className="relative flex items-center gap-2 md:gap-3 h-full">
            {/* Icon Halo - 32px mobile, 36-40px desktop */}
            <div
              className={cn(
                "flex-shrink-0 rounded-full flex items-center justify-center icon-halo transition-transform",
                "w-8 h-8 md:w-10 md:h-10",
                loading && "animate-pulse"
              )}
              style={{
                background: "color-mix(in srgb, var(--page-bg) 70%, transparent)",
                boxShadow: "inset 0 1px 2px hsl(var(--tile-border) / 0.3)",
              }}
            >
              <Icon className="w-[18px] h-[18px] md:w-5 md:h-5 text-lime" />
            </div>

            {/* Title & Subtitle Stack */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 md:gap-2 mb-0.5">
                <h3 
                  className={cn(
                    "font-semibold text-tile-ink-900 leading-tight truncate",
                    "text-[clamp(15px,3.8vw,16px)] md:text-base"
                  )}
                >
                  {title}
                </h3>
                {badge && (
                  <Badge
                    variant={badge.variant || "outline"}
                    className="text-[10px] px-1.5 py-0 border-lime/40 text-tile-ink-900 flex-shrink-0"
                  >
                    {badge.label}
                  </Badge>
                )}
              </div>
              <p
                className={cn(
                  "text-tile-ink-700 leading-tight truncate",
                  "text-[clamp(12px,3.2vw,13px)] md:text-sm",
                  "opacity-85"
                )}
              >
                {subtitle}
              </p>
            </div>

            {/* Right Side: Chevron + Overflow */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Chevron indicator - hidden on very narrow */}
              <ChevronRight 
                className={cn(
                  "w-4 h-4 md:w-5 md:h-5 text-tile-ink-700 opacity-60",
                  "hidden @[320px]:block"
                )} 
              />

              {/* Overflow Menu */}
              {menuActions && menuActions.length > 0 && (
                <>
                  {/* Desktop: Dropdown Menu */}
                  <div className="hidden md:block">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-tile-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4 text-tile-ink-700" />
                          <span className="sr-only">More options for {title}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {menuActions.map((action, i) => (
                          <DropdownMenuItem 
                            key={i} 
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick();
                            }}
                          >
                            {action.icon && <action.icon className="w-4 h-4 mr-2" />}
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Mobile: Bottom Sheet Trigger */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "md:hidden touch-manipulation",
                      "w-10 h-10 min-w-[44px] min-h-[44px]",
                      "hover:bg-tile-muted"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetOpen(true);
                    }}
                  >
                    <MoreVertical className="w-5 h-5 text-tile-ink-700" />
                    <span className="sr-only">More options for {title}</span>
                  </Button>
                </>
              )}
            </div>

            {/* Notification Indicator */}
            {notification && (
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5 md:h-3 md:w-3 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 bg-lime"></span>
              </span>
            )}
          </div>
        </button>

        {/* Mobile: Bottom Sheet for overflow actions */}
        {menuActions && menuActions.length > 0 && (
          <BottomSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title={title}
            actions={menuActions}
          />
        )}
      </>
    );
  }
);

DashboardTile.displayName = "DashboardTile";
