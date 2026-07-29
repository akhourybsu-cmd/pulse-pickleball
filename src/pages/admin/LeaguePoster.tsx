import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { toBlob } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Share2, Link2, Check, ScanLine, KeyRound, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESSABLE } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import type { League } from "@/lib/leagues/types";

/** Can this browser share files (image) via the native sheet? */
function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    return (
      typeof nav.canShare === "function" &&
      nav.canShare({ files: [new File([], "x.png", { type: "image/png" })] })
    );
  } catch {
    return false;
  }
}

/**
 * Full-page printable + shareable invite poster. Real leagues stick
 * these on court fences / community boards, or drop the image straight
 * into a group chat. The page has its own layout — no AdminLayout chrome
 * — because print stylesheets hate nested headers/nav wrappers.
 *
 * The visible controls (back arrow + share/print) are hidden at
 * @media print so the printed sheet is just the poster canvas.
 *
 * A4/Letter both come out fine — the canvas uses an 8.5×11 aspect so it
 * fills whatever page the printer picks.
 */
export default function LeaguePoster() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [rendering, setRendering] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const shareFiles = canShareFiles();

  // Leagues live in one public portal — always route back there.
  const backToLeague = leagueId ? `/player/leagues/${leagueId}/manage` : "/player/leagues";
  const backToList = "/player/leagues";

  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      const { data, error } = await supabase
        .from("leagues" as never)
        .select("*")
        .eq("id", leagueId)
        .maybeSingle();
      if (error) toast.error(error.message);
      setLeague((data as unknown as League) ?? null);
      setLoading(false);
    })();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!league) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">League not found.</p>
        <Button variant="outline" onClick={() => navigate(backToList)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to leagues
        </Button>
      </div>
    );
  }
  if (!league.invite_code) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground max-w-md">
          Set an invite code on the league's Overview tab before printing a poster.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate(backToLeague)}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to league
        </Button>
      </div>
    );
  }

  // Deep-link into the dedicated join page — it previews the league even
  // for logged-out recipients (the common case for a scanned flyer) and
  // then joins, instead of bouncing them off the auth wall like the
  // in-app /player/leagues?join= path would.
  const shareUrl =
    `${window.location.origin}/player/leagues/join/${encodeURIComponent(league.invite_code)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      haptic("success");
      setTimeout(() => setCopied(false), 1500);
      toast.success("Share link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const fileBase =
    league.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "league";

  /** Rasterise the poster canvas to a PNG blob at 2× for crisp output. */
  const renderPng = async (): Promise<Blob | null> => {
    if (!posterRef.current) return null;
    // Make sure the display font is ready so the title doesn't fall back.
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }
    return toBlob(posterRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#0B171F",
    });
  };

  /** Adaptive: share the image file where supported, else download it. */
  const shareOrSaveImage = async () => {
    if (rendering) return;
    setRendering(true);
    try {
      const blob = await renderPng();
      if (!blob) throw new Error("render failed");
      const file = new File([blob], `${fileBase}-invite.png`, { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };
      if (shareFiles && nav.share) {
        try {
          await nav.share({
            files: [file],
            title: `Join ${league.name}`,
            text: `Join ${league.name} on PULSE (code: ${league.invite_code})`,
          });
          haptic("success");
          return;
        } catch (err) {
          // AbortError = user dismissed the sheet; don't fall back to a download.
          if ((err as DOMException)?.name === "AbortError") return;
          // Any other share failure → fall through to download.
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      haptic("success");
    } catch {
      toast.error("Couldn't generate the poster image");
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Controls — hidden when printing */}
      <div className="print:hidden fixed top-0 inset-x-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="container mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <Button
            variant="ghost" size="sm"
            className={cn("group text-slate-200 hover:text-white hover:bg-slate-800 shrink-0", PRESSABLE)}
            onClick={() => navigate(backToLeague)}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={copyLink}
              className={cn("h-9 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white", PRESSABLE)}
            >
              {copied ? (
                <><Check className="w-4 h-4 sm:mr-1.5 text-[#A6DB5A]" /><span className="hidden sm:inline">Copied</span></>
              ) : (
                <><Link2 className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Copy link</span></>
              )}
            </Button>
            <Button
              variant="outline" size="sm"
              className={cn("h-9 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white", PRESSABLE)}
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              size="sm"
              onClick={shareOrSaveImage}
              disabled={rendering}
              aria-busy={rendering || undefined}
              className={cn("h-9 min-w-[2.25rem] bg-[#A6DB5A] text-slate-950 hover:bg-[#A6DB5A]/90", PRESSABLE)}
            >
              {rendering ? (
                <><Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" /><span className="hidden sm:inline">Rendering…</span></>
              ) : shareFiles ? (
                <><Share2 className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Share image</span></>
              ) : (
                <><Download className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Save image</span></>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Poster canvas. Print CSS resets bg to white + text to black so
          the printed sheet doesn't try to render our dark hero as a
          full-page dark rectangle (ink hog + often ignored by drivers). */}
      <div className="pt-14 print:pt-0 px-3 sm:px-0">
        <div
          ref={posterRef}
          className={[
            "relative mx-auto my-6 sm:my-8 print:my-0",
            "aspect-[8.5/11] w-full max-w-[850px]",
            "rounded-3xl print:rounded-none overflow-hidden",
            "bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38]",
            "print:bg-white print:text-slate-900",
            "border border-slate-800 print:border-0",
            "shadow-2xl print:shadow-none",
            "flex flex-col",
          ].join(" ")}
        >
          {/* Decorative diagonal stripes — screen only. Turned off on
              print because printers add moiré to sub-pixel repeats. */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.05] pointer-events-none print:hidden"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 13px)",
              color: "#A6DB5A",
            }}
          />
          {/* Corner glow — screen only, adds depth behind the header. */}
          <div
            aria-hidden
            className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#A6DB5A]/10 blur-3xl pointer-events-none print:hidden"
          />

          {/* Header */}
          <div className="relative pt-10 sm:pt-14 px-8 text-center">
            <div
              className={[
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.25em]",
                "bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30",
                "print:bg-transparent print:text-[#5f8f26] print:ring-1 print:ring-[#5f8f26]/40",
              ].join(" ")}
            >
              PULSE Pickleball League
            </div>

            <h1 className="font-display text-5xl sm:text-7xl tracking-tight leading-[0.95] mt-6 uppercase">
              {league.name}
            </h1>
            {league.location && (
              <p className="text-slate-400 print:text-slate-500 text-base sm:text-lg mt-3 font-medium">
                {league.location}
              </p>
            )}

            {/* Accent divider */}
            <div className="mx-auto mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-[#A6DB5A] to-transparent print:via-[#5f8f26]" />
          </div>

          {/* Hero: QR is the primary call-to-action, code is the fallback. */}
          <div className="relative flex-1 flex flex-col items-center justify-center gap-5 sm:gap-7 px-8">
            <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.3em] text-[#A6DB5A] print:text-[#5f8f26]">
              <ScanLine className="w-4 h-4" />
              Scan to join
            </div>

            {/* QR — level Q (25% error recovery) + a 2-module quiet zone so
                it still scans off a printed flyer with glare or a smudge. */}
            <div className="rounded-3xl print:rounded-xl bg-white p-5 shadow-2xl print:shadow-none ring-1 ring-black/5">
              <QRCodeSVG
                value={shareUrl}
                size={248}
                level="Q"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#0B171F"
                className="h-auto w-[248px] max-w-full"
              />
            </div>

            {/* Manual code fallback */}
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 print:text-slate-500 mb-1.5 flex items-center justify-center gap-1.5">
                <KeyRound className="w-3 h-3" />
                Or join with code
              </div>
              <div
                className={[
                  "font-mono font-black text-5xl sm:text-7xl tracking-[0.12em] leading-none",
                  "text-[#A6DB5A] print:text-slate-900",
                  "break-all",
                ].join(" ")}
              >
                {league.invite_code}
              </div>
            </div>
          </div>

          {/* Footer — compact "how to" + share URL */}
          <div className="relative px-8 pb-10 sm:pb-12 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-[12px] sm:text-sm text-slate-300 print:text-slate-700 flex-wrap">
              <Step n={1}>Open PULSE</Step>
              <Dot />
              <Step n={2}>Tap Leagues</Step>
              <Dot />
              <Step n={3}>Join with code</Step>
            </div>
            <div className="text-[11px] text-slate-500 print:text-slate-500 font-mono truncate">
              {shareUrl}
            </div>
          </div>
        </div>
      </div>

      {/* Print stylesheet — ensures the poster fills the page with no
          margin bleed. */}
      <style>{`
        @media print {
          @page { margin: 0.5in; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

/** Small numbered step chip used in the poster footer. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#A6DB5A]/20 text-[#A6DB5A] print:bg-[#5f8f26]/15 print:text-[#5f8f26] text-[11px] font-black">
        {n}
      </span>
      <span className="font-medium">{children}</span>
    </span>
  );
}

function Dot() {
  return <span className="text-slate-600 print:text-slate-400" aria-hidden>·</span>;
}
