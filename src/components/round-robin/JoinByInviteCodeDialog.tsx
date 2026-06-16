import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Key, Loader2, Calendar, Clock, Users, MapPin, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JoinByInviteCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional pre-filled code (from a ?invite=… deep link). */
  initialCode?: string;
  /** Whether to immediately attempt preview when initialCode is provided.
   *  Used by the deep-link consumer so a player landing from a shared
   *  link sees the join card right away. */
  autoPreviewOnOpen?: boolean;
}

interface EventPreview {
  event_id: string;
  event_name: string;
  event_date: string;
  event_start_time: string | null;
  event_status: "draft" | "live" | "completed";
  num_courts: number;
  num_rounds: number;
  current_players: number;
  max_players: number | null;
  registration_deadline: string | null;
  organizer_name: string;
  organizer_avatar_url: string | null;
  already_joined: boolean;
}

/**
 * Player-side dialog for joining a Round Robin event with an invite code.
 *
 * Two-step flow:
 *   1. ENTER — player types or pastes the XYZ-ABCD code, presses Enter,
 *      the dialog calls preview_round_robin_by_code to fetch event meta
 *      so the player can verify they're joining the right thing.
 *   2. CONFIRM — player taps "Join this event"; calls
 *      join_round_robin_by_code which atomically registers them
 *      (confirmed or waitlisted depending on capacity).
 *
 * Edge cases handled gracefully:
 *   - Invalid code → inline error, code field re-focused
 *   - Already joined → preview shows it; CTA changes to "Open event"
 *   - Event completed → preview shows it; CTA is disabled
 *   - Deadline passed → preview shows it; CTA is disabled
 *   - Full capacity → preview shows "Event full — you'll join the
 *     waitlist" and CTA confirms waitlist join
 */
export function JoinByInviteCodeDialog({
  open,
  onOpenChange,
  initialCode = "",
  autoPreviewOnOpen = false,
}: JoinByInviteCodeDialogProps) {
  const navigate = useNavigate();
  const [code, setCode] = useState(initialCode);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when the dialog closes so re-opening starts fresh.
  useEffect(() => {
    if (!open) {
      setCode(initialCode);
      setPreview(null);
      setError(null);
      setPreviewLoading(false);
      setJoining(false);
    } else if (open && initialCode && autoPreviewOnOpen) {
      setCode(initialCode);
      void runPreview(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runPreview = async (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) return;

    setPreviewLoading(true);
    setError(null);
    setPreview(null);

    const { data, error: rpcError } = await supabase.rpc(
      "preview_round_robin_by_code",
      { p_code: trimmed },
    );

    setPreviewLoading(false);

    if (rpcError) {
      setError(
        rpcError.message?.toLowerCase().includes("invalid invite code")
          ? "We couldn't find an event with that code. Double-check and try again."
          : rpcError.message || "Could not look up that code",
      );
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setError("We couldn't find an event with that code. Double-check and try again.");
      return;
    }

    setPreview(row as EventPreview);
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.trim() && !preview) {
      void runPreview(code);
    }
  };

  const handleJoin = async () => {
    if (!preview) return;
    setJoining(true);

    const { data, error: rpcError } = await supabase.rpc(
      "join_round_robin_by_code",
      { p_code: code.trim().toUpperCase() },
    );

    setJoining(false);

    if (rpcError) {
      toast.error(rpcError.message || "Could not join");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    toast.success(row?.message || "You're in");
    onOpenChange(false);
    navigate(`/round-robin/${preview.event_id}`);
  };

  const handleOpenExisting = () => {
    if (!preview) return;
    onOpenChange(false);
    navigate(`/round-robin/${preview.event_id}`);
  };

  // Derived booleans for the confirmation UI
  const isCompleted = preview?.event_status === "completed";
  const isPastDeadline = preview?.registration_deadline
    ? new Date() > new Date(preview.registration_deadline)
    : false;
  const isFull =
    preview?.max_players != null && preview.current_players >= preview.max_players;
  const canJoin = preview && !preview.already_joined && !isCompleted && !isPastDeadline;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Join with invite code
          </DialogTitle>
          <DialogDescription>
            Ask your host for the 7-character code (e.g. <span className="font-mono">YMCA-7K2P</span>). Case doesn't matter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1 — code input. Shown until a successful preview lands. */}
          {!preview && (
            <div className="space-y-2">
              <Label htmlFor="rr-invite-code">Invite code</Label>
              <Input
                id="rr-invite-code"
                placeholder="XYZ-ABCD"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (error) setError(null);
                }}
                onKeyDown={handleEnterKey}
                className="text-center text-xl tracking-[0.25em] font-mono h-14"
                maxLength={20}
                autoFocus
                disabled={previewLoading}
              />
              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — preview card + confirm. Shown once preview lands. */}
          {preview && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border/50 bg-gradient-to-br from-primary/[0.05] to-card">
                <div className="flex items-start gap-2 mb-1">
                  <Lock className="h-3.5 w-3.5 text-primary mt-1 flex-shrink-0" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Invite-only event
                  </span>
                </div>
                <h3 className="font-semibold text-lg leading-tight">{preview.event_name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Organized by {preview.organizer_name}
                </p>
              </div>

              <div className="p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>{format(parseISO(preview.event_date + "T00:00:00"), "PP")}</span>
                  {preview.event_start_time && (
                    <>
                      <span className="mx-1 text-muted-foreground/40">·</span>
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span>{preview.event_start_time}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {preview.current_players}
                    {preview.max_players ? ` / ${preview.max_players}` : ""} players
                    {isFull ? " · Event full" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {preview.num_courts} {preview.num_courts === 1 ? "court" : "courts"}
                    {" · "}
                    {preview.num_rounds} {preview.num_rounds === 1 ? "round" : "rounds"}
                  </span>
                </div>
              </div>

              {/* State callouts */}
              {preview.already_joined && (
                <div className="px-4 py-3 border-t border-border/50 bg-primary/5 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>You're already registered for this event</span>
                </div>
              )}
              {isCompleted && (
                <div className="px-4 py-3 border-t border-border/50 bg-muted/30 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>This event has already completed</span>
                </div>
              )}
              {!isCompleted && isPastDeadline && (
                <div className="px-4 py-3 border-t border-border/50 bg-muted/30 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>Registration deadline has passed</span>
                </div>
              )}
              {canJoin && isFull && (
                <div className="px-4 py-3 border-t border-border/50 bg-amber-500/10 flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span>Event is full — you'll join the waitlist</span>
                </div>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className={cn("flex gap-3", !preview && "pt-2")}>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={previewLoading || joining}
            >
              Cancel
            </Button>

            {!preview ? (
              <Button
                className="flex-1"
                onClick={() => runPreview(code)}
                disabled={!code.trim() || previewLoading}
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Looking up
                  </>
                ) : (
                  "Look up event"
                )}
              </Button>
            ) : preview.already_joined ? (
              <Button className="flex-1" onClick={handleOpenExisting}>
                Open event
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleJoin}
                disabled={!canJoin || joining}
              >
                {joining ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining
                  </>
                ) : isFull ? (
                  "Join waitlist"
                ) : (
                  "Join this event"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
