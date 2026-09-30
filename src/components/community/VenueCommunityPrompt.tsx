import { useState } from "react";
import { Link } from "react-router-dom";
import { X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function VenueCommunityPrompt({ userId }: { userId: string }) {
  const key = "pulse.venue-prompt-dismissed.v1:" + userId;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <aside
      aria-label="Venue owner information"
      className="relative mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed bg-muted/20 p-4 pr-12"
    >
      <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Run a venue?</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Create a verified venue community and bring your players together.
        </p>
      </div>
      <Button variant="outline" asChild className="min-h-11 rounded-xl">
        <Link to="/player/venue-requests">Venue requests</Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-10 w-10"
        aria-label="Dismiss venue owner information"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* Dismiss for this visit when storage is unavailable. */
          }
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </aside>
  );
}
