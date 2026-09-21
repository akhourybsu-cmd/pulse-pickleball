import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import "./event.css";

interface RoundRobinTopBarProps {
  /** Where to go when the back button is pressed. Defaults to in-app history. */
  backHref?: string;
  /** Share callback. When omitted, the share button is hidden. */
  onShare?: () => void;
  /** Overflow menu slot — typically a <DropdownMenu> with host controls.
   *  Hidden when undefined (e.g. for non-organizer viewers). */
  overflow?: ReactNode;
  className?: string;
}

/**
 * Branded top bar for the Round Robin detail page.
 *
 * Replaces the standard PageHeader on this route because the host page
 * has its own action surfaces (the WhatsNextBanner + overflow menu) —
 * the global PULSE/Bell/Profile/Theme/Sign-out toolbar takes up valuable
 * mobile real estate that the host doesn't need while running an event.
 *
 * Anatomy (mobile-first):
 *   [back]  [  Round Robin by:   ]  [share] [overflow]
 *                  [  LOGO  ]
 *
 * Sticky to top so the back/share are always reachable during play.
 */
export function RoundRobinTopBar({
  backHref,
  onShare,
  overflow,
  className,
}: RoundRobinTopBarProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backHref) navigate(backHref);
    else navigate(-1);
  };

  return (
    <nav
      className={cn(
        "rr-event-topbar sticky top-0 z-40 bg-secondary text-secondary-foreground",
        "border-b border-secondary-foreground/10 shadow-[0_4px_20px_-8px_hsl(var(--foreground)/0.35)]",
        "backdrop-blur supports-[backdrop-filter]:bg-secondary/95",
        className,
      )}
    >
      {/* Primary hairline accent — subtle broadcast-style top edge */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      <div className="rr-event-width rr-event-topbar-inner h-[72px] flex items-center gap-1.5 relative">
        {/* Back button — left */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Back"
          className="h-11 w-11 rounded-full text-secondary-foreground hover:bg-secondary-foreground/10 flex-shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-1 min-w-0 items-center pointer-events-none">
          <Logo className="h-auto w-full max-w-[116px] text-secondary-foreground" />
        </div>

        {/* Right actions */}
        {onShare && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShare}
            aria-label="Share event"
            className="h-11 w-11 text-secondary-foreground hover:bg-secondary-foreground/10 flex-shrink-0"
          >
            <Share2 className="h-[18px] w-[18px]" />
          </Button>
        )}

        {overflow}
      </div>
    </nav>
  );
}
