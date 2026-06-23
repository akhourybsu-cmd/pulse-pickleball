import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

interface RoundRobinTopBarProps {
  /** Where to go when the back button is pressed. Defaults to in-app history. */
  backHref?: string;
  /** Center label — usually "Round Robin". */
  label?: string;
  /** Share callback. When omitted, the share button is hidden. */
  onShare?: () => void;
  /** Overflow menu slot — typically a <DropdownMenu> with host controls.
   *  Hidden when undefined (e.g. for non-organizer viewers). */
  overflow?: ReactNode;
  className?: string;
}

/**
 * Slim top bar for the Round Robin detail page.
 *
 * Replaces the standard PageHeader on this route because the host page
 * has its own action surfaces (the WhatsNextBanner + overflow menu) —
 * the global PULSE/Bell/Profile/Theme/Sign-out toolbar takes up valuable
 * mobile real estate that the host doesn't need while running an event.
 *
 * Anatomy (mobile-first):
 *   [back] [label] ........... [share] [overflow]
 *
 * Sticky to top so the back/share are always reachable during play.
 */
export function RoundRobinTopBar({
  backHref,
  label = "Round Robin",
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
        "sticky top-0 z-40 bg-secondary text-secondary-foreground",
        "border-b border-secondary-foreground/10 shadow-sm",
        "backdrop-blur supports-[backdrop-filter]:bg-secondary/95",
        className,
      )}
    >
      <div className="container max-w-[1280px] mx-auto px-2 sm:px-4 h-14 flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Back"
          className="h-9 w-9 text-secondary-foreground hover:bg-secondary-foreground/10 flex-shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <span className="text-sm font-semibold tracking-wide truncate">{label}</span>

        <div className="flex-1" />

        {onShare && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShare}
            aria-label="Share event"
            className="h-9 w-9 text-secondary-foreground hover:bg-secondary-foreground/10 flex-shrink-0"
          >
            <Share2 className="h-[18px] w-[18px]" />
          </Button>
        )}

        {overflow}
      </div>
    </nav>
  );
}
