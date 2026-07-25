import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, Trophy, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { stashPostAuthRedirect } from "@/lib/authRedirect";

interface LeagueTeaser {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  league_type: string | null;
  registration_open: boolean;
  registration_closes_at: string | null;
}

type Phase =
  | "loading"
  | "preview" // authed → auto-joins
  | "need_auth" // logged out → Sign in / Sign up
  | "joining"
  | "success"
  | "reg_closed"
  | "error";

/**
 * Handles league invite links of the form /player/leagues/join/:code.
 *
 * Flow (mirrors JoinGroupByCode):
 *   1. Look up the league by code — works for logged-out users too, since
 *      find_league_by_invite_code is SECURITY DEFINER granted to anon and
 *      returns only public teaser columns (admin_only leagues stay hidden).
 *   2. If logged out, show "You're invited to {name}" + Sign in / Sign up,
 *      stashing this URL so they land back here after auth.
 *   3. If logged in, call join_league_by_code, then show a success state
 *      with an Open league button. Registration-closed rejections
 *      (returning members bypass the deadline; only brand-new signups are
 *      blocked) surface as an explicit "registration closed" state.
 */
export default function JoinLeagueByCode() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [league, setLeague] = useState<LeagueTeaser | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const joinAttempted = useRef(false);

  // Step 1 — preview the league from the code.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setPhase("error");
        setErrorMsg("Missing invite code.");
        return;
      }
      const { data, error } = await supabase.rpc(
        "find_league_by_invite_code" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { p_code: code },
      );
      if (cancelled) return;
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setPhase("error");
        setErrorMsg("This invite code is invalid or the league is no longer accepting links.");
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as LeagueTeaser;
      setLeague({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        location: row.location ?? null,
        league_type: row.league_type ?? null,
        registration_open: row.registration_open ?? true,
        registration_closes_at: row.registration_closes_at ?? null,
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setPhase(user ? "preview" : "need_auth");
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Step 2 — auto-join once we have a preview and a signed-in user.
  useEffect(() => {
    if (phase !== "preview" || !code || joinAttempted.current) return;
    joinAttempted.current = true;
    (async () => {
      setPhase("joining");
      const { data, error } = await supabase.rpc(
        "join_league_by_code" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        { p_code: code },
      );
      if (error) {
        // 22023 = "Registration for this league has closed" (new signups).
        if (error.code === "22023") {
          setPhase("reg_closed");
          return;
        }
        setPhase("error");
        setErrorMsg(
          error.code === "02000"
            ? "This invite code is invalid or has been changed."
            : error.message || "We couldn't add you to this league.",
        );
        return;
      }
      if (!data) {
        setPhase("error");
        setErrorMsg("We couldn't add you to this league. The code may have changed.");
        return;
      }
      setLeague((prev) => (prev ? { ...prev, id: String(data) } : prev));
      setPhase("success");
    })();
  }, [phase, code]);

  const goToAuth = (mode: "signin" | "signup") => {
    stashPostAuthRedirect(`/player/leagues/join/${code}`);
    navigate(`/auth${mode === "signup" ? "?tab=signup" : ""}`, { replace: false });
  };

  const closesLabel = league?.registration_closes_at
    ? new Date(`${league.registration_closes_at}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-5">
          {phase === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Looking up invite…</p>
            </>
          )}

          {phase === "error" && (
            <>
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <div>
                <p className="text-lg font-semibold">Invite not available</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
              </div>
              <Button onClick={() => navigate("/player/leagues")} className="w-full">
                Browse leagues
              </Button>
            </>
          )}

          {(phase === "need_auth" ||
            phase === "preview" ||
            phase === "joining" ||
            phase === "reg_closed") &&
            league && (
              <>
                <div className="w-16 h-16 rounded-xl bg-primary/10 mx-auto flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    You're invited to
                  </p>
                  <p className="text-2xl font-bold mt-1">{league.name}</p>
                  {league.location && (
                    <p className="text-sm text-muted-foreground mt-1">{league.location}</p>
                  )}
                  {league.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                      {league.description}
                    </p>
                  )}
                  {closesLabel && phase !== "reg_closed" && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      Registration open until {closesLabel}
                    </p>
                  )}
                </div>

                {phase === "joining" && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Joining…</span>
                  </div>
                )}

                {phase === "need_auth" && (
                  <div className="space-y-2">
                    <Button onClick={() => goToAuth("signin")} className="w-full">
                      Sign in to join
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => goToAuth("signup")}
                      className="w-full"
                    >
                      Create an account
                    </Button>
                  </div>
                )}

                {phase === "reg_closed" && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Registration has closed
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This league isn't accepting new players right now. Ask the
                        organizer if you think this is a mistake.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/player/leagues")}
                      className="w-full"
                    >
                      Browse other leagues
                    </Button>
                  </div>
                )}
              </>
            )}

          {phase === "success" && league && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="text-2xl font-bold">You joined {league.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You're in. Check your schedule and standings any time.
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => navigate(`/player/leagues/${league.id}`)}
                  className="w-full"
                >
                  Open {league.name}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/player/leagues")}
                  className="w-full"
                >
                  My leagues
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
