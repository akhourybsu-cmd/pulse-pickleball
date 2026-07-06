import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, KeyRound } from "lucide-react";
import type { League } from "@/lib/leagues/types";

/**
 * Full-page printable invite poster. Real leagues stick these on
 * court fences / community boards. The page has its own layout — no
 * AdminLayout chrome — because print stylesheets hate nested
 * headers/nav wrappers.
 *
 * The visible controls (back arrow + Print button) are hidden at
 * @media print so the printed sheet is just the poster canvas.
 *
 * A4/Letter both come out fine — the canvas uses vh-based sizing so
 * it fills whatever aspect the printer picks.
 */
export default function LeaguePoster() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  // Back button routes to the same context we came from.
  const isPlayerContext = location.pathname.startsWith("/player/");
  const backToLeague = leagueId
    ? (isPlayerContext ? `/player/leagues/${leagueId}/manage` : `/admin/leagues/${leagueId}`)
    : (isPlayerContext ? "/player/leagues" : "/admin/leagues");
  const backToList = isPlayerContext ? "/player/leagues" : "/admin/leagues";

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

  const shareUrl =
    `${window.location.origin}/player/leagues?join=${encodeURIComponent(league.invite_code)}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Controls — hidden when printing */}
      <div className="print:hidden fixed top-0 inset-x-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Button
            variant="ghost" size="sm"
            className="text-slate-200 hover:text-white hover:bg-slate-800"
            onClick={() => navigate(backToLeague)}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="text-xs text-slate-400 hidden sm:block">
            Ctrl/⌘+P to print
          </div>
          <Button
            size="sm"
            className="bg-[#A6DB5A] text-slate-950 hover:bg-[#A6DB5A]/90"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      {/* Poster canvas. Print CSS resets bg to white + text to black so
          the printed sheet doesn't try to render our dark hero as a
          full-page dark rectangle (ink hog + often ignored by drivers). */}
      <div className="pt-14 print:pt-0">
        <div
          className={[
            "relative mx-auto my-8 print:my-0",
            "aspect-[8.5/11] w-full max-w-[850px]",
            "rounded-2xl print:rounded-none overflow-hidden",
            "bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38]",
            "print:bg-white print:text-slate-900",
            "border border-slate-800 print:border-0",
            "flex flex-col",
          ].join(" ")}
        >
          {/* Decorative diagonal stripes — screen only. Turned off on
              print because printers add moiré to sub-pixel repeats. */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.04] pointer-events-none print:hidden"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 13px)",
              color: "#A6DB5A",
            }}
          />

          {/* Top eyebrow */}
          <div className="relative pt-10 sm:pt-14 px-8 text-center">
            <div
              className={[
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.25em]",
                "bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30",
                "print:bg-transparent print:text-[#5f8f26] print:ring-0",
              ].join(" ")}
            >
              PULSE Pickleball League
            </div>
          </div>

          {/* League name */}
          <div className="relative px-8 pt-6 sm:pt-8 text-center">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
              {league.name}
            </h1>
            {league.location && (
              <p className="text-slate-400 print:text-slate-500 text-lg mt-3">
                {league.location}
              </p>
            )}
          </div>

          {/* Big code + QR block */}
          <div className="relative flex-1 flex flex-col items-center justify-center gap-6 sm:gap-8 px-8">
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 print:text-slate-500 mb-2">
                Join with code
              </div>
              <div
                className={[
                  "font-mono font-black text-6xl sm:text-8xl tracking-[0.1em]",
                  "text-[#A6DB5A] print:text-slate-900",
                  "break-all",
                ].join(" ")}
              >
                {league.invite_code}
              </div>
            </div>

            <div className="flex items-center gap-6 sm:gap-8">
              {/* QR */}
              <div className="rounded-2xl print:rounded-lg bg-white p-4 shadow-xl print:shadow-none">
                <QRCodeSVG
                  value={shareUrl}
                  size={200}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0B171F"
                />
              </div>

              {/* Or-manual instructions */}
              <div className="max-w-[220px] hidden sm:block">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 print:text-slate-500 mb-2 flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" />
                  Or enter manually
                </div>
                <ol className="text-sm text-slate-300 print:text-slate-700 space-y-1.5 list-decimal ml-4">
                  <li>Open PULSE</li>
                  <li>Tap Leagues</li>
                  <li>Join with code</li>
                  <li>Enter the code above</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative px-8 pb-8 sm:pb-10 text-center">
            <div className="text-[11px] text-slate-400 print:text-slate-500 font-mono truncate">
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
