import { format, parseISO } from "date-fns";

/**
 * Format a Postgres `time` value (e.g. "09:00:00" or "13:30:00") into a
 * human-readable "9:00 AM" / "1:30 PM". Falls back to the raw string if
 * the input doesn't match the HH:mm[:ss] shape.
 */
function formatStartTime(raw: string): string {
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return raw;
  const h24 = parseInt(m[1], 10);
  const min = m[2];
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return min === "00" ? `${h12} ${period}` : `${h12}:${min} ${period}`;
}
import { Calendar, Clock, Users, Trophy, Lock, Copy, Check, Share2, MapPin, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCourtName } from "@/hooks/useCourtName";

interface RoundRobinHostHeroProps {
  name: string;
  date: string;           // YYYY-MM-DD
  startTime: string | null;
  status: "draft" | "live" | "completed" | "voided";
  voided?: boolean;
  ratingEligible: boolean;
  format?: string;        // 'open' | 'mixed' | 'male' | 'female'
  numRounds: number;
  numCourts: number;
  playerCount: number;
  hasSchedule: boolean;
  inviteCode?: string | null;
  registrationMode?: string | null;
  eventId: string;
  location?: string | null;
  /** When true, show the inline "edit location" pencil. */
  canEditLocation?: boolean;
  /** Called after a successful location update so the parent can refetch. */
  onLocationUpdated?: () => void;
  className?: string;
}

/**
 * Premium host-facing hero card for the Round Robin detail page.
 *
 * Replaces the previous three-row hero (status + title + share row,
 * metadata row, action-button row) with a single coherent identity
 * card. The action row has moved into the new RoundRobinTopBar's
 * overflow menu, and the primary action lives in the WhatsNextBanner
 * below — so the hero is purely about answering "what is this event?"
 *
 * Layout (mobile-first):
 *
 *   Monday Nickerson Advanced League
 *   ──
 *   DRAFT  ·  Rating eligible
 *
 *   Jun 22  ·  9:00 AM  ·  Doubles
 *   0 confirmed players  ·  Schedule not generated
 *
 *   ─────────────────────────────────
 *   🔒 Invite code · XYZ-ABCD     [copy] [share]
 *   ─────────────────────────────────
 */
export function RoundRobinHostHero({
  name,
  date,
  startTime,
  status,
  voided,
  ratingEligible,
  format: eventFormat,
  numRounds,
  numCourts,
  playerCount,
  hasSchedule,
  inviteCode,
  registrationMode,
  eventId,
  location,
  canEditLocation,
  onLocationUpdated,
  className,
}: RoundRobinHostHeroProps) {
  const [copied, setCopied] = useState(false);
  // Resolve UUIDs (legacy: location used to hold a court_id) to a readable
  // name. Free-text values pass through unchanged.
  const resolvedLocation = useCourtName(location || null);

  const handleEditLocation = async () => {
    const next = window.prompt(
      "Where is this Round Robin? (town, city, or venue name)",
      resolvedLocation || ""
    );
    if (next === null) return;
    const trimmed = next.trim();
    const { error } = await supabase
      .from("round_robin_events")
      .update({ location: trimmed || null } as never)
      .eq("id", eventId);
    if (error) {
      toast.error("Could not update location");
      return;
    }
    toast.success(trimmed ? "Location updated" : "Location cleared");
    onLocationUpdated?.();
  };

  const showInviteCode = !!inviteCode && registrationMode === "invite_only";
  const joinUrl = showInviteCode
    ? `${window.location.origin}/player/play?invite=${encodeURIComponent(inviteCode!)}`
    : null;

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success("Invite code copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleShareCode = async () => {
    if (!inviteCode || !joinUrl) return;
    const shareText = `Join "${name}" on PULSE — invite code ${inviteCode}`;
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: name,
          text: shareText,
          url: joinUrl,
        });
        return;
      } catch {
        // Fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${joinUrl}`);
      toast.success("Share text copied");
    } catch {
      toast.error("Could not copy share text");
    }
  };

  // Status language — "Schedule not generated" reads better than "Schedule TBD".
  const scheduleStatus = hasSchedule
    ? `${numRounds} ${numRounds === 1 ? "round" : "rounds"} · ${numCourts} ${numCourts === 1 ? "court" : "courts"}`
    : "Schedule not generated";

  const formatLabel = eventFormat
    ? eventFormat.charAt(0).toUpperCase() + eventFormat.slice(1) + " · Doubles"
    : "Doubles";

  return (
    <section
      className={cn(
        "relative",
        // Subtle primary wash from top — gives the hero a sense of place
        // without an obvious bounding box.
        "bg-gradient-to-b from-primary/[0.06] via-background to-background",
        className,
      )}
    >
      <div className="container max-w-2xl mx-auto px-4 pt-4 pb-3 sm:pt-5 sm:pb-4">
        {/* Status chips first — small, restrained */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {status === "live" ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
              </span>
              Live
            </span>
          ) : status === "completed" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/90 text-background text-[10px] font-bold tracking-wider uppercase">
              <Trophy className="h-2.5 w-2.5" />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Draft
            </span>
          )}
          {voided && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tracking-wider uppercase">
              Voided
            </span>
          )}
          {ratingEligible && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold tracking-wider uppercase">
              Rating eligible
            </span>
          )}
        </div>

        {/* Title — compact, premium */}
        <h1 className="text-[22px] sm:text-2xl md:text-[28px] font-bold tracking-tight text-foreground leading-[1.1] mb-3">
          {name}
        </h1>

        {/* Metadata — two restrained lines instead of an icon-soup chip row */}
        <div className="space-y-0.5 text-[13px] sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Calendar className="h-3.5 w-3.5 text-primary/80 flex-shrink-0" />
            <span>{format(parseISO(date + "T00:00:00"), "PP")}</span>
            {startTime && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <Clock className="h-3.5 w-3.5 text-primary/80 flex-shrink-0" />
                <span>{formatStartTime(startTime)}</span>
              </>
            )}
            <span className="text-muted-foreground/50">·</span>
            <span>{formatLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Users className="h-3.5 w-3.5 text-primary/80 flex-shrink-0" />
            <span>
              {playerCount} {playerCount === 1 ? "player" : "players"}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>{scheduleStatus}</span>
          </div>
          {/* Location row — free-text town/city. Host can tap the pencil
              to set or update it inline. Hidden entirely for non-hosts
              when there's nothing to show. */}
          {(resolvedLocation || canEditLocation) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <MapPin className="h-3.5 w-3.5 text-primary/80 flex-shrink-0" />
              <span>{resolvedLocation || "Add a location"}</span>
              {canEditLocation && (
                <button
                  type="button"
                  onClick={handleEditLocation}
                  className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors"
                  aria-label="Edit location"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Invite-code row — compact, inline. Only when invite-only. */}
        {showInviteCode && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <Lock className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Invite code
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="font-mono text-lg sm:text-xl font-bold tracking-[0.25em] tabular-nums text-foreground hover:text-primary transition-colors text-left"
                  aria-label={`Invite code ${inviteCode} — tap to copy`}
                >
                  {inviteCode}
                </button>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted active:scale-95 transition-all flex items-center justify-center"
                  aria-label="Copy code"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleShareCode}
                  className="h-9 w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
                  aria-label="Share code"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
