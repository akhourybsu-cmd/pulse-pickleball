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
import { Calendar, Users, Trophy, Lock, Copy, Check, Share2, MapPin, Pencil, Grid3X3 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCourtName } from "@/hooks/useCourtName";
import "./event.css";

interface RoundRobinHostHeroProps {
  name: string;
  date: string;           // YYYY-MM-DD
  startTime: string | null;
  status: "draft" | "live" | "completed" | "voided";
  voided?: boolean;
  ratingEligible: boolean;
  /** When true, surface a "Guests enabled" chip explaining why this event
   *  isn't PULSE Rating eligible. */
  allowGuests?: boolean;

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
  compact?: boolean;
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
  allowGuests,

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
  compact = false,
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

  const formatLabel = ({ open: "Open", mixed: "Mixed", male: "Men's", female: "Women's" }[eventFormat || ""] || "Doubles");

  if (compact) return (
    <section className={cn("rr-player-event-header rr-event-width", className)} aria-label="Event information">
      <div className="min-w-0">
        <p className="rr-player-event-eyebrow">Round Robin <span>{voided ? "voided" : status}</span></p>
        <h1>{name}</h1>
      </div>
      <details className="rr-player-event-details">
        <summary>Event info</summary>
        <div>
          <p>{format(parseISO(date + "T00:00:00"), "MMM d")}{startTime ? ` · ${formatStartTime(startTime)}` : ""}</p>
          {resolvedLocation && <p>{resolvedLocation}</p>}
          <p>{playerCount} players · {numCourts} courts · {formatLabel}</p>
          <p>{ratingEligible && !voided && status !== "voided" ? "PULSE rating eligible" : "Not rating eligible"}</p>
        </div>
      </details>
    </section>
  );

  return (
    <section
      className={cn(
        "rr-event-hero",
        className,
      )}
    >
      <div className="rr-event-width rr-event-identity">
        {/* Status chips first — small, restrained */}
        <div className="rr-event-status flex items-center gap-1.5 flex-wrap mb-2.5">
          {voided || status === "voided" ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tracking-[0.14em] uppercase">Voided</span>
          ) : status === "live" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.14em] uppercase shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.55)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
              </span>
              Live
            </span>
          ) : status === "completed" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-foreground/90 text-background text-[10px] font-bold tracking-[0.14em] uppercase">
              <Trophy className="h-2.5 w-2.5" />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-border/70 bg-background/60 text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase backdrop-blur-sm">
              Draft
            </span>
          )}
          {ratingEligible && !voided && status !== "voided" ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-primary/25 bg-primary/12 text-primary text-[10px] font-bold tracking-[0.14em] uppercase">
              Rating eligible
            </span>
          ) : allowGuests ? (
            <span
              title="Guest players are allowed, so results don't count toward PULSE Ratings."
              className="inline-flex items-center px-2.5 py-1 rounded-full border border-border/70 bg-background/60 text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase backdrop-blur-sm"
            >
              Not rating eligible · Guests enabled
            </span>
          ) : null}

        </div>

        {/* Eyebrow + title — editorial, with an accent rule for weight */}
        <div className="rr-event-title relative pl-3.5 mb-3.5">
          <span
            aria-hidden
            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary to-primary/25"
          />
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80 mb-1">
            Round Robin
          </div>
          <h1 className="text-[24px] sm:text-[28px] md:text-[32px] font-extrabold tracking-[-0.02em] text-foreground leading-[1.05] text-balance">
            {name}
          </h1>
        </div>

        {/* Metadata — stat strip reads like a scoreboard instead of icon soup */}
        <div className="rr-event-metrics grid grid-cols-2 sm:grid-cols-4">
          <StatTile
            icon={Calendar}
            label="When"
            value={`${format(parseISO(date + "T00:00:00"), "MMM d")}${startTime ? ` · ${formatStartTime(startTime)}` : ""}`}
          />
          <StatTile
            icon={Users}
            label="Players"
            value={String(playerCount)}
          />
          <StatTile
            icon={Grid3X3}
            label="Courts"
            value={hasSchedule ? String(numCourts) : "—"}
          />
          <StatTile
            icon={Trophy}
            label="Format"
            value={formatLabel}
          />
        </div>


        {/* Secondary line — schedule state + location, quiet by design */}
        <div className="rr-event-meta mt-2.5 flex items-center gap-x-2 gap-y-1 flex-wrap text-[12px] sm:text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground/80">{scheduleStatus}</span>
          {(resolvedLocation || canEditLocation) && (
            <>
              <span className="text-muted-foreground/40">·</span>
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
            </>
          )}
        </div>


        {/* Invite-code row — compact, inline. Only when invite-only. */}
        {showInviteCode && (
          <div className="rr-event-invite mt-3 pt-3 border-t border-border/60">
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
      <svg className="rr-event-signal" viewBox="0 0 1200 18" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path pathLength="1" d="M0 9h550l12-5 10 9 12-12 14 16 12-8h590" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </section>
  );
}

/**
 * Small scoreboard-style metric tile used in the hero stat strip.
 * Glassy card on the hero wash — label above, tabular value below.
 */
function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="rr-event-stat">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3 w-3 text-primary/80" />
        {label}
      </div>
      <div className="rr-event-stat-value mt-0.5 font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}
