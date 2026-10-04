import { leagueInvitePath } from "@/lib/leagues/playerNavigation";
import {
  LeagueBrandMark,
  LeagueCover,
} from "@/components/leagues/LeagueIdentity";
import { useEffect, useRef, useState } from "react";
import { useAuthState } from "@/hooks/useAuthState";
import { communityAuthUrl } from "@/lib/communityAccess";
import {
  lookupLeagueInvitation,
  joinLeagueInvitation,
  leagueInvitationError,
} from "@/lib/leagues/invitations";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  clearPostAuthRedirect,
  stashPostAuthRedirect,
} from "@/lib/authRedirect";
import { LeagueScope } from "@/components/leagues/_leagueScope";
import { Logo } from "@/components/Logo";
import "@/components/leagues/playerLeague.css";

/** Preview an invitation before committing a membership. */
export default function JoinLeagueByCode() {
  const { code = "" } = useParams<{ code: string }>();
  return <LeagueInvitation key={code} code={code} />;
}

export function LeagueInvitation({ code }: { code: string }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const auth = useAuthState();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const busy = useRef(false);
  const active = useRef(true);
  const actor = useRef(auth.user?.id);
  actor.current = auth.user?.id;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const preview = useQuery({
    queryKey: ["league-invitation", code],
    queryFn: () => lookupLeagueInvitation(code),
    retry: false,
    staleTime: 30_000,
  });
  const league = preview.data;
  const path = leagueInvitePath(code);
  useEffect(() => {
    if (auth.isAuthenticated) clearPostAuthRedirect(path);
  }, [auth.isAuthenticated, path]);

  const join = async () => {
    if (busy.current || !league || !auth.isAuthenticated || !auth.user?.id)
      return;
    busy.current = true;
    setJoining(true);
    setErrorMsg("");
    const userId = auth.user.id;
    try {
      await joinLeagueInvitation(code, league.id);
      void client.invalidateQueries({ queryKey: ["my-leagues"] });
      void client.invalidateQueries({ queryKey: ["player-league-detail"] });
      if (active.current && actor.current === userId) setJoined(true);
    } catch (error) {
      if (active.current && actor.current === userId)
        setErrorMsg(leagueInvitationError(error));
    } finally {
      busy.current = false;
      if (active.current) setJoining(false);
    }
  };
  const goToAuth = (mode: "signin" | "signup") => {
    stashPostAuthRedirect(path);
    navigate(communityAuthUrl(path, mode));
  };
  const phase =
    preview.isPending || auth.loading
      ? "loading"
      : preview.isError
      ? "error"
      : joined
      ? "success"
      : joining
      ? "joining"
      : !auth.isAuthenticated
      ? "need_auth"
      : "preview";

  const closesLabel = league?.registration_closes_at
    ? new Date(`${league.registration_closes_at}T00:00:00`).toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
      )
    : null;

  return (
    <LeagueScope
      brand={league?.branding}
      className="league-player flex items-center justify-center p-4 sm:p-6"
    >
      <Card className="w-full max-w-md overflow-hidden rounded-3xl border-[color:var(--lg-border)] shadow-xl shadow-black/5">
        <div className="relative overflow-hidden bg-[var(--league-header,#1c2621)] p-6 text-[#faf7ef]">
          <LeagueCover branding={league?.branding} />
          <div className="relative">
            <Logo compact className="mx-auto w-24" />
            <p className="mt-4 text-center text-xs uppercase tracking-[.2em] text-[color:var(--league-brand-accent,#e3ca92)]">
              Your league invitation
            </p>
            {league && (
              <LeagueBrandMark
                name={league.name}
                branding={league.branding}
                className="mx-auto mt-4 h-20 w-20 text-[80px]"
              />
            )}
          </div>
        </div>
        <CardContent className="p-5 sm:p-8 text-center space-y-5">
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
                <p className="text-sm text-muted-foreground mt-1">
                  {leagueInvitationError(preview.error)}
                </p>
              </div>
              <Button onClick={() => void preview.refetch()} className="w-full">
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/player/leagues")}
                className="w-full"
              >
                Browse leagues
              </Button>
            </>
          )}

          {(phase === "need_auth" ||
            phase === "preview" ||
            phase === "joining") &&
            league && (
              <>
                <div className="w-16 h-16 rounded-xl bg-primary/10 mx-auto flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    You're invited to
                  </p>
                  <p className="text-2xl font-bold mt-1 break-words">
                    {league.name}
                  </p>
                  {league.location && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {league.location}
                    </p>
                  )}
                  {league.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                      {league.description}
                    </p>
                  )}
                  {closesLabel && league.registration_open && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      Registration open until {closesLabel}
                    </p>
                  )}
                </div>

                {!league.registration_open && (
                  <p className="rounded-xl border p-3 text-sm text-muted-foreground">
                    Registration is closed to new players. Existing members can
                    still open their league.
                  </p>
                )}

                {phase === "joining" && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Joining…</span>
                  </div>
                )}

                {phase === "need_auth" && (
                  <div className="space-y-2">
                    <Button
                      onClick={() => goToAuth("signin")}
                      className="w-full"
                    >
                      {league.registration_open
                        ? "Sign in to join"
                        : "Sign in to view league"}
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

                {phase === "preview" && (
                  <div className="space-y-3">
                    {errorMsg && (
                      <p
                        role="alert"
                        className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                      >
                        {errorMsg}
                      </p>
                    )}
                    <Button
                      onClick={() => void join()}
                      className="w-full min-h-11 whitespace-normal h-auto py-3"
                    >
                      {league.registration_open
                        ? "Join league"
                        : "Check my membership"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => navigate("/player/leagues")}
                    >
                      My leagues
                    </Button>
                  </div>
                )}
              </>
            )}

          {phase === "success" && league && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="text-2xl font-bold break-words">
                  You joined {league.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You're in. Check your schedule and standings any time.
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => navigate(`/player/leagues/${league.id}`)}
                  className="w-full min-h-11 h-auto whitespace-normal py-3"
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
    </LeagueScope>
  );
}
