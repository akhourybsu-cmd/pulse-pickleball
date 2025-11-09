import { ReactNode, ButtonHTMLAttributes, forwardRef } from "react";
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
  };
  iconActions?: Array<{
    icon: LucideIcon;
    tooltip: string;
    onClick: () => void;
  }>;
  menuActions?: Array<{
    label: string;
    onClick: () => void;
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
    return (
      <div
        ref={ref}
        className={cn(
          "relative group",
          "border rounded-2xl overflow-hidden tile-hover",
          "bg-tile-bg border-tile-border",
          "transition-all duration-200",
          className
        )}
        style={{
          boxShadow: "var(--tile-shadow)",
          minHeight: "160px",
        }}
      >
        {/* Top Accent Bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
          style={{
            background: "var(--tile-gradient-lime)",
          }}
        />

        {/* Pickleball Dot Pattern */}
        <div
          className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{
            opacity: "var(--tile-pattern-opacity)",
            backgroundImage: `radial-gradient(circle, hsl(var(--tile-pattern-color)) 1px, transparent 1px)`,
            backgroundSize: "8px 8px",
          }}
        />

        {/* Card Content */}
        <div className="relative p-4 flex flex-col h-full">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Icon Halo */}
              <div
                className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-tile-muted icon-halo transition-transform"
                style={{
                  boxShadow: "inset 0 1px 2px hsl(var(--tile-border) / 0.3)",
                }}
              >
                <Icon className="w-5 h-5 text-lime" />
              </div>

              {/* Title & Badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-tile-ink-900 text-sm leading-tight">
                    {title}
                  </h3>
                  {badge && (
                    <Badge
                      variant={badge.variant || "outline"}
                      className="text-[10px] px-1.5 py-0 border-lime/40 text-tile-ink-900"
                    >
                      {badge.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Overflow Menu */}
            {menuActions && menuActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 -mt-1 -mr-1 hover:bg-tile-muted"
                  >
                    <MoreVertical className="w-4 h-4 text-tile-ink-700" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuActions.map((action, i) => (
                    <DropdownMenuItem key={i} onClick={action.onClick}>
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Notification Indicator */}
            {notification && (
              <span className="absolute top-2 right-2 flex h-3 w-3 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-lime"></span>
              </span>
            )}
          </div>

          {/* Subtitle Line */}
          <p
            className="text-xs text-tile-ink-700 mb-4 leading-relaxed"
            style={{ opacity: 0.85 }}
          >
            {subtitle}
          </p>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer Row - Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary Button */}
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              disabled={primaryAction.loading}
              className="bg-lime text-primary-foreground hover:bg-lime/90 shadow-sm text-xs"
            >
              {primaryAction.loading ? (
                <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1.5" />
              ) : primaryAction.icon ? (
                <primaryAction.icon className="w-3.5 h-3.5 mr-1.5" />
              ) : null}
              {primaryAction.label}
            </Button>

            {/* Secondary Button */}
            {secondaryAction && (
              <Button
                size="sm"
                variant={secondaryAction.variant || "outline"}
                onClick={secondaryAction.onClick}
                className="border-lime/40 text-tile-ink-900 hover:bg-tile-muted text-xs"
              >
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
                          onClick={action.onClick}
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
    );
  }
);

DashboardTile.displayName = "DashboardTile";
