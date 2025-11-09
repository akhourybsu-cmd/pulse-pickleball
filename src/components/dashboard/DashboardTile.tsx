import { forwardRef, useState } from "react";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardTileProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  notification?: boolean;
}

export const DashboardTile = forwardRef<HTMLButtonElement, DashboardTileProps>(
  (
    {
      icon: Icon,
      title,
      subtitle,
      onClick,
      loading = false,
      disabled = false,
      ariaLabel,
      className,
      notification,
    },
    ref
  ) => {
    return (
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
          // Mobile: compact variant (92–108px)
          "min-h-[92px] p-3",
          // Desktop: standard variant (104–116px)
          "md:min-h-[104px] md:p-4",
          disabled && "opacity-60 cursor-not-allowed",
          className
        )}
        style={{
          boxShadow: "var(--tile-shadow), inset 0 1px 0 hsl(var(--tile-card-bg) / 0.5)",
        }}
      >
          {/* Top Accent Bar - 2px gradient */}
          <div
            className={cn(
              "absolute top-0 left-0 right-0 pointer-events-none h-[2px]",
              loading && "animate-pulse"
            )}
            style={{
              background: "linear-gradient(90deg, hsl(var(--accent-lime)), transparent 70%)",
            }}
          />

          {/* 3-Zone Grid Layout */}
          <div className="relative grid grid-cols-[1fr_auto_48px] items-center gap-1 md:gap-1.5 h-full">
            {/* Zone 1: Info (Icon + Title + Subtitle) ~64% */}
            <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
              {/* Icon Halo - 28–36px */}
              <div
                className={cn(
                  "flex-shrink-0 rounded-full flex items-center justify-center icon-halo transition-transform",
                  "w-7 h-7 md:w-9 md:h-9",
                  loading && "animate-pulse"
                )}
                style={{
                  background: "color-mix(in srgb, var(--page-bg) 70%, transparent)",
                  boxShadow: "inset 0 1px 2px hsl(var(--tile-border) / 0.25)",
                }}
              >
                <Icon className="w-[18px] h-[18px] md:w-5 md:h-5 text-lime" />
              </div>

              {/* Title & Subtitle Stack */}
              <div className="flex-1 min-w-0 -space-y-0.5">
                <h3 
                  className={cn(
                    "font-semibold text-tile-ink-900 leading-[1.1] truncate",
                    "text-[clamp(15px,3.8vw,16px)]"
                  )}
                >
                  {title}
                </h3>
                <p
                  className={cn(
                    "text-tile-ink-700 leading-[1.1] truncate",
                    "text-[clamp(12px,3.2vw,13px)]",
                    "opacity-85"
                  )}
                >
                  {subtitle}
                </p>
              </div>
            </div>

            {/* Zone 2: Pattern Zone - narrow column (0-22% width) */}
            <div
              className={cn(
                "hidden @[400px]:block w-12 md:w-16 h-full self-stretch pointer-events-none",
                "opacity-[0.015] dark:opacity-[0.01]",
                "md:opacity-[0.03] md:dark:opacity-[0.015]"
              )}
              style={{
                backgroundImage: `radial-gradient(circle, hsl(var(--tile-pattern-color)) 1px, transparent 1px)`,
                backgroundSize: "6px 6px",
                backgroundPosition: "center",
              }}
            />

            {/* Zone 3: Actions Rail - 48px fixed */}
            <div className="flex items-center justify-end gap-0.5 w-12">
              {/* Chevron indicator */}
              <ChevronRight 
                className={cn(
                  "w-4 h-4 md:w-[18px] md:h-[18px] text-tile-ink-700 opacity-50"
                )} 
              />
            </div>

            {/* Notification Indicator */}
            {notification && (
              <span className="absolute top-1 right-1 flex h-2 w-2 md:h-2.5 md:w-2.5 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-lime"></span>
              </span>
            )}
          </div>
        </button>
    );
  }
);

DashboardTile.displayName = "DashboardTile";
