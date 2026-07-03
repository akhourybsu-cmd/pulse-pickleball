import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Info, CalendarClock, XCircle } from "lucide-react";
import type { LeagueTeaser } from "@/lib/leagues/types";

/**
 * Two-step flow:
 *   1. Player types a code → we call find_league_by_invite_code() to
 *      show a teaser (name / description / location / type).
 *   2. Player confirms → we call join_league_by_code() which creates
 *      (or reactivates) an active membership and returns the league id.
 *
 * Separating lookup + join gives the player a "yes this is the right
 * league" moment before they're joined. It also lets us surface a
 * clear error when the code doesn't match anything.
 */
export function JoinByCodeDialog({
  open, onOpenChange, onJoined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the league id after a successful join, so the caller can navigate. */
  onJoined?: (leagueId: string) => void;
}) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [teaser, setTeaser] = useState<LeagueTeaser | null>(null);
  const [looking, setLooking] = useState(false);
  const [joining, setJoining] = useState(false);

  const reset = () => {
    setCode("");
    setTeaser(null);
    setLooking(false);
    setJoining(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const lookup = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter a code");
      return;
    }
    setLooking(true);
    const { data, error } = await supabase
      .rpc("find_league_by_invite_code" as never, { p_code: trimmed } as never);
    if (error) {
      toast.error(error.message);
      setLooking(false);
      return;
    }
    const rows = (data ?? []) as unknown as LeagueTeaser[];
    if (rows.length === 0) {
      toast.error("No league matches that code");
      setLooking(false);
      return;
    }
    setTeaser(rows[0]);
    setLooking(false);
  };

  const join = async () => {
    if (!teaser) return;
    setJoining(true);
    const { data, error } = await supabase
      .rpc("join_league_by_code" as never, { p_code: code.trim() } as never);
    if (error) {
      toast.error(error.message);
      setJoining(false);
      return;
    }
    const leagueId = data as unknown as string;
    toast.success(`Joined ${teaser.name}`);
    handleOpenChange(false);
    if (onJoined) onJoined(leagueId);
    else navigate(`/player/leagues/${leagueId}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Join a league
          </DialogTitle>
        </DialogHeader>

        {!teaser ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="join-code">Invite code</Label>
              <Input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. SPRING26"
                className="font-mono uppercase tracking-wider h-11"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !looking) {
                    e.preventDefault();
                    void lookup();
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                Ask your league organizer for the code. Case-insensitive.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={lookup}
                disabled={looking || !code.trim()}
                className="w-full"
              >
                {looking ? "Looking up…" : "Find league"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Teaser preview — confirm before commit */}
            <div className={`rounded-xl border p-4 ${
              teaser.registration_open
                ? "border-primary/30 bg-primary/5"
                : "border-muted bg-muted/40 opacity-90"
            }`}>
              <div className={`text-[10px] uppercase tracking-wider font-bold ${
                teaser.registration_open ? "text-primary" : "text-muted-foreground"
              }`}>
                {teaser.league_type}
              </div>
              <div className="mt-1 text-lg font-bold">{teaser.name}</div>
              {teaser.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                  {teaser.description}
                </p>
              )}
              {teaser.location && (
                <p className="text-xs text-muted-foreground mt-2">
                  {teaser.location}
                </p>
              )}
            </div>

            {teaser.registration_open ? (
              <>
                {teaser.registration_closes_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Registration closes {new Date(teaser.registration_closes_at)
                      .toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  You'll join as an active member. The organizer can update your
                  division or team later.
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Registration closed</div>
                  <div className="text-xs mt-0.5 opacity-90">
                    The registration deadline has passed. Reach out to the
                    organizer if you think this is a mistake.
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="ghost"
                onClick={() => setTeaser(null)}
                disabled={joining}
                className="flex-1"
              >
                {teaser.registration_open ? "Not this one" : "Back"}
              </Button>
              {teaser.registration_open && (
                <Button onClick={join} disabled={joining} className="flex-1">
                  {joining ? "Joining…" : "Join league"}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
