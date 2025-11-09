import { ReactNode, ButtonHTMLAttributes, forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BottomSheet } from "./BottomSheet";

interface DashboardTileProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  primaryAction: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: "outline" | "ghost";
    icon?: LucideIcon;
  };
  iconActions?: Array<{
    icon: LucideIcon;
    tooltip: string;
    onClick: () => void;
  }>;
  menuActions?: Array<{
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  }>;
  className?: string;
  notification?: boolean;
}

export const DashboardTile = forwardRef<HTMLDivElement, DashboardTileProps>(
  (
    {
      icon: Icon,
      title,
      subtitle,
      badge,
      primaryAction,
      secondaryAction,
      iconActions,
      menuActions,
      className,
      notification,
    },
    ref
  ) => {
    const [sheetOpen, setSheetOpen] = useState(false);

    // Combine all overflow actions for mobile
    const allOverflowActions = [
      ...(secondaryAction ? [{
        label: secondaryAction.label,
        onClick: secondaryAction.onClick,
        icon: secondaryAction.icon,
      }] : []),
      ...(iconActions || []).map(action => ({
        label: action.tooltip,
        onClick: action.onClick,
        icon: action.icon,
      })),
      ...(menuActions || []),
    ];

    return (
      <>
        <div
          ref={ref}
          className={cn(
            "relative group @container",
            "border rounded-2xl overflow-hidden tile-hover",
            "bg-tile-bg border-tile-border",
            "transition-all duration-200",
            // Mobile: compact variant
            "min-h-[96px] p-3",
            // Tablet & up: standard variant
            "md:min-h-[160px] md:p-4",
            className
          )}
          style={{
            boxShadow: "var(--tile-shadow)",
          }}
          onClick={() => {
            // On mobile, tapping card triggers primary action
            if (window.innerWidth < 768) {
              primaryAction.onClick();
            }
          }}
        >
          {/* Top Accent Bar - 2px on mobile, 4px on desktop */}
          <div
            className={cn(
              "absolute top-0 left-0 right-0 pointer-events-none",
              "h-[2px] md:h-1"
            )}
            style={{
              background: "var(--tile-gradient-lime)",
            }}
          />

          {/* Pickleball Dot Pattern - reduced opacity on mobile */}
          <div
            className={cn(
              "absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 pointer-events-none",
              "opacity-[0.025] dark:opacity-[0.015]",
              "md:opacity-[var(--tile-pattern-opacity)]"
            )}
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--tile-pattern-color)) 1px, transparent 1px)`,
              backgroundSize: "8px 8px",
            }}
          />

          {/* Card Content */}
          <div className="relative flex flex-col h-full gap-2 md:gap-3">
            {/* Header Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                {/* Icon Halo - 32px on mobile, 44px on desktop */}
                <div
                  className={cn(
                    "flex-shrink-0 rounded-full flex items-center justify-center bg-tile-muted icon-halo transition-transform",
                    "w-8 h-8 md:w-11 md:h-11"
                  )}
                  style={{
                    boxShadow: "inset 0 1px 2px hsl(var(--tile-border) / 0.3)",
                  }}
                >
                  <Icon className="w-[18px] h-[18px] md:w-5 md:h-5 text-lime" />
                </div>

                {/* Title & Badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    <h3 
                      className={cn(
                        "font-semibold text-tile-ink-900 leading-tight truncate",
                        "text-[clamp(15px,3.8vw,16px)] md:text-sm"
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
                </div>
              </div>

              {/* Overflow Menu - Desktop dropdown, Mobile opens sheet */}
              {allOverflowActions.length > 0 && (
                <>
                  {/* Desktop: Dropdown Menu */}
                  <div className="hidden md:block">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 -mt-1 -mr-1 hover:bg-tile-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4 text-tile-ink-700" />
                          <span className="sr-only">More options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {allOverflowActions.map((action, i) => (
                          <DropdownMenuItem key={i} onClick={action.onClick}>
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
                      "md:hidden flex-shrink-0 touch-manipulation",
                      "w-10 h-10 min-w-[44px] min-h-[44px]",
                      "-mt-1 -mr-1 hover:bg-tile-muted"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetOpen(true);
                    }}
                  >
                    <MoreVertical className="w-5 h-5 text-tile-ink-700" />
                    <span className="sr-only">More options</span>
                  </Button>
                </>
              )}

              {/* Notification Indicator */}
              {notification && (
                <span className="absolute top-2 right-2 flex h-3 w-3 pointer-events-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-lime"></span>
                </span>
              )}
            </div>

            {/* Subtitle Line - single line with clamp */}
            <p
              className={cn(
                "text-tile-ink-700 leading-tight truncate",
                "text-[clamp(12px,3.2vw,13px)] md:text-xs",
                "opacity-80 md:opacity-85"
              )}
            >
              {subtitle}
            </p>

            {/* Spacer - only on desktop */}
            <div className="hidden md:block flex-1" />

            {/* Footer Row - Actions */}
            <div className="flex items-center gap-2 flex-wrap mt-auto">
              {/* Primary Button - Full width on mobile, auto on desktop */}
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  primaryAction.onClick();
                }}
                disabled={primaryAction.loading}
                className={cn(
                  "bg-lime text-primary-foreground hover:bg-lime/90 shadow-sm",
                  "text-[14px] md:text-xs font-medium touch-manipulation",
                  "h-10 md:h-9",
                  "w-full max-w-[240px] md:w-auto md:max-w-none",
                  "active:scale-[0.98] transition-transform"
                )}
              >
                {primaryAction.loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1.5" />
                ) : primaryAction.icon ? (
                  <primaryAction.icon className="w-[18px] h-[18px] md:w-3.5 md:h-3.5 mr-1.5 flex-shrink-0" />
                ) : null}
                <span className="truncate">{primaryAction.label}</span>
              </Button>

              {/* Desktop: Show secondary button & icon actions */}
              <div className="hidden md:flex items-center gap-2 flex-wrap flex-1">
                {/* Secondary Button */}
                {secondaryAction && (
                  <Button
                    size="sm"
                    variant={secondaryAction.variant || "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      secondaryAction.onClick();
                    }}
                    className="border-lime/40 text-tile-ink-900 hover:bg-tile-muted text-xs"
                  >
                    {secondaryAction.icon && <secondaryAction.icon className="w-3.5 h-3.5 mr-1.5" />}
                    {secondaryAction.label}
                  </Button>
                )}

                {/* Icon Quick Actions */}
                {iconActions && iconActions.length > 0 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <TooltipProvider>
                      {iconActions.map((action, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick();
                              }}
                              className="h-7 w-7 hover:bg-tile-muted"
                            >
                              <action.icon className="w-3.5 h-3.5 text-tile-ink-700" />
                              <span className="sr-only">{action.tooltip}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {action.tooltip}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Bottom Sheet for overflow actions */}
        {allOverflowActions.length > 0 && (
          <BottomSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title={title}
            actions={allOverflowActions}
          />
        )}
      </>
    );
  }
);

DashboardTile.displayName = "DashboardTile";
